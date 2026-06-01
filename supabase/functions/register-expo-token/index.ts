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
    const { client_id, expo_token, device_name, platform } = await req.json();

    // Validações
    if (!client_id || !expo_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'client_id e expo_token são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!expo_token.startsWith('ExponentPushToken[')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido. Deve começar com ExponentPushToken[' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Upsert token
    const { error } = await supabase
      .from('expo_push_tokens')
      .upsert({
        client_id,
        expo_token,
        device_name: device_name || null,
        platform: platform || 'android',
        is_active: true,
        last_used_at: new Date().toISOString(),
      }, {
        onConflict: 'client_id,expo_token',
      });

    if (error) {
      console.error('Erro ao salvar token:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Token Expo registrado para client ${client_id}`);
    return new Response(
      JSON.stringify({ success: true }),
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
