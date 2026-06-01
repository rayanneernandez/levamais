import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, DollarSign, TrendingUp, Calendar, Building2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { NetworkTransferImpact } from "@/components/admin/NetworkTransferImpact";

interface NetworkStats {
  network_id: string;
  network_name: string;
  active_members: number;
  monthly_revenue: number;
  commission_type: string;
  commission_value: number;
  network_commission: number;
  payment_day_offset: number;
  projected_payment_date: string;
  active_promotions_count?: number;
  is_eligible_for_commission?: boolean;
  transfer_adjustments?: {
    gained: number;
    lost: number;
  };
}

interface TransferImpact {
  client_name: string;
  from_network_name: string;
  to_network_name: string;
  transferred_at: string;
  monthly_value: number;
  impact_description: string;
}

interface MonthlyEvolution {
  month: string;
  subscriptions: number;
  revenue: number;
}

export default function DashboardOne() {
  const [isLoading, setIsLoading] = useState(true);
  const [networkStats, setNetworkStats] = useState<NetworkStats[]>([]);
  const [monthlyEvolution, setMonthlyEvolution] = useState<MonthlyEvolution[]>([]);
  const [transferImpacts, setTransferImpacts] = useState<TransferImpact[]>([]);
  const [totalStats, setTotalStats] = useState({
    total_members: 0,
    total_revenue: 0,
    total_network_commission: 0,
    gross_profit: 0,
    taxes: 0,
    card_fees: 0,
    other_costs: 0,
    net_profit: 0,
  });
  const [operationalCosts, setOperationalCosts] = useState({
    tax_percentage: 0,
    card_fee_percentage: 0,
    other_costs_percentage: 0,
    other_costs_type: 'percentage' as 'percentage' | 'fixed',
    other_costs_fixed_value: 0,
  });
  const [costConfigId, setCostConfigId] = useState<string | null>(null);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [tempCosts, setTempCosts] = useState({
    tax_percentage: 0,
    card_fee_percentage: 0,
    other_costs_percentage: 0,
    other_costs_type: 'percentage' as 'percentage' | 'fixed',
    other_costs_fixed_value: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Buscar configuração de custos operacionais
      const { data: costsConfig, error: costsError } = await (supabase as any)
        .from("one_operational_costs")
        .select("*")
        .eq("is_active", true)
        .single();

      if (costsError && costsError.code !== 'PGRST116') throw costsError;

      if (costsConfig) {
        setCostConfigId(costsConfig.id);
        setOperationalCosts({
          tax_percentage: costsConfig.tax_percentage || 0,
          card_fee_percentage: costsConfig.card_fee_percentage || 0,
          other_costs_percentage: costsConfig.other_costs_percentage || 0,
          other_costs_type: costsConfig.other_costs_type || 'percentage',
          other_costs_fixed_value: costsConfig.other_costs_fixed_value || 0,
        });
        setTempCosts({
          tax_percentage: costsConfig.tax_percentage || 0,
          card_fee_percentage: costsConfig.card_fee_percentage || 0,
          other_costs_percentage: costsConfig.other_costs_percentage || 0,
          other_costs_type: costsConfig.other_costs_type || 'percentage',
          other_costs_fixed_value: costsConfig.other_costs_fixed_value || 0,
        });
      }

      // Buscar transferências processadas do mês atual
      const currentMonthStart = startOfMonth(new Date());
      const currentMonthEnd = endOfMonth(new Date());
      
      const { data: processedTransfers } = await supabase
        .from("pending_network_transfers")
        .select(`
          *,
          client:clients!pending_network_transfers_client_id_fkey(full_name),
          from_network:networks!pending_network_transfers_from_network_id_fkey(name),
          to_network:networks!pending_network_transfers_to_network_id_fkey(name)
        `)
        .eq("status", "processed")
        .gte("processed_at", currentMonthStart.toISOString())
        .lte("processed_at", currentMonthEnd.toISOString());

      // Processar impactos das transferências
      const transferImpactsList: TransferImpact[] = [];
      
      if (processedTransfers && processedTransfers.length > 0) {
        for (const transfer of processedTransfers) {
          // Buscar valor da assinatura
          const { data: subscription } = await supabase
            .from("client_subscriptions_one")
            .select("monthly_value")
            .eq("client_id", transfer.client_id)
            .eq("status", "active")
            .maybeSingle();

          if (subscription) {
            transferImpactsList.push({
              client_name: transfer.client?.full_name || "Cliente",
              from_network_name: transfer.from_network?.name || "Rede Antiga",
              to_network_name: transfer.to_network?.name || "Rede Nova",
              transferred_at: transfer.processed_at!,
              monthly_value: subscription.monthly_value,
              impact_description: `Rede ${transfer.from_network?.name} recebeu comissão do mês anterior. Rede ${transfer.to_network?.name} recebe comissão do mês atual em diante.`
            });
          }
        }
      }

      setTransferImpacts(transferImpactsList);

      // Buscar todas as assinaturas ativas
      const { data: subscriptions, error: subsError } = await (supabase as any)
        .from("client_subscriptions_one")
        .select(`
          *,
          clients!inner(network_id),
          networks!inner(name)
        `)
        .eq("status", "active");

      if (subsError) throw subsError;

      // Buscar evolução mensal dos últimos 6 meses
      const { data: allSubscriptions, error: allSubsError } = await (supabase as any)
        .from("client_subscriptions_one")
        .select("created_at, monthly_value, status");

      if (allSubsError) throw allSubsError;

      // Processar evolução mensal
      const monthlyData: { [key: string]: { count: number; revenue: number } } = {};
      const today = new Date();

      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(today, i);
        const monthKey = format(monthDate, "MMM/yy", { locale: ptBR });
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);

        // Contar assinaturas criadas até o fim desse mês e ainda ativas
        const activeInMonth = allSubscriptions?.filter((sub: any) => {
          const createdDate = new Date(sub.created_at);
          return createdDate <= monthEnd;
        }).length || 0;

        const revenueInMonth = allSubscriptions?.filter((sub: any) => {
          const createdDate = new Date(sub.created_at);
          return createdDate <= monthEnd;
        }).reduce((sum: number, sub: any) => sum + (sub.monthly_value || 0), 0) || 0;

        monthlyData[monthKey] = {
          count: activeInMonth,
          revenue: revenueInMonth,
        };
      }

      const evolutionData: MonthlyEvolution[] = Object.entries(monthlyData).map(
        ([month, data]) => ({
          month,
          subscriptions: data.count,
          revenue: data.revenue,
        })
      );

      setMonthlyEvolution(evolutionData);

      // Buscar configurações de comissão
      const { data: commissionConfigs, error: configError } = await (supabase as any)
        .from("network_one_commission_config")
        .select("*");

      if (configError) throw configError;

      // Agrupar por rede
      const networksMap = new Map<string, any>();

      subscriptions?.forEach((sub: any) => {
        const networkId = sub.clients.network_id;
        const networkName = sub.networks.name;

        if (!networksMap.has(networkId)) {
          networksMap.set(networkId, {
            network_id: networkId,
            network_name: networkName,
            active_members: 0,
            monthly_revenue: 0,
            subscriptions: [],
          });
        }

        const network = networksMap.get(networkId);
        network.active_members += 1;
        network.monthly_revenue += sub.monthly_value || 0;
        network.subscriptions.push(sub);
      });

      // Calcular comissões
      const stats: NetworkStats[] = [];
      let totalMembers = 0;
      let totalRevenue = 0;
      let totalNetworkCommission = 0;

      // Buscar quantidade de promoções ativas por rede
      const { data: activePromosPerNetwork } = await supabase
        .from('one_promotions')
        .select('network_id')
        .eq('is_active', true)
        .gte('end_date', new Date().toISOString());

      const promosCountMap = new Map<string, number>();
      activePromosPerNetwork?.forEach((promo: any) => {
        promosCountMap.set(
          promo.network_id, 
          (promosCountMap.get(promo.network_id) || 0) + 1
        );
      });

      networksMap.forEach((network, networkId) => {
        const config = commissionConfigs?.find((c: any) => c.network_id === networkId);
        const activePromosCount = promosCountMap.get(networkId) || 0;
        const isEligibleForCommission = activePromosCount >= 5;

        let networkCommission = 0;
        if (config && isEligibleForCommission) {
          if (config.commission_type === "percentage") {
            networkCommission = network.monthly_revenue * (config.commission_value / 100);
          } else {
            networkCommission = network.active_members * config.commission_value;
          }
        }

        // Calcular data de pagamento
        const today = new Date();
        const nextMonth = addMonths(today, 1);
        const paymentDay = config?.payment_day_offset || 10;
        const projectedPaymentDate = new Date(
          nextMonth.getFullYear(),
          nextMonth.getMonth(),
          paymentDay
        );

        stats.push({
          ...network,
          commission_type: config?.commission_type || "percentage",
          commission_value: config?.commission_value || 0,
          network_commission: networkCommission,
          payment_day_offset: config?.payment_day_offset || 10,
          projected_payment_date: format(projectedPaymentDate, "dd/MM/yyyy", { locale: ptBR }),
          active_promotions_count: activePromosCount,
          is_eligible_for_commission: isEligibleForCommission,
        });

        totalMembers += network.active_members;
        totalRevenue += network.monthly_revenue;
        totalNetworkCommission += networkCommission;
      });

      // Calcular custos na ordem correta:
      // 1. Receita Total
      // 2. - Impostos (% sobre receita)
      // 3. - Taxa Cartão (% sobre receita)
      // 4. = Lucro após impostos/taxas
      // 5. - Comissão das Redes
      // 6. - Outros Custos (% ou R$ fixo)
      // 7. = Lucro Final
      
      const taxes = totalRevenue * ((costsConfig?.tax_percentage || 0) / 100);
      const cardFees = totalRevenue * ((costsConfig?.card_fee_percentage || 0) / 100);
      const liquidAfterTaxes = totalRevenue - taxes - cardFees;
      
      // Outros custos podem ser % do lucro líquido ou valor fixo
      let otherCosts = 0;
      if (costsConfig?.other_costs_type === 'fixed') {
        otherCosts = costsConfig?.other_costs_fixed_value || 0;
      } else {
        otherCosts = liquidAfterTaxes * ((costsConfig?.other_costs_percentage || 0) / 100);
      }
      
      const netProfit = liquidAfterTaxes - totalNetworkCommission - otherCosts;

      setNetworkStats(stats.sort((a, b) => b.monthly_revenue - a.monthly_revenue));
      setTotalStats({
        total_members: totalMembers,
        total_revenue: totalRevenue,
        total_network_commission: totalNetworkCommission,
        gross_profit: liquidAfterTaxes, // Lucro após impostos/taxas, antes das comissões
        taxes,
        card_fees: cardFees,
        other_costs: otherCosts,
        net_profit: netProfit,
      });
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados financeiros.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCosts = async () => {
    try {
      if (!costConfigId) {
        toast({
          title: "Erro",
          description: "Configuração não encontrada.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await (supabase as any)
        .from("one_operational_costs")
        .update({
          tax_percentage: tempCosts.tax_percentage,
          card_fee_percentage: tempCosts.card_fee_percentage,
          other_costs_percentage: tempCosts.other_costs_percentage,
          other_costs_type: tempCosts.other_costs_type,
          other_costs_fixed_value: tempCosts.other_costs_fixed_value,
        })
        .eq("id", costConfigId);

      if (error) throw error;

      setOperationalCosts(tempCosts);
      setIsConfigDialogOpen(false);
      loadData(); // Recarregar dados para atualizar cálculos

      toast({
        title: "Sucesso",
        description: "Configuração de custos atualizada.",
      });
    } catch (error: any) {
      console.error("Erro ao salvar configuração:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a configuração.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Financeiro ONE</h1>
          <p className="text-muted-foreground mt-1">Receitas, comissões e previsões</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
            Dashboard Financeiro ONE
          </h1>
          <p className="text-muted-foreground mt-1">
            Visão completa de receitas, comissões e previsões de pagamento
          </p>
        </div>
        <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Configurar Custos
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configuração de Custos Operacionais</DialogTitle>
              <DialogDescription>
                Impostos e taxas são calculados sobre a receita total. Outros custos podem ser fixos ou percentuais sobre o lucro após impostos.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tax">Impostos (% sobre receita total)</Label>
                <Input
                  id="tax"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={tempCosts.tax_percentage}
                  onChange={(e) =>
                    setTempCosts({ ...tempCosts, tax_percentage: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="Ex: 6.73"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="card">Taxa de Cartão (% sobre receita total)</Label>
                <Input
                  id="card"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={tempCosts.card_fee_percentage}
                  onChange={(e) =>
                    setTempCosts({ ...tempCosts, card_fee_percentage: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="Ex: 2.99"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="other-type">Tipo de Outros Custos</Label>
                <Select
                  value={tempCosts.other_costs_type}
                  onValueChange={(value: 'percentage' | 'fixed') =>
                    setTempCosts({ ...tempCosts, other_costs_type: value })
                  }
                >
                  <SelectTrigger id="other-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {tempCosts.other_costs_type === 'percentage' ? (
                <div className="space-y-2">
                  <Label htmlFor="other-pct">Outros Custos (% do lucro após impostos)</Label>
                  <Input
                    id="other-pct"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={tempCosts.other_costs_percentage}
                    onChange={(e) =>
                      setTempCosts({ ...tempCosts, other_costs_percentage: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="Ex: 5.00"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="other-fixed">Outros Custos (R$ fixo mensal)</Label>
                  <Input
                    id="other-fixed"
                    type="number"
                    step="0.01"
                    min="0"
                    value={tempCosts.other_costs_fixed_value}
                    onChange={(e) =>
                      setTempCosts({ ...tempCosts, other_costs_fixed_value: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="Ex: 500.00"
                  />
                </div>
              )}
              <Button onClick={handleSaveCosts} className="w-full">
                Salvar Configuração
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cards de Totais */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Membros</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.total_members}</div>
            <p className="text-xs text-muted-foreground">Assinaturas ativas ONE</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totalStats.total_revenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Faturamento mensal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comissões Redes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              R$ {totalStats.total_network_commission.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Total a pagar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro após Impostos/Taxas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              R$ {totalStats.gross_profit.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Receita - Impostos ({operationalCosts.tax_percentage}%) - Taxas ({operationalCosts.card_fee_percentage}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Final</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {totalStats.net_profit.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Após comissões redes e outros custos {operationalCosts.other_costs_type === 'fixed' 
                ? `(R$ ${operationalCosts.other_costs_fixed_value.toFixed(2)})` 
                : `(${operationalCosts.other_costs_percentage}%)`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Componente de Impacto de Transferências */}
      {transferImpacts.length > 0 && (
        <NetworkTransferImpact
          transfers={transferImpacts}
          currentMonth={format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
        />
      )}

      {/* Gráfico de Evolução Mensal */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução Mensal de Assinaturas</CardTitle>
          <CardDescription>Crescimento de membros e receita nos últimos 6 meses</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              subscriptions: {
                label: "Assinaturas",
                color: "hsl(var(--primary))",
              },
              revenue: {
                label: "Receita",
                color: "hsl(var(--chart-2))",
              },
            }}
            className="h-[300px]"
          >
            <AreaChart data={monthlyEvolution}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                className="text-xs"
                tickLine={false}
                axisLine={false}
              />
              <YAxis className="text-xs" tickLine={false} axisLine={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => `Mês: ${value}`}
                    formatter={(value, name) => {
                      if (name === "revenue") {
                        return [`R$ ${Number(value).toFixed(2)}`, "Receita"];
                      }
                      return [value, "Assinaturas"];
                    }}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="subscriptions"
                stackId="1"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Gráfico de Distribuição */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição de Receita e Custos</CardTitle>
          <CardDescription>Análise detalhada do fluxo financeiro</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Receita Total</span>
                <span className="text-sm font-bold">
                  R$ {totalStats.total_revenue.toFixed(2)} (100%)
                </span>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Comissões Redes</span>
                <span className="text-sm font-bold text-orange-600">
                  R$ {totalStats.total_network_commission.toFixed(2)} (
                  {((totalStats.total_network_commission / totalStats.total_revenue) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="h-4 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500"
                  style={{
                    width: `${(totalStats.total_network_commission / totalStats.total_revenue) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Impostos ({operationalCosts.tax_percentage}%)</span>
                <span className="text-sm font-bold text-red-600">
                  R$ {totalStats.taxes.toFixed(2)} (
                  {((totalStats.taxes / totalStats.total_revenue) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="h-4 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500"
                  style={{
                    width: `${(totalStats.taxes / totalStats.total_revenue) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Taxas de Cartão ({operationalCosts.card_fee_percentage}%)</span>
                <span className="text-sm font-bold text-red-600">
                  R$ {totalStats.card_fees.toFixed(2)} (
                  {((totalStats.card_fees / totalStats.total_revenue) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="h-4 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500"
                  style={{
                    width: `${(totalStats.card_fees / totalStats.total_revenue) * 100}%`,
                  }}
                />
              </div>
            </div>

            {totalStats.other_costs > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Outros Custos ({operationalCosts.other_costs_percentage}%)</span>
                  <span className="text-sm font-bold text-red-600">
                    R$ {totalStats.other_costs.toFixed(2)} (
                    {((totalStats.other_costs / totalStats.total_revenue) * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500"
                    style={{
                      width: `${(totalStats.other_costs / totalStats.total_revenue) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Lucro Líquido</span>
                <span className="text-sm font-bold text-green-600">
                  R$ {totalStats.net_profit.toFixed(2)} (
                  {((totalStats.net_profit / totalStats.total_revenue) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="h-4 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{
                    width: `${(totalStats.net_profit / totalStats.total_revenue) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Redes */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Rede</CardTitle>
          <CardDescription>Receitas, comissões e datas de pagamento por rede</CardDescription>
        </CardHeader>
        <CardContent>
          {networkStats.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma rede com assinaturas ativas</h3>
              <p className="text-muted-foreground">
                Quando houver assinaturas ONE ativas, os dados aparecerão aqui.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rede</TableHead>
                  <TableHead>Membros</TableHead>
                  <TableHead>Promoções</TableHead>
                  <TableHead>Receita Mensal</TableHead>
                  <TableHead>Tipo Comissão</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Lucro Leva+</TableHead>
                  <TableHead>Previsão Pagamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {networkStats.map((network) => (
                  <TableRow key={network.network_id}>
                    <TableCell className="font-medium">{network.network_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{network.active_members}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge 
                          variant={network.is_eligible_for_commission ? "default" : "destructive"}
                          className="w-fit"
                        >
                          {network.active_promotions_count || 0} promoções
                        </Badge>
                        {!network.is_eligible_for_commission && (
                          <span className="text-xs text-destructive">
                            Mín: 5 promoções
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold">R$ {network.monthly_revenue.toFixed(2)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {network.commission_type === "percentage"
                          ? `${network.commission_value}%`
                          : `R$ ${network.commission_value} /membro`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {network.is_eligible_for_commission ? (
                        <span className="font-bold text-orange-600">
                          R$ {network.network_commission.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground line-through">
                          R$ 0,00
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-green-600">
                        R${" "}
                        {(network.monthly_revenue - network.network_commission).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {network.is_eligible_for_commission ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{network.projected_payment_date}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Não elegível
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Resumo Executivo */}
      <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/20 dark:to-yellow-900/20 border-yellow-200 dark:border-yellow-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-yellow-600" />
            Resumo Executivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Ticket Médio por Membro</p>
              <p className="text-2xl font-bold">
                R${" "}
                {totalStats.total_members > 0
                  ? (totalStats.total_revenue / totalStats.total_members).toFixed(2)
                  : "0.00"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Margem de Lucro</p>
              <p className="text-2xl font-bold">
                {totalStats.total_revenue > 0
                  ? ((totalStats.net_profit / totalStats.total_revenue) * 100).toFixed(1)
                  : "0"}
                %
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Número de Redes Ativas</p>
              <p className="text-2xl font-bold">{networkStats.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
