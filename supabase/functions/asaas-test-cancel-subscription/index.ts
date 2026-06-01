// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { asaas_subscription_id } = await req.json();

    console.log('🧪 [TESTE] Cancelando assinatura no Asaas:', asaas_subscription_id);

    // Buscar assinatura
    const { data: subscription, error: subError } = await supabase
      .from('client_subscriptions_one')
      .select('*')
      .eq('asaas_subscription_id', asaas_subscription_id)
      .single();

    if (subError || !subscription) {
      throw new Error('Assinatura não encontrada');
    }

    // Buscar config Asaas
    const { data: asaasConfig, error: asaasError } = await supabase
      .from('asaas_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (asaasError || !asaasConfig) {
      throw new Error('Configuração Asaas não encontrada');
    }

    const asaasUrl = asaasConfig.is_sandbox 
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://www.asaas.com/api/v3';
    
    const apiKey = asaasConfig.is_sandbox 
      ? asaasConfig.api_key_sandbox 
      : asaasConfig.api_key_production;

    // Cancelar no Asaas via DELETE
    const asaasResponse = await fetch(`${asaasUrl}/subscriptions/${asaas_subscription_id}`, {
      method: 'DELETE',
      headers: { 
        'Content-Type': 'application/json',
        'access_token': apiKey 
      }
    });

    if (!asaasResponse.ok) {
      const errorData = await asaasResponse.json();
      console.error('❌ Erro ao cancelar no Asaas:', errorData);
      throw new Error(errorData.errors?.[0]?.description || 'Erro ao cancelar no Asaas');
    }

    console.log('✅ Assinatura cancelada no Asaas');

    // Atualizar banco
    const { error: updateError } = await supabase
      .from('client_subscriptions_one')
      .update({ 
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('asaas_subscription_id', asaas_subscription_id);

    if (updateError) {
      console.error('❌ Erro ao atualizar banco:', updateError);
      throw new Error('Erro ao atualizar banco de dados');
    }

    console.log('✅ Status atualizado no banco');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Assinatura cancelada com sucesso (TESTE)',
      subscription_id: subscription.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Erro em asaas-test-cancel-subscription:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
