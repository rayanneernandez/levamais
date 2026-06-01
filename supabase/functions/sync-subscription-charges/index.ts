import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { subscription_id } = await req.json();

    if (!subscription_id) {
      throw new Error('subscription_id é obrigatório');
    }

    console.log('🔄 Sincronizando cobranças para assinatura:', subscription_id);

    // Buscar a assinatura
    const { data: subscription, error: subError } = await supabase
      .from('client_subscriptions_one')
      .select('*')
      .eq('id', subscription_id)
      .single();

    if (subError || !subscription) {
      throw new Error('Assinatura não encontrada');
    }

    // Buscar configuração do Asaas
    const { data: asaasConfig, error: configError } = await supabase
      .from('asaas_config')
      .select('*')
      .single();

    if (configError || !asaasConfig) {
      throw new Error('Configuração Asaas não encontrada');
    }

    const asaasUrl = asaasConfig.is_sandbox
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://www.asaas.com/api/v3';

    const apiKey = asaasConfig.is_sandbox
      ? asaasConfig.api_key_sandbox
      : asaasConfig.api_key_production;

    if (!apiKey) {
      throw new Error('API Key do Asaas não configurada');
    }

    // Buscar cobranças do Asaas
    console.log('🔍 Buscando cobranças no Asaas para subscription:', subscription.asaas_subscription_id);
    
    const paymentsResponse = await fetch(
      `${asaasUrl}/payments?subscription=${subscription.asaas_subscription_id}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'access_token': apiKey
        }
      }
    );

    const paymentsData = await paymentsResponse.json();

    if (!paymentsResponse.ok) {
      console.error('Erro ao buscar cobranças:', paymentsData);
      throw new Error('Erro ao buscar cobranças no Asaas');
    }

    console.log(`📋 ${paymentsData.data?.length || 0} cobranças encontradas no Asaas`);

    if (!paymentsData.data || paymentsData.data.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhuma cobrança encontrada no Asaas',
          synced: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Verificar quais cobranças já existem no banco
    const { data: existingCharges } = await supabase
      .from('asaas_charges')
      .select('asaas_charge_id')
      .eq('subscription_id', subscription_id);

    const existingIds = new Set(existingCharges?.map(c => c.asaas_charge_id) || []);

    // Inserir cobranças que ainda não existem
    let syncedCount = 0;
    for (const payment of paymentsData.data) {
      if (!existingIds.has(payment.id)) {
        const { error: insertError } = await supabase
          .from('asaas_charges')
          .insert({
            network_id: subscription.network_id,
            subscription_id: subscription_id,
            asaas_charge_id: payment.id,
            charge_type: 'subscription',
            amount: payment.value,
            due_date: payment.dueDate,
            status: payment.status,
            billing_type: payment.billingType,
            description: payment.description || `Cobrança Leva+ One`,
            invoice_url: payment.invoiceUrl,
            bank_slip_url: payment.bankSlipUrl,
            payment_date: payment.paymentDate,
            confirmed_at: payment.confirmedDate
          });

        if (!insertError) {
          syncedCount++;
          console.log(`✅ Cobrança ${payment.id} sincronizada`);
        } else {
          console.error(`❌ Erro ao inserir cobrança ${payment.id}:`, insertError);
        }
      }
    }

    console.log(`🎉 ${syncedCount} cobranças sincronizadas com sucesso`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${syncedCount} cobranças sincronizadas`,
        synced: syncedCount,
        total: paymentsData.data.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('❌ Erro ao sincronizar cobranças:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao sincronizar cobranças'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
