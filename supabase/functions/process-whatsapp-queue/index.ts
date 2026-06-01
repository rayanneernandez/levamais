// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WHATSAPP_API_BASE = "https://wpp-360dialog-starter.onrender.com";
const DEFAULT_DEPARTMENT_ID = "a9355171-0c38-40e3-9f22-4ed123ddaf69";
const RATE_LIMIT_PER_MINUTE = 80;
const BATCH_SIZE = 10;

// Função para verificar janela de 24h
async function hasActiveConversationWindow(supabase: any, phone: string, networkId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_active_conversation_window', {
    p_phone: phone,
    p_network_id: networkId
  });
  
  if (error) {
    console.error('Erro ao verificar janela:', error);
    return false;
  }
  
  return data === true;
}

// Buscar configurações de WhatsApp da rede
async function getNetworkSettings(supabase: any, networkId: string) {
  const { data } = await supabase
    .from('whatsapp_network_settings')
    .select('*')
    .eq('network_id', networkId)
    .single();
  
  return data || {
    default_template_name: 'contato_inicial_pt',
    default_template_language: 'pt_BR',
    department_id: DEFAULT_DEPARTMENT_ID,
    auto_send_template: true
  };
}

// Buscar nome do cliente
async function getClientFirstName(supabase: any, clientId: string | null): Promise<string> {
  if (!clientId) return 'Cliente';
  
  const { data } = await supabase
    .from('clients')
    .select('full_name')
    .eq('id', clientId)
    .single();
  
  if (data?.full_name) {
    return data.full_name.split(' ')[0];
  }
  return 'Cliente';
}

