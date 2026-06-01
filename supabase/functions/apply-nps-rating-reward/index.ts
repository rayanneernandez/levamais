// @ts-nocheck
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
    const { ratingId } = await req.json();

    if (!ratingId) {
      throw new Error("Rating ID is required");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Buscar a avaliação
    const { data: rating, error: ratingError } = await supabaseClient
      .from("transaction_ratings")
      .select(`
        id,
        rating,
        comment,
        client_id,
        network_id,
        transaction_id,
        transactions (
          amount
        )
      `)
      .eq("id", ratingId)
      .single();

    if (ratingError) throw ratingError;
    if (!rating) throw new Error("Rating not found");

    // Verificar se já foi aplicada uma recompensa
    const { data: existingReward } = await supabaseClient
      .from("nps_rating_rewards_applied")
      .select("id")
      .eq("rating_id", ratingId)
      .maybeSingle();

    if (existingReward) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Reward already applied for this rating" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar configuração de recompensa ativa
    const { data: config, error: configError } = await supabaseClient
      .from("nps_rating_rewards_config")
      .select("*")
      .eq("network_id", rating.network_id)
      .eq("is_active", true)
      .maybeSingle();

    if (configError) throw configError;

    // Se não houver configuração ativa, retornar sem aplicar
    if (!config) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "No active reward configuration" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se atende aos critérios de estrelas mínimas
    if (config.min_stars && rating.rating < config.min_stars) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Rating ${rating.rating} is below minimum ${config.min_stars} stars` 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calcular o valor da recompensa
    let rewardValue = config.reward_value;
    const transactions = rating.transactions as any;
    const transactionAmount = (Array.isArray(transactions) ? transactions[0]?.amount : transactions?.amount) || 0;

    if ((config.reward_type === 'cashback_percentage' || config.reward_type === 'points_percentage') && transactionAmount > 0) {
      rewardValue = (transactionAmount * config.reward_value) / 100;
    }

    // Aplicar a recompensa baseado no tipo
    if (config.reward_type === 'points_fixed' || config.reward_type === 'points_percentage') {
      // Adicionar pontos ao cliente
      const { error: pointsError } = await supabaseClient.rpc(
        'add_client_points',
        {
          p_client_id: rating.client_id,
          p_points: rewardValue
        }
      );

      if (pointsError) throw pointsError;

      // Criar transação de pontos
      const { error: txError } = await supabaseClient
        .from("transactions")
        .insert({
          client_id: rating.client_id,
          store_id: (rating.transactions as any)?.store_id,
          type: 'accumulation',
          amount: 0,
          points: rewardValue,
          description: `Bonificação por avaliação de ${rating.rating} estrelas`
        });

      if (txError) throw txError;

    } else if (config.reward_type === 'cashback_fixed' || config.reward_type === 'cashback_percentage') {
      // Adicionar cashback ao cliente
      const { error: cashbackError } = await supabaseClient.rpc(
        'add_client_cashback',
        {
          p_client_id: rating.client_id,
          p_cashback: rewardValue
        }
      );

      if (cashbackError) throw cashbackError;

      // Criar transação de cashback
      const { error: txError } = await supabaseClient
        .from("transactions")
        .insert({
          client_id: rating.client_id,
          store_id: (rating.transactions as any)?.store_id,
          type: 'accumulation',
          amount: rewardValue,
          points: 0,
          description: `Bonificação por avaliação de ${rating.rating} estrelas`
        });

      if (txError) throw txError;
    }

    // Registrar a aplicação da recompensa
    const { error: appliedError } = await supabaseClient
      .from("nps_rating_rewards_applied")
      .insert({
        rating_id: ratingId,
        client_id: rating.client_id,
        network_id: rating.network_id,
        reward_type: config.reward_type,
        reward_value: rewardValue,
        transaction_id: rating.transaction_id
      });

    if (appliedError) throw appliedError;

    // Criar notificação para o cliente
    const rewardDescription = 
      config.reward_type === 'points_fixed' || config.reward_type === 'points_percentage'
        ? `${rewardValue} pontos` 
        : `R$ ${rewardValue.toFixed(2)}`;

    const { data: notification } = await supabaseClient
      .from("client_notifications")
      .insert({
        network_id: rating.network_id,
        title: "🎁 Bonificação por Avaliação",
        message: `Você recebeu ${rewardDescription} por avaliar sua compra com ${rating.rating} estrelas!`,
        created_by: rating.client_id
      })
      .select()
      .single();

    if (notification) {
      await supabaseClient
        .from("client_notification_recipients")
        .insert({
          notification_id: notification.id,
          client_id: rating.client_id
        });
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        reward: {
          type: config.reward_type,
          value: rewardValue
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error applying NPS rating reward:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
