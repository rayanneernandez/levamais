import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface EmailResult {
  success: boolean;
  emailId?: string;
  error?: string;
  provider?: string;
}

interface EmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

/**
 * Envia email usando o provider configurado no sistema
 * Consulta api_usage_configs para determinar qual API usar
 */
export async function sendEmail(
  params: EmailParams,
  configType: "internal_email" | "client_email" = "internal_email"
): Promise<EmailResult> {
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
      // Continuar tentando com Resend padrão se disponível
      return await sendViaResend(params);
    }

    const integration = config.api_integrations as any;
    
    if (!integration) {
      console.log("Integração não encontrada, usando Resend padrão");
      return await sendViaResend(params);
    }

    // Enviar de acordo com o provider configurado
    console.log(`📤 Usando provider: ${integration.provider} para ${configType}`);
    
    if (integration.provider === "resend") {
      // Se for Resend configurado na tabela, usar credenciais de lá
      const apiKey = integration.credentials?.api_key || RESEND_API_KEY;
      return await sendViaResend(params, apiKey);
    } else {
      console.log(`⚠️  Provider desconhecido: ${integration.provider}`);
      return await sendViaResend(params);
    }
  } catch (error: any) {
    console.error("Erro ao enviar email:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Envia email via Resend
 */
async function sendViaResend(
  params: EmailParams,
  apiKey?: string
): Promise<EmailResult> {
  try {
    const key = apiKey || RESEND_API_KEY;
    
    if (!key) {
      throw new Error("Resend API key não configurada");
    }

    const fromEmail = params.from || "Leva+ <noreply@updates.levamais.app>";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro Resend:", data);
      throw new Error(data.message || "Falha ao enviar email via Resend");
    }

    console.log("✅ Email enviado via Resend:", data.id);

    return {
      success: true,
      emailId: data.id,
      provider: "resend",
    };
  } catch (error: any) {
    console.error("Erro ao enviar via Resend:", error);
    return {
      success: false,
      error: error.message,
      provider: "resend",
    };
  }
}
