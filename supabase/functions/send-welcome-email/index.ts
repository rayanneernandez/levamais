import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendEmail } from "../_shared/email-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  name: string;
  email: string;
  cpf: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, cpf }: WelcomeEmailRequest = await req.json();

    console.log("Sending welcome email to:", email);

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
            .section {
              background: white;
              padding: 20px;
              margin: 20px 0;
              border-radius: 8px;
              border-left: 4px solid #667eea;
            }
            .highlight {
              background: #667eea;
              color: white;
              padding: 15px;
              border-radius: 8px;
              margin: 15px 0;
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
            h2 {
              color: #667eea;
              margin-top: 0;
            }
            ul {
              padding-left: 20px;
            }
            li {
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎉 Bem-vindo(a) à Leva+!</h1>
          </div>
          
          <div class="content">
            <p>Olá, <strong>${name}</strong>!</p>
            
            <p>É com muita alegria que damos as boas-vindas ao programa de fidelidade Leva+! 🎊</p>
            
            <div class="section">
              <h2>📱 Como acessar sua conta</h2>
              <p><strong>Login:</strong> Use seu CPF (${cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')})</p>
              <p><strong>Senha:</strong> A senha que você cadastrou</p>
              <p><em>⚠️ Importante: Ao fazer seu primeiro login, será necessário validar seu e-mail e celular.</em></p>
            </div>

            <div class="section">
              <h2>🎁 Como funciona o Leva+</h2>
              <ul>
                <li><strong>Acumule pontos:</strong> Em todas as lojas que possuem o Leva+, você acumula pontos automaticamente em suas compras!</li>
                <li><strong>Resgate seus pontos:</strong> Você pode trocar seus pontos por benefícios, mas lembre-se: o resgate só pode ser feito em lojas do mesmo grupo onde você acumulou.</li>
                <li><strong>Acompanhe tudo:</strong> No portal do cliente, você tem acesso completo ao extrato de acúmulo e resgate de pontos.</li>
              </ul>
            </div>

            <div class="highlight">
              <h2 style="color: white; margin-top: 0;">💡 Resgate Simples e Rápido</h2>
              <p style="margin: 0;">Não se preocupe com vouchers ou códigos complicados! Nosso resgate é feito diretamente no checkout com o atendente. É prático, rápido e sem burocracia!</p>
            </div>

            <div class="section">
              <h2>🌟 Próximos Passos</h2>
              <ol>
                <li>Faça login no portal do cliente</li>
                <li>Valide seu e-mail e celular</li>
                <li>Comece a acumular pontos em suas compras!</li>
              </ol>
            </div>

            <p>Estamos muito felizes em tê-lo(a) conosco! Se tiver qualquer dúvida, nossa equipe está à disposição para ajudar.</p>
            
            <p><strong>Boas compras e bons acúmulos! 🚀</strong></p>

            <div class="footer">
              <p>Este é um e-mail automático. Por favor, não responda.</p>
              <p>&copy; ${new Date().getFullYear()} Leva+ Fidelidade. Todos os direitos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Enviar email usando o provider configurado (internal_email)
    const emailResult = await sendEmail(
      {
        to: email,
        subject: "Bem-vindo(a) à Leva+! 🎉",
        html: emailHtml,
        from: "Leva+ <noreply@updates.levamais.app>",
      },
      "internal_email"
    );

    if (!emailResult.success) {
      throw new Error(emailResult.error || "Falha ao enviar email");
    }

    console.log(`✅ Email enviado via ${emailResult.provider}:`, emailResult.emailId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: emailResult.emailId,
        provider: emailResult.provider 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
