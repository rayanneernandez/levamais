import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  email: string;
  name: string;
  network_name: string;
  expiration_date: string;
  commitment_months: number;
  multiplier: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, network_name, expiration_date, commitment_months, multiplier }: EmailRequest = await req.json();

    console.log('📧 Enviando aviso de expiração para:', email);

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
              background-color: #f9f9f9;
            }
            .container {
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              text-align: center;
            }
            .content {
              padding: 30px;
            }
            .alert-box {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              border-radius: 4px;
              margin: 20px 0;
            }
            .info-box {
              background: #f4f4f4;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
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
              text-align: center;
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
            .highlight {
              color: #667eea;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⏰ Seu Benefício Está Expirando!</h1>
            </div>
            
            <div class="content">
              <p>Olá <strong>${name}</strong>,</p>
              
              <div class="alert-box">
                <p style="margin: 0;"><strong>⚠️ Atenção:</strong> Seu compromisso de retenção com <strong>${network_name}</strong> expira em 7 dias!</p>
              </div>
              
              <div class="info-box">
                <p style="margin: 5px 0;"><strong>📅 Data de Expiração:</strong> ${expiration_date}</p>
                <p style="margin: 5px 0;"><strong>⏱️ Período Atual:</strong> ${commitment_months} meses</p>
                <p style="margin: 5px 0;"><strong>🎯 Bônus Atual:</strong> +${multiplier}%</p>
              </div>
              
              <p><strong>O que acontece quando expirar?</strong></p>
              <ul>
                <li>Você voltará a acumular sem bônus</li>
                <li>Poderá renovar o compromisso</li>
                <li>Poderá trocar de rede favorita novamente</li>
              </ul>
              
              <p><strong>Quer continuar aproveitando os benefícios?</strong></p>
              <p>Você pode renovar seu compromisso a qualquer momento no portal do cliente!</p>
              
              <div style="text-align: center;">
                <a href="https://portal.levamais.app/levacliente/auth" class="button">Acessar Portal</a>
              </div>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                💡 <strong>Dica:</strong> Ao renovar, você pode escolher um período maior e ganhar ainda mais bônus!
              </p>

              <div class="footer">
                <p>Este é um e-mail automático. Por favor, não responda.</p>
                <p>&copy; ${new Date().getFullYear()} Leva+ Fidelidade. Todos os direitos reservados.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Leva+ <noreply@updates.levamais.app>",
        to: [email],
        subject: `⏰ Seu benefício expira em 7 dias - ${network_name}`,
        html: emailHtml,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", data);
      throw new Error(data.message || "Failed to send email");
    }

    console.log("✅ Email de aviso enviado com sucesso:", data);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email enviado com sucesso'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('❌ Erro ao enviar email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar e-mail';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
