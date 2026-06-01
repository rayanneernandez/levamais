import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if VAPID keys are already in environment secrets (preferred)
    const envPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const envPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (envPublicKey && envPrivateKey) {
      console.log("VAPID keys found in environment secrets (secure)");
      return new Response(
        JSON.stringify({
          success: true,
          message: "VAPID keys configured via environment secrets",
          publicKey: envPublicKey
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check existing DB keys (legacy fallback)
    const { data: existingKeys, error: fetchError } = await supabaseClient
      .from("vapid_keys")
      .select("*")
      .limit(1);

    if (fetchError) {
      console.error("Erro ao buscar VAPID keys:", fetchError);
      throw fetchError;
    }

    if (existingKeys && existingKeys.length > 0) {
      console.log("VAPID keys found in database (legacy). Consider migrating to environment secrets.");
      return new Response(
        JSON.stringify({
          success: true,
          message: "VAPID keys configuradas (migre para secrets de ambiente para maior segurança)",
          publicKey: existingKeys[0].public_key,
          migrationNeeded: true
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    }

    // Generate new VAPID keys
    const webpush = await import("npm:web-push@3.6.7");
    const vapidKeys = webpush.generateVAPIDKeys();

    // Save to database (legacy approach - user should migrate to env secrets)
    const { error: saveError } = await supabaseClient
      .from("vapid_keys")
      .insert({
        public_key: vapidKeys.publicKey,
        private_key: vapidKeys.privateKey
      });

    if (saveError) {
      console.error("Erro ao salvar VAPID keys:", saveError);
      throw saveError;
    }

    console.log("VAPID keys geradas. IMPORTANTE: Migre as chaves para secrets de ambiente (VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY).");

    return new Response(
      JSON.stringify({
        success: true,
        message: "VAPID keys geradas. Migre para secrets de ambiente para maior segurança.",
        publicKey: vapidKeys.publicKey,
        migrationNeeded: true
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (error) {
    console.error("Erro ao inicializar VAPID keys:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
