import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      throw new Error('Email é obrigatório');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verificar se o usuário existe e é um cliente
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!profile) {
      // Por segurança, retornar sucesso mesmo se o email não existir
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Se o email estiver cadastrado, você receberá as instruções de recuperação.' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Verificar se tem role de cliente
    const { data: clientRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', profile.id)
      .eq('role', 'client')
      .single();

    if (!clientRole) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Se o email estiver cadastrado, você receberá as instruções de recuperação.' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Gerar link de recuperação customizado
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: 'https://portal.levamais.app/levacliente',
      }
    });

    if (resetError || !resetData) {
      console.error('Erro ao gerar link de recuperação:', resetError);
      throw new Error('Erro ao gerar link de recuperação');
    }

    // Importar o email provider
    const { sendEmail } = await import('../_shared/email-provider.ts');

    // Enviar e-mail customizado em português
    const emailHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Redefinição de Senha - Leva+</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Leva+</h1>
                    <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">Programa de Fidelidade</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: 600;">Redefinir sua senha</h2>
                    
                    <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                      Você solicitou a redefinição de senha da sua conta. Clique no botão abaixo para criar uma nova senha:
                    </p>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 30px 0;">
                          <a href="${resetData.properties.action_link}" 
                             style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.25);">
                            Redefinir Senha
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.5;">
                      Ou copie e cole o seguinte link no seu navegador:
                    </p>
                    <p style="margin: 10px 0 0 0; padding: 15px; background-color: #f8f9fa; border-radius: 4px; word-break: break-all; font-size: 12px; color: #666666;">
                      ${resetData.properties.action_link}
                    </p>
                    
                    <div style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0; color: #999999; font-size: 13px; line-height: 1.5;">
                        <strong>Não solicitou esta alteração?</strong><br>
                        Se você não solicitou a redefinição de senha, pode ignorar este e-mail com segurança.
                      </p>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
                    <p style="margin: 0 0 10px 0; color: #999999; font-size: 12px;">
                      © ${new Date().getFullYear()} Leva+ Fidelidade. Todos os direitos reservados.
                    </p>
                    <p style="margin: 0; color: #999999; font-size: 12px;">
                      <a href="https://portal.levamais.app" style="color: #667eea; text-decoration: none;">portal.levamais.app</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const emailResult = await sendEmail({
      to: [email],
      subject: 'Redefinição de Senha - Leva+ Fidelidade',
      html: emailHtml,
    }, 'client_email');

    if (!emailResult.success) {
      console.error('Erro ao enviar e-mail:', emailResult.error);
      throw new Error('Erro ao enviar e-mail de recuperação');
    }

    console.log('E-mail de recuperação enviado com sucesso para:', email);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email de recuperação enviado com sucesso!'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Erro em client-forgot-password:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
