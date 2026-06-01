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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Não autorizado');
    }

    // Verificar se é admin
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roles) {
      throw new Error('Apenas administradores podem sincronizar perfis');
    }

    const { client_id } = await req.json();

    if (!client_id) {
      throw new Error('client_id é obrigatório');
    }

    // Buscar dados do cliente e perfil
    const { data: clientData, error: clientError } = await supabaseClient
      .from('clients')
      .select('id, user_id, full_name, email')
      .eq('id', client_id)
      .single();

    if (clientError || !clientData) {
      throw new Error('Cliente não encontrado');
    }

    // Buscar dados do perfil
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('full_name, email, phone, cpf')
      .eq('id', clientData.user_id)
      .single();

    if (profileError || !profileData) {
      throw new Error('Perfil não encontrado');
    }

    // Atualizar cliente com dados do perfil
    const { error: updateError } = await supabaseClient
      .from('clients')
      .update({
        full_name: profileData.full_name,
        email: profileData.email,
      })
      .eq('id', client_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Perfil sincronizado com sucesso',
        updated: {
          from: clientData.full_name,
          to: profileData.full_name,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
