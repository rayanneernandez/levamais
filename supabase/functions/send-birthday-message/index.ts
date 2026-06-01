// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper para substituir variáveis na mensagem
function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  });
  return result;
}

// Helper para formatar valor monetário
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🎂 Iniciando envio de mensagens de aniversário...");

    // Buscar clientes que fazem aniversário hoje
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayFormatted = `${month}-${day}`;

    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, full_name, birth_date, network_id, email, phone")
      .not("birth_date", "is", null)
      .like("birth_date", `%${todayFormatted}%`);

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
        // Buscar templates de aniversário habilitados para envio automático
        const { data: templates, error: templatesError } = await supabase
          .from("marketing_message_templates")
          .select("*")
          .eq("network_id", client.network_id)
          .eq("template_type", "aniversario")
          .eq("auto_send_enabled", true)
          .eq("is_active", true);

        if (templatesError) {
          console.error(`Erro ao buscar templates para cliente ${client.id}:`, templatesError);
          continue;
        }

        if (!templates || templates.length === 0) {
          console.log(`Cliente ${client.full_name} não tem templates de aniversário automáticos`);
          continue;
        }

        // Buscar valor do bônus de aniversário
        const { data: store } = await supabase
          .from("stores")
          .select("birthday_bonus_points, birthday_bonus_cashback, loyalty_type")
          .eq("network_id", client.network_id)
          .limit(1)
          .single();

        const bonusValue = store?.loyalty_type === "points"
          ? (store?.birthday_bonus_points || 0)
          : (store?.birthday_bonus_cashback || 0);

        // Buscar saldo atual
        const { data: clientData } = await supabase
          .from("clients")
          .select("total_points")
          .eq("id", client.id)
          .single();

        const variables = {
          nome: client.full_name || "Cliente",
          valor: formatCurrency(bonusValue),
          saldo: formatCurrency(clientData?.total_points || 0),
        };

        const messagesSent = [];

        // Enviar mensagem para cada canal configurado
        for (const template of templates) {
          try {
            const message = replaceVariables(template.message_content, variables);
            const subject = template.subject ? replaceVariables(template.subject, variables) : undefined;
            
            console.log(`Enviando via ${template.channel} para ${client.full_name}`);
            
            // TODO: Integrar com serviços reais de envio
            if (template.channel === "email" && client.email) {
              console.log(`📧 Email: ${subject} - ${message}`);
              messagesSent.push({ channel: "email", success: true });
            } else if (template.channel === "whatsapp" && client.phone) {
              console.log(`📱 WhatsApp: ${message}`);
              messagesSent.push({ channel: "whatsapp", success: true });
            } else if (template.channel === "sms" && client.phone) {
              console.log(`💬 SMS: ${message}`);
              messagesSent.push({ channel: "sms", success: true });
            }
          } catch (error) {
            console.error(`Erro ao enviar via ${template.channel}:`, error);
            messagesSent.push({ 
              channel: template.channel, 
              success: false, 
              error: error instanceof Error ? error.message : String(error) 
            });
          }
        }

        if (messagesSent.length > 0) {
          processedCount++;
          results.push({
            client_id: client.id,
            client_name: client.full_name,
            messages_sent: messagesSent,
          });
        }

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
        message: `Mensagens de aniversário enviadas para ${processedCount} cliente(s)`,
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
