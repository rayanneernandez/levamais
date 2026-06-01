// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { sendEmail } from '../_shared/email-provider.ts';

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

    const { clientId, email } = await req.json();

    console.log('🔵 Iniciando envio de convite - versão com domínio verificado');

    if (!clientId || !email) {
      throw new Error('ID do cliente e email são obrigatórios');
    }

    // Buscar dados do cliente
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('cpf, full_name, network_id, user_id, email_validated')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      throw new Error('Cliente não encontrado');
    }

    console.log('Cliente encontrado:', { 
      user_id: client.user_id, 
      email_validated: client.email_validated 
    });

    // Se já tem user_id E email validado, não pode reenviar
    if (client.user_id && client.email_validated) {
      console.log('Bloqueando reenvio: cliente já tem acesso ativo');
      throw new Error('Este cliente já possui acesso ativo ao aplicativo');
    }

    console.log('Permitindo envio/reenvio de convite');

    // Buscar nome da rede
    const { data: network } = await supabase
      .from('networks')
      .select('name')
      .eq('id', client.network_id)
      .single();

    const networkName = network?.name || 'Rede';

    // Se já tem user_id, significa que é reenvio
    if (client.user_id) {
      console.log('Reenviando convite para cliente existente:', client.user_id);
      
      // Gerar link de reset de senha com redirect para login do cliente
      const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: email,
        options: {
          redirectTo: 'https://portal.levamais.app/levacliente'
        }
      });

      if (resetError) throw resetError;

      const resetUrl = resetData.properties.action_link;

      // Enviar email de reenvio
      const emailResult = await sendEmail({
        to: email,
        subject: `Reenvio: Defina sua senha - ${networkName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Bem-vindo ao Leva+!</h2>
            <p>Olá, ${client.full_name}!</p>
            <p>Você solicitou um novo link para definir sua senha no programa de fidelidade <strong>${networkName}</strong>.</p>
            <p>Clique no botão abaixo para criar sua senha e acessar o aplicativo:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                Definir Minha Senha
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              <strong>Seu CPF para login:</strong> ${client.cpf}
            </p>
            <p style="color: #e53e3e; font-size: 14px; background: #fff5f5; padding: 12px; border-radius: 6px; border-left: 4px solid #e53e3e;">
              ⚠️ <strong>IMPORTANTE:</strong> Este link é válido por apenas 1 hora e pode ser usado uma única vez. Se expirar, solicite um novo link.
            </p>
            <p style="color: #666; font-size: 14px;">
              Após definir sua senha, você poderá fazer login usando seu CPF e a senha criada em <strong>Portal Cliente</strong>.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
              Se você não solicitou este email, pode ignorá-lo com segurança.
            </p>
          </div>
        `,
      }, 'client_email');

      if (!emailResult.success) {
        throw new Error(`Falha ao enviar email: ${emailResult.error}`);
      }

      console.log('Email de reenvio enviado para:', email);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Convite reenviado com sucesso!'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cliente não tem user_id ainda - criar novo usuário
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      email_confirm: true,
      user_metadata: {
        full_name: client.full_name,
        pending_first_access: true
      }
    });

    if (authError) {
      // Email já existe mas cliente não tinha user_id - buscar e associar
      console.log('Email já existe, buscando usuário e associando ao cliente');
      
      // Buscar user_id pelo email
      const { data: existingUser } = await supabase.auth.admin.listUsers();
      const user = existingUser.users.find(u => u.email === email);
      
      if (user) {
        // Atualizar cliente com user_id
        await supabase
          .from('clients')
          .update({ 
            user_id: user.id,
            email: email 
          })
          .eq('id', clientId);

        // Criar perfil se não existir
        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            full_name: client.full_name,
            email: email,
            force_password_change: false
          });

        // Adicionar role de cliente (verificar se já existe)
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', user.id)
          .eq('role', 'client')
          .single();

        if (!existingRole) {
          await supabase
            .from('user_roles')
            .insert({
              user_id: user.id,
              role: 'client'
            });
        }
      }

      // Gerar link de reset de senha com redirect para login do cliente
      const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: email,
        options: {
          redirectTo: 'https://portal.levamais.app/levacliente'
        }
      });

      if (resetError) throw resetError;

      const resetUrl = resetData.properties.action_link;

      // Enviar email com link de reset
      const emailResult = await sendEmail({
        to: email,
        subject: `Defina sua senha - ${networkName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Bem-vindo ao Leva+!</h2>
            <p>Olá, ${client.full_name}!</p>
            <p>Você foi cadastrado no programa de fidelidade <strong>${networkName}</strong>.</p>
            <p>Para acessar o aplicativo Leva+ e começar a acumular pontos, você precisa definir sua senha.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                Definir Minha Senha
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              <strong>Seu CPF para login:</strong> ${client.cpf}
            </p>
            <p style="color: #e53e3e; font-size: 14px; background: #fff5f5; padding: 12px; border-radius: 6px; border-left: 4px solid #e53e3e;">
              ⚠️ <strong>IMPORTANTE:</strong> Este link é válido por apenas 1 hora e pode ser usado uma única vez. Se expirar, solicite um novo link.
            </p>
            <p style="color: #666; font-size: 14px;">
              Após definir sua senha, você poderá fazer login usando seu CPF e a senha criada em <strong>Portal Cliente</strong>.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
              Se você não solicitou este cadastro, pode ignorar este email.
            </p>
          </div>
        `,
      }, 'client_email');

      if (!emailResult.success) {
        throw new Error(`Falha ao enviar email: ${emailResult.error}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email de convite enviado com sucesso'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newUserId = authData.user.id;

    // Atualizar cliente com user_id
    await supabase
      .from('clients')
      .update({ 
        user_id: newUserId,
        email: email 
      })
      .eq('id', clientId);

    // Criar perfil
    await supabase
      .from('profiles')
      .insert({
        id: newUserId,
        full_name: client.full_name,
        email: email,
        force_password_change: false
      });

    // Adicionar role de cliente
    await supabase
      .from('user_roles')
      .insert({
        user_id: newUserId,
        role: 'client'
      });

    // Gerar link de definição de senha com redirect para login do cliente
    const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: 'https://portal.levamais.app/levacliente'
      }
    });

    if (resetError) throw resetError;

    const resetUrl = resetData.properties.action_link;

    // Enviar email de convite
    const emailResult = await sendEmail({
      to: email,
      subject: `Crie sua senha - ${networkName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Bem-vindo ao Leva+!</h2>
          <p>Olá, ${client.full_name}!</p>
          <p>Você foi cadastrado no programa de fidelidade <strong>${networkName}</strong>.</p>
          <p>Para acessar o aplicativo Leva+ e começar a acumular pontos, você precisa criar sua senha.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
              Criar Minha Senha
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            <strong>Seu CPF para login:</strong> ${client.cpf}
          </p>
          <p style="color: #e53e3e; font-size: 14px; background: #fff5f5; padding: 12px; border-radius: 6px; border-left: 4px solid #e53e3e;">
            ⚠️ <strong>IMPORTANTE:</strong> Este link é válido por apenas 1 hora e pode ser usado uma única vez. Se expirar, solicite um novo link.
          </p>
          <p style="color: #666; font-size: 14px;">
            Após criar sua senha, você poderá fazer login usando seu CPF e a senha criada em <strong>Portal Cliente</strong>.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            Se você não solicitou este cadastro, pode ignorar este email.
          </p>
        </div>
      `,
    }, 'client_email');

    if (!emailResult.success) {
      throw new Error(`Falha ao enviar email: ${emailResult.error}`);
    }

    console.log('Email de convite enviado para:', email);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Convite enviado com sucesso!'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro em send-client-invite:', error);
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
