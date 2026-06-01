// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { client_id } = await req.json();

    if (!client_id) {
      throw new Error('client_id é obrigatório');
    }

    console.log('🔍 Verificando configuração de desligamento automático para cliente:', client_id);

    // Buscar configuração do cliente
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('auto_redemption_enabled, auto_redemption_disable_mode, auto_redemption_disable_scheduled_at')
      .eq('id', client_id)
      .single();

    if (clientError) throw clientError;

    // Se o resgate não está ativo, não fazer nada
    if (!client?.auto_redemption_enabled) {
      console.log('⏭️ Resgate já está desativado');
      return new Response(
        JSON.stringify({ success: true, message: 'Resgate já desativado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let shouldDisable = false;
    let reason = '';

    // Verificar modo de desligamento
    // Se não tem modo configurado (null), o padrão é desligar imediatamente após o resgate
    if (!client.auto_redemption_disable_mode || client.auto_redemption_disable_mode === 'immediate') {
      // Desligar imediatamente após este resgate
      shouldDisable = true;
      reason = client.auto_redemption_disable_mode === 'immediate' 
        ? 'Desligado automaticamente após resgate (modo imediato)'
        : 'Desligado automaticamente após resgate (padrão - sem modo configurado)';
      console.log('⚡ Modo imediato/padrão: desligando após resgate');
    } else if (client.auto_redemption_disable_mode === 'scheduled' && client.auto_redemption_disable_scheduled_at) {
      // Verificar se já passou da data agendada
      const scheduledDate = new Date(client.auto_redemption_disable_scheduled_at);
      const now = new Date();
      
      if (now >= scheduledDate) {
        shouldDisable = true;
        reason = 'Desligado automaticamente após período agendado';
        console.log('📅 Período agendado expirou: desligando resgate');
      } else {
        console.log('📅 Período agendado ainda não expirou. Expira em:', client.auto_redemption_disable_scheduled_at);
      }
    }

    if (shouldDisable) {
      const { error: updateError } = await supabase
        .from('clients')
        .update({ 
          auto_redemption_enabled: false,
          auto_redemption_disable_scheduled_at: null // Limpar data agendada
        })
        .eq('id', client_id);

      if (updateError) throw updateError;

      console.log('✅ Resgate desligado automaticamente');
      return new Response(
        JSON.stringify({ 
          success: true, 
          disabled: true,
          reason
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, disabled: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
