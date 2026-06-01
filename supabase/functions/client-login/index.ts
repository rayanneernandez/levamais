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

    const { cpf, password } = await req.json();

    if (!cpf || !password) {
      throw new Error('CPF e senha são obrigatórios');
    }

    // Buscar cliente pelo CPF (usando service role, sem RLS)
    // Prioriza o registro da rede favorita, senão pega o mais recente
    const { data: clientRecords, error: clientError } = await supabase
      .from('clients')
      .select('user_id, full_name, favorite_network_id, network_id, created_at')
      .eq('cpf', cpf.replace(/\D/g, ''))
      .order('created_at', { ascending: false });

    if (clientError || !clientRecords || clientRecords.length === 0) {
      throw new Error('CPF não encontrado');
    }

    // Se tiver múltiplos registros, prioriza aquele que é rede favorita
    let clientData = clientRecords[0]; // Default: mais recente
    
    if (clientRecords.length > 1) {
      const favoriteRecord = clientRecords.find(
        record => record.favorite_network_id === record.network_id
      );
      if (favoriteRecord) {
        clientData = favoriteRecord;
      }
    }

    // Validar se user_id existe e é válido
    if (!clientData.user_id) {
      throw new Error('PRIMEIRO_ACESSO: Complete seu primeiro acesso ao aplicativo informando email e criando sua senha.');
    }

    // Verificar se é um UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clientData.user_id)) {
      throw new Error('Dados do usuário estão corrompidos. Entre em contato com o suporte.');
    }

    // Buscar email do profile primeiro
    let email = null;
    const { data: profileData } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', clientData.user_id)
      .maybeSingle();

    if (profileData?.email) {
      email = profileData.email;
    } else {
      // Se não encontrar no profile, buscar no auth.users
      const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(
        clientData.user_id
      );
      
      if (authError || !user?.email) {
        throw new Error('Email do usuário não encontrado');
      }
      
      email = user.email;
    }

    // Verificar role de cliente
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', clientData.user_id)
      .eq('role', 'client')
      .maybeSingle();

    if (roleError || !roleData) {
      throw new Error('Acesso não autorizado');
    }

    // Retornar email para o frontend fazer o login
    return new Response(
      JSON.stringify({
        success: true,
        email: email,
        name: clientData.full_name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro em client-login:', error);
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
