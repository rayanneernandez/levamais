import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendSMSRequest {
  phone: string; // Número com DDD (ex: 13981460806)
  message: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, message }: SendSMSRequest = await req.json();

    if (!phone || !message) {
      throw new Error("Telefone e mensagem são obrigatórios");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Buscar credenciais da Mex10
    const { data: integration, error: integrationError } = await supabaseClient
      .from("api_integrations")
      .select("credentials")
      .eq("provider", "mex10")
      .eq("status", "active")
      .single();

    if (integrationError || !integration) {
      throw new Error("Integração Mex10 não encontrada ou inativa");
    }

    const { token, endpoint } = integration.credentials;

    if (!token || !endpoint) {
      throw new Error("Credenciais da Mex10 não configuradas corretamente");
    }

    // Limpar número (remover caracteres não numéricos)
    const cleanPhone = phone.replace(/\D/g, "");

    // Enviar SMS pela API da Mex10
    const smsUrl = `${endpoint}?token=${token}&t=send&n=${cleanPhone}&m=${encodeURIComponent(message)}`;
    
    console.log("Enviando SMS Mex10 para:", cleanPhone);

    const response = await fetch(smsUrl);
    const data = await response.text();

    console.log("Resposta Mex10:", data);

    // Parsear resposta da API MEX10
    // Formato: { "data": { "success": true }, "errors": { "error": false }, "sms": { "code": uuid, "status": PENDENTE } }
    // NOTA: A API retorna JSON malformado (sem aspas em alguns valores)
    let success = false;
    let smsCode = null;

    try {
      // Corrigir JSON malformado da Mex10
      // Adicionar aspas nos UUIDs e status que vêm sem aspas
      let fixedData = data
        .replace(/"code":([0-9a-f-]+),/gi, '"code":"$1",')
        .replace(/"status":([A-Z]+),/g, '"status":"$1",');
      
      console.log("JSON corrigido:", fixedData);
      
      const jsonData = JSON.parse(fixedData);
      console.log("✅ JSON parseado com sucesso");
      
      // Verificar sucesso: data.success === true OU errors.error === false
      if (jsonData.data && jsonData.data.success === true) {
        console.log("✅ Success detectado via data.success");
        success = true;
      } else if (jsonData.errors && jsonData.errors.error === false) {
        console.log("✅ Success detectado via errors.error === false");
        success = true;
      }
      
      // Buscar código do SMS
      if (jsonData.sms && jsonData.sms.code) {
        smsCode = jsonData.sms.code;
      } else if (jsonData.code) {
        smsCode = jsonData.code;
      } else if (jsonData.message_id) {
        smsCode = jsonData.message_id;
      }
      
      console.log("Parsing: success =", success, "smsCode =", smsCode);
    } catch (parseError) {
      console.error("Erro ao parsear JSON:", parseError);
      // Se não for JSON, considerar sucesso se não houver erro
      success = !data.toLowerCase().includes("erro") && !data.toLowerCase().includes("error");
      // Tentar extrair código UUID da resposta
      const uuidMatch = data.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (uuidMatch) {
        smsCode = uuidMatch[0];
      }
    }

    // Registrar log no banco
    try {
      await supabaseClient
        .from("sms_logs")
        .insert({
          provider: "mex10",
          phone: cleanPhone,
          message,
          sms_code: smsCode,
          status: success ? "sent" : "failed",
          raw_request: { phone, message, endpoint },
          raw_response: data,
          success,
          error_message: success ? null : "Falha no parse ou envio",
        });
    } catch (logError) {
      console.error("Erro ao salvar log:", logError);
      // Não falhar o envio por causa do log
    }

    return new Response(
      JSON.stringify({
        success,
        sms_code: smsCode,
        phone: cleanPhone,
        message,
        raw_response: data,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: success ? 200 : 400,
      }
    );
  } catch (error: any) {
    console.error("Erro ao enviar SMS Mex10:", error);
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