// Função principal de processamento
async function processQueue() {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  console.log('Iniciando processamento da fila WhatsApp...');

  // 1. Processar mensagens pendentes normais
  const { data: queueItems, error: queueError } = await supabase
    .from('whatsapp_message_queue')
    .select('*')
    .eq('status', 'pending')
    .eq('waiting_for_template_reply', false)
    .lte('scheduled_for', new Date().toISOString())
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (queueError) {
    console.error('Erro ao buscar fila:', queueError);
    return { error: queueError.message };
  }

  console.log(`Encontradas ${queueItems?.length || 0} mensagens para processar...`);

  let sent = 0;
  let failed = 0;
  let waiting = 0;

  for (const item of queueItems || []) {
    try {
      const currentMinute = new Date();
      currentMinute.setSeconds(0, 0);
      
      // Verificar rate limit
      const { data: rateLimitData } = await supabase
        .from('whatsapp_rate_limits')
        .select('*')
        .eq('network_id', item.network_id)
        .gte('window_start', currentMinute.toISOString())
        .single();

      if (rateLimitData && rateLimitData.messages_sent >= RATE_LIMIT_PER_MINUTE) {
        console.log(`Rate limit atingido para rede ${item.network_id}`);
        continue;
      }

      // Verificar janela de 24h
      // PRIORIDADE: Se has_active_window já está true (liberado pelo webhook), usar isso
      let hasWindow = item.has_active_window === true;
      
      if (!hasWindow) {
        // Se não foi liberado manualmente, verificar no banco
        hasWindow = await hasActiveConversationWindow(supabase, item.phone, item.network_id);
      }
      
      console.log(`Janela 24h para ${item.phone}: ${hasWindow} (from_queue: ${item.has_active_window})`);

      // Atualizar status para processing
      await supabase
        .from('whatsapp_message_queue')
        .update({ 
          status: 'processing',
          conversation_window_checked: true,
          has_active_window: hasWindow
        })
        .eq('id', item.id);

      let result;
      
      if (hasWindow) {
        // TEM janela - enviar mensagem diretamente
        if (item.message_type === 'text') {
          console.log(`✓ Janela ativa - enviando texto direto para ${item.phone}`);
          result = await sendTextMessage(item.phone, item.message_text);
        } else if (item.message_type === 'template') {
          console.log(`Enviando template ${item.template_name} para ${item.phone}`);
          const clientName = await getClientFirstName(supabase, item.client_id);
          const params = item.template_params?.length ? item.template_params : [clientName];
          result = await sendTemplateMessage(item.phone, item.template_name, params);
        }
      } else {
        // NÃO tem janela - verificar se deve enviar template primeiro
        const settings = await getNetworkSettings(supabase, item.network_id);
        
        if (settings.auto_send_template && settings.default_template_name) {
          console.log(`✗ Sem janela - enviando template ${settings.default_template_name} primeiro para ${item.phone}`);
          
          // Buscar nome do cliente para o template
          const clientName = await getClientFirstName(supabase, item.client_id);
          
          // Enviar o template padrão
          result = await sendTemplateMessage(
            item.phone, 
            settings.default_template_name, 
            [clientName],
            settings.department_id
          );

          const isTemplateSuccess = result.sent === true || 
                                   result.success === true || 
                                   result.messages?.length > 0 ||
                                   result.messageId;

          if (isTemplateSuccess) {
            // Template enviado - colocar mensagem em espera aguardando resposta
            await supabase
              .from('whatsapp_message_queue')
              .update({
                status: 'waiting_reply',
                waiting_for_template_reply: true,
                template_sent_at: new Date().toISOString(),
                original_message_text: item.message_text
              })
              .eq('id', item.id);

            // Log do template enviado
            await supabase
              .from('whatsapp_send_logs')
              .insert({
                queue_id: item.id,
                network_id: item.network_id,
                phone: item.phone,
                direction: 'out',
                message_type: 'template',
                template_name: settings.default_template_name,
                body_text: `Template inicial enviado. Aguardando resposta para enviar: "${item.message_text?.substring(0, 100)}..."`,
                wamid: result.wamid || result.messageId || result.messages?.[0]?.id,
                status: 'sent',
                api_response: result
              });

            console.log(`📩 Mensagem ${item.id} aguardando resposta do cliente`);
            waiting++;
            continue;
          }
        } else {
          // Sem template configurado - tentar enviar mesmo assim (pode falhar no WhatsApp)
          console.log(`⚠️ Sem template configurado - tentando enviar texto direto`);
          if (item.message_type === 'text') {
            result = await sendTextMessage(item.phone, item.message_text);
          }
        }
      }

      // Processar resultado do envio
      const isSuccess = result?.sent === true || 
                       result?.success === true || 
                       result?.messages?.length > 0 ||
                       result?.messageId;

      if (isSuccess) {
        const messageId = result.wamid || result.messageId || result.messages?.[0]?.id;
        
        await supabase
          .from('whatsapp_message_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            wamid: messageId
          })
          .eq('id', item.id);

        await supabase
          .from('whatsapp_send_logs')
          .insert({
            queue_id: item.id,
            network_id: item.network_id,
            phone: item.phone,
            direction: 'out',
            message_type: item.message_type,
            template_name: item.template_name,
            body_text: item.message_text,
            wamid: messageId,
            status: 'sent',
            api_response: result,
            cost: item.cost
          });

        await supabase.rpc('increment_whatsapp_rate_limit', {
          p_network_id: item.network_id,
          p_window_start: currentMinute.toISOString()
        });

        sent++;
        console.log(`✓ Mensagem ${item.id} enviada com sucesso`);
      } else {
        const errorMsg = result?.error || result?.message || result?.details || JSON.stringify(result);
        throw new Error(`Falha no envio: ${errorMsg}`);
      }

    } catch (error) {
      console.error(`✗ Erro ao processar ${item.id}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      const newRetryCount = (item.retry_count || 0) + 1;
      const shouldRetry = newRetryCount < (item.max_retries || 3);

      await supabase
        .from('whatsapp_message_queue')
        .update({
          status: shouldRetry ? 'pending' : 'failed',
          retry_count: newRetryCount,
          failed_at: shouldRetry ? null : new Date().toISOString(),
          error_message: errorMessage
        })
        .eq('id', item.id);

      await supabase
        .from('whatsapp_send_logs')
        .insert({
          queue_id: item.id,
          network_id: item.network_id,
          phone: item.phone,
          direction: 'out',
          message_type: item.message_type,
          template_name: item.template_name,
          body_text: item.message_text,
          status: 'failed',
          error_details: errorMessage
        });

      failed++;
    }

    // Delay entre mensagens para evitar bloqueio
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`Processamento concluído: ${sent} enviadas, ${failed} falhadas, ${waiting} aguardando resposta`);
  return { success: true, processed: queueItems?.length || 0, sent, failed, waiting };
}

async function sendTextMessage(phone: string, text: string) {
  try {
    const payload = { to: phone, text: text };
    console.log('Payload enviado:', JSON.stringify(payload));
    
    const response = await fetch(`${WHATSAPP_API_BASE}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    console.log('Resposta raw:', responseText, 'Status:', response.status);
    
    if (!responseText || responseText.trim() === '') {
      if (response.ok) {
        return { sent: true, status_code: response.status };
      }
      return { sent: false, error: `HTTP ${response.status}` };
    }
    
    try {
      return JSON.parse(responseText);
    } catch {
      if (response.ok) {
        return { sent: true, status_code: response.status, raw: responseText };
      }
      return { sent: false, error: responseText };
    }
  } catch (error) {
    console.error('Erro ao enviar texto:', error);
    return { sent: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

async function sendTemplateMessage(phone: string, templateName: string, parameters: string[], departmentId?: string) {
  try {
    const payload = { 
      to: phone, 
      template: templateName, 
      language: 'pt_BR', 
      parameters: parameters.map(p => String(p || '')),
      departmentId: departmentId || DEFAULT_DEPARTMENT_ID,
      showInChat: true
    };
    console.log('Payload template enviado:', JSON.stringify(payload));
    
    const response = await fetch(`${WHATSAPP_API_BASE}/send/template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    console.log('Resposta raw template:', responseText, 'Status:', response.status);
    
    if (!responseText || responseText.trim() === '') {
      if (response.ok) {
        return { sent: true, status_code: response.status };
      }
      return { sent: false, error: `HTTP ${response.status}` };
    }
    
    try {
      return JSON.parse(responseText);
    } catch {
      if (response.ok) {
        return { sent: true, status_code: response.status, raw: responseText };
      }
      return { sent: false, error: responseText };
    }
  } catch (error) {
    console.error('Erro ao enviar template:', error);
    return { sent: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Iniciar processamento em background e responder imediatamente
    // @ts-ignore - EdgeRuntime disponível no Supabase Edge Functions
    (globalThis as any).EdgeRuntime?.waitUntil?.(processQueue()) || processQueue();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Processamento iniciado em background' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    );

  } catch (error) {
    console.error('Erro ao iniciar processamento:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
