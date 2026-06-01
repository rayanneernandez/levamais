// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateChargesRequest {
  budget_id: string;
  network_id: string;
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

    const { budget_id, network_id }: CreateChargesRequest = await req.json();

    console.log("🚀 Iniciando criação de cobranças para orçamento:", budget_id);

    // 1. Buscar dados do orçamento
    const { data: budget, error: budgetError } = await supabase
      .from("budgets")
      .select("*")
      .eq("id", budget_id)
      .single();

    if (budgetError || !budget) {
      throw new Error("Orçamento não encontrado");
    }

    // 2. Buscar dados da network
    const { data: network, error: networkError } = await supabase
      .from("networks")
      .select("*")
      .eq("id", network_id)
      .single();

    if (networkError || !network) {
      throw new Error("Rede não encontrada");
    }

    // 3. Buscar configuração Asaas
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

    // 4. Criar ou buscar cliente no Asaas
    let asaasCustomerId = network.asaas_customer_id;

    if (!asaasCustomerId) {
      console.log("📝 Verificando se cliente já existe no Asaas...");
      
      // Primeiro buscar se já existe um cliente com este CNPJ no Asaas
      const cnpjClean = network.cnpj?.replace(/\D/g, '');
      if (cnpjClean) {
        const searchResponse = await fetch(
          `${asaasUrl}/customers?cpfCnpj=${cnpjClean}`,
          {
            headers: {
              "Content-Type": "application/json",
              "access_token": asaasApiKey,
            },
          }
        );

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.data && searchData.data.length > 0) {
            // Cliente já existe no Asaas, usar o existente
            asaasCustomerId = searchData.data[0].id;
            console.log("✅ Cliente já existe no Asaas (por CNPJ):", asaasCustomerId);
            
            // Atualizar network com customer_id
            await supabase
              .from("networks")
              .update({ asaas_customer_id: asaasCustomerId })
              .eq("id", network_id);
          }
        }
      }

      // Se não encontrou, criar novo
      if (!asaasCustomerId) {
        console.log("📝 Criando novo cliente no Asaas...");
        
        const customerData = {
          name: network.name,
          email: network.financial_contact_email || network.email,
          phone: network.phone?.replace(/\D/g, ''),
          cpfCnpj: cnpjClean,
          postalCode: network.cep?.replace(/\D/g, ''),
          address: network.street,
          addressNumber: network.number,
          complement: network.complement,
          province: network.neighborhood,
          externalReference: network.id,
        };

        const createCustomerResponse = await fetch(`${asaasUrl}/customers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "access_token": asaasApiKey,
          },
          body: JSON.stringify(customerData),
        });

        if (!createCustomerResponse.ok) {
          const errorData = await createCustomerResponse.json();
          throw new Error(`Erro ao criar cliente Asaas: ${JSON.stringify(errorData)}`);
        }

        const customerResult = await createCustomerResponse.json();
        asaasCustomerId = customerResult.id;

        // Atualizar network com customer_id
        await supabase
          .from("networks")
          .update({ asaas_customer_id: asaasCustomerId })
          .eq("id", network_id);

        console.log("✅ Cliente criado no Asaas:", asaasCustomerId);
      }
    }

    // 5. Calcular datas e valores
    const today = new Date();
    const approvalDate = budget.approved_at ? new Date(budget.approved_at) : today;
    const billingDay = network.billing_day || 5;

    // Data de vencimento da implantação: 3 dias após a geração (hoje)
    const implementationDueDate = new Date(today);
    implementationDueDate.setDate(implementationDueDate.getDate() + 3);

    // Calcular pro-rata do primeiro mês
    const lastDayOfMonth = new Date(approvalDate.getFullYear(), approvalDate.getMonth() + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const dayOfApproval = approvalDate.getDate();
    const remainingDays = daysInMonth - dayOfApproval + 1;
    const prorataValue = (network.monthly_fee / daysInMonth) * remainingDays;

    // Data de vencimento do pro-rata: dia de cobrança do próximo mês
    const prorataDueDate = new Date(approvalDate.getFullYear(), approvalDate.getMonth() + 1, billingDay);
    
    // Na primeira cobrança mensal (mês seguinte), incluir pro-rata + mensalidade completa
    const firstMonthlyValue = prorataValue + network.monthly_fee;

    console.log("📊 Cálculos:");
    console.log("- Valor implantação:", network.valor_implantacao);
    console.log("- Vencimento implantação:", implementationDueDate.toISOString().split('T')[0]);
    console.log("- Pro-rata (", remainingDays, "dias):", prorataValue.toFixed(2));
    console.log("- Primeira mensalidade (pro-rata + mês completo):", firstMonthlyValue.toFixed(2));
    console.log("- Billing type:", network.billing_type);

    const createdCharges = [];

    // 6. COBRANÇA DE IMPLANTAÇÃO (se houver valor)
    if (network.valor_implantacao && network.valor_implantacao > 0) {
      console.log("💰 Criando cobrança de implantação...");

      const implChargeData = {
        customer: asaasCustomerId,
        billingType: "BOLETO",
        value: network.valor_implantacao,
        dueDate: implementationDueDate.toISOString().split('T')[0],
        description: `Implantação - ${network.name} - Orçamento ${budget.budget_number}`,
        externalReference: `impl_${budget_id}`,
        daysAfterDueDateToRegistrationCancellation: 30,
        fine: {
          value: 2 // 2% de multa após vencimento
        },
        interest: {
          value: 1 // 1% de juros ao mês
        }
      };

      const implChargeResponse = await fetch(`${asaasUrl}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": asaasApiKey,
        },
        body: JSON.stringify(implChargeData),
      });

      if (!implChargeResponse.ok) {
        const errorData = await implChargeResponse.json();
        console.error("❌ Erro ao criar cobrança de implantação:", errorData);
        throw new Error(`Erro ao criar cobrança de implantação: ${JSON.stringify(errorData)}`);
      }

      const implChargeResult = await implChargeResponse.json();

      // Salvar no banco
      const { data: savedImplCharge, error: implChargeError } = await supabase
        .from("asaas_charges")
        .insert({
          network_id: network_id,
          asaas_charge_id: implChargeResult.id,
          charge_type: "implementation",
          amount: network.valor_implantacao,
          status: implChargeResult.status,
          due_date: implementationDueDate.toISOString().split('T')[0],
          billing_type: "BOLETO",
          bank_slip_url: implChargeResult.bankSlipUrl,
          invoice_url: implChargeResult.invoiceUrl,
          description: implChargeData.description,
        })
        .select()
        .single();

      if (implChargeError) {
        console.error("❌ Erro ao salvar cobrança de implantação:", implChargeError);
      } else {
        createdCharges.push(savedImplCharge);
        console.log("✅ Cobrança de implantação criada:", implChargeResult.id);
      }
    }

    // 7. PRIMEIRA COBRANÇA MENSAL (pro-rata + mês seguinte completo)
    // Respeitar billing_type: per_cnpj ou single_cnpj
    console.log("💰 Criando primeira(s) cobrança(s) mensal(is)...");

    if (network.billing_type === 'per_cnpj' && network.cnpjs && network.cnpjs.length > 0) {
      // Gerar um boleto para cada CNPJ
      console.log("📋 Modo: Um boleto por CNPJ");
      const valuePerCnpj = firstMonthlyValue / network.cnpjs.length;
      
      for (const cnpj of network.cnpjs) {
        const monthlyChargeData = {
          customer: asaasCustomerId,
          billingType: "BOLETO",
          value: valuePerCnpj,
          dueDate: prorataDueDate.toISOString().split('T')[0],
          description: `Mensalidade - ${network.name} - CNPJ ${cnpj} - Pro-rata + Mês seguinte`,
          externalReference: `monthly_${budget_id}_${cnpj}_${prorataDueDate.getTime()}`,
          daysAfterDueDateToRegistrationCancellation: 30,
          fine: {
            value: 2
          },
          interest: {
            value: 1
          }
        };

        const monthlyResponse = await fetch(`${asaasUrl}/payments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "access_token": asaasApiKey,
          },
          body: JSON.stringify(monthlyChargeData),
        });

        if (!monthlyResponse.ok) {
          const errorData = await monthlyResponse.json();
          console.error(`❌ Erro ao criar mensalidade para CNPJ ${cnpj}:`, errorData);
          continue;
        }

        const monthlyResult = await monthlyResponse.json();

        const { data: savedCharge } = await supabase
          .from("asaas_charges")
          .insert({
            network_id: network_id,
            asaas_charge_id: monthlyResult.id,
            charge_type: "subscription",
            amount: valuePerCnpj,
            status: monthlyResult.status,
            due_date: prorataDueDate.toISOString().split('T')[0],
            billing_type: "BOLETO",
            bank_slip_url: monthlyResult.bankSlipUrl,
            invoice_url: monthlyResult.invoiceUrl,
            description: monthlyChargeData.description,
          })
          .select()
          .single();

        if (savedCharge) {
          createdCharges.push(savedCharge);
          console.log(`✅ Mensalidade criada para CNPJ ${cnpj}:`, monthlyResult.id);
        }
      }
    } else {
      // Gerar um único boleto consolidado
      console.log("📋 Modo: Boleto único consolidado");
      
      const firstMonthlyChargeData = {
        customer: asaasCustomerId,
        billingType: "BOLETO",
        value: firstMonthlyValue,
        dueDate: prorataDueDate.toISOString().split('T')[0],
        description: `Mensalidade - ${network.name} - Pro-rata + Mês seguinte`,
        externalReference: `monthly_${budget_id}_${prorataDueDate.getTime()}`,
        daysAfterDueDateToRegistrationCancellation: 30,
        fine: {
          value: 2
        },
        interest: {
          value: 1
        }
      };

      const firstMonthlyResponse = await fetch(`${asaasUrl}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": asaasApiKey,
        },
        body: JSON.stringify(firstMonthlyChargeData),
      });

      if (!firstMonthlyResponse.ok) {
        const errorData = await firstMonthlyResponse.json();
        console.error("❌ Erro ao criar primeira mensalidade:", errorData);
        throw new Error(`Erro ao criar primeira mensalidade: ${JSON.stringify(errorData)}`);
      }

      const firstMonthlyResult = await firstMonthlyResponse.json();

      const { data: savedMonthlyCharge, error: monthlyChargeError } = await supabase
        .from("asaas_charges")
        .insert({
          network_id: network_id,
          asaas_charge_id: firstMonthlyResult.id,
          charge_type: "subscription",
          amount: firstMonthlyValue,
          status: firstMonthlyResult.status,
          due_date: prorataDueDate.toISOString().split('T')[0],
          billing_type: "BOLETO",
          bank_slip_url: firstMonthlyResult.bankSlipUrl,
          invoice_url: firstMonthlyResult.invoiceUrl,
          description: firstMonthlyChargeData.description,
        })
        .select()
        .single();

      if (monthlyChargeError) {
        console.error("❌ Erro ao salvar primeira mensalidade:", monthlyChargeError);
      } else {
        createdCharges.push(savedMonthlyCharge);
        console.log("✅ Primeira mensalidade criada:", firstMonthlyResult.id);
      }
    }

    // 8. Marcar network como implantada e definir datas de contrato
    const contractStartDate = approvalDate.toISOString().split('T')[0];
    const contractEndDate = new Date(approvalDate);
    contractEndDate.setMonth(contractEndDate.getMonth() + (network.contract_duration_months || 12));

    await supabase
      .from("networks")
      .update({ 
        implantado: true,
        contract_start_date: contractStartDate,
        contract_end_date: contractEndDate.toISOString().split('T')[0],
        contract_status: 'active',
      })
      .eq("id", network_id);

    console.log("🎉 Todas as cobranças criadas com sucesso!");

    return new Response(
      JSON.stringify({
        success: true,
        charges: createdCharges,
        summary: {
          implementation: network.valor_implantacao || 0,
          prorata: prorataValue,
          first_monthly: firstMonthlyValue,
          total_charged: (network.valor_implantacao || 0) + firstMonthlyValue,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("❌ Erro em create-network-charges:", error);
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
