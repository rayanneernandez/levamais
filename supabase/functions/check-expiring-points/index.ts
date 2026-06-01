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

    console.log('🔍 Verificando expirações de pontos/cashback...');

    // Buscar todas as redes ativas
    const { data: networks, error: networksError } = await supabase
      .from('networks')
      .select('id, name, points_expiration_days, points_expiration_alert_days');

    if (networksError) {
      console.error('❌ Erro ao buscar redes:', networksError);
      throw networksError;
    }

    let totalNotifications = 0;

    for (const network of networks || []) {
      // Buscar points_validity_days da loja (configurado em MESES na UI)
      const { data: storeConfig } = await supabase
        .from('stores')
        .select('points_validity_days')
        .eq('network_id', network.id)
        .eq('status', 'active')
        .not('points_validity_days', 'is', null)
        .limit(1)
        .maybeSingle();

      // Usar points_validity_days (em meses) da loja, ou fallback para networks.points_expiration_days
      const expirationMonths = storeConfig?.points_validity_days || network.points_expiration_days || 12;
      
      // Se 0, nunca expira - pular esta rede
      if (expirationMonths === 0) {
        console.log(`⏭️ Rede ${network.name}: Validade = 0 (nunca expira), pulando...`);
        continue;
      }
      
      // Converter meses para dias
      const expirationDays = expirationMonths * 30;
      const alertDays = network.points_expiration_alert_days || 7;

      // Calcular data limite para alerta
      const now = new Date();
      const expirationThreshold = new Date();
      expirationThreshold.setDate(expirationThreshold.getDate() - expirationDays + alertDays);

      console.log(`📊 Rede ${network.name}: Expira após ${expirationMonths} meses (${expirationDays} dias), alertar ${alertDays} dias antes`);

      // Buscar clientes com saldo e última transação antes do threshold
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select(`
          id,
          user_id,
          full_name,
          network_id,
          last_transaction_date,
          points_balance,
          cashback_balance
        `)
        .eq('network_id', network.id)
        .or('points_balance.gt.0,cashback_balance.gt.0')
        .lt('last_transaction_date', expirationThreshold.toISOString());

      if (clientsError) {
        console.error(`❌ Erro ao buscar clientes da rede ${network.name}:`, clientsError);
        continue;
      }

      console.log(`👥 ${clients?.length || 0} clientes com risco de expiração na rede ${network.name}`);

      // Enviar notificações para cada cliente
      for (const client of clients || []) {
        try {
          // Buscar email do perfil
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', client.user_id)
            .single();

          if (!profile?.email) continue;

          // Calcular dias restantes
          const lastTransaction = new Date(client.last_transaction_date);
          const expiresAt = new Date(lastTransaction);
          expiresAt.setDate(expiresAt.getDate() + expirationDays);
          const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (daysRemaining <= 0) continue; // Já expirou

          // Buscar template de mensagem ativo
          const { data: template } = await supabase
            .from('marketing_message_templates')
            .select('*')
            .eq('network_id', network.id)
            .eq('template_type', 'expiracao_pontos')
            .eq('auto_send_enabled', true)
            .eq('is_active', true)
            .limit(1);

          if (!template || template.length === 0) {
            console.log(`⚠️ Sem template automático para rede ${network.name}`);
            continue;
          }

          const activeTemplate = template[0];

          // Determinar tipo e valor
          const hasPoints = client.points_balance > 0;
          const hasCashback = client.cashback_balance > 0;
          const tipo = hasPoints ? 'pontos' : 'cashback';
          const valor = hasPoints 
            ? `${client.points_balance} pontos` 
            : `R$ ${client.cashback_balance.toFixed(2)}`;

          // Substituir variáveis na mensagem
          let message = activeTemplate.message_content
            .replace(/\{\{nome\}\}/g, client.full_name)
            .replace(/\{\{tipo\}\}/g, tipo)
            .replace(/\{\{valor\}\}/g, valor)
            .replace(/\{\{dias_restantes\}\}/g, `${daysRemaining} dias`);

          let subject = '';
          if (activeTemplate.subject) {
            subject = activeTemplate.subject
              .replace(/\{\{nome\}\}/g, client.full_name)
              .replace(/\{\{tipo\}\}/g, tipo)
              .replace(/\{\{valor\}\}/g, valor)
              .replace(/\{\{dias_restantes\}\}/g, `${daysRemaining} dias`);
          }

          console.log(`📧 Enviando alerta para ${profile.email}: ${valor} expira em ${daysRemaining} dias`);

          // Enviar notificação baseada no canal
          if (activeTemplate.channel === 'email') {
            await supabase.functions.invoke('send-transaction-message', {
              body: {
                email: profile.email,
                subject: subject || '⚠️ Seus benefícios estão expirando!',
                message: message,
              }
            });
          } else if (activeTemplate.channel === 'sms') {
            console.log(`📱 SMS: ${message}`);
          } else if (activeTemplate.channel === 'whatsapp') {
            console.log(`📱 WhatsApp: ${message}`);
          }

          totalNotifications++;
        } catch (notificationError) {
          console.error(`❌ Erro ao enviar notificação para cliente ${client.id}:`, notificationError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        notifications_sent: totalNotifications,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro em check-expiring-points:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});