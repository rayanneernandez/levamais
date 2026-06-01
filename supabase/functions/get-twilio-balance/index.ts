import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error("Twilio não configurado");
    }

    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    // 1. Consultar saldo da conta Twilio
    const balanceUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Balance.json`;
    console.log("Consultando saldo Twilio...");

    const balanceResponse = await fetch(balanceUrl, {
      method: "GET",
      headers: { Authorization: authHeader },
    });

    const balanceData = await balanceResponse.json();

    if (!balanceResponse.ok) {
      console.error("Erro ao consultar saldo:", balanceData);
      throw new Error(balanceData.message || "Falha ao consultar saldo Twilio");
    }

    // 2. Consultar consumo do mês atual
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const usageUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Usage/Records.json?StartDate=${startDate}&Category=sms`;
    
    console.log("Consultando consumo mensal...");

    const usageResponse = await fetch(usageUrl, {
      method: "GET",
      headers: { Authorization: authHeader },
    });

    const usageData = await usageResponse.json();
    
    let monthlyUsage = 0;
    if (usageResponse.ok && usageData.usage_records && usageData.usage_records.length > 0) {
      // Somar o count de todos os registros (SMS enviados)
      monthlyUsage = usageData.usage_records.reduce((sum: number, record: any) => 
        sum + parseFloat(record.count || 0), 0
      );
    }

    console.log("✅ Dados consultados - Saldo:", balanceData.balance, "Consumo mensal:", monthlyUsage);

    return new Response(
      JSON.stringify({
        success: true,
        balance: balanceData.balance,
        currency: balanceData.currency || "USD",
        account_sid: balanceData.account_sid,
        monthly_usage: monthlyUsage,
        raw_response: {
          balance: balanceData,
          usage: usageData,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Erro ao consultar saldo Twilio:", error);
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
