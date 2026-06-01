import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    console.log('Webhook recebido:', JSON.stringify(payload, null, 2));

    // Estrutura esperada do webhook do ZapResponder/WhatsApp
    // {
    //   "entry": [{
    //     "changes": [{
    //       "value": {
    //         "statuses": [{
    //           "id": "wamid.xxx",
    //           "status": "delivered" | "read" | "failed",
    //           "timestamp": "1234567890",
    //           "recipient_id": "5521999999999",
    //           "errors": [{ "code": 123, "title": "Error" }]
    //         }]
    //       }
    //     }]
    //   }]
    // }

    // Formato alternativo simplificado do ZapResponder
    // {
    //   "wamid": "xxx",
    //   "status": "delivered",
    //   "phone": "5521999999999",
    //   "timestamp": 1234567890,
    //   "error": { "code": 123, "message": "Error" }
    // }

    let statuses: any[] = [];

    // Tentar extrair status do formato padrão WhatsApp Cloud API
    if (payload.entry?.[0]?.changes?.[0]?.value?.statuses) {
      statuses = payload.entry[0].changes[0].value.statuses;
    }
    // Formato simplificado
    else if (payload.wamid || payload.status) {
      statuses = [{
        id: payload.wamid || payload.message_id,
        status: payload.status,
        recipient_id: payload.phone || payload.to,
        timestamp: payload.timestamp,
        errors: payload.error ? [payload.error] : undefined
      }];
    }

    console.log(`Processando ${statuses.length} status updates...`);

    for (const statusUpdate of statuses) {
      const wamid = statusUpdate.id;
      const status = statusUpdate.status; // sent, delivered, read, failed
      const phone = statusUpdate.recipient_id;
      const errors = statusUpdate.errors;

      console.log(`Status: ${status} para wamid: ${wamid}, phone: ${phone}`);

      // Buscar mensagem na fila pelo wamid
      let query = supabase
        .from('whatsapp_message_queue')
        .select('id, status')
        .limit(1);

      if (wamid) {
        query = query.eq('wamid', wamid);
      } else if (phone) {
        // Fallback: buscar pela última mensagem enviada para esse telefone
        query = query.eq('phone', phone).eq('status', 'sent').order('sent_at', { ascending: false });
      }

      const { data: messages } = await query;

      if (messages && messages.length > 0) {
        const messageId = messages[0].id;

        // Mapear status do WhatsApp para nosso status
        let newStatus = messages[0].status;
        if (status === 'failed') {
          newStatus = 'failed';
        } else if (status === 'delivered' || status === 'read') {
          // Manter como sent, mas poderíamos criar status 'delivered'/'read'
          newStatus = 'sent';
        }

        // Atualizar apenas se falhou (status assíncrono)
        if (status === 'failed') {
          const errorMessage = errors?.[0]?.title || errors?.[0]?.message || 'Falha reportada pelo WhatsApp';
          
          await supabase
            .from('whatsapp_message_queue')
            .update({
              status: 'failed',
              failed_at: new Date().toISOString(),
              error_message: `Webhook: ${errorMessage}`
            })
            .eq('id', messageId);

          console.log(`Mensagem ${messageId} marcada como failed via webhook`);
        }

        // Registrar no log
        await supabase
          .from('whatsapp_send_logs')
          .insert({
            queue_id: messageId,
            phone: phone,
            direction: 'status',
            message_type: 'status_update',
            status: status,
            api_response: statusUpdate
          });

      } else {
        console.log(`Mensagem não encontrada para wamid: ${wamid} ou phone: ${phone}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: statuses.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro no webhook:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
