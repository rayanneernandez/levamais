import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Clock, AlertTriangle, TrendingUp, Users, Mail, MessageSquare, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStoreFilter } from "@/contexts/StoreFilterContext";
import { format, differenceInDays, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface ClientePrevisto {
  id: string;
  codigo: string;
  full_name: string;
  cpf: string;
  last_purchase_date: Date;
  avg_frequency_days: number;
  predicted_return_date: Date;
  days_since_prediction: number;
  status: 'on_time' | 'upcoming' | 'late' | 'critical';
  total_spent: number;
  purchase_count: number;
  phone: string;
  email: string;
}

interface DaySchedule {
  date: Date;
  clients: ClientePrevisto[];
  count: number;
}

type StatusFilter = 'all' | 'on_time' | 'upcoming' | 'late' | 'critical';
type ViewMode = 'calendar' | 'list';

export default function AgendaRecompra() {
  const { selectedStore } = useStoreFilter();
  const [clientes, setClientes] = useState<ClientePrevisto[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<ClientePrevisto[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [daySchedules, setDaySchedules] = useState<DaySchedule[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);

  const [metrics, setMetrics] = useState({
    todayCount: 0,
    lateCount: 0,
    criticalCount: 0,
    returnRate: 0,
  });

  useEffect(() => {
    loadAgendaData();
  }, [selectedStore]);

  useEffect(() => {
    filterClientes();
  }, [clientes, searchTerm, statusFilter]);

  useEffect(() => {
    if (viewMode === 'calendar') {
      generateDaySchedules();
    }
  }, [filteredClientes, selectedMonth, viewMode]);

  const loadAgendaData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: manager } = await supabase
        .from('store_managers')
        .select('network_id')
        .eq('user_id', user.id)
        .single();

      if (!manager) return;

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
        .eq('network_id', manager.network_id);
      if (!clients) return;

      const now = new Date();
      const clientesPrevistos: ClientePrevisto[] = [];
      const trendDataMap = new Map<string, { predicted: number; actual: number }>();

      // Processar cada cliente
      clients.forEach(client => {
        const clientTransactions = transactions
          .filter(t => t.client_id === client.id && t.type === 'accumulation')
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        if (clientTransactions.length < 2) return; // Precisa de pelo menos 2 compras para calcular frequência

        // Calcular frequência média
        let totalDays = 0;
        for (let i = 1; i < clientTransactions.length; i++) {
          const diff = differenceInDays(
            new Date(clientTransactions[i].created_at),
            new Date(clientTransactions[i - 1].created_at)
          );
          totalDays += diff;
        }
        const avgFrequency = totalDays / (clientTransactions.length - 1);

        const lastPurchase = new Date(clientTransactions[clientTransactions.length - 1].created_at);
        const predictedReturn = addDays(lastPurchase, Math.round(avgFrequency));
        const daysSincePrediction = differenceInDays(now, predictedReturn);

        // Determinar status
        let status: 'on_time' | 'upcoming' | 'late' | 'critical' = 'on_time';
        if (daysSincePrediction > 7) {
          status = 'critical';
        } else if (daysSincePrediction > 0) {
          status = 'late';
        } else if (daysSincePrediction >= -3) {
          status = 'upcoming';
        }

        // Calcular total gasto
        const totalSpent = clientTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

        clientesPrevistos.push({
          id: client.id,
          codigo: client.codigo || '-',
          full_name: client.full_name || 'Sem nome',
          cpf: client.cpf,
          last_purchase_date: lastPurchase,
          avg_frequency_days: avgFrequency,
          predicted_return_date: predictedReturn,
          days_since_prediction: daysSincePrediction,
          status,
          total_spent: totalSpent,
          purchase_count: clientTransactions.length,
          phone: client.phone || '',
          email: client.email || '',
        });

        // Dados de tendência (últimos 30 dias)
        const dateKey = format(predictedReturn, 'yyyy-MM-dd');
        if (!trendDataMap.has(dateKey)) {
          trendDataMap.set(dateKey, { predicted: 0, actual: 0 });
        }
        const trendEntry = trendDataMap.get(dateKey)!;
        trendEntry.predicted += 1;

        // Verificar se retornou de fato
        const actualReturn = clientTransactions.find(t => 
          differenceInDays(new Date(t.created_at), predictedReturn) >= 0 &&
          differenceInDays(new Date(t.created_at), predictedReturn) <= 7
        );
        if (actualReturn) {
          trendEntry.actual += 1;
        }
      });

      // Calcular métricas
      const todayCount = clientesPrevistos.filter(c => isSameDay(c.predicted_return_date, now)).length;
      const lateCount = clientesPrevistos.filter(c => c.status === 'late').length;
      const criticalCount = clientesPrevistos.filter(c => c.status === 'critical').length;
      
      const totalPredicted = Array.from(trendDataMap.values()).reduce((sum, v) => sum + v.predicted, 0);
      const totalActual = Array.from(trendDataMap.values()).reduce((sum, v) => sum + v.actual, 0);
      const returnRate = totalPredicted > 0 ? (totalActual / totalPredicted) * 100 : 0;

      setMetrics({
        todayCount,
        lateCount,
        criticalCount,
        returnRate,
      });

      // Preparar dados de tendência (últimos 30 dias)
      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = addDays(now, -29 + i);
        const dateKey = format(date, 'yyyy-MM-dd');
        const data = trendDataMap.get(dateKey) || { predicted: 0, actual: 0 };
        return {
          date: format(date, 'dd/MM'),
          previstos: data.predicted,
          retornaram: data.actual,
        };
      });

      setTrendData(last30Days);
      setClientes(clientesPrevistos);
    } catch (error) {
      console.error('Erro ao carregar agenda:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterClientes = () => {
    let filtered = [...clientes];

    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.cpf.includes(searchTerm) ||
        c.codigo.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    // Ordenar por data prevista (mais próximos primeiro)
    filtered.sort((a, b) => a.predicted_return_date.getTime() - b.predicted_return_date.getTime());

    setFilteredClientes(filtered);
  };

  const generateDaySchedules = () => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const schedules: DaySchedule[] = daysInMonth.map(date => {
      const dayClients = filteredClientes.filter(c =>
        isSameDay(c.predicted_return_date, date)
      );

      return {
        date,
        clients: dayClients,
        count: dayClients.length,
      };
    });

    setDaySchedules(schedules);
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      on_time: { label: 'Em dia', variant: 'default' as const },
      upcoming: { label: 'Próximo', variant: 'secondary' as const },
      late: { label: 'Atrasado', variant: 'destructive' as const },
      critical: { label: 'Crítico', variant: 'destructive' as const },
    };

    const config = configs[status as keyof typeof configs];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      on_time: 'bg-green-500',
      upcoming: 'bg-yellow-500',
      late: 'bg-orange-500',
      critical: 'bg-red-500',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-500';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agenda de Recompra</h1>
        <p className="text-muted-foreground text-sm">
          Previsão de retorno dos clientes baseada em padrões de compra
        </p>
      </div>

      {/* Cards de Métricas */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium">Previstos Hoje</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.todayCount}</div>
            <p className="text-xs text-muted-foreground">clientes esperados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <CardTitle className="text-sm font-medium">Atrasados</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{metrics.lateCount}</div>
            <p className="text-xs text-muted-foreground">1-7 dias atrasados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <CardTitle className="text-sm font-medium">Críticos</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics.criticalCount}</div>
            <p className="text-xs text-muted-foreground">&gt;7 dias atrasados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <CardTitle className="text-sm font-medium">Taxa de Retorno</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.returnRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">no prazo previsto</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Tendência */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Previsões vs Retornos Reais</CardTitle>
          <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="previstos" stroke="hsl(var(--primary))" name="Previstos" />
              <Line type="monotone" dataKey="retornaram" stroke="hsl(var(--chart-2))" name="Retornaram" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Controles de Visualização */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Filtros e Visualização</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                Lista
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('calendar')}
              >
                Calendário
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <Input
                placeholder="Nome, CPF ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="on_time">Em dia</SelectItem>
                  <SelectItem value="upcoming">Próximos</SelectItem>
                  <SelectItem value="late">Atrasados</SelectItem>
                  <SelectItem value="critical">Críticos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visualização Principal */}
      {isLoading ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">Carregando...</div>
          </CardContent>
        </Card>
      ) : viewMode === 'calendar' ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(prev => addDays(startOfMonth(prev), -1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(new Date())}
                >
                  Hoje
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(prev => addDays(endOfMonth(prev), 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="text-center text-sm font-medium py-2">
                  {day}
                </div>
              ))}
              {daySchedules.map((schedule, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "min-h-20 p-2 border rounded-lg",
                    schedule.count > 0 ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                  )}
                >
                  <div className="text-sm font-medium">{format(schedule.date, 'd')}</div>
                  {schedule.count > 0 && (
                    <div className="mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {schedule.count} cliente{schedule.count > 1 ? 's' : ''}
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            {filteredClientes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum cliente encontrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Última Compra</TableHead>
                      <TableHead className="text-right">Frequência</TableHead>
                      <TableHead>Data Prevista</TableHead>
                      <TableHead className="text-right">Dias</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total Gasto</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClientes.map((cliente) => (
                      <TableRow key={cliente.id}>
                        <TableCell className="font-medium">
                          <div>
                            <div>{cliente.full_name}</div>
                            <div className="text-xs text-muted-foreground">{cliente.codigo}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{cliente.cpf}</TableCell>
                        <TableCell>
                          {format(cliente.last_purchase_date, 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          {cliente.avg_frequency_days.toFixed(0)} dias
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "w-2 h-2 rounded-full",
                                getStatusColor(cliente.status)
                              )}
                            />
                            {format(cliente.predicted_return_date, 'dd/MM/yyyy', { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {cliente.days_since_prediction > 0 ? '+' : ''}
                          {cliente.days_since_prediction}
                        </TableCell>
                        <TableCell>{getStatusBadge(cliente.status)}</TableCell>
                        <TableCell className="text-right">
                          R$ {cliente.total_spent.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {cliente.phone && (
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                                <MessageSquare className="h-3 w-3" />
                              </Button>
                            )}
                            {cliente.email && (
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                                <Mail className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
