// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    console.log('📥 Webhook recebido:', JSON.stringify(body, null, 2));

    // Ignorar eventos de mensagens ENVIADAS (type: message_sent)
    if (body.type === 'message_sent' || body.author?.type === 'bot') {
      console.log('ℹ️ Ignorando evento de mensagem enviada');
      return new Response(
        JSON.stringify({ success: true, skipped: 'outbound message' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Extrair telefone do formato Zap Responder
    // chatId é o campo mais confiável para o número do cliente
    const chatId = body.chatId || '';
    const rawMessage = body.raw_message || {};
    const message = body.message || {};
    
    // Extrair telefone de várias fontes possíveis
    const phone = chatId || rawMessage.from || rawMessage.to || body.from || '';
    const cleanPhone = String(phone).replace(/\D/g, '');

    if (!cleanPhone) {
      console.log('⚠️ Webhook sem telefone válido. Body:', JSON.stringify(body));
      return new Response(
        JSON.stringify({ success: true, skipped: 'no phone' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`📱 Telefone extraído: ${cleanPhone}`);

    // Extrair conteúdo da mensagem
    const messageContent = message.mensagem || rawMessage.content || rawMessage.buttonPayload || '';
    const messageType = rawMessage.type || message.type || 'text';
    const messageId = rawMessage.id || body.id || `msg_${Date.now()}`;
    const timestamp = rawMessage.timestamp || body.timestamp || Math.floor(Date.now() / 1000);
    const senderName = rawMessage.pushName || '';

    console.log(`💬 Conteúdo: "${messageContent}" | Tipo: ${messageType} | De: ${senderName}`);

    // Tentar encontrar cliente pelo telefone
    const { data: client } = await supabase
      .from('clients')
      .select('id, network_id, favorite_network_id, full_name')
      .or(`phone.eq.${cleanPhone},phone.eq.55${cleanPhone},phone.ilike.%${cleanPhone.slice(-9)}`)
      .limit(1)
      .maybeSingle();

    const networkId = client?.favorite_network_id || client?.network_id;
    console.log(`👤 Cliente: ${client?.full_name || 'Não encontrado'} | Network: ${networkId || 'N/A'}`);

    // Salvar no histórico
    const timestampDate = typeof timestamp === 'string' 
      ? new Date(parseInt(timestamp) > 9999999999 ? parseInt(timestamp) : parseInt(timestamp) * 1000).toISOString()
      : new Date(timestamp > 9999999999 ? timestamp : timestamp * 1000).toISOString();

    const { error: historyError } = await supabase
      .from('whatsapp_conversation_history')
      .insert({
        network_id: networkId,
        client_id: client?.id,
        wa_id: cleanPhone,
        phone: cleanPhone,
        direction: 'in',
        message_type: messageType,
        body_text: messageContent || '[sem conteúdo]',
        wamid: messageId,
        timestamp: timestampDate,
        metadata: body
      });

    if (historyError) {
      console.error('❌ Erro ao salvar histórico:', historyError);
    } else {
      console.log('✅ Mensagem salva no histórico');
    }

    // ==== LÓGICA DA JANELA 24H ====
    // Verificar se há mensagens aguardando resposta deste telefone
    const { data: waitingMessages, error: waitingError } = await supabase
      .from('whatsapp_message_queue')
      .select('*')
      .eq('phone', cleanPhone)
      .eq('status', 'waiting_reply')
      .eq('waiting_for_template_reply', true);

    if (waitingError) {
      console.error('❌ Erro ao buscar mensagens aguardando:', waitingError);
    }

    if (waitingMessages && waitingMessages.length > 0) {
      console.log(`🔓 ${waitingMessages.length} mensagens aguardando resposta de ${cleanPhone} - LIBERANDO!`);
      
      for (const waitingMsg of waitingMessages) {
        // Atualizar status para pendente novamente
        const { error: updateError } = await supabase
          .from('whatsapp_message_queue')
          .update({
            status: 'pending',
            waiting_for_template_reply: false,
            has_active_window: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', waitingMsg.id);

        if (updateError) {
          console.error(`❌ Erro ao liberar mensagem ${waitingMsg.id}:`, updateError);
        } else {
          console.log(`✅ Mensagem ${waitingMsg.id} liberada para envio!`);
        }

        // Log de liberação
        await supabase
          .from('whatsapp_send_logs')
          .insert({
            queue_id: waitingMsg.id,
            network_id: waitingMsg.network_id,
            phone: waitingMsg.phone,
            direction: 'out',
            message_type: 'system',
            body_text: `🔓 Cliente respondeu "${messageContent.substring(0, 30)}..." - Mensagem "${waitingMsg.message_text?.substring(0, 30)}..." liberada`,
            status: 'pending'
          });
      }

      // Disparar processamento imediato da fila
      console.log('🚀 Disparando processamento imediato da fila...');
      try {
        const response = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-whatsapp-queue`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ trigger: 'webhook_reply' })
          }
        );
        console.log(`📤 Fila disparada: ${response.status}`);
      } catch (queueError) {
        console.error('⚠️ Erro ao disparar fila (não crítico):', queueError);
      }
    } else {
      console.log(`ℹ️ Nenhuma mensagem aguardando resposta de ${cleanPhone}`);
    }

    return new Response(
      JSON.stringify({ success: true, phone: cleanPhone, content: messageContent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
