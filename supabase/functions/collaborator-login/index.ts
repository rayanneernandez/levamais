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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { attendant_code, password } = await req.json();

    if (!attendant_code || !password) {
      throw new Error('Código e senha são obrigatórios');
    }

    // Buscar atendente pelo código
    const { data: attendantData, error: attendantError } = await supabase
      .from('store_managers')
      .select('user_id, network_id, is_active')
      .eq('attendant_code', attendant_code)
      .eq('is_attendant', true)
      .single();

    if (attendantError || !attendantData) {
      throw new Error('Código de atendente não encontrado');
    }

    if (attendantData.is_active === false) {
      throw new Error('Seu acesso foi desativado. Entre em contato com o administrador da rede.');
    }

    // Buscar email do profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', attendantData.user_id)
      .single();

    if (profileError || !profileData?.email) {
      throw new Error('Dados do usuário não encontrados');
    }

    // Retornar email para o frontend fazer o login
    return new Response(
      JSON.stringify({
        success: true,
        email: profileData.email,
        name: profileData.full_name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro em collaborator-login:', error);
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
