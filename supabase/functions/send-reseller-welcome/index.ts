import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ResellerWelcomeData {
  resellerId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { resellerId } = await req.json() as ResellerWelcomeData

    if (!resellerId) {
      throw new Error('resellerId é obrigatório')
    }

    // Buscar dados da revenda
    const { data: reseller, error: resellerError } = await supabase
      .from('resellers')
      .select('*')
      .eq('id', resellerId)
      .single()

    if (resellerError || !reseller) {
      throw new Error('Revenda não encontrada')
    }

    // Gerar senha temporária
    const temporaryPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12).toUpperCase()

    // Criar usuário no sistema de autenticação
    const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: reseller.email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: reseller.owner_name
      }
    })

    if (createUserError) {
      console.error('Erro ao criar usuário:', createUserError)
      throw new Error('Erro ao criar usuário de acesso')
    }

    // Gerar link de reset de senha
    const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: reseller.email,
      options: {
        redirectTo: 'https://portal.levamais.app/levarevendedor/trocar-senha'
      }
    })

    if (resetError) {
      console.error('Erro ao gerar link de reset:', resetError)
      throw new Error('Erro ao gerar link de acesso')
    }

    const resetLink = resetData.properties?.action_link || ''

    // Enviar email de boas-vindas
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
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
          .credentials {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #667eea;
          }
          .credential-item {
            margin: 10px 0;
          }
          .credential-label {
            font-weight: bold;
            color: #667eea;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Bem-vindo ao Portal do Revendedor!</h1>
          <p>Leva+ Fidelidade</p>
        </div>
        
        <div class="content">
          <h2>Olá, ${reseller.owner_name}!</h2>
          
          <p>Sua conta de revendedor foi criada com sucesso para <strong>${reseller.company_name}</strong>.</p>
          
          <p>Você agora tem acesso ao Portal do Revendedor, onde poderá acompanhar:</p>
          <ul>
            <li>Comissões mensais</li>
            <li>Clientes indicados</li>
            <li>Extratos de pagamentos</li>
            <li>Relatórios detalhados</li>
          </ul>

          <div class="credentials">
            <h3>Configure Sua Senha</h3>
            <div class="credential-item">
              <span class="credential-label">E-mail:</span> ${reseller.email}
            </div>
            <p>Clique no botão abaixo para criar sua senha de acesso ao portal:</p>
          </div>

          <div class="warning">
            <strong>⚠️ Importante:</strong> Este link é válido por 24 horas. Após criar sua senha, você terá acesso completo ao Portal do Revendedor.
          </div>

          <center>
            <a href="${resetLink}" class="button">
              Criar Minha Senha
            </a>
          </center>

          <p>Qualquer dúvida, entre em contato conosco!</p>

          <p>Atenciosamente,<br>
          <strong>Equipe Leva+ Fidelidade</strong></p>
        </div>

        <div class="footer">
          <p>Este é um email automático, por favor não responda.</p>
          <p>© ${new Date().getFullYear()} Leva+ Fidelidade - Todos os direitos reservados</p>
        </div>
      </body>
      </html>
    `

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'Leva+ Fidelidade <noreply@updates.levamais.app>',
        to: [reseller.email],
        subject: 'Bem-vindo ao Portal do Revendedor - Leva+ Fidelidade',
        html: emailHtml,
      }),
    })

    if (!resendResponse.ok) {
      const error = await resendResponse.text()
      console.error('Erro ao enviar email:', error)
      throw new Error(`Falha ao enviar email: ${error}`)
    }

    const emailResult = await resendResponse.json()

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email de boas-vindas enviado com sucesso',
        emailId: emailResult.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Erro em send-reseller-welcome:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
