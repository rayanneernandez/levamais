import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
}

/**
 * Envia SMS usando o provider configurado no sistema
 * Consulta api_usage_configs para determinar qual API usar
 */
export async function sendSMS(
  phone: string,
  message: string,
  configType: "internal_sms" | "client_sms" = "internal_sms"
): Promise<SMSResult> {
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Buscar configuração ativa para o tipo especificado
    const { data: config, error: configError } = await supabaseClient
      .from("api_usage_configs")
      .select(`
        integration_id,
        api_integrations (
          provider,
          credentials
        )
      `)
      .eq("config_type", configType)
      .eq("is_active", true)
      .single();

    if (configError || !config || !config.integration_id) {
      console.log(`⚠️  Nenhuma configuração ativa para ${configType}`);
      // Continuar tentando com Twilio padrão se disponível
      return await sendViaTwilio(phone, message);
    }

    const integration = config.api_integrations as any;
    
    if (!integration) {
      console.log("Integração não encontrada, usando Twilio padrão");
      return await sendViaTwilio(phone, message);
    }

    // Enviar de acordo com o provider configurado
    console.log(`📤 Usando provider: ${integration.provider} para ${configType}`);
    
    if (integration.provider === "mex10") {
      return await sendViaMex10(phone, message, integration.credentials);
    } else if (integration.provider === "twilio") {
      return await sendViaTwilio(phone, message);
    } else {
      console.log(`⚠️  Provider desconhecido: ${integration.provider}`);
      return await sendViaTwilio(phone, message);
    }
  } catch (error: any) {
    console.error("Erro ao enviar SMS:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Envia SMS via Twilio
 */
async function sendViaTwilio(phone: string, message: string): Promise<SMSResult> {
  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error("Twilio não configurado. Configure as variáveis de ambiente.");
    }

    // Formatar telefone - garantir código do país Brasil
    let cleanPhone = phone.replace(/\D/g, "");
    
    // Se não começa com 55 (Brasil), adicionar
    if (!cleanPhone.startsWith("55")) {
      cleanPhone = "55" + cleanPhone;
    }
    
    const formattedPhone = "+" + cleanPhone;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append("To", formattedPhone);
    formData.append("From", TWILIO_PHONE_NUMBER);
    formData.append("Body", message);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro Twilio:", data);
      
      // Logar erro no banco
      try {
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        
        await supabaseClient.from("sms_logs").insert({
          provider: "twilio",
          phone: formattedPhone,
          message,
          sms_code: null,
          status: "failed",
          raw_request: { phone: formattedPhone, message },
          raw_response: JSON.stringify(data),
          success: false,
          error_message: data.message || "Erro desconhecido",
        });
      } catch (logError) {
        console.error("Erro ao salvar log de erro:", logError);
      }
      
      throw new Error(data.message || "Falha ao enviar SMS via Twilio");
    }

    console.log("✅ SMS enviado via Twilio:", data.sid);

    // Logar sucesso no banco
    try {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      
      await supabaseClient.from("sms_logs").insert({
        provider: "twilio",
        phone: formattedPhone,
        message,
        sms_code: data.sid,
        status: data.status || "sent",
        raw_request: { phone: formattedPhone, message },
        raw_response: JSON.stringify(data),
        success: true,
        error_message: null,
      });
    } catch (logError) {
      console.error("Erro ao salvar log:", logError);
    }

    return {
      success: true,
      messageId: data.sid,
      provider: "twilio",
    };
  } catch (error: any) {
    console.error("Erro ao enviar via Twilio:", error);
    return {
      success: false,
      error: error.message,
      provider: "twilio",
    };
  }
}

/**
 * Envia SMS via Mex10
 */
async function sendViaMex10(
  phone: string,
  message: string,
  credentials: any
): Promise<SMSResult> {
  try {
    const { token, endpoint } = credentials;

    if (!token || !endpoint) {
      throw new Error("Credenciais Mex10 não configuradas");
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
    let messageId = null;

    try {
      // Corrigir JSON malformado da Mex10
      let fixedData = data
        .replace(/"code":([0-9a-f-]+),/gi, '"code":"$1",')
        .replace(/"status":([A-Z]+),/g, '"status":"$1",');
      
      const jsonData = JSON.parse(fixedData);
      
      // Verificar sucesso: data.success === true OU errors.error === false
      if (jsonData.data && jsonData.data.success === true) {
        success = true;
      } else if (jsonData.errors && jsonData.errors.error === false) {
        success = true;
      }
      
      // Buscar código do SMS
      if (jsonData.sms && jsonData.sms.code) {
        messageId = jsonData.sms.code;
      } else if (jsonData.code) {
        messageId = jsonData.code;
      } else if (jsonData.message_id) {
        messageId = jsonData.message_id;
      }
    } catch (parseError) {
      console.error("Erro ao parsear JSON:", parseError);
      // Se não for JSON, considerar sucesso se não houver erro
      success = !data.toLowerCase().includes("erro") && !data.toLowerCase().includes("error");
      // Tentar extrair código UUID da resposta
      const uuidMatch = data.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (uuidMatch) {
        messageId = uuidMatch[0];
      }
    }

    // Logar no banco
    try {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      
      await supabaseClient.from("sms_logs").insert({
        provider: "mex10",
        phone: cleanPhone,
        message,
        sms_code: messageId,
        status: success ? "sent" : "failed",
        raw_request: { phone: cleanPhone, message },
        raw_response: data,
        success,
        error_message: success ? null : "Falha no envio",
      });
    } catch (logError) {
      console.error("Erro ao salvar log Mex10:", logError);
    }

    if (!success) {
      throw new Error(`Falha ao enviar SMS via Mex10: ${data}`);
    }

    console.log("✅ SMS enviado via Mex10:", messageId);

    return {
      success: true,
      messageId: messageId || undefined,
      provider: "mex10",
    };
  } catch (error: any) {
    console.error("Erro ao enviar via Mex10:", error);
    
    // Logar erro no banco
    try {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      
      const cleanPhone = phone.replace(/\D/g, "");
      
      await supabaseClient.from("sms_logs").insert({
        provider: "mex10",
        phone: cleanPhone,
        message,
        sms_code: null,
        status: "failed",
        raw_request: { phone: cleanPhone, message },
        raw_response: error.message,
        success: false,
        error_message: error.message,
      });
    } catch (logError) {
      console.error("Erro ao salvar log de erro Mex10:", logError);
    }
    
    return {
      success: false,
      error: error.message,
      provider: "mex10",
    };
  }
}
