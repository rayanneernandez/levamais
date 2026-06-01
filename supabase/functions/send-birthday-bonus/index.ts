// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Store {
  id: string;
  network_id: string;
  loyalty_type: string;
  birthday_bonus_points: number;
  birthday_bonus_cashback: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🎂 Iniciando envio de bônus de aniversário...");

    // Buscar clientes que fazem aniversário hoje
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayFormatted = `${month}-${day}`;

    console.log(`Buscando clientes com aniversário em ${todayFormatted}`);

    // Buscar clientes cujo birth_date tem o mesmo mês e dia de hoje
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, full_name, birth_date, network_id")
      .not("birth_date", "is", null)
      .like("birth_date", `%${todayFormatted}%`); // Formato: YYYY-MM-DD

    if (clientsError) {
      console.error("Erro ao buscar clientes:", clientsError);
      throw clientsError;
    }

    if (!clients || clients.length === 0) {
      console.log("Nenhum cliente encontrado com aniversário hoje.");
      return new Response(
        JSON.stringify({ message: "Nenhum aniversariante hoje", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`Encontrados ${clients.length} clientes aniversariantes`);

    let processedCount = 0;
    const results = [];

    // Processar cada cliente
    for (const client of clients) {
      try {
        // Buscar a loja da rede favorita do cliente
        const { data: store, error: storeError } = await supabase
          .from("stores")
          .select("id, network_id, loyalty_type, birthday_bonus_points, birthday_bonus_cashback")
          .eq("network_id", client.network_id)
          .limit(1)
          .single();

        if (storeError || !store) {
          console.error(`Erro ao buscar loja para cliente ${client.id}:`, storeError);
          continue;
        }

        const bonusValue = store.loyalty_type === "points"
          ? store.birthday_bonus_points
          : store.birthday_bonus_cashback;

        // Verificar se há bônus configurado
        if (!bonusValue || bonusValue <= 0) {
          console.log(`Cliente ${client.full_name} não tem bônus de aniversário configurado`);
          continue;
        }

        // Verificar se já recebeu o bônus este ano
        const currentYear = today.getFullYear();
        const startOfYear = new Date(currentYear, 0, 1).toISOString();
        const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59).toISOString();

        const { data: existingBonus, error: checkError } = await supabase
          .from("balance_adjustments")
          .select("id")
          .eq("client_id", client.id)
          .eq("network_id", client.network_id)
          .eq("adjustment_type", "birthday_bonus")
          .gte("created_at", startOfYear)
          .lte("created_at", endOfYear)
          .limit(1);

        if (checkError) {
          console.error(`Erro ao verificar bônus existente para ${client.id}:`, checkError);
          continue;
        }

        if (existingBonus && existingBonus.length > 0) {
          console.log(`Cliente ${client.full_name} já recebeu o bônus de aniversário este ano`);
          continue;
        }

        // Creditar o bônus
        const adjustmentData = {
          client_id: client.id,
          network_id: client.network_id,
          adjustment_type: "birthday_bonus",
          amount: bonusValue,
          reason: `🎂 Bônus de Aniversário - Parabéns ${client.full_name}!`,
          adjusted_by: "00000000-0000-0000-0000-000000000000", // Sistema
        };

        const { error: adjustmentError } = await supabase
          .from("balance_adjustments")
          .insert(adjustmentData);

        if (adjustmentError) {
          console.error(`Erro ao criar ajuste para ${client.id}:`, adjustmentError);
          continue;
        }

        // Atualizar o saldo do cliente
        const fieldToUpdate = store.loyalty_type === "points" 
          ? "total_points" 
          : "total_points"; // Ambos usam total_points na tabela clients

        const { error: updateError } = await supabase.rpc("increment", {
          table_name: "clients",
          row_id: client.id,
          field_name: fieldToUpdate,
          increment_value: bonusValue,
        });

        if (updateError) {
          // Tentar update direto se RPC falhar
          const { data: currentClient } = await supabase
            .from("clients")
            .select("total_points")
            .eq("id", client.id)
            .single();

          if (currentClient) {
            await supabase
              .from("clients")
              .update({ 
                total_points: (currentClient.total_points || 0) + bonusValue 
              })
              .eq("id", client.id);
          }
        }

        console.log(
          `✅ Bônus de ${bonusValue} ${store.loyalty_type === "points" ? "pontos" : "R$"} creditado para ${client.full_name}`
        );

        processedCount++;
        results.push({
          client_id: client.id,
          client_name: client.full_name,
          bonus_value: bonusValue,
          loyalty_type: store.loyalty_type,
          success: true,
        });

      } catch (error) {
        console.error(`Erro ao processar cliente ${client.id}:`, error);
        results.push({
          client_id: client.id,
          client_name: client.full_name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log(`✨ Processamento concluído: ${processedCount}/${clients.length} clientes`);

    return new Response(
      JSON.stringify({
        message: `Bônus de aniversário enviado para ${processedCount} cliente(s)`,
        total_birthdays: clients.length,
        processed: processedCount,
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Erro geral:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
