// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

Deno.serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date().toISOString();

    // Buscar promoções que devem ser ativadas
    const { data: toActivate, error: activateError } = await supabaseClient
      .from('fuel_promotions')
      .select('*, fuel_differential_config(*)')
      .eq('is_active', false)
      .lte('start_date', now)
      .gte('end_date', now);

    if (activateError) throw activateError;

    // Ativar promoções e atualizar fuel_differential_config
    for (const promotion of toActivate || []) {
      await supabaseClient
        .from('fuel_promotions')
        .update({ is_active: true })
        .eq('id', promotion.id);

      await supabaseClient
        .from('fuel_differential_config')
        .update({
          differential_percentage: promotion.promotion_percentage,
          is_active: true,
        })
        .eq('id', promotion.fuel_config_id);

      console.log(`Promoção ativada: ${promotion.promotion_name}`);
    }

    // Buscar promoções que devem ser desativadas (já passaram da data final)
    const { data: toDeactivate, error: deactivateError } = await supabaseClient
      .from('fuel_promotions')
      .select('*, fuel_differential_config(*)')
      .eq('is_active', true)
      .lt('end_date', now);

    if (deactivateError) throw deactivateError;

    // Desativar promoções e restaurar percentual original
    for (const promotion of toDeactivate || []) {
      await supabaseClient
        .from('fuel_promotions')
        .update({ is_active: false })
        .eq('id', promotion.id);

      await supabaseClient
        .from('fuel_differential_config')
        .update({
          differential_percentage: promotion.original_percentage,
          is_active: false,
        })
        .eq('id', promotion.fuel_config_id);

      console.log(`Promoção desativada: ${promotion.promotion_name}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        activated: toActivate?.length || 0,
        deactivated: toDeactivate?.length || 0,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erro ao processar promoções:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});