// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ApprovalRequest {
  budget_id: string;
  approval_token: string;
  approved_by_name: string;
  approved_by_cpf: string;
  approved_by_email: string;
  approved_by_position: string;
  payment_due_days: number;
  financial_email?: string;
  latitude?: number | null;
  longitude?: number | null;
  billing_day?: number;
  billing_type?: 'per_cnpj' | 'single_cnpj';
  main_billing_cnpj?: string | null;
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

    const requestData: ApprovalRequest = await req.json();

    // Buscar o orçamento
    const { data: budget, error: budgetError } = await supabase
      .from("budgets")
      .select("*")
      .eq("id", requestData.budget_id)
      .eq("approval_token", requestData.approval_token)
      .single();

    if (budgetError || !budget) {
      throw new Error("Orçamento não encontrado ou token inválido");
    }

    if (budget.status === 'approved') {
      throw new Error("Este orçamento já foi aprovado");
    }

    // Coletar dados de auditoria
    const ip_address = req.headers.get("x-forwarded-for") || "unknown";
    const user_agent = req.headers.get("user-agent") || "unknown";
    const approval_timestamp = new Date().toISOString();

    // Gerar hash do documento para auditoria usando Web Crypto API
    const documentData = JSON.stringify({
      budget_id: requestData.budget_id,
      budget_number: budget.budget_number,
      approved_by: requestData.approved_by_name,
      approved_by_cpf: requestData.approved_by_cpf,
      approved_by_email: requestData.approved_by_email,
      timestamp: approval_timestamp,
      ip: ip_address,
      total_value: budget.total_value,
    });

    const encoder = new TextEncoder();
    const data = encoder.encode(documentData);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const document_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Criar assinatura digital (simplificado)
    const signatureData = `${requestData.approved_by_cpf}-${approval_timestamp}-${document_hash}`;
    const signatureBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(signatureData));
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signature = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // ============= ASSINATURA AUTOMÁTICA DA BISW =============
    // Dados fixos do representante da BISW
    const biswData = {
      name: "Bruno Lyra Lima",
      cpf: "13678233740",
      email: "bruno.lyra@levamais.app",
      position: "Diretor Comercial",
      ip: "187.102.169.26",
      latitude: -22.9718227,
      longitude: -43.3744525,
    };

    const bisw_approval_timestamp = new Date().toISOString();

    // Gerar hash do documento para assinatura BISW
    const biswDocumentData = JSON.stringify({
      budget_id: requestData.budget_id,
      budget_number: budget.budget_number,
      approved_by_bisw: biswData.name,
      approved_by_cpf_bisw: biswData.cpf,
      approved_by_email_bisw: biswData.email,
      timestamp: bisw_approval_timestamp,
      ip: biswData.ip,
      total_value: budget.total_value,
      client_signature: signature, // Incluir assinatura do cliente no hash da BISW
    });

    const biswHashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(biswDocumentData));
    const biswHashArray = Array.from(new Uint8Array(biswHashBuffer));
    const bisw_document_hash = biswHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Criar assinatura digital da BISW
    const biswSignatureData = `${biswData.cpf}-${bisw_approval_timestamp}-${bisw_document_hash}`;
    const biswSignatureBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(biswSignatureData));
    const biswSignatureArray = Array.from(new Uint8Array(biswSignatureBuffer));
    const bisw_signature = biswSignatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Atualizar orçamento com dados de aprovação do cliente E da BISW
    const { error: updateError } = await supabase
      .from("budgets")
      .update({
        status: 'approved',
        approved_at: approval_timestamp,
        approved_by_name: requestData.approved_by_name,
        approved_by_cpf: requestData.approved_by_cpf,
        approved_by_email: requestData.approved_by_email,
        approved_by_position: requestData.approved_by_position,
        payment_due_days: requestData.payment_due_days,
        financial_email: requestData.financial_email,
        billing_day: requestData.billing_day,
        billing_type: requestData.billing_type,
        main_billing_cnpj: requestData.main_billing_cnpj,
        approval_signature: signature,
        approval_document_hash: document_hash,
        approval_ip: ip_address,
        approval_user_agent: user_agent,
        approval_latitude: requestData.latitude,
        approval_longitude: requestData.longitude,
        // Assinatura da BISW
        bisw_approved_by_name: biswData.name,
        bisw_approved_by_cpf: biswData.cpf,
        bisw_approved_by_email: biswData.email,
        bisw_approved_by_position: biswData.position,
        bisw_approved_at: bisw_approval_timestamp,
        bisw_approval_signature: bisw_signature,
        bisw_approval_document_hash: bisw_document_hash,
        bisw_approval_ip: biswData.ip,
        bisw_approval_user_agent: "BISW Auto-Signature System",
        bisw_approval_latitude: biswData.latitude,
        bisw_approval_longitude: biswData.longitude,
      })
      .eq("id", requestData.budget_id)
      .eq("approval_token", requestData.approval_token);

    if (updateError) throw updateError;

    // Atualizar o email financeiro e dados de faturamento na rede
    if (budget.network_id) {
      const networkUpdates: any = {};
      
      // Dados financeiros
      if (requestData.financial_email) {
        networkUpdates.financial_email = requestData.financial_email;
      }
      
      if (requestData.billing_day) {
        networkUpdates.billing_day = requestData.billing_day;
      }
      
      if (requestData.billing_type) {
        networkUpdates.billing_type = requestData.billing_type;
      }
      
      if (requestData.main_billing_cnpj) {
        networkUpdates.main_billing_cnpj = requestData.main_billing_cnpj;
      }
      
      // Dados do contrato
      const contractStartDate = new Date().toISOString().split('T')[0]; // Data de hoje
      const contractDurationMonths = budget.contract_duration_months || 12;
      const contractEndDate = new Date();
      contractEndDate.setMonth(contractEndDate.getMonth() + contractDurationMonths);
      
      networkUpdates.contract_start_date = contractStartDate;
      networkUpdates.contract_end_date = contractEndDate.toISOString().split('T')[0];
      
      if (budget.contract_duration_months) {
        networkUpdates.contract_duration_months = budget.contract_duration_months;
      }
      
      if (budget.poc_days) {
        networkUpdates.poc_days = budget.poc_days;
      }
      
      // CNPJs da proposta
      if (budget.cnpjs && Array.isArray(budget.cnpjs) && budget.cnpjs.length > 0) {
        // Extrair apenas os CNPJs do array (que podem estar como JSON strings)
        const cnpjList = budget.cnpjs.map((item: any) => {
          try {
            if (typeof item === 'string') {
              const parsed = JSON.parse(item);
              return parsed.cnpj || '';
            } else if (item && typeof item === 'object') {
              return item.cnpj || '';
            }
            return '';
          } catch (e) {
            return '';
          }
        }).filter((cnpj: string) => cnpj !== '');
        
        networkUpdates.cnpjs = cnpjList;
      }
      
      if (Object.keys(networkUpdates).length > 0) {
        const { error: networkUpdateError } = await supabase
          .from("networks")
          .update(networkUpdates)
          .eq("id", budget.network_id);
        
        if (networkUpdateError) {
          console.error("Erro ao atualizar dados da rede:", networkUpdateError);
        } else {
          console.log("✅ Dados da rede atualizados:", budget.network_id, networkUpdates);
        }
      }
    }

    // Atualizar o status do lead para "won" se houver lead vinculado
    if (budget.lead_id) {
      const { error: leadUpdateError } = await supabase
        .from("leads")
        .update({ status: "won" })
        .eq("id", budget.lead_id);
      
      if (leadUpdateError) {
        console.error("Erro ao atualizar status do lead:", leadUpdateError);
      } else {
        console.log("Lead atualizado para status 'won':", budget.lead_id);
      }
    }

    // Criar cobranças automaticamente se houver network_id
    if (budget.network_id) {
      console.log("🔄 Iniciando criação de cobranças para network:", budget.network_id);
      
      try {
        const chargesResponse = await supabase.functions.invoke('create-network-charges', {
          body: {
            budget_id: requestData.budget_id,
            network_id: budget.network_id,
          }
        });

        if (chargesResponse.error) {
          console.error("❌ Erro ao criar cobranças:", chargesResponse.error);
        } else {
          console.log("✅ Cobranças criadas com sucesso:", chargesResponse.data);
        }
      } catch (chargeError) {
        console.error("❌ Erro ao invocar create-network-charges:", chargeError);
        // Não interrompe o fluxo de aprovação se houver erro nas cobranças
      }

      // Criar/atualizar licença automaticamente
      console.log("📋 Criando/atualizando licença da network...");
      try {
        const licenseData: any = {
          network_id: budget.network_id,
          max_stores: budget.cnpjs?.length || 1,
          monthly_fee: budget.services_total || 0,
          billing_day: requestData.billing_day || 5,
        };

        // Verificar se já existe licença
        const { data: existingLicense } = await supabase
          .from("network_licenses")
          .select("id")
          .eq("network_id", budget.network_id)
          .maybeSingle();

        if (existingLicense) {
          // Atualizar licença existente
          await supabase
            .from("network_licenses")
            .update(licenseData)
            .eq("id", existingLicense.id);
          console.log("✅ Licença atualizada");
        } else {
          // Criar nova licença
          await supabase
            .from("network_licenses")
            .insert(licenseData);
          console.log("✅ Licença criada");
        }
      } catch (licenseError) {
        console.error("❌ Erro ao criar/atualizar licença:", licenseError);
      }

      // Pré-cadastrar lojas baseado nos CNPJs
      if (budget.cnpjs && Array.isArray(budget.cnpjs) && budget.cnpjs.length > 0) {
        console.log(`🏪 Pré-cadastrando ${budget.cnpjs.length} loja(s)...`);
        
        for (const cnpjItem of budget.cnpjs) {
          try {
            let cnpj = '';
            let razaoSocial = '';
            
            if (typeof cnpjItem === 'string') {
              const parsed = JSON.parse(cnpjItem);
              cnpj = parsed.cnpj || '';
              razaoSocial = parsed.razao_social || '';
            } else if (cnpjItem && typeof cnpjItem === 'object') {
              cnpj = cnpjItem.cnpj || '';
              razaoSocial = cnpjItem.razao_social || '';
            }

            if (!cnpj) continue;

            // Verificar se loja já existe
            const { data: existingStore } = await supabase
              .from("stores")
              .select("id")
              .eq("network_id", budget.network_id)
              .eq("cnpj", cnpj)
              .maybeSingle();

            if (existingStore) {
              console.log(`⏭️ Loja ${cnpj} já existe, pulando...`);
              continue;
            }

            // Criar loja
            const storeData = {
              network_id: budget.network_id,
              name: razaoSocial || `Loja ${cnpj}`,
              cnpj: cnpj,
              razao_social: razaoSocial,
              is_active: false, // Inativa até configuração completa
            };

            await supabase
              .from("stores")
              .insert(storeData);

            console.log(`✅ Loja pré-cadastrada: ${razaoSocial || cnpj}`);
          } catch (storeError) {
            console.error("❌ Erro ao pré-cadastrar loja:", storeError);
          }
        }
      }
    }

    console.log("Orçamento aprovado:", requestData.budget_id);
    console.log("Hash do documento (Cliente):", document_hash);
    console.log("Assinatura (Cliente):", signature);
    console.log("Hash do documento (BISW):", bisw_document_hash);
    console.log("Assinatura (BISW):", bisw_signature);

    return new Response(
      JSON.stringify({
        success: true,
        client: {
          document_hash,
          signature,
          approved_at: approval_timestamp,
        },
        bisw: {
          document_hash: bisw_document_hash,
          signature: bisw_signature,
          approved_at: bisw_approval_timestamp,
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Erro em approve-budget:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
