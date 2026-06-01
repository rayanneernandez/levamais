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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Autorização necessária');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Não autorizado');
    }

    const body = await req.json();
    const {
      network_id,
      store_id,
      client_id,
      phone,
      message_type, // 'text', 'template', 'media'
      template_id,
      template_name,
      template_params,
      message_text,
      media_url,
      media_type,
      priority = 5,
      scheduled_for,
      campaign_id,
      is_promotional = false,
      cost = 0
    } = body;

    // Validações básicas
    if (!network_id || !phone || !message_type) {
      throw new Error('network_id, phone e message_type são obrigatórios');
    }

    if (message_type === 'text' && !message_text) {
      throw new Error('message_text é obrigatório para tipo text');
    }

    if (message_type === 'template' && !template_name) {
      throw new Error('template_name é obrigatório para tipo template');
    }

    // Inserir na fila
    const { data: queueItem, error: queueError } = await supabase
      .from('whatsapp_message_queue')
      .insert({
        network_id,
        store_id,
        client_id,
        phone: phone.replace(/\D/g, ''), // Remove formatação
        message_type,
        template_id,
        template_name,
        template_params,
        message_text,
        media_url,
        media_type,
        priority,
        scheduled_for: scheduled_for || new Date().toISOString(),
        campaign_id,
        is_promotional,
        cost,
        status: 'pending'
      })
      .select()
      .single();

    if (queueError) {
      console.error('Erro ao inserir na fila:', queueError);
      throw queueError;
    }

    console.log('Mensagem adicionada à fila:', queueItem.id);

    return new Response(
      JSON.stringify({
        success: true,
        queue_id: queueItem.id,
        message: 'Mensagem adicionada à fila de envio',
        estimated_send: scheduled_for || 'Em alguns minutos'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Erro em send-whatsapp:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});