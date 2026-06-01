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

    const { subscription_id, is_admin_cancellation } = await req.json();

    console.log('Cancelling ONE subscription:', subscription_id);

    // Verificar se pode cancelar
    const { data: subscription, error: subError } = await supabase
      .from('client_subscriptions_one')
      .select('*')
      .eq('id', subscription_id)
      .single();

    if (subError || !subscription) {
      throw new Error('Assinatura não encontrada');
    }

    console.log('Subscription found:', subscription.id, 'Can cancel:', subscription.can_cancel, 'Is admin:', is_admin_cancellation);

    // Verificar período mínimo de 12 meses (apenas para clientes, não para admins)
    if (!is_admin_cancellation) {
      const startDate = new Date(subscription.start_date);
      const twelveMonthsLater = new Date(startDate);
      twelveMonthsLater.setMonth(twelveMonthsLater.getMonth() + 12);
      
      const now = new Date();
      if (now < twelveMonthsLater) {
        const daysRemaining = Math.ceil((twelveMonthsLater.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        throw new Error(`Você precisa manter a assinatura por no mínimo 12 meses. Faltam ${daysRemaining} dias.`);
      }
    } else {
      console.log('Admin cancellation - skipping 12-month validation');
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

    // Cancelar no Asaas
    console.log('Cancelling subscription in Asaas:', subscription.asaas_subscription_id);
    
    const asaasResponse = await fetch(`${asaasUrl}/subscriptions/${subscription.asaas_subscription_id}`, {
      method: 'DELETE',
      headers: { 
        'Content-Type': 'application/json',
        'access_token': apiKey 
      }
    });

    if (!asaasResponse.ok) {
      const errorData = await asaasResponse.json();
      console.error('Asaas cancellation error:', errorData);
      // Continuar mesmo se falhar no Asaas (pode já estar cancelada)
    } else {
      console.log('Subscription cancelled in Asaas');
    }

    // Atualizar banco
    const { error: updateError } = await supabase
      .from('client_subscriptions_one')
      .update({ 
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', subscription_id);

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      throw new Error('Erro ao atualizar assinatura');
    }

    console.log('Subscription cancelled in database:', subscription_id);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Assinatura cancelada com sucesso'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in cancel-one-subscription:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
