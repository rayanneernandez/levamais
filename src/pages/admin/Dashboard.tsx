import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Store, Users, TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, CreditCard, XCircle, ArrowLeftRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LoadingPage } from "@/components/ui/loading-page";

interface DashboardStats {
  totalNetworks: number;
  totalStores: number;
  totalClients: number;
  validatedClients: number;
  newClientsLast30Days: number;
  clientGrowthPercentage: number;
  monthlyRevenue: number;
  totalLicenses: number;
  inactiveNetworks: number;
  averageRevenuePerNetwork: number;
  payingStores: number;
  totalImplantacao: number;
  pendingTransfers: number;
  processedTransfersThisMonth: number;
}

interface DailyTransaction {
  date: string;
  cashback: number;
  resgates: number;
  total: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalNetworks: 0,
    totalStores: 0,
    totalClients: 0,
    validatedClients: 0,
    newClientsLast30Days: 0,
    clientGrowthPercentage: 0,
    monthlyRevenue: 0,
    totalLicenses: 0,
    inactiveNetworks: 0,
    averageRevenuePerNetwork: 0,
    payingStores: 0,
    totalImplantacao: 0,
    pendingTransfers: 0,
    processedTransfersThisMonth: 0,
  });
  const [dailyTransactions, setDailyTransactions] = useState<DailyTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Buscar totais gerais
      const [storesResult, clientsResult, networksResult] = await Promise.all([
        supabase.from("stores").select("id, network_id, status"),
        supabase.from("clients").select("id, is_validated, created_at"),
        supabase.from("networks").select("id, status, monthly_fee, total_licenses, valor_implantacao, implantado, max_stores"),
      ]);

      const totalStores = storesResult.data?.length || 0;
      const totalClients = clientsResult.data?.length || 0;
      const validatedClients = clientsResult.data?.filter(c => c.is_validated).length || 0;

      // Calcular dados financeiros
      const activeNetworks = networksResult.data?.filter(n => n.status === 'active') || [];
      const inactiveNetworks = networksResult.data?.filter(n => n.status === 'inactive').length || 0;
      const totalNetworks = activeNetworks.length;
      
      // Faturamento = mensalidade da rede × nº de lojas ativas dessa rede
      const activeStoresByNetwork = (storesResult.data || []).reduce((acc: Record<string, number>, s) => {
        if (s.status === 'active') {
          acc[s.network_id] = (acc[s.network_id] || 0) + 1;
        }
        return acc;
      }, {});

      const monthlyRevenue = activeNetworks.reduce((sum, network) => {
        const fee = parseFloat(network.monthly_fee?.toString() || '0');
        const storeCount = activeStoresByNetwork[network.id] || 0;
        return sum + (fee * storeCount);
      }, 0);

      // Somar total de licenças (max_stores) de todas as redes ativas
      const totalLicenses = activeNetworks.reduce((sum, network) => {
        return sum + (network.max_stores || 0);
      }, 0);

      const averageRevenuePerNetwork = totalNetworks > 0 ? monthlyRevenue / totalNetworks : 0;

      // Calcular lojas pagantes (mensalidade > 1,00)
      const payingNetworkIds = activeNetworks
        .filter(n => parseFloat(n.monthly_fee?.toString() || '0') > 1.0)
        .map(n => n.id);
      
      const payingStores = storesResult.data?.filter(
        store => store.status === 'active' && payingNetworkIds.includes(store.network_id)
      ).length || 0;

      // Calcular total de implantações (apenas redes implantadas)
      const totalImplantacao = networksResult.data
        ?.filter(n => n.implantado)
        .reduce((sum, network) => {
          const valor = parseFloat(network.valor_implantacao?.toString() || '0');
          return sum + valor;
        }, 0) || 0;

      // Calcular crescimento dos últimos 30 dias
      const thirtyDaysAgo = subDays(new Date(), 30);
      const newClientsLast30Days = clientsResult.data?.filter(
        c => new Date(c.created_at) >= thirtyDaysAgo
      ).length || 0;

      const previousPeriodClients = totalClients - newClientsLast30Days;
      const clientGrowthPercentage = previousPeriodClients > 0
        ? ((newClientsLast30Days / previousPeriodClients) * 100)
        : 0;

      // Buscar transferências de rede
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      const [pendingTransfersResult, processedTransfersResult] = await Promise.all([
        supabase
          .from("pending_network_transfers")
          .select("id")
          .eq("status", "pending"),
        supabase
          .from("pending_network_transfers")
          .select("id")
          .eq("status", "processed")
          .gte("processed_at", monthStart.toISOString())
          .lte("processed_at", monthEnd.toISOString()),
      ]);

      const pendingTransfers = pendingTransfersResult.data?.length || 0;
      const processedTransfersThisMonth = processedTransfersResult.data?.length || 0;

      setStats({
        totalNetworks,
        totalStores,
        totalClients,
        validatedClients,
        newClientsLast30Days,
        clientGrowthPercentage,
        monthlyRevenue,
        totalLicenses,
        inactiveNetworks,
        averageRevenuePerNetwork,
        payingStores,
        totalImplantacao,
        pendingTransfers,
        processedTransfersThisMonth,
      });

      // Buscar transações dos últimos 7 dias
      const sevenDaysAgo = subDays(new Date(), 7);
      const { data: transactionsData } = await supabase
        .from("transactions")
        .select("created_at, type, amount")
        .gte("created_at", sevenDaysAgo.toISOString());

      // Agrupar transações por dia
      const dailyData: Record<string, { cashback: number; resgates: number }> = {};
      
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(new Date(), i), "dd/MM", { locale: ptBR });
        dailyData[date] = { cashback: 0, resgates: 0 };
      }

      transactionsData?.forEach((tx) => {
        const date = format(new Date(tx.created_at), "dd/MM", { locale: ptBR });
        if (dailyData[date]) {
          if (tx.type === "accumulation") {
            dailyData[date].cashback += parseFloat(tx.amount.toString());
          } else if (tx.type === "redemption") {
            dailyData[date].resgates += Math.abs(parseFloat(tx.amount.toString()));
          }
        }
      });

      const chartData: DailyTransaction[] = Object.entries(dailyData).map(([date, values]) => ({
        date,
        cashback: parseFloat(values.cashback.toFixed(2)),
        resgates: parseFloat(values.resgates.toFixed(2)),
        total: parseFloat((values.cashback + values.resgates).toFixed(2)),
      }));

      setDailyTransactions(chartData);
    } catch (error) {
      console.error("Erro ao carregar dados do dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingPage message="Carregando dashboard..." submessage="Preparando suas métricas de negócio" />;
  }

  const totalCashback = dailyTransactions.reduce((sum, day) => sum + day.cashback, 0);
  const totalResgates = dailyTransactions.reduce((sum, day) => sum + day.resgates, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do sistema</p>
      </div>

      {/* Cards de Métricas Financeiras da Plataforma */}
      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Mensal</CardTitle>
            <CreditCard className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              R$ {stats.monthlyRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              {stats.totalNetworks} redes ativas
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lojas Pagantes</CardTitle>
            <Store className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {stats.payingStores} / 1000
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {((stats.payingStores / 1000) * 100).toFixed(1)}% da meta
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Implantações</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              R$ {stats.totalImplantacao.toFixed(2)}
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              Valor único por rede
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Licenças Totais</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLicenses}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalStores} lojas cadastradas
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redes Canceladas</CardTitle>
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">
              {stats.inactiveNetworks}
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              Clientes inativos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cards de Estatísticas de Uso */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClients}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.validatedClients} validados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novos Clientes (30d)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newClientsLast30Days}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {stats.clientGrowthPercentage > 0 ? (
                <>
                  <ArrowUpRight className="h-3 w-3 text-green-500" />
                  <span className="text-green-500">+{stats.clientGrowthPercentage.toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                  <span className="text-red-500">{stats.clientGrowthPercentage.toFixed(1)}%</span>
                </>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cashback (7d)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totalCashback.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Últimos 7 dias
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transferências</CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
              {stats.pendingTransfers}
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              {stats.processedTransfersThisMonth} processadas no mês
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Gráfico de Transações por Dia */}
        <Card>
          <CardHeader>
            <CardTitle>Transações dos Últimos 7 Dias</CardTitle>
            <CardDescription>
              Volume de cashback acumulado e resgates por dia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyTransactions}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="cashback" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  name="Acúmulo"
                />
                <Line 
                  type="monotone" 
                  dataKey="resgates" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  name="Resgates"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Comparação Acúmulo vs Resgate */}
        <Card>
          <CardHeader>
            <CardTitle>Acúmulo vs Resgate (7 dias)</CardTitle>
            <CardDescription>
              Comparação entre valor acumulado e resgatado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyTransactions}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                />
                <Legend />
                <Bar dataKey="cashback" fill="#10b981" name="Acúmulo" />
                <Bar dataKey="resgates" fill="#ef4444" name="Resgates" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Cards de Resumo */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Acumulado (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              R$ {totalCashback.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Cashback acumulado pelos clientes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Resgatado (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              R$ {totalResgates.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Valor resgatado pelos clientes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Saldo Líquido (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${(totalCashback - totalResgates) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              R$ {(totalCashback - totalResgates).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Diferença entre acúmulo e resgate
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
