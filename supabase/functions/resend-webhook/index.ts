// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

interface ResendWebhookEvent {
  type: string; // email.sent, email.delivered, email.opened, email.clicked, email.bounced, email.complained
  created_at: string;
  data: {
    email_id: string;
    to: string | string[];
    subject: string;
    from: string;
    created_at?: string;
    opened_at?: string;
    clicked_at?: string;
    bounced_at?: string;
    complained_at?: string;
    [key: string]: any;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("📧 Resend webhook received");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const event: ResendWebhookEvent = await req.json();
    console.log("Event type:", event.type);
    console.log("Email ID:", event.data.email_id);

    // Mapear tipo do evento
    const eventType = event.type.replace("email.", ""); // email.opened -> opened

    // Buscar o budget_id usando o resend_email_id armazenado no envio
    // Para isso, primeiro precisamos ter salvo o email_id quando enviamos o email
    // Por enquanto, vamos extrair do subject ou metadata se possível
    
    const emailTo = Array.isArray(event.data.to) ? event.data.to[0] : event.data.to;
    const subject = event.data.subject;

    // Tentar encontrar o orçamento pelo email do destinatário
    // Isso funciona pois cada email de orçamento vai para um único destinatário
    let budgetId: string | null = null;

    if (subject && subject.includes("Orçamento")) {
      // Buscar orçamento pelo email do aprovador
      const { data: budget } = await supabase
        .from("budgets")
        .select("id")
        .eq("requester_email", emailTo)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (budget) {
        budgetId = budget.id;
      }
    }

    // Determinar o timestamp correto baseado no tipo de evento
    let occurredAt = event.created_at;
    if (event.data.opened_at) occurredAt = event.data.opened_at;
    if (event.data.clicked_at) occurredAt = event.data.clicked_at;
    if (event.data.bounced_at) occurredAt = event.data.bounced_at;
    if (event.data.complained_at) occurredAt = event.data.complained_at;

    // Salvar evento no banco
    const { error: insertError } = await supabase
      .from("email_events")
      .insert({
        budget_id: budgetId,
        event_type: eventType,
        email_to: emailTo,
        email_subject: subject,
        resend_email_id: event.data.email_id,
        occurred_at: occurredAt,
        metadata: event.data,
      });

    if (insertError) {
      console.error("Error inserting email event:", insertError);
      throw insertError;
    }

    console.log(`✅ Email event '${eventType}' saved successfully`);

    return new Response(
      JSON.stringify({ success: true, event_type: eventType }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("❌ Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
