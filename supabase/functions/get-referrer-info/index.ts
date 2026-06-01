// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { referrer_id } = await req.json();

    if (!referrer_id) {
      throw new Error('referrer_id é obrigatório');
    }

    // Buscar dados do indicador
    const { data: referrer, error } = await supabase
      .from('clients')
      .select('id, full_name, favorite_network_id, network_id')
      .eq('id', referrer_id)
      .single();

    if (error || !referrer) {
      throw new Error('Indicador não encontrado');
    }

    // Buscar nome da rede favorita
    let networkName = null;
    const networkId = referrer.favorite_network_id || referrer.network_id;
    if (networkId) {
      const { data: network } = await supabase
        .from('networks')
        .select('name, referral_enabled, referral_bonus_type, referral_bonus_referrer, referral_bonus_referred')
        .eq('id', networkId)
        .single();

      networkName = network?.name || null;

      return new Response(
        JSON.stringify({
          success: true,
          referrer_name: referrer.full_name,
          network_id: networkId,
          network_name: networkName,
          referral_enabled: network?.referral_enabled || false,
          referral_bonus_type: network?.referral_bonus_type,
          referral_bonus_referred: network?.referral_bonus_referred,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        referrer_name: referrer.full_name,
        network_id: null,
        network_name: null,
        referral_enabled: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
