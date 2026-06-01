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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { client_id, transaction_type } = await req.json();

    console.log('🎯 Calculando pontos do colaborador:', { client_id, transaction_type });

    // Buscar cliente e quem o cadastrou
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('registered_by_attendant_id, network_id, created_at')
      .eq('id', client_id)
      .single();

    if (clientError || !client || !client.registered_by_attendant_id) {
      console.log('ℹ️ Cliente não tem atendente registrado');
      return new Response(
        JSON.stringify({ success: false, message: 'Cliente sem atendente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar regras de pontuação da rede
    const { data: rules, error: rulesError } = await supabase
      .from('attendant_points_rules')
      .select('*')
      .eq('network_id', client.network_id)
      .eq('is_active', true)
      .single();

    if (rulesError || !rules) {
      console.log('⚠️ Sem regras de pontuação configuradas');
      return new Response(
        JSON.stringify({ success: false, message: 'Sem regras configuradas' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let pointsEarned = 0;
    let multiplier = 1;
    let transactionTypeStr = transaction_type || 'client_registration';

    // Se é cadastro de cliente
    if (transaction_type === 'registration' || !transaction_type) {
      pointsEarned = parseFloat(rules.points_per_client.toString());
      transactionTypeStr = 'client_registration';
    } 
    // Se é retorno do cliente (calcular dias desde cadastro)
    else if (transaction_type === 'return') {
      const registrationDate = new Date(client.created_at);
      const today = new Date();
      const daysSinceRegistration = Math.floor((today.getTime() - registrationDate.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`📅 Cliente cadastrado há ${daysSinceRegistration} dias`);

      if (daysSinceRegistration <= 7) {
        multiplier = parseFloat(rules.multiplier_7_days.toString());
        transactionTypeStr = 'client_return_7';
      } else if (daysSinceRegistration <= 15) {
        multiplier = parseFloat(rules.multiplier_15_days.toString());
        transactionTypeStr = 'client_return_15';
      } else if (daysSinceRegistration <= 30) {
        multiplier = parseFloat(rules.multiplier_30_days.toString());
        transactionTypeStr = 'client_return_30';
      }

      pointsEarned = parseFloat(rules.points_per_client.toString()) * multiplier;
    }

    if (pointsEarned <= 0) {
      console.log('ℹ️ Nenhum ponto para atribuir');
      return new Response(
        JSON.stringify({ success: true, points: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`💰 Pontos calculados: ${pointsEarned} (base: ${rules.points_per_client} x ${multiplier})`);

    // Registrar transação de pontos
    const { error: transactionError } = await supabase
      .from('attendant_points_transactions')
      .insert({
        attendant_id: client.registered_by_attendant_id,
        network_id: client.network_id,
        client_id: client_id,
        points_earned: pointsEarned,
        multiplier_applied: multiplier,
        transaction_type: transactionTypeStr,
        description: `${transaction_type === 'return' ? 'Retorno' : 'Cadastro'} do cliente`,
      });

    if (transactionError) {
      console.error('❌ Erro ao criar transação:', transactionError);
      throw transactionError;
    }

    // Atualizar total de pontos do atendente
    const { data: currentPoints, error: fetchError } = await supabase
      .from('attendant_points')
      .select('total_points')
      .eq('attendant_id', client.registered_by_attendant_id)
      .eq('network_id', client.network_id)
      .single();

    const newTotal = (currentPoints?.total_points || 0) + pointsEarned;

    const { error: updateError } = await supabase
      .from('attendant_points')
      .upsert({
        attendant_id: client.registered_by_attendant_id,
        network_id: client.network_id,
        total_points: newTotal,
      }, {
        onConflict: 'attendant_id,network_id',
      });

    if (updateError) {
      console.error('❌ Erro ao atualizar pontos:', updateError);
      throw updateError;
    }

    console.log(`✅ Pontos atualizados: ${currentPoints?.total_points || 0} → ${newTotal}`);

    return new Response(
      JSON.stringify({
        success: true,
        points_earned: pointsEarned,
        multiplier: multiplier,
        new_total: newTotal,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Erro em calculate-attendant-points:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
