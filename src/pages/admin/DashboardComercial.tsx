import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, TrendingUp, DollarSign, Clock, CheckCircle, XCircle, AlertCircle, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, FunnelChart, Funnel, LabelList } from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DashboardStats {
  totalPropostas: number;
  propostasAtivas: number;
  propostasAprovadas: number;
  propostasRecusadas: number;
  taxaConversao: number;
  ticketMedio: number;
  valorTotalAtivo: number;
  valorTotalAprovado: number;
}

interface PropostasPorStatus {
  status: string;
  quantidade: number;
  valor: number;
}

interface FunilData {
  name: string;
  value: number;
  fill: string;
}

const COLORS = {
  draft: "#94a3b8",
  sent: "#3b82f6",
  pending_approval: "#f59e0b",
  pending_internal_approval: "#8b5cf6",
  approved: "#10b981",
  declined: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  pending_approval: "Pend. Aprovação Cliente",
  pending_internal_approval: "Pend. Aprovação Interna",
  approved: "Aprovado",
  declined: "Recusado",
};

export default function DashboardComercial() {
  const [stats, setStats] = useState<DashboardStats>({
    totalPropostas: 0,
    propostasAtivas: 0,
    propostasAprovadas: 0,
    propostasRecusadas: 0,
    taxaConversao: 0,
    ticketMedio: 0,
    valorTotalAtivo: 0,
    valorTotalAprovado: 0,
  });
  const [propostasPorStatus, setPropostasPorStatus] = useState<PropostasPorStatus[]>([]);
  const [propostasPorTemperatura, setPropostasPorTemperatura] = useState<any[]>([]);
  const [evolucaoTemporal, setEvolucaoTemporal] = useState<any[]>([]);
  const [funnelData, setFunnelData] = useState<FunilData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const { data: budgets, error } = await supabase
        .from("budgets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const totalPropostas = budgets?.length || 0;
      const propostasAtivas = budgets?.filter(
        b => !["approved", "declined"].includes(b.status)
      ).length || 0;
      const propostasAprovadas = budgets?.filter(b => b.status === "approved").length || 0;
      const propostasRecusadas = budgets?.filter(b => b.status === "declined").length || 0;

      const taxaConversao = totalPropostas > 0 ? (propostasAprovadas / totalPropostas) * 100 : 0;

      const valorTotalAtivo = budgets
        ?.filter(b => !["approved", "declined"].includes(b.status))
        .reduce((sum, b) => sum + parseFloat(b.total_value?.toString() || "0"), 0) || 0;

      const valorTotalAprovado = budgets
        ?.filter(b => b.status === "approved")
        .reduce((sum, b) => sum + parseFloat(b.total_value?.toString() || "0"), 0) || 0;

      const ticketMedio = propostasAprovadas > 0 ? valorTotalAprovado / propostasAprovadas : 0;

      setStats({
        totalPropostas,
        propostasAtivas,
        propostasAprovadas,
        propostasRecusadas,
        taxaConversao,
        ticketMedio,
        valorTotalAtivo,
        valorTotalAprovado,
      });

      // Agrupar por status
      const statusGroups: Record<string, { quantidade: number; valor: number }> = {};
      budgets?.forEach((b) => {
        if (!statusGroups[b.status]) {
          statusGroups[b.status] = { quantidade: 0, valor: 0 };
        }
        statusGroups[b.status].quantidade++;
        statusGroups[b.status].valor += parseFloat(b.total_value?.toString() || "0");
      });

      const statusData = Object.entries(statusGroups).map(([status, data]) => ({
        status: STATUS_LABELS[status] || status,
        quantidade: data.quantidade,
        valor: data.valor,
      }));
      setPropostasPorStatus(statusData);

      // Funil de conversão
      const funnel: FunilData[] = [
        {
          name: "Total Propostas",
          value: totalPropostas,
          fill: "#3b82f6",
        },
        {
          name: "Enviadas",
          value: budgets?.filter(b => b.status !== "draft").length || 0,
          fill: "#8b5cf6",
        },
        {
          name: "Em Aprovação",
          value: budgets?.filter(b => ["pending_approval", "pending_internal_approval"].includes(b.status)).length || 0,
          fill: "#f59e0b",
        },
        {
          name: "Aprovadas",
          value: propostasAprovadas,
          fill: "#10b981",
        },
      ];
      setFunnelData(funnel);

      // Temperatura das propostas
      const tempGroups: Record<string, number> = {};
      budgets?.forEach((b) => {
        const temp = b.temperature || "Não definida";
        tempGroups[temp] = (tempGroups[temp] || 0) + 1;
      });

      const tempData = Object.entries(tempGroups).map(([temp, count]) => ({
        name: temp,
        value: count,
      }));
      setPropostasPorTemperatura(tempData);

      // Evolução temporal (últimos 30 dias)
      const dailyData: Record<string, { criadas: number; aprovadas: number }> = {};
      
      for (let i = 29; i >= 0; i--) {
        const date = format(subDays(new Date(), i), "dd/MM", { locale: ptBR });
        dailyData[date] = { criadas: 0, aprovadas: 0 };
      }

      budgets?.forEach((b) => {
        const createdDate = format(new Date(b.created_at), "dd/MM", { locale: ptBR });
        if (dailyData[createdDate]) {
          dailyData[createdDate].criadas++;
        }

        if (b.approved_at) {
          const approvedDate = format(new Date(b.approved_at), "dd/MM", { locale: ptBR });
          if (dailyData[approvedDate]) {
            dailyData[approvedDate].aprovadas++;
          }
        }
      });

      const evolutionData = Object.entries(dailyData).map(([date, values]) => ({
        date,
        criadas: values.criadas,
        aprovadas: values.aprovadas,
      }));
      setEvolucaoTemporal(evolutionData);

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Comercial</h1>
          <p className="text-muted-foreground text-sm mt-1">Carregando indicadores...</p>
        </div>
      </div>
    );
  }

  const TEMP_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#94a3b8"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Comercial</h1>
        <p className="text-muted-foreground text-sm mt-1">Acompanhamento de propostas e indicadores de vendas</p>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Propostas Ativas</CardTitle>
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {stats.propostasAtivas}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              R$ {stats.valorTotalAtivo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em negociação
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <Target className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {stats.taxaConversao.toFixed(1)}%
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              {stats.propostasAprovadas} de {stats.totalPropostas} propostas
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              R$ {stats.ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              Valor médio aprovado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fechado</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {stats.valorTotalAprovado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.propostasAprovadas} propostas aprovadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cards Secundários */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Propostas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPropostas}</div>
            <p className="text-xs text-muted-foreground mt-1">Todas as propostas criadas</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {stats.propostasAprovadas}
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">Negócios fechados</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recusadas</CardTitle>
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">
              {stats.propostasRecusadas}
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Negócios perdidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Funil de Conversão */}
        <Card>
          <CardHeader>
            <CardTitle>Funil de Conversão</CardTitle>
            <CardDescription>
              Jornada das propostas até fechamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <FunnelChart>
                <Tooltip 
                  formatter={(value: number) => `${value} propostas`}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Funnel dataKey="value" data={funnelData}>
                  <LabelList position="right" fill="hsl(var(--foreground))" stroke="none" dataKey="name" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição por Status */}
        <Card>
          <CardHeader>
            <CardTitle>Propostas por Status</CardTitle>
            <CardDescription>
              Distribuição atual das propostas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={propostasPorStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip 
                  formatter={(value: number, name: string) => 
                    name === "valor" 
                      ? `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` 
                      : value
                  }
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                <Bar dataKey="quantidade" fill="#3b82f6" name="Quantidade" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Evolução Temporal */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução de Propostas (30 dias)</CardTitle>
            <CardDescription>
              Propostas criadas e aprovadas por dia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evolucaoTemporal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="criadas" stroke="#3b82f6" strokeWidth={2} name="Criadas" />
                <Line type="monotone" dataKey="aprovadas" stroke="#10b981" strokeWidth={2} name="Aprovadas" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Temperatura das Propostas */}
        <Card>
          <CardHeader>
            <CardTitle>Temperatura das Propostas</CardTitle>
            <CardDescription>
              Classificação por potencial de fechamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={propostasPorTemperatura}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {propostasPorTemperatura.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={TEMP_COLORS[index % TEMP_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Resumo de Valores */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Pipeline Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Em Negociação</span>
                <span className="text-lg font-bold text-blue-600">
                  R$ {stats.valorTotalAtivo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Fechado</span>
                <span className="text-lg font-bold text-green-600">
                  R$ {stats.valorTotalAprovado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total</span>
                  <span className="text-xl font-bold">
                    R$ {(stats.valorTotalAtivo + stats.valorTotalAprovado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Indicadores de Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Taxa de Conversão</span>
                <span className="text-lg font-bold">
                  {stats.taxaConversao.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Ticket Médio</span>
                <span className="text-lg font-bold">
                  R$ {stats.ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Propostas/Dia</span>
                <span className="text-lg font-bold">
                  {(stats.totalPropostas / 30).toFixed(1)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
