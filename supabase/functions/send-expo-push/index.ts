// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client_id, title, body, data } = await req.json();

    if (!client_id || !title || !body) {
      return new Response(
        JSON.stringify({ success: false, error: 'client_id, title e body são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar tokens ativos do cliente
    const { data: tokens, error: tokensError } = await supabase
      .from('expo_push_tokens')
      .select('*')
      .eq('client_id', client_id)
      .eq('is_active', true);

    if (tokensError) throw tokensError;

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Nenhum token Expo ativo encontrado', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Montar mensagens para Expo Push API
    const messages = tokens.map((t: any) => ({
      to: t.expo_token,
      sound: 'default',
      title,
      body,
      data: data || {},
    }));

    // Enviar para Expo Push API
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await expoResponse.json();
    console.log('📨 Expo Push API response:', JSON.stringify(result));

    // Processar resultados e desativar tokens inválidos
    let sent = 0;
    let failed = 0;
    const tickets = result.data || [];

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket.status === 'ok') {
        sent++;
        // Atualizar last_used_at
        await supabase
          .from('expo_push_tokens')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', tokens[i].id);
      } else {
        failed++;
        // Desativar token se DeviceNotRegistered
        if (ticket.details?.error === 'DeviceNotRegistered') {
          console.log(`🗑️ Token ${tokens[i].id} expirado, desativando`);
          await supabase
            .from('expo_push_tokens')
            .update({ is_active: false })
            .eq('id', tokens[i].id);
        }
      }
    }

    console.log(`🎉 Expo push: ${sent} enviados, ${failed} falhas`);

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: tokens.length, tickets }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
