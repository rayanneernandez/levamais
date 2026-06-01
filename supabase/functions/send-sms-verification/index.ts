import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendSMS } from "../_shared/sms-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SMSVerificationRequest {
  phone: string;
  code: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, code }: SMSVerificationRequest = await req.json();

    console.log("Sending SMS verification to:", phone);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Enviar SMS usando o provider configurado (internal_sms)
    const message = `Seu código de verificação Leva+ é: ${code}\n\nEste código expira em 10 minutos.\nNunca compartilhe este código.`;
    
    const smsResult = await sendSMS(phone, message, "internal_sms");

    if (!smsResult.success) {
      throw new Error(smsResult.error || "Falha ao enviar SMS");
    }

    console.log(`✅ SMS enviado via ${smsResult.provider}:`, smsResult.messageId);

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: smsResult.messageId,
      provider: smsResult.provider 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending SMS:", error);
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
