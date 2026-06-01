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

    // Limites fixos do Resend
    const transactionalLimit = 50000;
    const marketingLimit = 1000;
    const billingDay = 20;

    // Calcular período de faturamento atual
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentDay = now.getDate();
    
    // Se ainda não passou do dia 20, o período começou no mês anterior
    let periodStart: Date;
    if (currentDay < billingDay) {
      periodStart = new Date(currentYear, currentMonth - 1, billingDay);
    } else {
      periodStart = new Date(currentYear, currentMonth, billingDay);
    }

    console.log("Período de faturamento iniciado em:", periodStart.toISOString());

    // Consultar consumo de emails transacionais no período
    const { count: transactionalUsed } = await supabaseClient
      .from("email_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "delivered")
      .gte("created_at", periodStart.toISOString());

    // Base inicial: 58 emails transacionais já consumidos antes do tracking
    const baseTransactionalUsage = 58;
    const totalTransactionalUsed = baseTransactionalUsage + (transactionalUsed || 0);

    // Última utilização (qualquer email enviado)
    const { data: lastEmail } = await supabaseClient
      .from("email_events")
      .select("created_at")
      .eq("event_type", "delivered")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Marketing ainda não implementado, manter em 0
    const marketingUsed = 0;

    console.log("✅ Dados consultados - Transacional:", totalTransactionalUsed, "/", transactionalLimit, "(base:", baseTransactionalUsage, "+ tracked:", transactionalUsed, ") | Marketing:", marketingUsed, "/", marketingLimit);

    return new Response(
      JSON.stringify({
        success: true,
        transactional: {
          limit: transactionalLimit,
          used: totalTransactionalUsed,
          remaining: transactionalLimit - totalTransactionalUsed,
        },
        marketing: {
          limit: marketingLimit,
          used: marketingUsed,
          remaining: marketingLimit - marketingUsed,
        },
        billing_day: billingDay,
        next_reset: currentDay < billingDay 
          ? new Date(currentYear, currentMonth, billingDay).toISOString()
          : new Date(currentYear, currentMonth + 1, billingDay).toISOString(),
        last_used_at: lastEmail?.created_at || null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Erro ao consultar dados Resend:", error);
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
