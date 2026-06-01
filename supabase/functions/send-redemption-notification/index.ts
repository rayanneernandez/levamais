// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RedemptionNotificationRequest {
  attendantName: string;
  attendantEmail: string;
  attendantCode: string;
  rewardName: string;
  pointsSpent: number;
  newBalance: number;
  managerEmail: string;
  networkName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      attendantName,
      attendantEmail,
      attendantCode,
      rewardName,
      pointsSpent,
      newBalance,
      managerEmail,
      networkName,
    }: RedemptionNotificationRequest = await req.json();

    console.log("Sending redemption notifications", {
      attendantEmail,
      managerEmail,
      rewardName,
    });

    // E-mail para o colaborador
    const attendantEmailResponse = await resend.emails.send({
      from: "Leva+ <noreply@updates.levamais.app>",
      to: [attendantEmail],
      subject: "✅ Resgate Realizado - Leva+ Valoriza",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
            Resgate Realizado com Sucesso!
          </h1>
          
          <p style="font-size: 16px; color: #333;">Olá, <strong>${attendantName}</strong>!</p>
          
          <p style="font-size: 14px; color: #666;">
            Seu resgate foi realizado com sucesso e está aguardando aprovação do gestor.
          </p>
          
          <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #1f2937;">Detalhes do Resgate</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Prêmio:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${rewardName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Pontos Utilizados:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #dc2626;">-${pointsSpent}</td>
              </tr>
              <tr style="border-top: 2px solid #d1d5db;">
                <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Saldo Atual:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #2563eb; font-size: 18px;">${newBalance}</td>
              </tr>
            </table>
          </div>
          
          <p style="font-size: 14px; color: #666;">
            Você receberá outra notificação quando seu resgate for aprovado.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
          
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">
            Leva+ Fidelidade - Continue acumulando pontos!
          </p>
        </div>
      `,
    });

    console.log("Attendant email sent:", attendantEmailResponse);

    // E-mail para o gestor (se configurado)
    if (managerEmail) {
      const managerEmailResponse = await resend.emails.send({
        from: "Leva+ <noreply@updates.levamais.app>",
        to: [managerEmail],
        subject: `🎁 Novo Resgate Pendente - ${attendantName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
              Novo Resgate Pendente de Aprovação
            </h1>
            
            <p style="font-size: 16px; color: #333;">
              Um colaborador realizou um resgate no programa <strong>Leva+ Valoriza</strong>.
            </p>
            
            <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h2 style="margin-top: 0; color: #1f2937;">Informações do Resgate</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Colaborador:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold;">${attendantName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Código:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold; font-family: monospace;">${attendantCode}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Rede:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold;">${networkName}</td>
                </tr>
                <tr style="border-top: 1px solid #d1d5db;">
                  <td style="padding: 8px 0; color: #6b7280;">Prêmio Resgatado:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #2563eb;">${rewardName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Pontos Gastos:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold;">${pointsSpent}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e; font-weight: bold;">⚠️ Ação Necessária</p>
              <p style="margin: 5px 0 0 0; color: #92400e; font-size: 14px;">
                Acesse o painel administrativo para aprovar ou recusar este resgate.
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
            
            <p style="font-size: 12px; color: #9ca3af; text-align: center;">
              Leva+ Fidelidade - Sistema de Gestão
            </p>
          </div>
        `,
      });

      console.log("Manager email sent:", managerEmailResponse);
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending redemption notification:", error);
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
