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

    console.log('🔍 Verificando resgates agendados para desligar...');

    const now = new Date();

    // Buscar clientes com resgate ativo e data agendada que já passou
    const { data: clientsToDisable, error: fetchError } = await supabase
      .from('clients')
      .select('id, cpf, full_name, auto_redemption_disable_scheduled_at')
      .eq('auto_redemption_enabled', true)
      .eq('auto_redemption_disable_mode', 'scheduled')
      .not('auto_redemption_disable_scheduled_at', 'is', null)
      .lte('auto_redemption_disable_scheduled_at', now.toISOString());

    if (fetchError) {
      throw fetchError;
    }

    console.log(`📋 Encontrados ${clientsToDisable?.length || 0} clientes com resgate para desligar`);

    let disabledCount = 0;

    for (const client of clientsToDisable || []) {
      try {
        const { error: updateError } = await supabase
          .from('clients')
          .update({ 
            auto_redemption_enabled: false,
            auto_redemption_disable_scheduled_at: null
          })
          .eq('id', client.id);

        if (updateError) {
          console.error(`❌ Erro ao desligar resgate do cliente ${client.id}:`, updateError);
          continue;
        }

        disabledCount++;
        console.log(`✅ Resgate desligado automaticamente para ${client.full_name || client.cpf} (agendado em ${client.auto_redemption_disable_scheduled_at})`);
      } catch (error) {
        console.error(`❌ Erro ao processar cliente ${client.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Verificação concluída: ${disabledCount} resgates desligados`,
        total_checked: clientsToDisable?.length || 0,
        disabled_count: disabledCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
