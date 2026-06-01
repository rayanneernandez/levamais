import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Verify admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { network_id } = await req.json();

    console.log('Resending welcome email for network:', network_id);

    // Buscar dados da rede
    const { data: network, error: networkError } = await supabaseAdmin
      .from('networks')
      .select('name, email')
      .eq('id', network_id)
      .single();

    if (networkError || !network) {
      throw new Error('Rede não encontrada');
    }

    // Buscar o usuário associado à rede
    const { data: manager, error: managerError } = await supabaseAdmin
      .from('store_managers')
      .select('user_id')
      .eq('network_id', network_id)
      .is('store_id', null)
      .single();

    if (managerError || !manager) {
      throw new Error('Gestor da rede não encontrado');
    }

    // Buscar email do usuário
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(manager.user_id);

    if (userError || !userData.user || !userData.user.email) {
      throw new Error('Usuário não encontrado ou sem e-mail cadastrado');
    }

    const userEmail = userData.user.email;
    console.log('Sending welcome email to:', userEmail);

    // HTML do e-mail
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .content {
              background: #f9f9f9;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .button {
              display: inline-block;
              background: #667eea;
              color: white;
              padding: 15px 30px;
              text-decoration: none;
              border-radius: 8px;
              margin: 20px 0;
              font-weight: bold;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              color: #666;
              font-size: 14px;
            }
            h1 {
              margin: 0;
              font-size: 28px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎉 Bem-vindo(a) à Leva+!</h1>
          </div>
          
          <div class="content">
            <p>Olá!</p>
            
            <p>Sua conta de gestor da rede <strong>${network.name}</strong> foi criada com sucesso!</p>
            
            <p>Use as credenciais abaixo para acessar o portal:</p>
            
            <div style="background: #f4f4f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>E-mail:</strong> ${userEmail}</p>
              <p style="margin: 5px 0;"><strong>Senha:</strong> Leva+2025</p>
            </div>
            
            <div style="text-align: center;">
              <a href="https://portal.levamais.app/levaloja/auth" class="button">Acessar Portal</a>
            </div>
            
            <p><strong>⚠️ Importante:</strong> Você será solicitado a trocar sua senha no primeiro acesso.</p>

            <p>Se tiver qualquer dúvida, nossa equipe está à disposição para ajudar.</p>
            
            <p><strong>Boas-vindas! 🚀</strong></p>

            <div class="footer">
              <p>Este é um e-mail automático. Por favor, não responda.</p>
              <p>&copy; ${new Date().getFullYear()} Leva+ Fidelidade. Todos os direitos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Enviar e-mail via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Leva+ <noreply@updates.levamais.app>",
        to: [userEmail],
        subject: "Bem-vindo(a) à Leva+ - Configure sua Senha! 🎉",
        html: emailHtml,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", data);
      throw new Error(data.message || "Failed to send email");
    }

    console.log("Welcome email sent successfully via Resend:", data);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'E-mail de boas-vindas reenviado com sucesso!'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error in resend-welcome-email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao reenviar e-mail';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
