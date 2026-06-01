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

    const { cpf, password, email, phone } = await req.json();

    if (!cpf || !password) {
      throw new Error('CPF e senha são obrigatórios');
    }

    // Buscar cliente pelo CPF sem user_id
    const { data: clientRecords, error: clientError } = await supabase
      .from('clients')
      .select('id, full_name, favorite_network_id, network_id, user_id, email, phone')
      .eq('cpf', cpf.replace(/\D/g, ''))
      .order('created_at', { ascending: false });

    if (clientError || !clientRecords || clientRecords.length === 0) {
      throw new Error('CPF não encontrado no sistema');
    }

    // Priorizar registro da rede favorita
    let clientData = clientRecords[0];
    if (clientRecords.length > 1) {
      const favoriteRecord = clientRecords.find(
        record => record.favorite_network_id === record.network_id
      );
      if (favoriteRecord) {
        clientData = favoriteRecord;
      }
    }

    // Verificar se já tem user_id
    if (clientData.user_id) {
      throw new Error('Este CPF já possui cadastro. Use a opção de login.');
    }

    // Usar email fornecido ou o que já está cadastrado
    const userEmail = email || clientData.email;
    if (!userEmail) {
      throw new Error('Email é obrigatório para o primeiro cadastro');
    }

    // Criar usuário no auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: clientData.full_name,
      }
    });

    if (authError) {
      console.error('Erro ao criar usuário:', authError);
      throw new Error('Erro ao criar conta: ' + authError.message);
    }

    const newUserId = authData.user.id;

    // Atualizar cliente com user_id
    const { error: updateClientError } = await supabase
      .from('clients')
      .update({ 
        user_id: newUserId,
        email: userEmail,
        phone: phone || clientData.phone,
        updated_at: new Date().toISOString()
      })
      .eq('id', clientData.id);

    if (updateClientError) {
      console.error('Erro ao atualizar cliente:', updateClientError);
      throw new Error('Erro ao vincular conta ao cliente');
    }

    // Criar perfil
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: newUserId,
        full_name: clientData.full_name,
        email: userEmail,
        phone: phone || clientData.phone,
        force_password_change: false
      });

    if (profileError) {
      console.error('Erro ao criar perfil:', profileError);
    }

    // Adicionar role de cliente
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: newUserId,
        role: 'client'
      });

    if (roleError) {
      console.error('Erro ao criar role:', roleError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cadastro realizado com sucesso!',
        email: userEmail
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro em client-first-registration:', error);
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
