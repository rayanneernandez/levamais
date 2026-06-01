import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CancelContractRequest {
  network_id: string;
  penalty_percentage: number;
  penalty_amount: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { network_id, penalty_percentage, penalty_amount }: CancelContractRequest = await req.json();

    console.log("🚫 Iniciando cancelamento de contrato para network:", network_id);

    // 1. Buscar dados da network
    const { data: network, error: networkError } = await supabase
      .from("networks")
      .select("*")
      .eq("id", network_id)
      .single();

    if (networkError || !network) {
      throw new Error("Rede não encontrada");
    }

    if (!network.contract_end_date) {
      throw new Error("Rede não possui data de término de contrato definida");
    }

    // 2. Buscar configuração Asaas
    const { data: asaasConfig, error: configError } = await supabase
      .from("asaas_config")
      .select("*")
      .eq("is_active", true)
      .single();

    if (configError || !asaasConfig) {
      throw new Error("Configuração Asaas não encontrada");
    }

    const asaasApiKey = asaasConfig.is_sandbox 
      ? asaasConfig.api_key_sandbox 
      : asaasConfig.api_key_production;
    
    const asaasUrl = asaasConfig.is_sandbox
      ? asaasConfig.sandbox_api_url
      : asaasConfig.production_api_url;

    if (!network.asaas_customer_id) {
      throw new Error("Rede não possui cliente Asaas vinculado");
    }

    // 3. Criar cobrança de multa rescisória no Asaas
    const today = new Date();
    const dueDatePenalty = new Date(today);
    dueDatePenalty.setDate(dueDatePenalty.getDate() + 7); // Vencimento em 7 dias

    const penaltyChargeData = {
      customer: network.asaas_customer_id,
      billingType: "BOLETO",
      value: penalty_amount,
      dueDate: dueDatePenalty.toISOString().split('T')[0],
      description: `Multa Rescisória - ${network.name} - Cancelamento antecipado (${penalty_percentage}%)`,
      externalReference: `penalty_${network_id}_${today.getTime()}`,
    };

    console.log("💰 Criando cobrança de multa no Asaas:", penaltyChargeData);

    const penaltyResponse = await fetch(`${asaasUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": asaasApiKey,
      },
      body: JSON.stringify(penaltyChargeData),
    });

    if (!penaltyResponse.ok) {
      const errorData = await penaltyResponse.json();
      console.error("❌ Erro ao criar multa no Asaas:", errorData);
      throw new Error(`Erro ao criar multa no Asaas: ${JSON.stringify(errorData)}`);
    }

    const penaltyResult = await penaltyResponse.json();

    // 4. Salvar cobrança de multa no banco
    const { data: savedPenalty, error: penaltySaveError } = await supabase
      .from("asaas_charges")
      .insert({
        network_id: network_id,
        asaas_charge_id: penaltyResult.id,
        charge_type: "penalty",
        amount: penalty_amount,
        status: penaltyResult.status,
        due_date: dueDatePenalty.toISOString().split('T')[0],
        billing_type: "BOLETO",
        bank_slip_url: penaltyResult.bankSlipUrl,
        invoice_url: penaltyResult.invoiceUrl,
        description: penaltyChargeData.description,
        is_penalty: true,
        penalty_percentage: penalty_percentage,
        original_contract_end_date: network.contract_end_date,
      })
      .select()
      .single();

    if (penaltySaveError) {
      console.error("❌ Erro ao salvar multa:", penaltySaveError);
      throw penaltySaveError;
    }

    console.log("✅ Multa criada com sucesso:", penaltyResult.id);

    // 5. Cancelar todas as cobranças pendentes futuras
    const { data: pendingCharges, error: pendingError } = await supabase
      .from("asaas_charges")
      .select("*")
      .eq("network_id", network_id)
      .eq("status", "PENDING")
      .gte("due_date", today.toISOString().split('T')[0]);

    if (!pendingError && pendingCharges) {
      console.log(`🗑️ Cancelando ${pendingCharges.length} cobranças pendentes...`);

      for (const charge of pendingCharges) {
        try {
          const cancelResponse = await fetch(`${asaasUrl}/payments/${charge.asaas_charge_id}`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              "access_token": asaasApiKey,
            },
          });

          if (cancelResponse.ok) {
            await supabase
              .from("asaas_charges")
              .update({ status: "REFUNDED" })
              .eq("id", charge.id);
            
            console.log("✅ Cobrança cancelada:", charge.asaas_charge_id);
          }
        } catch (cancelError) {
          console.error("❌ Erro ao cancelar cobrança:", charge.asaas_charge_id, cancelError);
        }
      }
    }

    // 6. Atualizar status do contrato da network
    const { error: updateError } = await supabase
      .from("networks")
      .update({
        contract_status: "cancelled",
        status: "inactive",
      })
      .eq("id", network_id);

    if (updateError) {
      console.error("❌ Erro ao atualizar status da network:", updateError);
      throw updateError;
    }

    console.log("✅ Contrato cancelado com sucesso");

    return new Response(
      JSON.stringify({
        success: true,
        penalty_charge: savedPenalty,
        summary: {
          penalty_amount: penalty_amount,
          penalty_percentage: penalty_percentage,
          due_date: dueDatePenalty.toISOString().split('T')[0],
          cancelled_charges: pendingCharges?.length || 0,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("❌ Erro em cancel-network-contract:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
