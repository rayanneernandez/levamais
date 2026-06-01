import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { sendEmail } from "../_shared/email-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerificationRequest {
  budget_id: string;
  email: string;
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

    const { budget_id, email }: VerificationRequest = await req.json();

    // Gerar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Salvar código no banco
    const { error: dbError } = await supabase
      .from("budget_verification_codes")
      .insert({
        budget_id,
        email,
        code,
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
      });

    if (dbError) throw dbError;

    // Enviar email usando o provider configurado (internal_email)
    const emailResult = await sendEmail(
      {
        to: email,
        subject: "Código de Verificação - Aprovação de Proposta",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #40b9d9;">Código de Verificação</h1>
            <p>Use o código abaixo para verificar seu email e aprovar a proposta comercial:</p>
            <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
              ${code}
            </div>
            <p style="color: #666;">Este código é válido por 10 minutos.</p>
            <p style="color: #666;">Se você não solicitou este código, ignore este email.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px;">Leva+ Fidelidade - Sistema de Gestão de Fidelidade</p>
          </div>
        `,
        from: "Leva+ Verificação <verificacao@updates.levamais.app>",
      },
      "internal_email"
    );

    if (!emailResult.success) {
      throw new Error(emailResult.error || "Falha ao enviar email");
    }

    console.log(`✅ Email enviado via ${emailResult.provider}:`, emailResult.emailId);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Erro em send-verification-email:", error);
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
