import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

interface CheckSMSStatusRequest {
  message_sid: string; // SID da mensagem retornado no envio
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_sid }: CheckSMSStatusRequest = await req.json();

    if (!message_sid) {
      throw new Error("SID da mensagem é obrigatório");
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error("Twilio não configurado");
    }

    // Consultar status na API do Twilio
    const messageUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages/${message_sid}.json`;
    
    console.log("Consultando status SMS Twilio:", message_sid);

    const response = await fetch(messageUrl, {
      method: "GET",
      headers: {
        Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro Twilio:", data);
      throw new Error(data.message || "Falha ao consultar status SMS");
    }

    console.log("Resposta Twilio:", data);

    return new Response(
      JSON.stringify({
        success: true,
        message_sid,
        status: data.status,
        error_code: data.error_code,
        error_message: data.error_message,
        price: data.price,
        price_unit: data.price_unit,
        date_sent: data.date_sent,
        date_updated: data.date_updated,
        raw_response: data,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Erro ao consultar status SMS Twilio:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
