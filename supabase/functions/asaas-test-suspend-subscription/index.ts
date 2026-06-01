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

    console.log('🧪 [TESTE] Suspendendo assinatura:', asaas_subscription_id);

    // Buscar assinatura
    const { data: subscription, error: subError } = await supabase
      .from('client_subscriptions_one')
      .select('*')
      .eq('asaas_subscription_id', asaas_subscription_id)
      .single();

    if (subError || !subscription) {
      throw new Error('Assinatura não encontrada');
    }

    // Suspender apenas localmente (Asaas não tem endpoint de suspensão manual)
    // A suspensão real acontece via webhook quando pagamento está atrasado
    const { error: updateError } = await supabase
      .from('client_subscriptions_one')
      .update({ status: 'suspended' })
      .eq('asaas_subscription_id', asaas_subscription_id);

    if (updateError) {
      console.error('❌ Erro ao suspender:', updateError);
      throw new Error('Erro ao suspender assinatura');
    }

    console.log('✅ Assinatura suspensa localmente');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Assinatura suspensa com sucesso (TESTE)',
      subscription_id: subscription.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Erro em asaas-test-suspend-subscription:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
