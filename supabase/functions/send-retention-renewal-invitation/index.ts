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
  previous_commitment_months: number;
  previous_multiplier: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, network_name, previous_commitment_months, previous_multiplier }: EmailRequest = await req.json();

    console.log('📧 Enviando convite de renovação para:', email);

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
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              padding: 30px;
              text-align: center;
            }
            .content {
              padding: 30px;
            }
            .success-box {
              background: #d1fae5;
              border-left: 4px solid #10b981;
              padding: 15px;
              border-radius: 4px;
              margin: 20px 0;
            }
            .plan-cards {
              display: flex;
              gap: 15px;
              margin: 20px 0;
              flex-wrap: wrap;
            }
            .plan-card {
              flex: 1;
              min-width: 150px;
              background: #f4f4f4;
              padding: 20px;
              border-radius: 8px;
              text-align: center;
              border: 2px solid #e5e5e5;
            }
            .plan-card.highlight {
              background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
              border-color: #f59e0b;
            }
            .plan-card h3 {
              margin: 0 0 10px 0;
              font-size: 24px;
              color: #667eea;
            }
            .plan-card.highlight h3 {
              color: #d97706;
            }
            .plan-card .bonus {
              font-size: 20px;
              font-weight: bold;
              color: #10b981;
            }
            .button {
              display: inline-block;
              background: #10b981;
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
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Renove Seu Benefício!</h1>
            </div>
            
            <div class="content">
              <p>Olá <strong>${name}</strong>,</p>
              
              <div class="success-box">
                <p style="margin: 0;"><strong>✅ Parabéns!</strong> Você completou seu compromisso de ${previous_commitment_months} meses com <strong>${network_name}</strong>!</p>
              </div>
              
              <p><strong>Seu desempenho:</strong></p>
              <ul>
                <li>Período cumprido: ${previous_commitment_months} meses</li>
                <li>Bônus recebido: +${previous_multiplier}%</li>
                <li>✨ Você aproveitou benefícios exclusivos!</li>
              </ul>
              
              <p><strong>Quer continuar com os benefícios?</strong></p>
              <p>Renove agora e escolha um novo plano:</p>
              
              <div class="plan-cards">
                <div class="plan-card">
                  <h3>6 meses</h3>
                  <div class="bonus">+10%</div>
                  <p style="font-size: 12px; color: #666; margin: 5px 0 0 0;">Bônus</p>
                </div>
                
                <div class="plan-card">
                  <h3>9 meses</h3>
                  <div class="bonus">+15%</div>
                  <p style="font-size: 12px; color: #666; margin: 5px 0 0 0;">Bônus</p>
                </div>
                
                <div class="plan-card highlight">
                  <h3>12 meses</h3>
                  <div class="bonus">+20%</div>
                  <p style="font-size: 12px; color: #d97706; margin: 5px 0 0 0;">⭐ Popular</p>
                </div>
              </div>
              
              <p><strong>Benefícios ao renovar:</strong></p>
              <ul>
                <li>Continue acumulando com bônus</li>
                <li>Mantenha seus privilégios exclusivos</li>
                <li>Aproveite ofertas especiais</li>
              </ul>
              
              <div style="text-align: center;">
                <a href="https://portal.levamais.app/levacliente/auth" class="button">Renovar Agora</a>
              </div>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                💡 <strong>Dica:</strong> Quanto maior o período, maior o bônus! Escolha 12 meses e ganhe +20%!
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
        subject: `🎉 Parabéns! Renove seu benefício na ${network_name}`,
        html: emailHtml,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", data);
      throw new Error(data.message || "Failed to send email");
    }

    console.log("✅ Email de renovação enviado com sucesso:", data);

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
