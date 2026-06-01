import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendEmail } from "../_shared/email-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ContactEmailRequest {
  name: string;
  email: string;
  phone: string;
  company: string;
  stores: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, phone, company, stores, message }: ContactEmailRequest = await req.json();

    console.log("Sending contact email from:", email);

    // Validação básica
    if (!name || !email || !phone) {
      throw new Error("Nome, email e telefone são obrigatórios");
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Email inválido");
    }

    // Salvar lead no banco de dados
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (supabaseUrl && supabaseServiceKey) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { error: leadError } = await supabase.from("leads").insert({
        name,
        email,
        phone: phone || null,
        company: company || null,
        message: message || "Contato via WhatsApp",
        status: "new",
        source: "website",
      });

      if (leadError) {
        console.error("Erro ao salvar lead:", leadError);
      } else {
        console.log("Lead salvo com sucesso");
      }
    }

    // Enviar email para a empresa usando o provider configurado
    const emailToCompanyResult = await sendEmail(
      {
        to: "comercial@levamais.app",
        subject: `Novo contato do site - ${name}`,
        html: `
          <h2>Novo contato recebido do site Leva+</h2>
          <hr />
          <p><strong>Nome:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Telefone:</strong> ${phone}</p>
          ${company ? `<p><strong>Empresa:</strong> ${company}</p>` : ''}
          ${stores ? `<p><strong>Número de lojas:</strong> ${stores}</p>` : ''}
          <hr />
          ${message ? `<p><strong>Mensagem:</strong></p><p>${message}</p><hr />` : ''}
          <p style="color: #666; font-size: 12px;">Este email foi enviado automaticamente pelo formulário de contato do site Leva+</p>
        `,
        from: "Leva+ Contato <contato@updates.levamais.app>",
      },
      "internal_email"
    );

    if (!emailToCompanyResult.success) {
      console.error("Erro ao enviar email para empresa:", emailToCompanyResult.error);
    } else {
      console.log(`✅ Email para empresa enviado via ${emailToCompanyResult.provider}`);
    }

    // Enviar email de confirmação para o cliente
    const emailToClientResult = await sendEmail(
      {
        to: email,
        subject: "Recebemos sua mensagem! - Leva+",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #00FFFF;">Olá, ${name}!</h1>
            <p>Obrigado por entrar em contato com a <strong>Leva+</strong>.</p>
            <p>Recebemos sua mensagem e nossa equipe entrará em contato em até 24 horas.</p>
            ${message && message !== "Contato via WhatsApp" ? `
            <hr style="border: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #666; font-size: 14px;"><strong>Resumo da sua mensagem:</strong></p>
            <p style="background: #f5f5f5; padding: 15px; border-radius: 5px;">${message}</p>
            ` : ''}
            <hr style="border: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #999; font-size: 12px;">
              Se você tiver alguma dúvida urgente, pode entrar em contato conosco pelo WhatsApp: 
              <a href="https://api.whatsapp.com/send/?phone=5521995071007" style="color: #00FFFF;">+55 21 99507-1007</a>
            </p>
            <p style="color: #00FFFF; font-style: italic; margin-top: 30px;">
              "Fazer o simples ser simples é o que nos torna únicos."
            </p>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
              © 2025 Leva+ by GlobalTera. Todos os direitos reservados.
            </p>
          </div>
        `,
        from: "Leva+ <noreply@updates.levamais.app>",
      },
      "internal_email"
    );

    if (!emailToClientResult.success) {
      console.error("Erro ao enviar email para cliente:", emailToClientResult.error);
    } else {
      console.log(`✅ Email para cliente enviado via ${emailToClientResult.provider}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Emails enviados com sucesso" 
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
    console.error("Error in send-contact-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Erro ao enviar email" 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
