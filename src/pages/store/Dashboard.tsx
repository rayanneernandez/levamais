import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Users, Award, Calendar, Percent, DollarSign, RotateCcw, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { startOfMonth, endOfMonth, format, differenceInDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useStoreFilter } from "@/contexts/StoreFilterContext";
import { LineChart, Line, PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { LoadingPage } from "@/components/ui/loading-page";
import { DrillDownDialog } from "@/components/store/DrillDownDialog";
import { useDrillDown } from "@/hooks/useDrillDown";
import InsightsChat from "@/components/store/InsightsChat";

interface Store {
  id: string;
  name: string;
}

interface DashboardMetrics {
  totalClients: number;
  newClientsRate: number;
  averageTicket: number;
  conversionRate: number;
  redeemedValue: number;
  retentionRate: number;
  avgPurchaseFrequency: number;
  activePoints: number;
  totalTransactions: number;
  loyaltyTransactions: number;
}

export default function StoreDashboard() {
  const { toast } = useToast();
  const { selectedStore } = useStoreFilter();
  const { drillDownCard, drillDownLoading, setDrillDownLoading, openDrillDown, closeDrillDown } = useDrillDown();
  const [stores, setStores] = useState<Store[]>([]);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [loyaltyType, setLoyaltyType] = useState<'points' | 'cashback'>('points');
  const [isLoading, setIsLoading] = useState(true);
  const [drillDownData, setDrillDownData] = useState<any>(null);
  
  // Definir período padrão como mês atual
  const now = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(now), 'yyyy-MM-dd'));
  
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalClients: 0,
    newClientsRate: 0,
    averageTicket: 0,
    conversionRate: 0,
    redeemedValue: 0,
    retentionRate: 0,
    avgPurchaseFrequency: 0,
    activePoints: 0,
    totalTransactions: 0,
    loyaltyTransactions: 0,
  });

  const [evolutionData, setEvolutionData] = useState<Array<{month: string, clients: number, redemptions: number}>>([]);
  const [pointsDistribution, setPointsDistribution] = useState<Array<{name: string, value: number}>>([]);
  const [retentionData, setRetentionData] = useState<Array<{name: string, value: number}>>([]);
  const [topStores, setTopStores] = useState<Array<{name: string, revenue: number}>>([]);
  const [topClients, setTopClients] = useState<Array<{name: string, cpf: string, spent: number}>>([]);

  const loadNetworkAndStores = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: managerData } = await supabase
        .from('store_managers')
        .select('network_id')
        .eq('user_id', user.id)
        .is('store_id', null)
        .maybeSingle();

      if (!managerData?.network_id) return;
      
      setNetworkId(managerData.network_id);

      // Buscar informações da rede incluindo tipo de fidelidade
      const { data: networkData } = await supabase
        .from('networks')
        .select('loyalty_type')
        .eq('id', managerData.network_id)
        .single();

      if (networkData?.loyalty_type) {
        const type = networkData.loyalty_type as 'points' | 'cashback';
        setLoyaltyType(type);
      }

      const { data: storesData } = await supabase
        .from('stores')
        .select('id, name')
        .eq('network_id', managerData.network_id)
        .eq('status', 'active');

      setStores(storesData || []);
    } catch (error) {
      console.error('Error loading network:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as lojas",
        variant: "destructive",
      });
    }
  };

  const loadMetrics = async () => {
    try {
      setIsLoading(true);

      const startDateTime = new Date(startDate + 'T00:00:00').toISOString();
      const endDateTime = new Date(endDate + 'T23:59:59').toISOString();

      // Query base de transações
      let transactionsQuery = supabase
        .from('transactions')
        .select('*')
        .gte('created_at', startDateTime)
        .lte('created_at', endDateTime);

      if (selectedStore !== 'all') {
        transactionsQuery = transactionsQuery.eq('store_id', selectedStore);
      } else {
        // Buscar todas as lojas da rede
        const storeIds = stores.map(s => s.id);
        if (storeIds.length > 0) {
          transactionsQuery = transactionsQuery.in('store_id', storeIds);
        }
      }

      const { data: transactions, error: transError } = await transactionsQuery;
      if (transError) throw transError;

      // Query de clientes
      let clientsQuery = supabase
        .from('clients')
        .select('*')
        .eq('network_id', networkId);

      const { data: allClients, error: clientsError } = await clientsQuery;
      if (clientsError) throw clientsError;

      // Calcular métricas
      const totalTransactions = transactions?.length || 0;
      const loyaltyTransactions = transactions?.filter(t => t.client_id)?.length || 0;
      
      // Taxa de conversão
      const conversionRate = totalTransactions > 0 
        ? (loyaltyTransactions / totalTransactions) * 100 
        : 0;

      // Ticket médio fidelizado
      const loyaltyTransactionsData = transactions?.filter(t => t.client_id) || [];
      const totalLoyaltyAmount = loyaltyTransactionsData.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const averageTicket = loyaltyTransactions > 0 
        ? totalLoyaltyAmount / loyaltyTransactions 
        : 0;

      // Valor resgatado (em reais)
      const redemptions = transactions?.filter(t => t.type === 'redemption') || [];
      const redeemedValue = redemptions.reduce((sum, t) => sum + Number(t.amount || 0), 0);

      // Novos clientes no período
      const newClients = allClients?.filter(c => {
        const createdAt = new Date(c.created_at);
        return createdAt >= new Date(startDateTime) && createdAt <= new Date(endDateTime);
      }) || [];
      
      const newClientsRate = allClients && allClients.length > 0
        ? (newClients.length / allClients.length) * 100
        : 0;

      // Pontos ativos (soma de total_points de todos os clientes)
      const activePoints = allClients?.reduce((sum, c) => sum + Number(c.total_points || 0), 0) || 0;

      // Taxa de retenção (clientes que compraram no período atual e no anterior)
      const previousStartDate = new Date(startDate);
      previousStartDate.setMonth(previousStartDate.getMonth() - 1);
      const previousEndDate = new Date(endDate);
      previousEndDate.setMonth(previousEndDate.getMonth() - 1);

      let prevTransQuery = supabase
        .from('transactions')
        .select('client_id')
        .gte('created_at', previousStartDate.toISOString())
        .lte('created_at', previousEndDate.toISOString())
        .not('client_id', 'is', null);

      if (selectedStore !== 'all') {
        prevTransQuery = prevTransQuery.eq('store_id', selectedStore);
      }

      const { data: prevTransactions } = await prevTransQuery;
      const previousClients = new Set(prevTransactions?.map(t => t.client_id));
      const currentClients = new Set(transactions?.filter(t => t.client_id).map(t => t.client_id));
      
      const retainedClients = [...previousClients].filter(id => currentClients.has(id)).length;
      const retentionRate = previousClients.size > 0 
        ? (retainedClients / previousClients.size) * 100 
        : 0;

      // Frequência média de compra
      const clientTransactions = new Map<string, Date[]>();
      transactions?.filter(t => t.client_id).forEach(t => {
        const clientId = t.client_id!;
        if (!clientTransactions.has(clientId)) {
          clientTransactions.set(clientId, []);
        }
        clientTransactions.get(clientId)!.push(new Date(t.created_at));
      });

      let totalDaysBetweenPurchases = 0;
      let purchasePairs = 0;

      clientTransactions.forEach(dates => {
        if (dates.length >= 2) {
          dates.sort((a, b) => a.getTime() - b.getTime());
          for (let i = 1; i < dates.length; i++) {
            totalDaysBetweenPurchases += differenceInDays(dates[i], dates[i - 1]);
            purchasePairs++;
          }
        }
      });

      const avgPurchaseFrequency = purchasePairs > 0 
        ? totalDaysBetweenPurchases / purchasePairs 
        : 0;

      setMetrics({
        totalClients: allClients?.length || 0,
        newClientsRate,
        averageTicket,
        conversionRate,
        redeemedValue,
        retentionRate,
        avgPurchaseFrequency,
        activePoints,
        totalTransactions,
        loyaltyTransactions,
      });

    } catch (error) {
      console.error('Error loading metrics:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as métricas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadChartData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar transações
      let transactionsQuery = supabase.from('transactions').select('*');
      if (selectedStore !== 'all') {
        transactionsQuery = transactionsQuery.eq('store_id', selectedStore);
      }
      const { data: transactions } = await transactionsQuery;
      if (!transactions) return;

      // Buscar clientes
      const { data: clients } = await supabase
        .from('clients')
        .select('*')
        .eq('network_id', networkId);
      if (!clients) return;

      // Buscar lojas
      let storesQuery = supabase.from('stores').select('*').eq('network_id', networkId);
      if (selectedStore !== 'all') {
        storesQuery = storesQuery.eq('id', selectedStore);
      }
      const { data: storesData } = await storesQuery;

      // 1. Evolução de clientes ativos e resgates por mês (últimos 6 meses)
      const monthsData = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);

        const monthTransactions = transactions.filter(t => {
          const tDate = new Date(t.created_at);
          return tDate >= monthStart && tDate <= monthEnd;
        });

        const activeClientsInMonth = new Set(monthTransactions.map(t => t.client_id)).size;
        const redemptionsInMonth = monthTransactions.filter(t => t.type === 'redemption').length;

        monthsData.push({
          month: format(monthDate, 'MMM/yy', { locale: ptBR }),
          clients: activeClientsInMonth,
          redemptions: redemptionsInMonth
        });
      }
      setEvolutionData(monthsData);

      // 2. Distribuição de pontos (ativos, resgatados, expirados)
      const totalActivePoints = clients.reduce((sum, c) => sum + Number(c.total_points || 0), 0);
      const totalRedeemedPoints = Math.abs(transactions
        .filter(t => t.type === 'redemption')
        .reduce((sum, t) => sum + Number(t.points), 0));
      const expiredPoints = 0; // TODO: implementar lógica de expiração

      setPointsDistribution([
        { name: 'Ativos', value: totalActivePoints },
        { name: 'Resgatados', value: totalRedeemedPoints },
        { name: 'Expirados', value: expiredPoints }
      ]);

      // 3. Retenção vs Novos Clientes
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const newClients = clients.filter(c => 
        new Date(c.created_at) >= thirtyDaysAgo
      ).length;

      const retainedClients = clients.filter(c => {
        const clientTransactions = transactions.filter(t => t.client_id === c.id);
        const hasRecentTransaction = clientTransactions.some(t => 
          new Date(t.created_at) >= thirtyDaysAgo
        );
        const hadPreviousTransaction = clientTransactions.some(t => 
          new Date(t.created_at) >= sixtyDaysAgo && new Date(t.created_at) < thirtyDaysAgo
        );
        return hasRecentTransaction && hadPreviousTransaction;
      }).length;

      setRetentionData([
        { name: 'Novos', value: newClients },
        { name: 'Retidos', value: retainedClients }
      ]);

      // 4. Top 10 Lojas
      if (storesData) {
        const storesWithRevenue = storesData.map(store => {
          const storeTransactions = transactions.filter(t => t.store_id === store.id && t.type === 'accumulation');
          const revenue = storeTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
          return { name: store.name, revenue };
        });
        
        const topStoresData = storesWithRevenue
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);
        setTopStores(topStoresData);
      }

      // 5. Top 10 Clientes
      const clientsWithSpent = clients.map(client => {
        const clientTransactions = transactions.filter(t => t.client_id === client.id && t.type === 'accumulation');
        const spent = clientTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
        return {
          name: client.full_name || 'Sem nome',
          cpf: client.cpf,
          spent
        };
      });

      const topClientsData = clientsWithSpent
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 10);
      setTopClients(topClientsData);

    } catch (error) {
      console.error('Erro ao carregar dados dos gráficos:', error);
    }
  };

  useEffect(() => {
    loadNetworkAndStores();
  }, []);

  const loadDrillDownData = async (type: string) => {
    if (!networkId) return;
    
    setDrillDownLoading(true);
    try {
      const startDateTime = new Date(startDate + 'T00:00:00').toISOString();
      const endDateTime = new Date(endDate + 'T23:59:59').toISOString();

      switch (type) {
        case 'totalClients': {
          // Buscar últimos clientes cadastrados e breakdown
          let clientsQuery = supabase
            .from('clients')
            .select('*')
            .eq('network_id', networkId)
            .order('created_at', { ascending: false })
            .limit(50);

          const { data: recentClients } = await clientsQuery;
          
          const validated = recentClients?.filter(c => c.is_validated).length || 0;
          const notValidated = recentClients?.filter(c => !c.is_validated).length || 0;
          
          setDrillDownData({
            recentClients: recentClients || [],
            breakdown: { validated, notValidated }
          });
          break;
        }

        case 'conversionRate': {
          // Buscar transações fidelizadas vs não fidelizadas
          let transQuery = supabase
            .from('transactions')
            .select('*, clients(full_name, cpf)')
            .gte('created_at', startDateTime)
            .lte('created_at', endDateTime);

          if (selectedStore !== 'all') {
            transQuery = transQuery.eq('store_id', selectedStore);
          } else {
            const storeIds = stores.map(s => s.id);
            if (storeIds.length > 0) {
              transQuery = transQuery.in('store_id', storeIds);
            }
          }

          const { data: transactions } = await transQuery;
          
          const loyaltyTrans = transactions?.filter(t => t.client_id) || [];
          const nonLoyaltyTrans = transactions?.filter(t => !t.client_id) || [];
          
          setDrillDownData({
            loyaltyTransactions: loyaltyTrans.slice(0, 20),
            nonLoyaltyTransactions: nonLoyaltyTrans.slice(0, 20),
            totals: {
              loyalty: loyaltyTrans.length,
              nonLoyalty: nonLoyaltyTrans.length
            }
          });
          break;
        }

        case 'averageTicket': {
          // Buscar distribuição de tickets
          let transQuery = supabase
            .from('transactions')
            .select('amount, created_at, clients(full_name)')
            .not('client_id', 'is', null)
            .gte('created_at', startDateTime)
            .lte('created_at', endDateTime)
            .order('amount', { ascending: false });

          if (selectedStore !== 'all') {
            transQuery = transQuery.eq('store_id', selectedStore);
          } else {
            const storeIds = stores.map(s => s.id);
            if (storeIds.length > 0) {
              transQuery = transQuery.in('store_id', storeIds);
            }
          }

          const { data: transactions } = await transQuery;
          
          const amounts = transactions?.map(t => Number(t.amount)) || [];
          const low = amounts.filter(a => a < 50).length;
          const medium = amounts.filter(a => a >= 50 && a < 200).length;
          const high = amounts.filter(a => a >= 200).length;
          
          setDrillDownData({
            topTransactions: transactions?.slice(0, 20) || [],
            distribution: { low, medium, high }
          });
          break;
        }

        case 'activePoints': {
          // Buscar top clientes com mais pontos
          let clientsQuery = supabase
            .from('clients')
            .select('*')
            .eq('network_id', networkId)
            .order('total_points', { ascending: false })
            .limit(50);

          const { data: topClients } = await clientsQuery;
          
          const points = topClients?.map(c => Number(c.total_points)) || [];
          const low = points.filter(p => p < 100).length;
          const medium = points.filter(p => p >= 100 && p < 500).length;
          const high = points.filter(p => p >= 500).length;
          
          setDrillDownData({
            topClients: topClients || [],
            distribution: { low, medium, high }
          });
          break;
        }

        case 'newClients': {
          // Buscar novos clientes do período
          let clientsQuery = supabase
            .from('clients')
            .select('*')
            .eq('network_id', networkId)
            .gte('created_at', startDateTime)
            .lte('created_at', endDateTime)
            .order('created_at', { ascending: false });

          const { data: newClients } = await clientsQuery;
          
          // Breakdown por status de validação
          const validated = newClients?.filter(c => c.is_validated).length || 0;
          const pending = newClients?.filter(c => !c.is_validated).length || 0;
          
          setDrillDownData({
            clients: newClients || [],
            breakdown: { validated, pending },
            total: newClients?.length || 0
          });
          break;
        }

        case 'retentionRate': {
          // Buscar clientes retidos
          const previousStartDate = new Date(startDate);
          previousStartDate.setMonth(previousStartDate.getMonth() - 1);
          const previousEndDate = new Date(endDate);
          previousEndDate.setMonth(previousEndDate.getMonth() - 1);

          let prevTransQuery = supabase
            .from('transactions')
            .select('client_id, clients(full_name, cpf, total_points)')
            .gte('created_at', previousStartDate.toISOString())
            .lte('created_at', previousEndDate.toISOString())
            .not('client_id', 'is', null);

          if (selectedStore !== 'all') {
            prevTransQuery = prevTransQuery.eq('store_id', selectedStore);
          } else {
            const storeIds = stores.map(s => s.id);
            if (storeIds.length > 0) {
              prevTransQuery = prevTransQuery.in('store_id', storeIds);
            }
          }

          const { data: prevTransactions } = await prevTransQuery;

          let currentTransQuery = supabase
            .from('transactions')
            .select('client_id, clients(full_name, cpf, total_points)')
            .gte('created_at', startDateTime)
            .lte('created_at', endDateTime)
            .not('client_id', 'is', null);

          if (selectedStore !== 'all') {
            currentTransQuery = currentTransQuery.eq('store_id', selectedStore);
          } else {
            const storeIds = stores.map(s => s.id);
            if (storeIds.length > 0) {
              currentTransQuery = currentTransQuery.in('store_id', storeIds);
            }
          }

          const { data: currentTransactions } = await currentTransQuery;

          const previousClients = new Set(prevTransactions?.map(t => t.client_id));
          const currentClientsMap = new Map();
          
          currentTransactions?.forEach(t => {
            if (t.client_id && !currentClientsMap.has(t.client_id)) {
              currentClientsMap.set(t.client_id, t.clients);
            }
          });

          const retainedClients = Array.from(currentClientsMap.entries())
            .filter(([id]) => previousClients.has(id))
            .map(([id, client]) => ({ id, ...client }));

          setDrillDownData({
            retainedClients,
            total: retainedClients.length,
            previousTotal: previousClients.size,
            rate: previousClients.size > 0 ? (retainedClients.length / previousClients.size) * 100 : 0
          });
          break;
        }

        case 'purchaseFrequency': {
          // Buscar clientes com múltiplas compras
          let transQuery = supabase
            .from('transactions')
            .select('client_id, created_at, amount, clients(full_name, cpf)')
            .not('client_id', 'is', null)
            .gte('created_at', startDateTime)
            .lte('created_at', endDateTime)
            .order('created_at', { ascending: true });

          if (selectedStore !== 'all') {
            transQuery = transQuery.eq('store_id', selectedStore);
          } else {
            const storeIds = stores.map(s => s.id);
            if (storeIds.length > 0) {
              transQuery = transQuery.in('store_id', storeIds);
            }
          }

          const { data: transactions } = await transQuery;

          // Agrupar por cliente
          const clientFrequency = new Map<string, any>();
          transactions?.forEach(t => {
            if (!t.client_id) return;
            
            if (!clientFrequency.has(t.client_id)) {
              clientFrequency.set(t.client_id, {
                clientId: t.client_id,
                clientName: t.clients?.full_name || 'Sem nome',
                clientCpf: t.clients?.cpf || '',
                purchases: [],
                totalSpent: 0
              });
            }
            
            const client = clientFrequency.get(t.client_id);
            client.purchases.push(new Date(t.created_at));
            client.totalSpent += Number(t.amount || 0);
          });

          // Calcular frequência para cada cliente
          const clientsWithFrequency = Array.from(clientFrequency.values()).map(client => {
            const dates = client.purchases.sort((a: Date, b: Date) => a.getTime() - b.getTime());
            let avgDays = 0;
            
            if (dates.length >= 2) {
              let totalDays = 0;
              for (let i = 1; i < dates.length; i++) {
                totalDays += differenceInDays(dates[i], dates[i - 1]);
              }
              avgDays = totalDays / (dates.length - 1);
            }
            
            return {
              ...client,
              purchaseCount: dates.length,
              avgDaysBetweenPurchases: avgDays
            };
          }).sort((a, b) => b.purchaseCount - a.purchaseCount);

          setDrillDownData({
            clients: clientsWithFrequency.slice(0, 50),
            totalClients: clientsWithFrequency.length
          });
          break;
        }

        case 'redeemedValue': {
          // Buscar resgates do período
          let redemptionsQuery = supabase
            .from('transactions')
            .select('*, clients(full_name, cpf)')
            .eq('type', 'redemption')
            .gte('created_at', startDateTime)
            .lte('created_at', endDateTime)
            .order('amount', { ascending: false });

          if (selectedStore !== 'all') {
            redemptionsQuery = redemptionsQuery.eq('store_id', selectedStore);
          } else {
            const storeIds = stores.map(s => s.id);
            if (storeIds.length > 0) {
              redemptionsQuery = redemptionsQuery.in('store_id', storeIds);
            }
          }

          const { data: redemptions } = await redemptionsQuery;

          const totalValue = redemptions?.reduce((sum, r) => sum + Number(r.amount || 0), 0) || 0;
          const totalPoints = Math.abs(redemptions?.reduce((sum, r) => sum + Number(r.points || 0), 0) || 0);

          setDrillDownData({
            redemptions: redemptions || [],
            totalValue,
            totalPoints,
            count: redemptions?.length || 0
          });
          break;
        }
      }
    } catch (error) {
      console.error('Erro ao carregar drill-down:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os detalhes",
        variant: "destructive",
      });
    } finally {
      setDrillDownLoading(false);
    }
  };

  const handleCardClick = async (type: string) => {
    openDrillDown(type as any);
    await loadDrillDownData(type);
  };

  useEffect(() => {
    if (networkId) {
      loadMetrics();
      loadChartData();
    }
  }, [networkId, selectedStore, startDate, endDate]);

  if (isLoading) {
    return <LoadingPage message="Carregando dashboard..." submessage="Processando suas métricas e gráficos" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Visão geral do seu programa de fidelidade
          </p>
        </div>
        
        {/* Filtro de Período Minimalista */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-36"
          />
          <span className="text-muted-foreground">até</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-36"
          />
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => {
              const now = new Date();
              setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
              setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
            }}
            title="Resetar para mês atual"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Indicadores Principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card 
          className="p-4 hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-primary group"
          onClick={() => handleCardClick('totalClients')}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Total de Clientes</p>
              <h3 className="text-2xl font-bold">{metrics.totalClients}</h3>
              <p className="text-xs text-muted-foreground">cadastrados</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center relative">
              <Users className="h-5 w-5 text-primary" />
              <ChevronRight className="h-3 w-3 text-primary absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </Card>

        <Card 
          className="p-4 hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-secondary group"
          onClick={() => handleCardClick('conversionRate')}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Taxa de Conversão</p>
              <h3 className="text-2xl font-bold">{metrics.conversionRate.toFixed(1)}%</h3>
              <p className="text-xs text-muted-foreground">
                {metrics.loyaltyTransactions} de {metrics.totalTransactions} transações
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center relative">
              <Percent className="h-5 w-5 text-secondary" />
              <ChevronRight className="h-3 w-3 text-secondary absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </Card>

        <Card 
          className="p-4 hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-accent group"
          onClick={() => handleCardClick('averageTicket')}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Ticket Médio</p>
              <h3 className="text-2xl font-bold">
                R$ {metrics.averageTicket.toFixed(2)}
              </h3>
              <p className="text-xs text-muted-foreground">fidelizados</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center relative">
              <DollarSign className="h-5 w-5 text-accent" />
              <ChevronRight className="h-3 w-3 text-accent absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </Card>

        <Card 
          className="p-4 hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-primary group"
          onClick={() => handleCardClick('activePoints')}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {loyaltyType === 'cashback' ? 'Cashback Ativo' : 'Pontos Ativos'}
              </p>
              <h3 className="text-2xl font-bold">
                {loyaltyType === 'cashback' 
                  ? `R$ ${metrics.activePoints.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : metrics.activePoints.toLocaleString('pt-BR')
                }
              </h3>
              <p className="text-xs text-muted-foreground">em circulação</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center relative">
              <Award className="h-5 w-5 text-primary" />
              <ChevronRight className="h-3 w-3 text-primary absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </Card>
      </div>

      {/* Indicadores Secundários */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card 
          className="p-4 hover:shadow-lg transition-all cursor-pointer group"
          onClick={() => handleCardClick('newClients')}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Novos Clientes</p>
              <h3 className="text-2xl font-bold">{metrics.newClientsRate.toFixed(1)}%</h3>
              <p className="text-xs text-muted-foreground">no período</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center relative">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <ChevronRight className="h-3 w-3 text-green-500 absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </Card>

        <Card 
          className="p-4 hover:shadow-lg transition-all cursor-pointer group"
          onClick={() => handleCardClick('retentionRate')}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Taxa de Retenção</p>
              <h3 className="text-2xl font-bold">{metrics.retentionRate.toFixed(1)}%</h3>
              <p className="text-xs text-muted-foreground">vs mês anterior</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center relative">
              <RotateCcw className="h-5 w-5 text-blue-500" />
              <ChevronRight className="h-3 w-3 text-blue-500 absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </Card>

        <Card 
          className="p-4 hover:shadow-lg transition-all cursor-pointer group"
          onClick={() => handleCardClick('purchaseFrequency')}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Freq. Média Compra</p>
              <h3 className="text-2xl font-bold">
                {metrics.avgPurchaseFrequency.toFixed(0)}
              </h3>
              <p className="text-xs text-muted-foreground">dias entre compras</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center relative">
              <Clock className="h-5 w-5 text-purple-500" />
              <ChevronRight className="h-3 w-3 text-purple-500 absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </Card>

        <Card 
          className="p-4 hover:shadow-lg transition-all cursor-pointer group"
          onClick={() => handleCardClick('redeemedValue')}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Valor Resgatado</p>
              <h3 className="text-2xl font-bold">
                R$ {metrics.redeemedValue.toFixed(2)}
              </h3>
              <p className="text-xs text-muted-foreground">no período</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center relative">
              <DollarSign className="h-5 w-5 text-orange-500" />
              <ChevronRight className="h-3 w-3 text-orange-500 absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Gráfico de Evolução */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="clients" stroke="hsl(var(--primary))" name="Clientes Ativos" strokeWidth={2} />
                <Line type="monotone" dataKey="redemptions" stroke="hsl(var(--secondary))" name="Resgates" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Pizza */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição de Pontos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pointsDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value.toFixed(0)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill="hsl(var(--primary))" />
                  <Cell fill="hsl(var(--secondary))" />
                  <Cell fill="hsl(var(--accent))" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Barras */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Retenção vs Novos Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={retentionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="hsl(var(--primary))" name="Quantidade" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top 10 Lojas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Lojas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topStores.map((store, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>{store.name}</TableCell>
                      <TableCell className="text-right">R$ {store.revenue.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {topStores.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Nenhum dado disponível
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead className="text-right">Total Gasto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topClients.map((client, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{client.name}</TableCell>
                    <TableCell className="font-mono text-xs">{client.cpf}</TableCell>
                    <TableCell className="text-right">R$ {client.spent.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {topClients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Nenhum dado disponível
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Card de Boas Vindas */}
      <Card className="p-5 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="space-y-2">
          <h2 className="text-lg font-bold">Bem-vindo ao Leva+</h2>
          <p className="text-muted-foreground text-sm">
            Gerencie seu programa de fidelidade, acompanhe métricas em tempo real e crie experiências incríveis para seus clientes.
          </p>
          <div className="flex gap-2 pt-1">
            <div className="h-1 w-8 bg-primary rounded-full" />
            <div className="h-1 w-6 bg-primary/60 rounded-full" />
            <div className="h-1 w-3 bg-primary/30 rounded-full" />
          </div>
        </div>
      </Card>

      {/* Drill Down Dialogs */}
      <DrillDownDialog
        open={drillDownCard === 'totalClients'}
        onClose={closeDrillDown}
        title="Total de Clientes - Detalhamento"
        isLoading={drillDownLoading}
      >
        {drillDownData?.breakdown && (
          <div className="space-y-6">
            {/* Breakdown */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 bg-green-50 dark:bg-green-950">
                <p className="text-sm text-muted-foreground">Validados</p>
                <p className="text-3xl font-bold text-green-600">{drillDownData.breakdown.validated}</p>
              </Card>
              <Card className="p-4 bg-yellow-50 dark:bg-yellow-950">
                <p className="text-sm text-muted-foreground">Não Validados</p>
                <p className="text-3xl font-bold text-yellow-600">{drillDownData.breakdown.notValidated}</p>
              </Card>
            </div>

            {/* Lista de últimos clientes */}
            {drillDownData.recentClients && drillDownData.recentClients.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Últimos Clientes Cadastrados</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cadastro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillDownData.recentClients.map((client: any) => (
                      <TableRow key={client.id}>
                        <TableCell>{client.full_name || 'Sem nome'}</TableCell>
                        <TableCell className="font-mono text-xs">{client.cpf}</TableCell>
                        <TableCell>{client.total_points}</TableCell>
                        <TableCell>
                          <Badge variant={client.is_validated ? 'default' : 'secondary'}>
                            {client.is_validated ? 'Validado' : 'Pendente'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(client.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DrillDownDialog>

      <DrillDownDialog
        open={drillDownCard === 'conversionRate'}
        onClose={closeDrillDown}
        title="Taxa de Conversão - Detalhamento"
        isLoading={drillDownLoading}
      >
        {drillDownData?.totals && (
          <div className="space-y-6">
            {/* Totais */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 bg-green-50 dark:bg-green-950">
                <p className="text-sm text-muted-foreground">Fidelizadas</p>
                <p className="text-3xl font-bold text-green-600">{drillDownData.totals.loyalty}</p>
              </Card>
              <Card className="p-4 bg-gray-50 dark:bg-gray-950">
                <p className="text-sm text-muted-foreground">Não Fidelizadas</p>
                <p className="text-3xl font-bold">{drillDownData.totals.nonLoyalty}</p>
              </Card>
            </div>

            {/* Transações fidelizadas */}
            {drillDownData.loyaltyTransactions && drillDownData.loyaltyTransactions.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Últimas Transações Fidelizadas</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillDownData.loyaltyTransactions.map((trans: any) => (
                      <TableRow key={trans.id}>
                        <TableCell>{trans.clients?.full_name || 'N/A'}</TableCell>
                        <TableCell className="font-mono text-xs">{trans.clients?.cpf || 'N/A'}</TableCell>
                        <TableCell>R$ {Number(trans.amount).toFixed(2)}</TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(trans.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DrillDownDialog>

      <DrillDownDialog
        open={drillDownCard === 'averageTicket'}
        onClose={closeDrillDown}
        title="Ticket Médio - Detalhamento"
        isLoading={drillDownLoading}
      >
        {drillDownData?.distribution && (
          <div className="space-y-6">
            {/* Distribuição */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 bg-blue-50 dark:bg-blue-950">
                <p className="text-sm text-muted-foreground">Baixo (&lt;R$50)</p>
                <p className="text-3xl font-bold text-blue-600">{drillDownData.distribution.low}</p>
              </Card>
              <Card className="p-4 bg-yellow-50 dark:bg-yellow-950">
                <p className="text-sm text-muted-foreground">Médio (R$50-200)</p>
                <p className="text-3xl font-bold text-yellow-600">{drillDownData.distribution.medium}</p>
              </Card>
              <Card className="p-4 bg-green-50 dark:bg-green-950">
                <p className="text-sm text-muted-foreground">Alto (&gt;R$200)</p>
                <p className="text-3xl font-bold text-green-600">{drillDownData.distribution.high}</p>
              </Card>
            </div>

            {/* Top transações */}
            {drillDownData.topTransactions && drillDownData.topTransactions.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Maiores Transações do Período</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillDownData.topTransactions.map((trans: any) => (
                      <TableRow key={trans.id}>
                        <TableCell>{trans.clients?.full_name || 'N/A'}</TableCell>
                        <TableCell className="font-bold">R$ {Number(trans.amount).toFixed(2)}</TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(trans.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DrillDownDialog>

      <DrillDownDialog
        open={drillDownCard === 'activePoints'}
        onClose={closeDrillDown}
        title="Pontos Ativos - Detalhamento"
        isLoading={drillDownLoading}
      >
        {drillDownData?.distribution && (
          <div className="space-y-6">
            {/* Distribuição */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 bg-blue-50 dark:bg-blue-950">
                <p className="text-sm text-muted-foreground">Baixo (&lt;100)</p>
                <p className="text-3xl font-bold text-blue-600">{drillDownData.distribution.low}</p>
              </Card>
              <Card className="p-4 bg-yellow-50 dark:bg-yellow-950">
                <p className="text-sm text-muted-foreground">Médio (100-500)</p>
                <p className="text-3xl font-bold text-yellow-600">{drillDownData.distribution.medium}</p>
              </Card>
              <Card className="p-4 bg-green-50 dark:bg-green-950">
                <p className="text-sm text-muted-foreground">Alto (&gt;500)</p>
                <p className="text-3xl font-bold text-green-600">{drillDownData.distribution.high}</p>
              </Card>
            </div>

            {/* Top clientes */}
            {drillDownData.topClients && drillDownData.topClients.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Top 50 Clientes com Mais Pontos</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Pontos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillDownData.topClients.map((client: any, index: number) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-bold">{index + 1}</TableCell>
                        <TableCell>{client.full_name || 'Sem nome'}</TableCell>
                        <TableCell className="font-mono text-xs">{client.cpf}</TableCell>
                        <TableCell className="font-bold text-primary">
                          {Number(client.total_points).toLocaleString('pt-BR')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DrillDownDialog>

      {/* Drill Down: Novos Clientes */}
      <DrillDownDialog
        open={drillDownCard === 'newClients'}
        onClose={closeDrillDown}
        title="Novos Clientes - Detalhamento"
        isLoading={drillDownLoading}
      >
        {drillDownData?.breakdown && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 bg-green-50 dark:bg-green-950">
                <p className="text-sm text-muted-foreground">Validados</p>
                <p className="text-3xl font-bold text-green-600">{drillDownData.breakdown.validated}</p>
              </Card>
              <Card className="p-4 bg-yellow-50 dark:bg-yellow-950">
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-3xl font-bold text-yellow-600">{drillDownData.breakdown.pending}</p>
              </Card>
            </div>

            {drillDownData.clients && drillDownData.clients.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Clientes Cadastrados no Período</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillDownData.clients.map((client: any) => (
                      <TableRow key={client.id}>
                        <TableCell>{client.full_name || 'Sem nome'}</TableCell>
                        <TableCell className="font-mono text-xs">{client.cpf}</TableCell>
                        <TableCell>
                          <Badge variant={client.is_validated ? 'default' : 'secondary'}>
                            {client.is_validated ? 'Validado' : 'Pendente'}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(client.created_at), 'dd/MM/yyyy')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DrillDownDialog>

      {/* Drill Down: Taxa de Retenção */}
      <DrillDownDialog
        open={drillDownCard === 'retentionRate'}
        onClose={closeDrillDown}
        title="Taxa de Retenção - Detalhamento"
        isLoading={drillDownLoading}
      >
        {drillDownData?.retainedClients && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 bg-blue-50 dark:bg-blue-950">
                <p className="text-sm text-muted-foreground">Mês Anterior</p>
                <p className="text-3xl font-bold text-blue-600">{drillDownData.previousTotal || 0}</p>
              </Card>
              <Card className="p-4 bg-green-50 dark:bg-green-950">
                <p className="text-sm text-muted-foreground">Retidos</p>
                <p className="text-3xl font-bold text-green-600">{drillDownData.total || 0}</p>
              </Card>
              <Card className="p-4 bg-purple-50 dark:bg-purple-950">
                <p className="text-sm text-muted-foreground">Taxa</p>
                <p className="text-3xl font-bold text-purple-600">{(drillDownData.rate || 0).toFixed(1)}%</p>
              </Card>
            </div>

            {drillDownData.retainedClients.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Clientes Retidos</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead className="text-right">Pontos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillDownData.retainedClients.map((client: any) => (
                      <TableRow key={client.id}>
                        <TableCell>{client.full_name || 'Sem nome'}</TableCell>
                        <TableCell className="font-mono text-xs">{client.cpf}</TableCell>
                        <TableCell className="text-right">{client.total_points}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DrillDownDialog>

      {/* Drill Down: Frequência de Compra */}
      <DrillDownDialog
        open={drillDownCard === 'purchaseFrequency'}
        onClose={closeDrillDown}
        title="Frequência de Compra - Detalhamento"
        isLoading={drillDownLoading}
      >
        {drillDownData?.clients && (
          <div className="space-y-6">
            <Card className="p-4 bg-purple-50 dark:bg-purple-950">
              <p className="text-sm text-muted-foreground">Total de Clientes Analisados</p>
              <p className="text-3xl font-bold text-purple-600">{drillDownData.totalClients}</p>
            </Card>

            {drillDownData.clients.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Clientes Mais Frequentes</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead className="text-right">Compras</TableHead>
                      <TableHead className="text-right">Freq. (dias)</TableHead>
                      <TableHead className="text-right">Total Gasto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillDownData.clients.map((client: any) => (
                      <TableRow key={client.clientId}>
                        <TableCell>{client.clientName}</TableCell>
                        <TableCell className="font-mono text-xs">{client.clientCpf}</TableCell>
                        <TableCell className="text-right font-bold">{client.purchaseCount || 0}</TableCell>
                        <TableCell className="text-right">
                          {(client.avgDaysBetweenPurchases || 0) > 0 
                            ? (client.avgDaysBetweenPurchases || 0).toFixed(0) 
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">R$ {(client.totalSpent || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DrillDownDialog>

      {/* Drill Down: Valor Resgatado */}
      <DrillDownDialog
        open={drillDownCard === 'redeemedValue'}
        onClose={closeDrillDown}
        title="Valor Resgatado - Detalhamento"
        isLoading={drillDownLoading}
      >
        {drillDownData?.redemptions && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 bg-orange-50 dark:bg-orange-950">
                <p className="text-sm text-muted-foreground">Total Resgates</p>
                <p className="text-3xl font-bold text-orange-600">{drillDownData.count || 0}</p>
              </Card>
              <Card className="p-4 bg-green-50 dark:bg-green-950">
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-3xl font-bold text-green-600">R$ {(drillDownData.totalValue || 0).toFixed(2)}</p>
              </Card>
              <Card className="p-4 bg-purple-50 dark:bg-purple-950">
                <p className="text-sm text-muted-foreground">Pontos Usados</p>
                <p className="text-3xl font-bold text-purple-600">{(drillDownData.totalPoints || 0).toLocaleString('pt-BR')}</p>
              </Card>
            </div>

            {drillDownData.redemptions.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Últimos Resgates</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead className="text-right">Pontos</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillDownData.redemptions.map((redemption: any) => (
                      <TableRow key={redemption.id}>
                        <TableCell>{redemption.clients?.full_name || 'Sem nome'}</TableCell>
                        <TableCell className="font-mono text-xs">{redemption.clients?.cpf}</TableCell>
                        <TableCell className="text-right font-bold text-red-600">
                          {Math.abs(Number(redemption.points)).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">R$ {(Number(redemption.amount) || 0).toFixed(2)}</TableCell>
                        <TableCell>{format(new Date(redemption.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DrillDownDialog>

      {networkId && <InsightsChat networkId={networkId} />}
    </div>
  );
}
