import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Consultar saldo na API da Mex10
    const balanceUrl = `${endpoint}?token=${token}&t=saldo`;
    
    console.log("Consultando saldo Mex10:", balanceUrl);

    const response = await fetch(balanceUrl);
    const data = await response.text();

    console.log("Resposta Mex10 (raw):", data);

    // Parsear resposta da API MEX10
    let balance = 0;
    let emailBalance = 0;
    let whatsappBalance = 0;
    
    try {
      const jsonData = JSON.parse(data);
      console.log("JSON parseado:", JSON.stringify(jsonData, null, 2));
      
      // Formato da API MEX10: { "balances": { "sms": 30, "email": 100, "whatsapp": 0 } }
      if (jsonData.balances) {
        balance = parseFloat(jsonData.balances.sms || 0);
        emailBalance = parseFloat(jsonData.balances.email || 0);
        whatsappBalance = parseFloat(jsonData.balances.whatsapp || 0);
        console.log("Saldos extraídos - SMS:", balance, "Email:", emailBalance, "WhatsApp:", whatsappBalance);
      } else if (jsonData.saldo !== undefined) {
        balance = parseFloat(jsonData.saldo);
      } else if (jsonData.balance !== undefined) {
        balance = parseFloat(jsonData.balance);
      }
    } catch (parseError) {
      console.error("Erro ao parsear resposta JSON:", parseError);
      // Se não for JSON, tentar extrair número do texto
      const match = data.match(/\d+(\.\d+)?/);
      if (match) {
        balance = parseFloat(match[0]);
      }
    }

    // Consultar consumo mensal a partir dos logs internos
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    
    const { count: monthlyUsage } = await supabaseClient
      .from("sms_logs")
      .select("id", { count: "exact", head: true })
      .eq("provider", "mex10")
      .eq("status", "sent")
      .gte("created_at", startOfMonth);

    // Base inicial: 8 SMS já consumidos antes do tracking
    const baseUsage = 8;
    const totalUsage = baseUsage + (monthlyUsage || 0);

    // Última utilização
    const { data: lastSms } = await supabaseClient
      .from("sms_logs")
      .select("created_at")
      .eq("provider", "mex10")
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log("✅ Consumo mensal:", totalUsage, "SMS (base:", baseUsage, "+ tracked:", monthlyUsage, ") | Última utilização:", lastSms?.created_at);

    return new Response(
      JSON.stringify({
        success: true,
        balance,
        email_balance: emailBalance,
        whatsapp_balance: whatsappBalance,
        monthly_usage: totalUsage,
        last_used_at: lastSms?.created_at || null,
        raw_response: data,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Erro ao consultar saldo Mex10:", error);
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
