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

    // Autenticação do cliente
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Token não fornecido');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Não autenticado');
    }

    const { network_id, commitment_months } = await req.json();

    // Validações
    if (!network_id || ![6, 9, 12].includes(commitment_months)) {
      throw new Error('Dados inválidos');
    }

    // Buscar registro do cliente
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, network_id, favorite_network_id')
      .eq('user_id', user.id)
      .eq('network_id', network_id)
      .single();

    if (clientError || !client) {
      throw new Error('Cliente não encontrado');
    }

    // Verificar se já tem compromisso ativo
    const { data: existingCommitment } = await supabase
      .from('client_retention_commitments')
      .select('*')
      .eq('client_id', client.id)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingCommitment) {
      // UPGRADE: verificar se não é downgrade
      if (commitment_months <= existingCommitment.commitment_months) {
        throw new Error('Você só pode fazer upgrade do período, não downgrade');
      }

      // Calcular novo prazo (soma tempo restante + novo período)
      const now = new Date();
      const currentExpiration = new Date(existingCommitment.expires_at);
      const remainingMs = currentExpiration.getTime() - now.getTime();
      const remainingMonths = Math.ceil(remainingMs / (1000 * 60 * 60 * 24 * 30));
      const totalMonths = remainingMonths + commitment_months;
      const newExpirationDate = new Date();
      newExpirationDate.setMonth(newExpirationDate.getMonth() + totalMonths);

      // Buscar configuração da rede
      const { data: config } = await supabase
        .from('network_retention_config')
        .select('*')
        .eq('network_id', network_id)
        .eq('is_active', true)
        .single();

      if (!config) {
        throw new Error('Programa de retenção não ativo');
      }

      // Buscar loyalty_type da rede
      const { data: network } = await supabase
        .from('networks')
        .select('loyalty_type')
        .eq('id', network_id)
        .single();

      const loyaltyType = network?.loyalty_type || 'cashback';
      const multiplierField = loyaltyType === 'cashback' 
        ? `cashback_multiplier_${commitment_months}_months`
        : `points_multiplier_${commitment_months}_months`;
      const multiplier = config[multiplierField];

      // Marcar compromisso antigo como 'upgraded'
      await supabase
        .from('client_retention_commitments')
        .update({ status: 'upgraded' })
        .eq('id', existingCommitment.id);

      // Criar novo compromisso
      const { data: newCommitment, error: insertError } = await supabase
        .from('client_retention_commitments')
        .insert({
          client_id: client.id,
          network_id: network_id,
          commitment_months: commitment_months,
          multiplier_applied: multiplier,
          loyalty_type: loyaltyType,
          started_at: now.toISOString(),
          expires_at: newExpirationDate.toISOString(),
          status: 'active'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log('✅ Upgrade realizado:', newCommitment);

      return new Response(
        JSON.stringify({ 
          success: true, 
          commitment: newCommitment,
          message: `Upgrade realizado! Seu novo período é de ${totalMonths} meses.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // NOVO COMPROMISSO (não é upgrade)
    // OPÇÃO A: Cliente pode criar compromisso imediatamente ao entrar na rede

    // Buscar configuração da rede
    const { data: config, error: configError } = await supabase
      .from('network_retention_config')
      .select('*')
      .eq('network_id', network_id)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      throw new Error('Programa de retenção não está ativo');
    }

    // Buscar loyalty_type da rede
    const { data: network } = await supabase
      .from('networks')
      .select('loyalty_type')
      .eq('id', network_id)
      .single();

    const loyaltyType = network?.loyalty_type || 'cashback';

    // Pegar multiplicador correto
    const multiplierField = loyaltyType === 'cashback' 
      ? `cashback_multiplier_${commitment_months}_months`
      : `points_multiplier_${commitment_months}_months`;
    
    const multiplier = config[multiplierField];

    // Calcular data de expiração
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + commitment_months);

    // Criar compromisso
    const { data: commitment, error: insertError } = await supabase
      .from('client_retention_commitments')
      .insert({
        client_id: client.id,
        network_id: network_id,
        commitment_months: commitment_months,
        multiplier_applied: multiplier,
        loyalty_type: loyaltyType,
        expires_at: expirationDate.toISOString(),
        status: 'active'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao criar compromisso:', insertError);
      throw new Error('Erro ao criar compromisso');
    }

    // Definir como rede favorita e atualizar data de mudança
    await supabase
      .from('clients')
      .update({ 
        favorite_network_id: network_id,
        favorite_network_changed_at: new Date().toISOString()
      })
      .eq('id', client.id);

    console.log('✅ Compromisso criado:', commitment);

    return new Response(
      JSON.stringify({ 
        success: true, 
        commitment,
        message: `Benefício ativado! Você receberá +${multiplier}% por ${commitment_months} meses.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro em create-retention-commitment:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
