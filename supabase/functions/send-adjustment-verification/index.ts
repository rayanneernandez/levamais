import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from "../_shared/email-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerificationRequest {
  network_id: string;
  client_id: string;
  adjustment_data: {
    action_type: string;
    balance_type: string;
    amount: number;
    reason: string;
    store_id: string;
    description?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { network_id, client_id, adjustment_data }: VerificationRequest = await req.json();

    console.log("📧 Solicitação de código de verificação para reajuste");
    console.log("Network ID:", network_id);

    // Buscar email do administrador da rede
    const { data: network, error: networkError } = await supabaseClient
      .from("networks")
      .select("email, name")
      .eq("id", network_id)
      .single();

    if (networkError || !network) {
      console.error("Rede não encontrada:", networkError);
      throw new Error("Rede não encontrada");
    }

    // Se a rede não tiver email configurado, usar o email do admin do sistema
    // (necessário quando Resend está em modo de teste)
    let targetEmail = network.email;
    
    if (!targetEmail) {
      console.log("⚠️  Rede sem email configurado, usando email do sistema");
      // Buscar email de um admin do sistema como fallback
      const { data: adminProfile } = await supabaseClient
        .from("profiles")
        .select("email")
        .eq("id", "fb0f5e62-a2cf-4f44-a0fd-be7987de9f6f") // ID do Bruno admin
        .single();
      
      targetEmail = adminProfile?.email || "bruno.lyra@globaltera.com.br";
    }

    // Buscar dados do cliente
    const { data: client, error: clientError } = await supabaseClient
      .from("clients")
      .select("full_name, cpf")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      console.error("Cliente não encontrado:", clientError);
      throw new Error("Cliente não encontrado");
    }

    // Gerar código de 6 dígitos
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Salvar código no banco
    const { error: insertError } = await supabaseClient
      .from("adjustment_verification_codes")
      .insert({
        network_id,
        code: verificationCode,
        email: targetEmail,
        client_id,
        adjustment_data,
      });

    if (insertError) {
      console.error("Erro ao salvar código:", insertError);
      throw new Error("Erro ao gerar código de verificação");
    }

    // Preparar dados para o email
    const actionLabels = {
      adjust: "Ajustar para",
      add: "Adicionar",
      subtract: "Subtrair"
    };

    const typeLabels = {
      cashback: "cashback",
      points: "pontos"
    };

    const actionLabel = actionLabels[adjustment_data.action_type as keyof typeof actionLabels] || adjustment_data.action_type;
    const typeLabel = typeLabels[adjustment_data.balance_type as keyof typeof typeLabels] || adjustment_data.balance_type;

    // Enviar email com código
    const emailResult = await sendEmail(
      {
        to: targetEmail,
        from: "Leva+ Verificação <verificacao@updates.levamais.app>",
        subject: `Código de Verificação - Reajuste de Saldo`,
        html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .code-box { background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
              .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
              .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
              .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
              .detail-label { font-weight: bold; color: #666; }
              .detail-value { color: #333; }
              .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">🔐 Código de Verificação</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Reajuste de Saldo de Cliente</p>
              </div>
              <div class="content">
                <p>Olá,</p>
                <p>Uma solicitação de reajuste de saldo foi iniciada na rede <strong>${network.name}</strong>.</p>
                
                <div class="code-box">
                  <p style="margin: 0 0 10px 0; color: #666;">Seu código de verificação é:</p>
                  <div class="code">${verificationCode}</div>
                  <p style="margin: 10px 0 0 0; color: #999; font-size: 14px;">Válido por 10 minutos</p>
                </div>

                <div class="details">
                  <h3 style="margin-top: 0; color: #667eea;">📋 Detalhes do Reajuste</h3>
                  <div class="detail-row">
                    <span class="detail-label">Cliente:</span>
                    <span class="detail-value">${client.full_name}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">CPF:</span>
                    <span class="detail-value">${client.cpf}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Ação:</span>
                    <span class="detail-value">${actionLabel}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Tipo:</span>
                    <span class="detail-value">${typeLabel}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Valor:</span>
                    <span class="detail-value">${adjustment_data.amount}</span>
                  </div>
                  <div class="detail-row" style="border-bottom: none;">
                    <span class="detail-label">Motivo:</span>
                    <span class="detail-value">${adjustment_data.reason}</span>
                  </div>
                </div>

                <div class="warning">
                  <strong>⚠️ Atenção:</strong> Não compartilhe este código com ninguém. Ele será usado para autorizar uma operação sensível de reajuste de saldo.
                </div>

                <p style="color: #666; font-size: 14px;">
                  Se você não solicitou este código, ignore este email e o código expirará automaticamente em 10 minutos.
                </p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Leva+ Fidelidade - Sistema de Gestão</p>
              </div>
            </div>
          </body>
        </html>
      `,
    }, "internal_email");

    if (!emailResult.success) {
      console.error("Erro ao enviar email:", emailResult.error);
      throw new Error("Erro ao enviar código por email");
    }

    console.log("✅ Código enviado com sucesso para:", targetEmail);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Código enviado com sucesso",
        email_sent_to: targetEmail,
        warning: !network.email ? "Email enviado para administrador do sistema (configure o email da rede)" : undefined,
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
    console.error("Erro na função send-adjustment-verification:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
};

serve(handler);
