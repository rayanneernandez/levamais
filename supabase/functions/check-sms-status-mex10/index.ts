// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckSMSStatusRequest {
  sms_code: string; // Código UUID retornado no envio
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sms_code }: CheckSMSStatusRequest = await req.json();

    if (!sms_code) {
      throw new Error("Código do SMS é obrigatório");
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

    // Consultar status na API da Mex10
    const statusUrl = `${endpoint}?token=${token}&t=status&code=${sms_code}`;
    
    console.log("Consultando status SMS Mex10:", sms_code);

    const response = await fetch(statusUrl);
    const data = await response.text();

    console.log("Resposta Mex10:", data);

    // Parsear resposta
    let status = "unknown";
    try {
      const jsonData = JSON.parse(data);
      
      // O status pode vir como objeto ou string
      if (typeof jsonData.status === 'string') {
        status = jsonData.status;
      } else if (typeof jsonData.status === 'object' && jsonData.status !== null) {
        // Se for objeto, extrair o campo status interno
        status = jsonData.status.status || jsonData.status.state || "unknown";
      } else if (typeof jsonData.state === 'string') {
        status = jsonData.state;
      } else if (typeof jsonData.state === 'object' && jsonData.state !== null) {
        status = jsonData.state.status || jsonData.state.state || "unknown";
      }
    } catch {
      // Extrair status do texto
      if (data.toLowerCase().includes("entregue")) status = "delivered";
      else if (data.toLowerCase().includes("enviado")) status = "sent";
      else if (data.toLowerCase().includes("falhou")) status = "failed";
    }

    return new Response(
      JSON.stringify({
        success: true,
        code: sms_code,
        status,
        raw_response: data,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Erro ao consultar status SMS Mex10:", error);
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
