import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge Function para gerar cobranças mensais recorrentes
 * Deve ser executada via Cron diariamente para verificar networks que precisam de cobrança
 */

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("🔄 Iniciando geração de cobranças mensais recorrentes...");

    const today = new Date();
    const currentDay = today.getDate();
    
    // Calcular qual billing_day deve ser gerado hoje (7 dias antes do vencimento)
    // Se hoje é dia 2, gerar boletos para vencimento dia 9 (2 + 7 = 9)
    const targetBillingDay = currentDay + 7;

    console.log(`📅 Hoje é dia ${currentDay}, gerando boletos para vencimento no dia ${targetBillingDay}`);

    // Buscar configuração Asaas
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

    // Buscar todas as networks ativas, implantadas e com billing_day = currentDay + 7
    const { data: networks, error: networksError } = await supabase
      .from("networks")
      .select("*")
      .eq("status", "active")
      .eq("implantado", true)
      .eq("billing_day", targetBillingDay)
      .not("asaas_customer_id", "is", null);

    if (networksError) {
      throw new Error(`Erro ao buscar networks: ${networksError.message}`);
    }

    if (!networks || networks.length === 0) {
      console.log(`ℹ️ Nenhuma network para gerar boletos hoje (vencimento dia ${targetBillingDay})`);
      return new Response(
        JSON.stringify({
          success: true,
          message: `Nenhuma network com vencimento no dia ${targetBillingDay}`,
          processed: 0,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`📋 Encontradas ${networks.length} network(s) para cobrar hoje`);

    const results = [];

    // Processar cada network
    for (const network of networks) {
      try {
        console.log(`\n💼 Processando network: ${network.name} (${network.id})`);

        // Calcular data de vencimento (billing_day do mês atual ou próximo)
        const dueDate = new Date(today.getFullYear(), today.getMonth(), targetBillingDay);
        
        // Se o billing_day já passou neste mês, considerar o próximo mês
        if (dueDate < today) {
          dueDate.setMonth(dueDate.getMonth() + 1);
        }

        const dueDateStr = dueDate.toISOString().split('T')[0];

        // Verificar se já existe cobrança para esta data de vencimento
        const { data: existingCharge, error: checkError } = await supabase
          .from("asaas_charges")
          .select("id")
          .eq("network_id", network.id)
          .eq("charge_type", "subscription")
          .eq("due_date", dueDateStr)
          .maybeSingle();

        if (existingCharge) {
          console.log("⏭️ Cobrança já existe para este mês, pulando...");
          results.push({
            network_id: network.id,
            network_name: network.name,
            status: "skipped",
            reason: "Cobrança já existe para este mês",
          });
          continue;
        }

        // Criar cobrança(s) no Asaas com base no billing_type
        if (network.billing_type === 'per_cnpj' && network.cnpjs && network.cnpjs.length > 0) {
          // Modo: Um boleto por CNPJ
          console.log(`📋 Modo: Um boleto por CNPJ (${network.cnpjs.length} boletos)`);
          const valuePerCnpj = network.monthly_fee / network.cnpjs.length;
          
          for (const cnpj of network.cnpjs) {
            const chargeData = {
              customer: network.asaas_customer_id,
              billingType: "BOLETO",
              value: valuePerCnpj,
              dueDate: dueDateStr,
              description: `Mensalidade - ${network.name} - CNPJ ${cnpj} - ${dueDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
              externalReference: `monthly_${network.id}_${cnpj}_${dueDate.getTime()}`,
              daysAfterDueDateToRegistrationCancellation: 30,
              fine: {
                value: 2
              },
              interest: {
                value: 1
              }
            };

            console.log(`💰 Criando cobrança para CNPJ ${cnpj}:`, chargeData.value);

            const chargeResponse = await fetch(`${asaasUrl}/payments`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "access_token": asaasApiKey,
              },
              body: JSON.stringify(chargeData),
            });

            if (!chargeResponse.ok) {
              const errorData = await chargeResponse.json();
              console.error(`❌ Erro ao criar cobrança para CNPJ ${cnpj}:`, errorData);
              continue;
            }

            const chargeResult = await chargeResponse.json();

            // Salvar no banco
            const { data: savedCharge, error: saveError } = await supabase
              .from("asaas_charges")
              .insert({
                network_id: network.id,
                asaas_charge_id: chargeResult.id,
                charge_type: "subscription",
                amount: valuePerCnpj,
                status: chargeResult.status,
                due_date: dueDateStr,
                billing_type: "BOLETO",
                bank_slip_url: chargeResult.bankSlipUrl,
                invoice_url: chargeResult.invoiceUrl,
                description: chargeData.description,
              })
              .select()
              .single();

            if (saveError) {
              console.error(`❌ Erro ao salvar cobrança para CNPJ ${cnpj}:`, saveError);
            } else {
              console.log(`✅ Cobrança criada para CNPJ ${cnpj}:`, chargeResult.id);
            }
          }

          results.push({
            network_id: network.id,
            network_name: network.name,
            status: "success",
            mode: "per_cnpj",
            charges_created: network.cnpjs.length,
          });

        } else {
          // Modo: Boleto único consolidado
          console.log("📋 Modo: Boleto único consolidado");
          
          const chargeData = {
            customer: network.asaas_customer_id,
            billingType: "BOLETO",
            value: network.monthly_fee,
            dueDate: dueDateStr,
            description: `Mensalidade - ${network.name} - ${dueDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
            externalReference: `monthly_${network.id}_${dueDate.getTime()}`,
            daysAfterDueDateToRegistrationCancellation: 30,
            fine: {
              value: 2
            },
            interest: {
              value: 1
            }
          };

          console.log("💰 Criando cobrança:", chargeData);

          const chargeResponse = await fetch(`${asaasUrl}/payments`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "access_token": asaasApiKey,
            },
            body: JSON.stringify(chargeData),
          });

          if (!chargeResponse.ok) {
            const errorData = await chargeResponse.json();
            console.error("❌ Erro ao criar cobrança no Asaas:", errorData);
            
            results.push({
              network_id: network.id,
              network_name: network.name,
              status: "error",
              error: JSON.stringify(errorData),
            });
            continue;
          }

          const chargeResult = await chargeResponse.json();

          // Salvar no banco
          const { data: savedCharge, error: saveError } = await supabase
            .from("asaas_charges")
            .insert({
              network_id: network.id,
              asaas_charge_id: chargeResult.id,
              charge_type: "subscription",
              amount: network.monthly_fee,
              status: chargeResult.status,
              due_date: dueDateStr,
              billing_type: "BOLETO",
              bank_slip_url: chargeResult.bankSlipUrl,
              invoice_url: chargeResult.invoiceUrl,
              description: chargeData.description,
            })
            .select()
            .single();

          if (saveError) {
            console.error("❌ Erro ao salvar cobrança:", saveError);
            results.push({
              network_id: network.id,
              network_name: network.name,
              status: "error",
              error: saveError.message,
            });
          } else {
            console.log("✅ Cobrança criada com sucesso:", chargeResult.id);
            results.push({
              network_id: network.id,
              network_name: network.name,
              status: "success",
              mode: "single_cnpj",
              charge_id: savedCharge.id,
              asaas_charge_id: chargeResult.id,
              amount: network.monthly_fee,
            });
          }
        }

      } catch (networkError: any) {
        console.error(`❌ Erro ao processar network ${network.name}:`, networkError);
        results.push({
          network_id: network.id,
          network_name: network.name,
          status: "error",
          error: networkError.message,
        });
      }
    }

    const successCount = results.filter(r => r.status === "success").length;
    const errorCount = results.filter(r => r.status === "error").length;
    const skippedCount = results.filter(r => r.status === "skipped").length;

    console.log("\n📊 Resumo:");
    console.log(`✅ Sucesso: ${successCount}`);
    console.log(`❌ Erro: ${errorCount}`);
    console.log(`⏭️ Puladas: ${skippedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: networks.length,
        summary: {
          success: successCount,
          error: errorCount,
          skipped: skippedCount,
        },
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("❌ Erro em generate-monthly-charges:", error);
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
