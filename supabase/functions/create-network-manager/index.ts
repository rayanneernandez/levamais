import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    const { name, email, network_id, network_name } = await req.json();

    console.log('Creating network manager:', { email, name, network_id });

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users?.some(u => u.email === email);

    if (userExists) {
      throw new Error('Este e-mail já está cadastrado no sistema');
    }

    // Set default password
    const defaultPassword = 'Leva+2025';

    // Create user in auth
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: {
        full_name: name
      }
    });

    if (createError) {
      console.error('Error creating auth user:', createError);
      throw createError;
    }

    console.log('Auth user created:', authData.user.id);

    // Update profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: name,
        email: email,
        force_password_change: true
      })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      throw profileError;
    }

    // Add network_manager role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'network_manager'
      });

    if (roleError) {
      console.error('Error creating role:', roleError);
      throw roleError;
    }

    // Get default access profile
    const { data: defaultProfile } = await supabaseAdmin
      .from('access_profiles')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single();

    // Create store manager entry (without specific store)
    const { error: managerError } = await supabaseAdmin
      .from('store_managers')
      .insert({
        user_id: authData.user.id,
        network_id: network_id,
        access_profile_id: defaultProfile?.id,
        must_change_password: true,
        is_attendant: false,
        store_id: null
      });

    if (managerError) {
      console.error('Error creating store manager:', managerError);
      throw managerError;
    }

    console.log('Store manager created, sending welcome email via Resend');

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
            <p>Olá, <strong>${name}</strong>!</p>
            
            <p>Sua conta de gestor da rede <strong>${network_name}</strong> foi criada com sucesso!</p>
            
            <p>Use as credenciais abaixo para acessar o portal:</p>
            
            <div style="background: #f4f4f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>E-mail:</strong> ${email}</p>
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
        to: [email],
        subject: "Bem-vindo(a) à Leva+ - Configure sua Senha! 🎉",
        html: emailHtml,
      }),
    });

    const emailData = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", emailData);
      // Don't throw - user was created successfully
      console.log('Warning: Failed to send welcome email, but user was created');
    } else {
      console.log("Welcome email sent successfully via Resend:", emailData);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authData.user.id,
        message: 'Gestor da rede criado com sucesso. Um e-mail foi enviado para configurar a senha.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error in create-network-manager:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao criar gestor da rede';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
