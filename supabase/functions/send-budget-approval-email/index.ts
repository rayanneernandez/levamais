import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendBudgetEmailRequest {
  budget_id: string;
  recipient_email?: string; // Email opcional para sobrescrever o padrão
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { budget_id, recipient_email }: SendBudgetEmailRequest = await req.json();

    console.log("=== DEBUG EMAIL ===");
    console.log("budget_id:", budget_id);
    console.log("recipient_email recebido:", recipient_email);
    console.log("==================");

    // Buscar dados do orçamento
    const { data: budget, error: budgetError } = await supabase
      .from("budgets")
      .select(`
        *,
        networks (name)
      `)
      .eq("id", budget_id)
      .single();

    if (budgetError || !budget) {
      throw new Error("Orçamento não encontrado");
    }

    if (!budget.approval_token) {
      throw new Error("Token de aprovação não encontrado");
    }

    // Usar o email personalizado ou o email do solicitante
    const emailTo = recipient_email || budget.requester_email;
    
    console.log("=== EMAIL FINAL ===");
    console.log("Email que será usado:", emailTo);
    console.log("Veio de recipient_email?", !!recipient_email);
    console.log("==================");

    // Buscar itens do orçamento para calcular valores únicos e mensais
    const { data: budgetItems, error: itemsError } = await supabase
      .from("budget_items")
      .select(`
        *,
        products_services (
          is_recurring
        )
      `)
      .eq("budget_id", budget_id);

    if (itemsError) {
      throw new Error("Erro ao buscar itens do orçamento");
    }

    // Calcular valores únicos e mensais
    let uniqueValue = budget.products_total || 0;
    let monthlyValue = 0;

    budgetItems?.forEach(item => {
      if (item.products_services?.is_recurring) {
        monthlyValue += item.total_value;
      } else {
        // Já contabilizado em products_total ou é serviço único
        if (item.products_services && !item.products_services.is_recurring) {
          uniqueValue += item.total_value;
        }
      }
    });

    // Ajustar uniqueValue baseado em services_total - monthlyValue
    const servicesUniqueTotal = (budget.services_total || 0) - monthlyValue;
    uniqueValue = (budget.products_total || 0) + servicesUniqueTotal;

    // Construir URL de aprovação usando o subdomínio de assinaturas
    const baseUrl = "https://assinaturas.levamais.app";
    const approvalUrl = `${baseUrl}/proposta/aprovacao?token=${budget.approval_token}`;

    // Formatar data
    const expiresAt = new Date(budget.expires_at);
    const formattedDate = expiresAt.toLocaleDateString('pt-BR');

    // HTML do email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 650px;
              margin: 0 auto;
              padding: 0;
              background: #f5f5f5;
            }
            .container {
              background: white;
              margin: 20px;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #40b9d9 0%, #2a9bb8 100%);
              color: white;
              padding: 40px 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0 0 10px 0;
              font-size: 28px;
              font-weight: 700;
            }
            .header p {
              margin: 0;
              font-size: 16px;
              opacity: 0.95;
            }
            .content {
              padding: 40px 30px;
            }
            .hero-text {
              font-size: 22px;
              font-weight: 600;
              color: #2a9bb8;
              margin: 0 0 20px 0;
              line-height: 1.4;
            }
            .intro {
              font-size: 16px;
              color: #555;
              margin-bottom: 30px;
            }
            .info-card {
              background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
              border-left: 5px solid #40b9d9;
              padding: 20px;
              margin: 25px 0;
              border-radius: 8px;
            }
            .info-card p {
              margin: 8px 0;
              font-size: 15px;
            }
            .info-card strong {
              color: #2a9bb8;
            }
            .cta-section {
              text-align: center;
              margin: 40px 0;
              padding: 30px;
              background: #f8f9fa;
              border-radius: 8px;
            }
            .button {
              display: inline-block;
              padding: 18px 50px;
              background: linear-gradient(135deg, #40b9d9 0%, #2a9bb8 100%);
              color: white !important;
              text-decoration: none;
              border-radius: 50px;
              font-weight: 700;
              font-size: 16px;
              box-shadow: 0 4px 15px rgba(64, 185, 217, 0.3);
              transition: transform 0.2s;
            }
            .benefits {
              background: #fff9e6;
              border-radius: 8px;
              padding: 25px;
              margin: 30px 0;
            }
            .benefits h3 {
              color: #2a9bb8;
              margin-top: 0;
              font-size: 18px;
            }
            .benefits ul {
              margin: 15px 0;
              padding-left: 20px;
            }
            .benefits li {
              margin: 10px 0;
              font-size: 15px;
            }
            .important-box {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px 20px;
              margin: 25px 0;
              border-radius: 4px;
            }
            .important-box p {
              margin: 5px 0;
              font-size: 14px;
            }
            .footer {
              background: #f8f9fa;
              text-align: center;
              padding: 30px;
              color: #666;
              font-size: 13px;
            }
            .footer a {
              color: #40b9d9;
              text-decoration: none;
            }
            @media only screen and (max-width: 600px) {
              .container {
                margin: 10px;
              }
              .content {
                padding: 25px 20px;
              }
              .hero-text {
                font-size: 20px;
              }
              .button {
                padding: 15px 35px;
                font-size: 15px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚀 Revolucione sua Fidelização!</h1>
              <p>Sua proposta personalizada está pronta</p>
            </div>
            
            <div class="content">
              <p class="hero-text">
                Olá, ${budget.requester_name}! 👋
              </p>

              <p class="intro">
                Chegou a hora de <strong>transformar a relação com seus clientes</strong> e criar um programa de fidelidade que realmente funciona! 
                Preparamos uma proposta especial pensada nas necessidades do seu negócio.
              </p>

              <div class="benefits">
                <h3>🎯 Por que mudar o conceito de fidelidade?</h3>
                <ul>
                  <li><strong>Tecnologia que Engaja:</strong> Aplicativo intuitivo que seus clientes vão adorar usar</li>
                  <li><strong>Gestão Inteligente:</strong> Painel completo para acompanhar resultados em tempo real</li>
                  <li><strong>Cashback Real:</strong> Sistema transparente que aumenta a frequência de compra</li>
                  <li><strong>Marketing Automatizado:</strong> Campanhas personalizadas sem esforço</li>
                  <li><strong>Retenção Garantida:</strong> Compromissos de fidelização com bonificações progressivas</li>
                </ul>
              </div>

              <div class="info-card">
                <p><strong>📋 Número da Proposta:</strong> ${budget.budget_number}</p>
                <p><strong>🏢 Empresa:</strong> ${budget.networks?.name || 'Sua Empresa'}</p>
                <p><strong>💰 Investimento Único:</strong> ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(uniqueValue)}</p>
                <p><strong>🔄 Investimento Mensal:</strong> ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthlyValue)}</p>
                <p><strong>📅 Proposta válida até:</strong> ${formattedDate}</p>
              </div>

              <div class="cta-section">
                <p style="margin-bottom: 20px; font-size: 16px; color: #555;">
                  <strong>Pronto para dar o próximo passo?</strong>
                </p>
                <a href="${approvalUrl}" class="button">
                  ✨ Ver Proposta Completa e Aprovar
                </a>
                <p style="margin-top: 20px; font-size: 13px; color: #777;">
                  Processo 100% digital e seguro com assinatura eletrônica
                </p>
              </div>

              <div class="important-box">
                <p><strong>⚡ Processo Rápido e Seguro:</strong></p>
                <p>• Visualize todos os detalhes da proposta online</p>
                <p>• Aprovação com assinatura digital em poucos cliques</p>
                <p>• Verificação de email para garantir a segurança</p>
                <p>• Validade jurídica total após assinatura</p>
              </div>

              <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">
                Link direto para aprovação:<br>
                <a href="${approvalUrl}" style="color: #40b9d9; word-break: break-all;">${approvalUrl}</a>
              </p>
            </div>

            <div class="footer">
              <p><strong>Leva+ Fidelidade</strong></p>
              <p>A plataforma completa de gestão de fidelidade e relacionamento</p>
              <p style="margin-top: 15px;">
                📧 <a href="mailto:comercial@levamais.app">comercial@levamais.app</a> | 
                📱 (21) 3950-7641
              </p>
              <p style="margin-top: 15px; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Leva+ Fidelidade. Todos os direitos reservados.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Enviar email
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Leva+ Propostas <propostas@updates.levamais.app>",
        to: [emailTo],
        subject: `Proposta Comercial ${budget.budget_number} - Leva+ Fidelidade`,
        html: emailHtml,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", data);
      throw new Error(data.message || "Falha ao enviar email");
    }

    const resendEmailId = data.id;

    // Registrar envio do email
    await supabase.from("email_events").insert({
      budget_id: budget_id,
      event_type: "sent",
      email_to: emailTo,
      email_subject: `Proposta Comercial ${budget.budget_number} - Leva+ Fidelidade`,
      resend_email_id: resendEmailId,
      occurred_at: new Date().toISOString(),
    });

    // Atualizar status do orçamento para "sent"
    await supabase
      .from("budgets")
      .update({ status: 'sent' })
      .eq("id", budget_id);

    console.log("Email de proposta enviado para:", emailTo);

    return new Response(
      JSON.stringify({ success: true, approval_url: approvalUrl }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Erro em send-budget-approval-email:", error);
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
