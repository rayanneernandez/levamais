// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ClientVerificationRequest {
  email: string;
  code: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, code }: ClientVerificationRequest = await req.json();

    console.log('📧 Enviando código de verificação para:', email);

    if (!email || !code) {
      throw new Error('Email e código são obrigatórios');
    }

    // Enviar email usando Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Leva+ <noreply@updates.levamais.app>",
        to: [email],
        subject: "Código de Verificação - Leva+",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4F46E5; margin: 0;">Leva+</h1>
            </div>
            
            <h2 style="color: #333; margin-bottom: 20px;">Verificação de Email</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.5;">
              Use o código abaixo para verificar seu email e completar seu cadastro:
            </p>
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        padding: 30px; 
                        text-align: center; 
                        border-radius: 12px; 
                        margin: 30px 0;">
              <div style="color: white; 
                          font-size: 42px; 
                          font-weight: bold; 
                          letter-spacing: 8px; 
                          font-family: 'Courier New', monospace;">
                ${code}
              </div>
            </div>
            
            <div style="background: #fff5f5; 
                        border-left: 4px solid #e53e3e; 
                        padding: 15px; 
                        border-radius: 6px; 
                        margin: 20px 0;">
              <p style="color: #e53e3e; margin: 0; font-size: 14px;">
                ⚠️ <strong>IMPORTANTE:</strong> Este código expira em 10 minutos e só pode ser usado uma vez.
              </p>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.5;">
              Após verificar seu email, você poderá completar seu cadastro e começar a acumular pontos no programa de fidelidade.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              Se você não solicitou este código, pode ignorar este email com segurança.
            </p>
            
            <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
              Leva+ Fidelidade - Programa de Pontos e Recompensas
            </p>
          </div>
        `,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro Resend:", data);
      throw new Error(data.message || "Falha ao enviar email via Resend");
    }

    console.log("✅ Código de verificação enviado via Resend:", data.id);

    return new Response(
      JSON.stringify({ success: true, emailId: data.id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Erro em send-client-email-verification:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
