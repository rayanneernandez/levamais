// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  messages: Message[];
  networkId: string;
  timezoneOffset?: number;
  reportType?: string; // yesterday, today, last7days, last15days, last30days, lastmonth
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, networkId, timezoneOffset = 0, reportType }: ChatRequest = await req.json();

    if (!messages || !networkId) {
      throw new Error("Mensagens e networkId são obrigatórios");
    }

    // Criar cliente Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar créditos disponíveis
    const { data: networkCredits, error: networkError } = await supabaseClient
      .from('networks')
      .select('ai_credits_limit, ai_credits_used')
      .eq('id', networkId)
      .single();

    if (networkError) throw networkError;

    const creditsLimit = networkCredits.ai_credits_limit || 0;
    const creditsUsed = networkCredits.ai_credits_used || 0;
    const creditsRemaining = creditsLimit - creditsUsed;

    if (creditsRemaining <= 0) {
      return new Response(
        JSON.stringify({ 
          error: "Créditos insuficientes. Entre em contato com o suporte para renovar seu pacote." 
        }),
        { 
          status: 402, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Calcular período baseado no reportType
    const now = new Date();
    const userNow = new Date(now.getTime() - timezoneOffset * 60000);
    
    let startDate: Date;
    let endDate: Date;
    let periodLabel: string;

    if (reportType) {
      switch (reportType) {
        case 'yesterday':
          // Dia anterior completo
          const yesterday = new Date(userNow);
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(0, 0, 0, 0);
          startDate = new Date(yesterday.getTime() + timezoneOffset * 60000);
          
          const yesterdayEnd = new Date(yesterday);
          yesterdayEnd.setHours(23, 59, 59, 999);
          endDate = new Date(yesterdayEnd.getTime() + timezoneOffset * 60000);
          periodLabel = yesterday.toLocaleDateString('pt-BR');
          break;
        
        case 'today':
          // Hoje desde 00:00 até agora
          const todayStart = new Date(userNow);
          todayStart.setHours(0, 0, 0, 0);
          startDate = new Date(todayStart.getTime() + timezoneOffset * 60000);
          endDate = now;
          periodLabel = `Hoje (${userNow.toLocaleDateString('pt-BR')}) até agora`;
          break;
        
        case 'last7days':
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          endDate = now;
          periodLabel = 'Últimos 7 dias';
          break;
        
        case 'last15days':
          startDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
          endDate = now;
          periodLabel = 'Últimos 15 dias';
          break;
        
        case 'last30days':
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          endDate = now;
          periodLabel = 'Últimos 30 dias';
          break;
        
        case 'lastmonth':
          // Mês anterior completo (ex: se estamos em Maio, pegar todo Abril)
          const lastMonthDate = new Date(userNow);
          lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
          lastMonthDate.setDate(1);
          lastMonthDate.setHours(0, 0, 0, 0);
          startDate = new Date(lastMonthDate.getTime() + timezoneOffset * 60000);
          
          const lastMonthEnd = new Date(lastMonthDate);
          lastMonthEnd.setMonth(lastMonthEnd.getMonth() + 1);
          lastMonthEnd.setDate(0);
          lastMonthEnd.setHours(23, 59, 59, 999);
          endDate = new Date(lastMonthEnd.getTime() + timezoneOffset * 60000);
          periodLabel = lastMonthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
          break;
        
        default:
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          endDate = now;
          periodLabel = 'Últimos 30 dias';
      }
    } else {
      // Período padrão: últimos 30 dias
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      endDate = now;
      periodLabel = 'Últimos 30 dias';
    }

    const startDateISO = startDate.toISOString();
    const endDateISO = endDate.toISOString();

    // =====================================================
    // BUSCAR TODAS AS INFORMAÇÕES DA REDE
    // =====================================================

    // 1. LOJAS - Informações completas
    const { data: stores, error: storesError } = await supabaseClient
      .from('stores')
      .select('*')
      .eq('network_id', networkId);

    if (storesError) {
      console.error("Erro ao buscar lojas:", storesError);
      throw new Error("Erro ao buscar lojas da rede");
    }

    const storeIds = stores?.map(s => s.id) || [];
    const storesData = stores || [];

    // 2. CAMPANHAS DE MARKETING
    const { data: campaigns } = await supabaseClient
      .from('marketing_campaigns')
      .select('*')
      .eq('network_id', networkId)
      .order('created_at', { ascending: false })
      .limit(50);

    // 3. CONFIGURAÇÕES DE COMBUSTÍVEL
    const { data: fuelConfigs } = await supabaseClient
      .from('fuel_differential_config')
      .select('*')
      .eq('network_id', networkId)
      .eq('is_active', true);

    const { data: fuelPromotions } = await supabaseClient
      .from('fuel_promotions')
      .select('*')
      .eq('network_id', networkId)
      .eq('is_active', true);

    // 4. TAGS DE CLIENTES
    const { data: tags } = await supabaseClient
      .from('client_tags')
      .select('tag_name, count(*)')
      .eq('network_id', networkId);

    // 5. PROGRAMA DE INDICAÇÃO
    const { data: referrals } = await supabaseClient
      .from('client_referrals')
      .select('*')
      .eq('network_id', networkId);

    // 6. COMPROMISSOS DE RETENÇÃO
    const { data: retentionCommitments } = await supabaseClient
      .from('client_retention_commitments')
      .select('*')
      .eq('network_id', networkId)
      .eq('status', 'active');

    // 7. INFORMAÇÕES DA REDE
    const { data: networkInfo } = await supabaseClient
      .from('networks')
      .select('*')
      .eq('id', networkId)
      .single();

    // 8. ANOMALIAS DETECTADAS
    const { data: anomalies } = await supabaseClient
      .from('anomalies')
      .select('*')
      .eq('network_id', networkId)
      .eq('status', 'pending')
      .gte('detected_at', startDateISO)
      .order('detected_at', { ascending: false });

    // 9. LOGS DE SMS
    const { data: smsLogs } = await supabaseClient
      .from('sms_logs')
      .select('status, provider, message_type, created_at')
      .in('store_id', storeIds)
      .gte('created_at', startDateISO);

    // 10. USUÁRIOS/GESTORES DA REDE
    const { data: managers } = await supabaseClient
      .from('store_managers')
      .select('user_id, store_id, is_attendant, attendant_code')
      .eq('network_id', networkId);

    // Buscar transações detalhadas (período selecionado)
    const { data: transactions, error: transactionsError } = await supabaseClient
      .from('transactions')
      .select(`
        id,
        type, 
        amount, 
        points, 
        created_at,
        description,
        codigo_produto,
        codigo_colaborador,
        nome_colaborador,
        client_id,
        store_id
      `)
      .in('store_id', storeIds)
      .gte('created_at', startDateISO)
      .lte('created_at', endDateISO)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (transactionsError) console.error("Erro ao buscar transações:", transactionsError);

    // Buscar clientes com informações completas
    const { data: clients, error: clientsError } = await supabaseClient
      .from('clients')
      .select('id, name, cpf, phone, created_at, total_points')
      .eq('network_id', networkId)
      .order('total_points', { ascending: false });

    if (clientsError) console.error("Erro ao buscar clientes:", clientsError);

    // Buscar todas as transações para análise de retenção
    const { data: allClientTransactions, error: allTransactionsError } = await supabaseClient
      .from('transactions')
      .select('client_id, type, created_at, amount, points')
      .in('store_id', storeIds)
      .order('created_at', { ascending: false });

    if (allTransactionsError) console.error("Erro ao buscar todas transações:", allTransactionsError);

    // Agregar dados
    const purchaseTransactions = transactions?.filter(t => t.type === 'accumulation') || [];
    const totalVendas = purchaseTransactions.length;
    const totalReceita = purchaseTransactions.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
    const mediaVenda = totalVendas > 0 ? totalReceita / totalVendas : 0;

    // Dados específicos de HOJE (considerando o timezone do usuário)
    const today = new Date(userNow.getFullYear(), userNow.getMonth(), userNow.getDate());
    const todayUTC = new Date(today.getTime() + timezoneOffset * 60000);
    
    const todayTransactions = purchaseTransactions.filter(t => {
      const tDate = new Date(t.created_at);
      return tDate >= todayUTC;
    });
    const vendasHoje = todayTransactions.length;
    const receitaHoje = todayTransactions.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

    const clientesAtivos = clients?.length || 0;
    const clientesNovos = clients?.filter(c => new Date(c.created_at) >= startDate).length || 0;
    const clientesNovosHoje = clients?.filter(c => {
      const cDate = new Date(c.created_at);
      return cDate >= todayUTC;
    }).length || 0;
    const topClients = clients?.slice(0, 5).map(c => ({
      pontos: c.total_points,
    })) || [];

    // Análise de Retenção
    const clientsWithLastPurchase = new Map<string, Date>();
    const clientPurchaseCount = new Map<string, number>();
    const clientRedemptionCount = new Map<string, number>();
    const clientTimeBetweenPurchases = new Map<string, number[]>();

    allClientTransactions?.forEach(t => {
      if (t.type === 'accumulation') {
        const purchaseDate = new Date(t.created_at);
        const lastPurchase = clientsWithLastPurchase.get(t.client_id);
        
        if (lastPurchase) {
          const daysBetween = Math.floor((purchaseDate.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24));
          const times = clientTimeBetweenPurchases.get(t.client_id) || [];
          times.push(daysBetween);
          clientTimeBetweenPurchases.set(t.client_id, times);
        }
        
        clientsWithLastPurchase.set(t.client_id, purchaseDate);
        clientPurchaseCount.set(t.client_id, (clientPurchaseCount.get(t.client_id) || 0) + 1);
      } else if (t.type === 'redemption') {
        clientRedemptionCount.set(t.client_id, (clientRedemptionCount.get(t.client_id) || 0) + 1);
      }
    });

    // Clientes inativos (sem compra nos últimos 30 dias)
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    let clientesInativos = 0;
    let clientesAtivosRecorrentes = 0;
    let totalDaysBetweenPurchases = 0;
    let purchaseIntervalsCount = 0;

    clientsWithLastPurchase.forEach((lastPurchase, clientId) => {
      if (lastPurchase < sixtyDaysAgo) {
        clientesInativos++;
      }
      
      const purchaseCount = clientPurchaseCount.get(clientId) || 0;
      if (purchaseCount >= 2) {
        clientesAtivosRecorrentes++;
      }

      const intervals = clientTimeBetweenPurchases.get(clientId) || [];
      intervals.forEach(days => {
        totalDaysBetweenPurchases += days;
        purchaseIntervalsCount++;
      });
    });

    const tempoMedioEntreCompras = purchaseIntervalsCount > 0 
      ? Math.round(totalDaysBetweenPurchases / purchaseIntervalsCount) 
      : 0;

    // Taxa de retenção (clientes ativos no período / total de clientes)
    const clientesAtivosNoPeriodo = Array.from(clientsWithLastPurchase.values())
      .filter(date => date >= startDate).length;
    const taxaRetencao = clientesAtivos > 0 
      ? Math.round((clientesAtivosNoPeriodo / clientesAtivos) * 100) 
      : 0;

    // Taxa de resgate (clientes que resgataram / clientes que acumularam)
    const clientesQueResgataram = clientRedemptionCount.size;
    const clientesQueAcumularam = clientPurchaseCount.size;
    const taxaResgate = clientesQueAcumularam > 0
      ? Math.round((clientesQueResgataram / clientesQueAcumularam) * 100)
      : 0;

    // Resgates vs Acúmulos
    const totalResgates = allClientTransactions?.filter(t => t.type === 'redemption').length || 0;
    const totalAcumulos = allClientTransactions?.filter(t => t.type === 'accumulation').length || 0;

    // Calcular distribuição por hora
    const vendaPorHora: Record<number, number> = {};
    purchaseTransactions.forEach(t => {
      const hora = new Date(t.created_at).getHours();
      vendaPorHora[hora] = (vendaPorHora[hora] || 0) + 1;
    });
    const horaMaisVendas = Object.entries(vendaPorHora).sort((a, b) => b[1] - a[1])[0];

    // Processar dados adicionais para insights
    const campaignsData = campaigns || [];
    const totalCampaigns = campaignsData.length;
    const completedCampaigns = campaignsData.filter(c => c.status === 'completed').length;
    const activeCampaigns = campaignsData.filter(c => c.status === 'active').length;
    
    const totalCampaignCost = campaignsData.reduce((sum, c) => sum + (parseFloat(c.total_cost || '0')), 0);
    const totalRecipients = campaignsData.reduce((sum, c) => sum + (c.total_recipients || 0), 0);
    const totalSent = campaignsData.reduce((sum, c) => sum + (c.sent_count || 0), 0);
    
    const campaignsByType = {
      email: campaignsData.filter(c => c.campaign_type === 'email').length,
      sms: campaignsData.filter(c => c.campaign_type === 'sms').length,
      whatsapp: campaignsData.filter(c => c.campaign_type === 'whatsapp').length,
    };

    const fuelConfigsData = fuelConfigs || [];
    const fuelPromotionsData = fuelPromotions || [];
    const hasFuelProgram = fuelConfigsData.length > 0 || fuelPromotionsData.length > 0;

    const tagsData = tags || [];
    const totalTags = tagsData.length;

    const referralsData = referrals || [];
    const totalReferrals = referralsData.length;
    const successfulReferrals = referralsData.filter(r => r.status === 'completed').length;

    const retentionCommitmentsData = retentionCommitments || [];
    const activeCommitments = retentionCommitmentsData.length;

    const anomaliesData = anomalies || [];
    const pendingAnomalies = anomaliesData.length;
    const anomaliesByType = anomaliesData.reduce((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const smsLogsData = smsLogs || [];
    const totalSMS = smsLogsData.length;
    const smsSent = smsLogsData.filter(s => s.status === 'sent' || s.status === 'delivered').length;
    const smsFailed = smsLogsData.filter(s => s.status === 'failed').length;

    const managersData = managers || [];
    const totalManagers = managersData.filter(m => !m.is_attendant).length;
    const totalAttendants = managersData.filter(m => m.is_attendant).length;

    const networkData: any = networkInfo || {};
    const hasReferralProgram = networkData.referral_enabled || false;
    const hasFuelAnalysis = networkData.fuel_analysis_enabled || false;

    // Dados das lojas
    const totalStores = storesData.length;
    const activeStores = storesData.filter((s: any) => s.status === 'active').length;
    
    // Agrupar lojas (sem processamento de cidade por enquanto, já que address é texto livre)
    const storeNames = storesData.map((s: any) => s.name || s.nome_fantasia || 'Sem nome').slice(0, 5);
    const topStores = storeNames.length > 0 ? `Lojas: ${storeNames.join(', ')}` : '';

    // Preparar mapa de clientes para referência rápida
    const clientsMap = new Map(clients?.map(c => [c.id, c]) || []);
    const storesMap = new Map(storesData.map(s => [s.id, s]) || []);

    // Agrupar transações recentes por data para insights detalhados
    const transactionsByDate: Record<string, any[]> = {};
    transactions?.forEach((t: any) => {
      const dateKey = new Date(t.created_at).toLocaleDateString('pt-BR');
      if (!transactionsByDate[dateKey]) {
        transactionsByDate[dateKey] = [];
      }
      transactionsByDate[dateKey].push(t);
    });

    // Pegar últimos 7 dias de transações detalhadas
    const last7DaysTransactions = transactions?.slice(0, 200) || [];
    const transactionDetails = last7DaysTransactions.map((t: any) => {
      const client = clientsMap.get(t.client_id);
      const store = storesMap.get(t.store_id);
      const date = new Date(t.created_at).toLocaleString('pt-BR');
      
      return `${date} | ${t.type === 'accumulation' ? 'ACÚMULO' : 'RESGATE'} | ` +
        `Cliente: ${client?.name || 'N/A'} | ` +
        `Loja: ${store?.name || store?.nome_fantasia || 'N/A'} | ` +
        `Valor: R$ ${parseFloat(t.amount || 0).toFixed(2)} | ` +
        `Pontos: ${parseFloat(t.points || 0).toFixed(2)} | ` +
        `${t.codigo_colaborador ? `Colaborador: ${t.nome_colaborador || t.codigo_colaborador}` : ''} | ` +
        `${t.codigo_produto ? `Produto: ${t.codigo_produto}` : ''}`;
    }).join('\n');

    // Estatísticas por dia dos últimos 7 dias
    const dailyStats = Object.entries(transactionsByDate)
      .slice(0, 7)
      .map(([date, trans]) => {
        const acumulos = trans.filter(t => t.type === 'accumulation');
        const resgates = trans.filter(t => t.type === 'redemption');
        return `${date}: ${acumulos.length} acúmulos (R$ ${acumulos.reduce((s, t) => s + parseFloat(t.amount || 0), 0).toFixed(2)}), ` +
          `${resgates.length} resgates (${resgates.reduce((s, t) => s + parseFloat(t.points || 0), 0).toFixed(2)} pts)`;
      })
      .join('\n');

    // Montar contexto COMPLETO para IA
    const systemPrompt = `Você é um assistente de inteligência artificial especializado em análise de dados do sistema de fidelidade Leva+.
Você tem acesso COMPLETO a todos os dados dessa rede e pode responder sobre absolutamente qualquer aspecto do negócio.

========================================
📅 DATA DE HOJE: ${userNow.toLocaleDateString('pt-BR')}
📊 PERÍODO DE ANÁLISE: ${periodLabel}
========================================
${reportType ? `
🎯 MODO RESUMO AUTOMÁTICO ATIVADO
Gere um relatório completo e detalhado do período "${periodLabel}". 
Inclua TODOS os dados relevantes: vendas, clientes, retenção, campanhas, anomalias, top clientes, horários de pico, etc.
Seja específico com números, percentuais e comparações quando possível.
` : ''}

========================================
📊 DADOS DE VENDAS DE HOJE
========================================
- Vendas realizadas hoje: ${vendasHoje}
- Receita gerada hoje: R$ ${receitaHoje.toFixed(2)}
${vendasHoje > 0 ? `- Ticket médio hoje: R$ ${(receitaHoje / vendasHoje).toFixed(2)}` : '- Sem vendas registradas hoje ainda'}
- Novos clientes cadastrados hoje: ${clientesNovosHoje}

========================================
📈 DESEMPENHO DOS ÚLTIMOS 30 DIAS
========================================
Vendas e Receita:
- Total de transações: ${totalVendas}
- Receita total: R$ ${totalReceita.toFixed(2)}
- Ticket médio: R$ ${mediaVenda.toFixed(2)}
${horaMaisVendas ? `- Horário de pico de vendas: ${horaMaisVendas[0]}h com ${horaMaisVendas[1]} transações` : ''}

Clientes:
- Total de clientes ativos: ${clientesAtivos}
- Novos clientes no período: ${clientesNovos}
- Clientes recorrentes (2+ compras): ${clientesAtivosRecorrentes}
${topClients.length > 0 ? `- Faixa de pontos dos top 5 clientes: ${Math.min(...topClients.map(c => c.pontos))} a ${Math.max(...topClients.map(c => c.pontos))} pontos` : ''}

========================================
🎯 ANÁLISE DE RETENÇÃO E ENGAJAMENTO
========================================
- Taxa de retenção: ${taxaRetencao}% (clientes ativos nos últimos 30 dias)
- Clientes inativos (60+ dias sem compra): ${clientesInativos}
- Tempo médio entre compras: ${tempoMedioEntreCompras} dias
- Taxa de resgate: ${taxaResgate}% (clientes que resgataram vs que acumularam)
- Total de acúmulos: ${totalAcumulos} transações
- Total de resgates: ${totalResgates} transações
- Proporção resgate/acúmulo: ${totalAcumulos > 0 ? ((totalResgates / totalAcumulos) * 100).toFixed(1) : 0}%
- Compromissos de retenção ativos: ${activeCommitments}

========================================
🏪 INFORMAÇÕES DAS LOJAS
========================================
- Total de lojas cadastradas: ${totalStores}
- Lojas ativas: ${activeStores}
${topStores ? `- ${topStores}` : ''}
- Tipo de programa predominante: ${networkData.loyalty_type || 'cashback'}

========================================
📋 TRANSAÇÕES DETALHADAS (últimos 7 dias)
========================================
Resumo por dia:
${dailyStats}

Últimas 200 transações (detalhadas):
${transactionDetails}

IMPORTANTE: Você tem acesso completo a essas transações. Quando perguntarem sobre uma data específica, 
analise as transações dessa data acima. Inclua nomes de clientes, lojas, colaboradores e produtos quando relevante.

========================================
📢 CAMPANHAS DE MARKETING
========================================
- Total de campanhas criadas: ${totalCampaigns}
- Campanhas ativas no momento: ${activeCampaigns}
- Campanhas concluídas: ${completedCampaigns}
- Custo total investido: R$ ${totalCampaignCost.toFixed(2)}
- Total de destinatários alcançados: ${totalRecipients}
- Mensagens enviadas: ${totalSent}
- Distribuição por canal:
  • Email: ${campaignsByType.email} campanhas
  • SMS: ${campaignsByType.sms} campanhas
  • WhatsApp: ${campaignsByType.whatsapp} campanhas

========================================
📱 SMS E COMUNICAÇÕES (últimos 30 dias)
========================================
- Total de SMS enviados: ${totalSMS}
- SMS entregues com sucesso: ${smsSent}
- SMS com falha: ${smsFailed}
- Taxa de sucesso: ${totalSMS > 0 ? ((smsSent / totalSMS) * 100).toFixed(1) : 0}%

========================================
⛽ PROGRAMA DE COMBUSTÍVEL
========================================
- Programa de combustível ativo: ${hasFuelProgram ? 'SIM' : 'NÃO'}
${fuelConfigsData.length > 0 ? `- Produtos configurados com pontuação diferenciada: ${fuelConfigsData.length}` : ''}
${fuelPromotionsData.length > 0 ? `- Promoções de combustível ativas: ${fuelPromotionsData.length}` : ''}
- Análise de combustível habilitada: ${hasFuelAnalysis ? 'SIM' : 'NÃO'}

========================================
👥 PROGRAMA DE INDICAÇÃO
========================================
- Programa de indicação ativo: ${hasReferralProgram ? 'SIM' : 'NÃO'}
- Total de indicações realizadas: ${totalReferrals}
- Indicações bem-sucedidas: ${successfulReferrals}
${totalReferrals > 0 ? `- Taxa de conversão de indicações: ${((successfulReferrals / totalReferrals) * 100).toFixed(1)}%` : ''}
${hasReferralProgram ? `- Bônus para indicador: ${networkData.referral_bonus_referrer || 0} ${networkData.referral_bonus_type || 'cashback'}` : ''}
${hasReferralProgram ? `- Bônus para indicado: ${networkData.referral_bonus_referred || 0} ${networkData.referral_bonus_type || 'cashback'}` : ''}

========================================
🏷️ TAGS E SEGMENTAÇÃO
========================================
- Total de tags em uso: ${totalTags}
- Segmentação de clientes disponível para campanhas direcionadas

========================================
👨‍💼 EQUIPE E USUÁRIOS
========================================
- Gestores da rede: ${totalManagers}
- Atendentes cadastrados: ${totalAttendants}

========================================
🚨 ANOMALIAS E SEGURANÇA
========================================
- Anomalias pendentes de análise: ${pendingAnomalies}
${pendingAnomalies > 0 ? `- Tipos de anomalias detectadas: ${Object.entries(anomaliesByType).map(([type, count]) => `${type} (${count})`).join(', ')}` : ''}

========================================
⚙️ CONFIGURAÇÕES DA REDE
========================================
- Tipo de fidelidade: ${networkData.loyalty_type === 'points' ? 'Pontos' : 'Cashback'}
- Validade dos pontos: ${networkData.points_expiration_days || 0} dias
- Alerta de expiração: ${networkData.points_expiration_alert_days || 0} dias antes
- Licenças totais: ${networkData.total_licenses || 0}
- Limite de lojas: ${networkData.max_stores || 0}
- Créditos de IA disponíveis: ${creditsRemaining}

========================================
💡 INSTRUÇÕES PARA RESPOSTA
========================================
- Responda SEMPRE em português brasileiro 🇧🇷
- Seja conciso mas completo (2-4 parágrafos)
- Use emojis relevantes para deixar a resposta visual
- Forneça insights PRÁTICOS e ACIONÁVEIS
- Cite números específicos dos dados acima
- Se não tiver dados suficientes, seja honesto e sugira o que fazer
- NUNCA invente dados ou estatísticas
- Para perguntas sobre "hoje", use a seção "DADOS DE VENDAS DE HOJE"
- Para análises de retenção, use "ANÁLISE DE RETENÇÃO E ENGAJAMENTO"
- Para campanhas, use "CAMPANHAS DE MARKETING"
- Você pode comparar dados de hoje com a média dos últimos 30 dias
- Sugira ações concretas baseadas nos dados
- Se perguntarem sobre algo específico que você não tem dados, explique o que você TEM disponível

Agora responda à pergunta do usuário de forma completa e útil:`;

    // Estimar consumo (aproximadamente 1 crédito = 1000 tokens)
    const estimatedInputTokens = JSON.stringify(messages).length / 4;
    const estimatedOutputTokens = 500; // Estimativa conservadora
    const estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens;
    const creditsToConsume = Math.ceil(estimatedTotalTokens / 1000);

    // Verificar se tem créditos suficientes para esta consulta
    if (creditsToConsume > creditsRemaining) {
      return new Response(
        JSON.stringify({ 
          error: `Esta consulta consumirá aproximadamente ${creditsToConsume} créditos, mas você tem apenas ${creditsRemaining} disponíveis.` 
        }),
        { 
          status: 402, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Chamar Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não está configurada");
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit atingido. Aguarde um momento antes de fazer outra pergunta." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos Lovable AI esgotados. Entre em contato com o suporte." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("Erro do Lovable AI:", aiResponse.status, errorText);
      throw new Error("Erro ao processar com IA");
    }

    const aiData = await aiResponse.json();
    const responseText = aiData.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua pergunta.";

    // Calcular consumo real baseado na resposta
    const actualOutputTokens = responseText.length / 4;
    const actualTotalTokens = estimatedInputTokens + actualOutputTokens;
    const actualCreditsUsed = Math.ceil(actualTotalTokens / 1000);

    // Atualizar créditos usados
    const { error: updateError } = await supabaseClient
      .from('networks')
      .update({ 
        ai_credits_used: creditsUsed + actualCreditsUsed,
      })
      .eq('id', networkId);

    if (updateError) {
      console.error("Erro ao atualizar créditos:", updateError);
    }

    // Registrar uso para auditoria
    await supabaseClient
      .from('audit_logs')
      .insert({
        table_name: 'ai_insights_usage',
        action: 'QUERY',
        record_id: networkId,
        new_data: {
          credits_used: actualCreditsUsed,
          question: messages[messages.length - 1]?.content?.substring(0, 100),
        },
      });

    return new Response(
      JSON.stringify({ 
        response: responseText,
        creditsUsed: actualCreditsUsed,
        creditsRemaining: creditsRemaining - actualCreditsUsed,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error("Erro no chat-insights:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
