// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { attendant_code, password } = await req.json();

    console.log(`[levaregistro-login] Tentativa de login: ${attendant_code}`);

    if (!attendant_code || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Código e senha são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar o atendente pelo código
    const { data: manager, error: managerError } = await supabase
      .from('store_managers')
      .select(`
        id,
        user_id,
        network_id,
        is_attendant,
        attendant_code
      `)
      .eq('attendant_code', attendant_code.toUpperCase())
      .eq('is_attendant', true)
      .single();

    if (managerError || !manager) {
      console.log(`[levaregistro-login] Atendente não encontrado: ${attendant_code}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Código de atendente inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se a rede está em modo manual
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('is_manual_mode')
      .eq('network_id', manager.network_id)
      .limit(1)
      .single();

    if (storeError) {
      console.error(`[levaregistro-login] Erro ao buscar loja:`, storeError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao verificar configuração da rede' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isManualMode = store?.is_manual_mode || false;

    if (!isManualMode) {
      console.log(`[levaregistro-login] Rede ${manager.network_id} não está em modo manual`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Esta rede não está configurada para lançamentos manuais',
          is_manual_mode: false 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar o email do usuário
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(manager.user_id);

    if (authError || !authUser?.user?.email) {
      console.error(`[levaregistro-login] Erro ao buscar email:`, authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[levaregistro-login] Login autorizado para: ${authUser.user.email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        email: authUser.user.email,
        is_manual_mode: true,
        network_id: manager.network_id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[levaregistro-login] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
