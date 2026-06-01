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

    const { client_id, network_id, commitment_months } = await req.json();

    // Validações básicas
    if (!client_id || !network_id || !commitment_months) {
      throw new Error('client_id, network_id e commitment_months são obrigatórios');
    }

    if (![6, 9, 12].includes(commitment_months)) {
      throw new Error('commitment_months deve ser 6, 9 ou 12');
    }

    // Buscar config de retenção da rede
    const { data: retentionConfig, error: configError } = await supabase
      .from('network_retention_config')
      .select('*')
      .eq('network_id', network_id)
      .eq('is_active', true)
      .maybeSingle();

    if (configError) throw configError;
    if (!retentionConfig) {
      throw new Error('Programa de retenção não está ativo para esta rede');
    }

    // Buscar rede para saber loyalty_type
    const { data: network, error: netError } = await supabase
      .from('networks')
      .select('loyalty_type, retention_is_active')
      .eq('id', network_id)
      .single();

    if (netError) throw netError;
    if (!network.retention_is_active) {
      throw new Error('Programa de retenção não está ativo para esta rede');
    }

    const loyaltyType = network.loyalty_type || 'cashback';
    const prefix = loyaltyType === 'cashback' ? 'cashback_multiplier' : 'points_multiplier';
    const multiplier = retentionConfig[`${prefix}_${commitment_months}_months`];

    if (!multiplier || multiplier <= 0) {
      throw new Error(`Plano de ${commitment_months} meses não está configurado para esta rede`);
    }

    // Verificar compromisso ativo existente
    const { data: existing } = await supabase
      .from('client_retention_commitments')
      .select('id, commitment_months, expires_at, started_at')
      .eq('client_id', client_id)
      .eq('network_id', network_id)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    const now = new Date();
    let action: 'created' | 'upgraded' = 'created';

    if (existing) {
      // Upgrade: só permite ir para plano maior
      if (commitment_months <= existing.commitment_months) {
        throw new Error(
          `Você já possui um plano de ${existing.commitment_months} meses ativo. Só é possível fazer upgrade para um plano maior.`
        );
      }

      action = 'upgraded';

      // Calcular novo expires_at a partir do started_at original + novos meses
      const newExpires = new Date(existing.started_at);
      newExpires.setMonth(newExpires.getMonth() + commitment_months);

      // Atualizar compromisso existente (upgrade)
      const { error: updateError } = await supabase
        .from('client_retention_commitments')
        .update({
          commitment_months,
          multiplier_applied: multiplier,
          expires_at: newExpires.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) throw updateError;
    } else {
      // Criar novo compromisso
      const expires = new Date(now);
      expires.setMonth(expires.getMonth() + commitment_months);

      const { error: insertError } = await supabase
        .from('client_retention_commitments')
        .insert({
          client_id,
          network_id,
          commitment_months,
          multiplier_applied: multiplier,
          loyalty_type: loyaltyType,
          started_at: now.toISOString(),
          expires_at: expires.toISOString(),
          status: 'active',
        });

      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        action,
        commitment_months,
        multiplier_applied: multiplier,
        loyalty_type: loyaltyType,
        message: action === 'upgraded'
          ? `Upgrade realizado com sucesso para plano de ${commitment_months} meses!`
          : `Compromisso de ${commitment_months} meses ativado com sucesso!`,
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
