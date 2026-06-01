// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-token',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let webhookPayload: any = null;
  let eventType = '';

  try {
    // 1. Validar token da webhook
    const webhookToken = req.headers.get('x-webhook-token') || req.headers.get('asaas-access-token');
    
    // Buscar token configurado no banco
    const { data: config } = await supabase
      .from('asaas_config')
      .select('webhook_token')
      .eq('is_active', true)
      .single();

    if (!config?.webhook_token || webhookToken !== config.webhook_token) {
      console.error('❌ Webhook token inválido ou ausente');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Webhook token validado com sucesso');

    // 2. Parse do payload
    webhookPayload = await req.json();
    const { event, payment } = webhookPayload;
    eventType = event;

    console.log('📥 Webhook Asaas recebida:', event, 'Payment ID:', payment?.id);

    // 3. Registrar evento no log
    const { error: logError } = await supabase
      .from('asaas_webhook_events')
      .insert({
        event_type: event,
        payment_id: payment?.id,
        subscription_id: payment?.subscription,
        customer_id: payment?.customer,
        payload: webhookPayload,
        processed: false
      });

    if (logError) {
      console.error('Erro ao registrar log do evento:', logError);
    }

    if (!payment || !payment.subscription) {
      console.log('ℹ️ Sem informação de assinatura, ignorando');
      
      // Marcar como processado mesmo assim
      await supabase
        .from('asaas_webhook_events')
        .update({ processed: true })
        .eq('payment_id', payment?.id);

      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar assinatura no banco
    const { data: subscription, error: subError } = await supabase
      .from('client_subscriptions_one')
      .select('*')
      .eq('asaas_subscription_id', payment.subscription)
      .maybeSingle();

    if (subError) {
      console.error('Error finding subscription:', subError);
      throw new Error('Erro ao buscar assinatura');
    }

    if (!subscription) {
      console.log('Subscription not found for:', payment.subscription);
      return new Response(JSON.stringify({ received: true, message: 'Subscription not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Processing event for subscription:', subscription.id, 'Status:', subscription.status);

    // Processar evento
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      console.log('✅ Payment received, activating subscription');
      
      // Calcular se já passou 12 meses (período mínimo alterado)
      const startDate = new Date(subscription.start_date);
      const twelveMonthsLater = new Date(startDate);
      twelveMonthsLater.setMonth(twelveMonthsLater.getMonth() + 12);
      const canCancelNow = new Date() >= twelveMonthsLater;

      // Ativar assinatura
      const { error: updateError } = await supabase
        .from('client_subscriptions_one')
        .update({ 
          status: 'active',
          can_cancel: canCancelNow
        })
        .eq('id', subscription.id);
      
      // Atualizar ou criar cobrança em asaas_charges
      const { data: existingCharge } = await supabase
        .from('asaas_charges')
        .select('id')
        .eq('asaas_charge_id', payment.id)
        .maybeSingle();

      if (existingCharge) {
        // Atualizar cobrança existente
        await supabase
          .from('asaas_charges')
          .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
            payment_date: payment.paymentDate || new Date().toISOString()
          })
          .eq('asaas_charge_id', payment.id);
      } else {
        // Criar cobrança se não existir
        await supabase
          .from('asaas_charges')
          .insert({
            asaas_charge_id: payment.id,
            network_id: subscription.network_id,
            amount: payment.value || 9.90,
            status: 'confirmed',
            due_date: payment.dueDate || new Date().toISOString().split('T')[0],
            payment_method: 'credit_card',
            billing_type: payment.billingType || 'CREDIT_CARD',
            charge_type: 'subscription',
            description: payment.description || `Leva+ One - ${subscription.network_id}`,
            payment_date: payment.paymentDate || new Date().toISOString(),
            confirmed_at: new Date().toISOString(),
            invoice_url: payment.invoiceUrl
          });
        console.log('✅ Cobrança criada automaticamente pelo webhook:', payment.id);
      }

      if (updateError) {
        console.error('Error updating subscription:', updateError);
        throw new Error('Erro ao atualizar assinatura');
      }

      console.log('✅ Assinatura ativada:', subscription.id, 'Can cancel:', canCancelNow);

      // ✅ Agora sim, marcar cliente como membro ONE
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('id', subscription.client_id)
        .single();

      if (clientData) {
        await supabase
          .from('clients')
          .update({
            is_one_member: true,
            one_member_since: subscription.start_date || new Date().toISOString()
          })
          .eq('id', subscription.client_id);
        
        console.log('✅ Cliente marcado como membro ONE:', subscription.client_id);
      }

      // Marcar evento como processado com sucesso
      await supabase
        .from('asaas_webhook_events')
        .update({ processed: true })
        .eq('payment_id', payment.id);

    } else if (event === 'PAYMENT_OVERDUE' || event === 'PAYMENT_OVERDUE_LIMIT_DAYS') {
      console.log('Payment overdue, suspending subscription');
      
      // Suspender assinatura temporariamente
      const { error: updateError } = await supabase
        .from('client_subscriptions_one')
        .update({ status: 'suspended' })
        .eq('id', subscription.id);

      if (updateError) {
        console.error('Error suspending subscription:', updateError);
        throw new Error('Erro ao suspender assinatura');
      }

      // ✅ Desmarcar cliente como membro ONE quando suspenso
      await supabase
        .from('clients')
        .update({ is_one_member: false })
        .eq('id', subscription.client_id);

      console.log('⚠️ Assinatura suspensa e benefícios ONE removidos:', subscription.id);

      // Marcar evento como processado
      await supabase
        .from('asaas_webhook_events')
        .update({ processed: true })
        .eq('payment_id', payment.id);

    } else if (event === 'PAYMENT_DELETED' || event === 'PAYMENT_REFUNDED') {
      console.log('Payment deleted/refunded, checking subscription status');
      
      // Verificar se deve cancelar a assinatura
      if (subscription.status === 'suspended') {
        const { error: updateError } = await supabase
          .from('client_subscriptions_one')
          .update({ 
            status: 'cancelled',
            cancelled_at: new Date().toISOString()
          })
          .eq('id', subscription.id);

        if (updateError) {
          console.error('Erro ao cancelar assinatura:', updateError);
        } else {
          // ✅ Desmarcar cliente como membro ONE quando cancelado
          await supabase
            .from('clients')
            .update({ is_one_member: false })
            .eq('id', subscription.client_id);

          console.log('❌ Assinatura cancelada e benefícios ONE removidos:', subscription.id);

          // Marcar evento como processado
          await supabase
            .from('asaas_webhook_events')
            .update({ processed: true })
            .eq('payment_id', payment.id);
        }
      }
    }

    // Marcar evento como processado se chegou até aqui
    await supabase
      .from('asaas_webhook_events')
      .update({ processed: true })
      .eq('payment_id', payment?.id);

    return new Response(JSON.stringify({ 
      received: true,
      subscription_id: subscription.id,
      new_status: subscription.status
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Erro na webhook Asaas:', error);
    
    // Registrar erro no log
    if (webhookPayload) {
      await supabase
        .from('asaas_webhook_events')
        .update({ 
          processed: false,
          error_message: error.message 
        })
        .eq('event_type', eventType)
        .eq('payload', webhookPayload);
    }

    return new Response(JSON.stringify({
      received: true,
      error: error.message
    }), {
      status: 200, // Retornar 200 para não retentar webhook
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
