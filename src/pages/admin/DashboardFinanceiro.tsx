import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, TrendingUp, Users, Package, CreditCard, CheckCircle, XCircle, Clock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DashboardFinanceiro() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalReceita: 0,
    receitaMensal: 0,
    assinaturasAtivas: 0,
    pedidosPendentes: 0,
    taxaConversao: 0,
  });
  const [recentCharges, setRecentCharges] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    loadDashboardData();
  }, [filterStatus]);

  const loadDashboardData = async () => {
    try {
      // Carregar métricas
      const { data: charges } = await supabase
        .from("asaas_charges")
        .select("*");

      const { data: subscriptions } = await supabase
        .from("network_subscriptions")
        .select("*")
        .eq("status", "active");

      // Calcular métricas
      const totalReceita = charges?.filter(c => c.status === "CONFIRMED")
        .reduce((sum, c) => sum + Number(c.amount), 0) || 0;

      const now = new Date();
      const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const receitaMensal = charges?.filter(c => 
        c.status === "CONFIRMED" && 
        new Date(c.confirmed_at) >= firstDayMonth
      ).reduce((sum, c) => sum + Number(c.amount), 0) || 0;

      const assinaturasAtivas = subscriptions?.length || 0;

      const pedidosPendentes = charges?.filter(c => 
        c.status === "PENDING"
      ).length || 0;

      setMetrics({
        totalReceita,
        receitaMensal,
        assinaturasAtivas,
        pedidosPendentes,
        taxaConversao: charges?.length ? 
          (charges.filter(c => c.status === "CONFIRMED").length / charges.length) * 100 : 0,
      });

      // Carregar cobranças recentes com filtro
      let query = supabase
        .from("asaas_charges")
        .select(`
          *,
          networks (name)
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data: chargesData } = await query;
      setRecentCharges(chargesData || []);

    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      CONFIRMED: { variant: "default", icon: CheckCircle, label: "Confirmado" },
      PENDING: { variant: "secondary", icon: Clock, label: "Pendente" },
      OVERDUE: { variant: "destructive", icon: XCircle, label: "Vencido" },
      RECEIVED: { variant: "default", icon: CheckCircle, label: "Recebido" },
    };

    const config = variants[status] || { variant: "secondary", icon: Clock, label: status };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Financeiro</h1>
        <p className="text-muted-foreground">
          Visão geral das receitas e cobranças
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Receita Total
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.totalReceita)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Receita Mensal
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.receitaMensal)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Assinaturas Ativas
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.assinaturasAtivas}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Taxa de Conversão
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.taxaConversao.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cobranças Recentes</CardTitle>
              <CardDescription>
                Últimas cobranças realizadas no sistema
              </CardDescription>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="PENDING">Pendentes</SelectItem>
                <SelectItem value="CONFIRMED">Confirmados</SelectItem>
                <SelectItem value="OVERDUE">Vencidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentCharges.map((charge) => (
                <TableRow key={charge.id}>
                  <TableCell className="font-medium">
                    {charge.networks?.name || "N/A"}
                  </TableCell>
                  <TableCell>
                    {charge.charge_type === "subscription" ? "Assinatura" : "Pedido"}
                  </TableCell>
                  <TableCell>{formatCurrency(charge.amount)}</TableCell>
                  <TableCell>
                    {new Date(charge.due_date).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(charge.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      Ver Detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
