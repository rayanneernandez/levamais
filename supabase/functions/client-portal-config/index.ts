import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    // Buscar dados do cliente
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select(`
        id, cpf, full_name, email, phone, birth_date,
        is_one_member, one_member_since,
        favorite_network_id, network_id, total_points,
        auto_redemption_enabled, auto_redemption_disable_mode, auto_redemption_disable_scheduled_at,
        tutorial_completed, codigo, created_at
      `)
      .eq('id', client_id)
      .single();

    if (clientError) throw clientError;

    // Buscar TODOS os registros do mesmo CPF para descobrir todas as redes associadas
    const { data: allClientRecords } = await supabase
      .from('clients')
      .select('id, network_id, total_points')
      .eq('cpf', client.cpf);

    // Coletar todos os network_ids do cliente (via registros + favorita + transações)
    const networkIds = new Set<string>();
    const clientIdsByNetwork: Record<string, string> = {};
    
    // Adicionar redes de TODOS os registros do mesmo CPF
    (allClientRecords || []).forEach((rec: any) => {
      if (rec.network_id) {
        networkIds.add(rec.network_id);
        clientIdsByNetwork[rec.network_id] = rec.id;
      }
    });
    
    if (client.favorite_network_id) networkIds.add(client.favorite_network_id);
    if (client.network_id) networkIds.add(client.network_id);

    // Calcular saldos por rede — usar total_points de cada registro
    let balancesByNetwork: Record<string, number> = {};
    (allClientRecords || []).forEach((rec: any) => {
      if (rec.network_id) {
        balancesByNetwork[rec.network_id] = parseFloat(rec.total_points || 0);
      }
    });

    // Buscar dados de TODAS as redes do cliente
    let networksData: Record<string, any> = {};
    if (networkIds.size > 0) {
      const { data: networks } = await supabase
        .from('networks')
        .select('id, name, loyalty_type, one_enabled, retention_is_active, retention_cashback_multiplier_6_months, retention_cashback_multiplier_9_months, retention_cashback_multiplier_12_months, retention_points_multiplier_6_months, retention_points_multiplier_9_months, retention_points_multiplier_12_months, referral_enabled, referral_bonus_type, referral_bonus_referrer, referral_bonus_referred, support_whatsapp, support_whatsapp_message')
        .in('id', Array.from(networkIds));

      (networks || []).forEach((n: any) => {
        networksData[n.id] = n;
      });
    }

    // Buscar lojas de TODAS as redes do cliente (com flag e services)
    const storesByNetwork: Record<string, any[]> = {};
    if (networkIds.size > 0) {
      const { data: stores } = await supabase
        .from('stores')
        .select('id, name, address, cnpj, razao_social, nome_fantasia, contact_name, contact_phone, contact_email, flag, services, network_id, status, max_redemption_sale_percentage')
        .in('network_id', Array.from(networkIds))
        .eq('status', 'active');

      (stores || []).forEach((store: any) => {
        if (!storesByNetwork[store.network_id]) {
          storesByNetwork[store.network_id] = [];
        }
        storesByNetwork[store.network_id].push(store);
      });
    }

    // Config da rede favorita
    let favoriteNetworkConfig = networksData[client.favorite_network_id] || null;
    let retentionCommitment = null;

    if (client.favorite_network_id) {
      // Usar o client_id correto da rede favorita (pode ser diferente do client_id passado)
      const favoriteClientId = clientIdsByNetwork[client.favorite_network_id] || client_id;
      
      const { data: commitment } = await supabase
        .from('client_retention_commitments')
        .select('*')
        .eq('client_id', favoriteClientId)
        .eq('network_id', client.favorite_network_id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      retentionCommitment = commitment;

      // Buscar config de retenção da rede favorita (opções de planos disponíveis)
      const { data: retentionConfig } = await supabase
        .from('network_retention_config')
        .select('*')
        .eq('network_id', client.favorite_network_id)
        .eq('is_active', true)
        .maybeSingle();

      if (retentionConfig) {
        const loyaltyType = favoriteNetworkConfig?.loyalty_type || 'cashback';
        const prefix = loyaltyType === 'cashback' ? 'cashback_multiplier' : 'points_multiplier';
        
        favoriteNetworkConfig = {
          ...favoriteNetworkConfig,
          retention_plans: {
            is_active: true,
            plans: [
              { months: 6, multiplier: retentionConfig[`${prefix}_6_months`] },
              { months: 9, multiplier: retentionConfig[`${prefix}_9_months`] },
              { months: 12, multiplier: retentionConfig[`${prefix}_12_months`] },
            ]
          }
        };
      }
    }

    // Buscar transações de TODOS os client_ids do mesmo CPF (todas as redes)
    const allClientIds = (allClientRecords || []).map((rec: any) => rec.id);
    const { data: transactionsData } = await supabase
      .from('transactions')
      .select('id, client_id, store_id, type, amount, points, description, created_at, is_manual_entry, stores(id, name, network_id)')
      .in('client_id', allClientIds)
      .order('created_at', { ascending: false })
      .limit(100);

    // Buscar últimas 20 notificações
    const { data: notifRecipients } = await supabase
      .from('client_notification_recipients')
      .select('id, is_read, read_at, created_at, client_notifications(id, title, message, created_at)')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false })
      .limit(20);

    const notifications = notifRecipients || [];
    const unreadCount = notifications.filter((n: any) => !n.is_read).length;

    // Montar array de redes com saldos, lojas e retenção normalizada
    const networksWithData = Array.from(networkIds).map((nid) => {
      const net = networksData[nid] || null;
      const loyaltyType = net?.loyalty_type || 'cashback';
      const prefix = loyaltyType === 'cashback' ? 'retention_cashback_multiplier' : 'retention_points_multiplier';
      
      return {
        network_id: nid,
        balance: balancesByNetwork[nid] || 0,
        is_favorite: nid === client.favorite_network_id,
        network: net,
        stores: storesByNetwork[nid] || [],
        retention_enabled: net?.retention_is_active || false,
        retention_multiplier_6: net?.[`${prefix}_6_months`] || 0,
        retention_multiplier_9: net?.[`${prefix}_9_months`] || 0,
        retention_multiplier_12: net?.[`${prefix}_12_months`] || 0,
      };
    });

    // Garantir que a rede favorita venha primeiro
    networksWithData.sort((a: any, b: any) => {
      if (a.is_favorite) return -1;
      if (b.is_favorite) return 1;
      return 0;
    });

    // Gerar link de indicação com domínio customizado
    const referralLink = `https://portal.levamais.app/cadastro?ref=${client_id}`;

    return new Response(
      JSON.stringify({
        success: true,
        client,
        referral_link: referralLink,
        favorite_network_config: favoriteNetworkConfig,
        retention_commitment: retentionCommitment,
        networks: networksWithData,
        transactions: transactionsData || [],
        notifications: {
          unread_count: unreadCount,
          items: notifications
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
