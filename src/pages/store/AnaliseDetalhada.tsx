import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Loader2,
  Download,
  DollarSign,
  Target,
  Users,
  Filter
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  Cell
} from "recharts";

interface CampaignDetail {
  id: string;
  campaign_name: string;
  campaign_type: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  total_cost: number;
  created_at: string;
  status: string;
}

interface PeriodComparison {
  current: {
    campaigns: number;
    messages: number;
    cost: number;
    revenue: number;
  };
  previous: {
    campaigns: number;
    messages: number;
    cost: number;
    revenue: number;
  };
}

interface FunnelData {
  name: string;
  value: number;
  fill: string;
}

interface ChannelPerformance {
  channel: string;
  campaigns: number;
  sent: number;
  failed: number;
  cost: number;
  revenue: number;
  roi: number;
  deliveryRate: number;
}

const AnaliseDetalhada = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("30");
  const [campaigns, setCampaigns] = useState<CampaignDetail[]>([]);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelData[]>([]);
  const [channelPerformance, setChannelPerformance] = useState<ChannelPerformance[]>([]);

  useEffect(() => {
    loadData();
  }, [selectedPeriod]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: managerData } = await supabase
        .from('store_managers')
        .select('network_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!managerData?.network_id) return;

      const days = parseInt(selectedPeriod);
      const currentStart = new Date();
      currentStart.setDate(currentStart.getDate() - days);

      // Buscar campanhas de marketing do período atual
      const { data: currentMarketingCampaigns } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .eq('network_id', managerData.network_id)
        .gte('created_at', currentStart.toISOString())
        .order('created_at', { ascending: false });

      // Buscar campanhas de ações do período atual
      const { data: currentLoyaltyCampaigns } = await supabase
        .from('loyalty_campaigns')
        .select('*')
        .eq('network_id', managerData.network_id)
        .gte('created_at', currentStart.toISOString())
        .order('created_at', { ascending: false });

      // Combinar campanhas
      const currentCampaigns = [
        ...(currentMarketingCampaigns || []),
        ...(currentLoyaltyCampaigns || []).map(lc => ({
          id: lc.id,
          network_id: lc.network_id,
          campaign_name: lc.name,
          campaign_type: `acao_${lc.action_type}`,
          sent_count: 0,
          failed_count: 0,
          total_cost: 0,
          total_recipients: 0,
          status: lc.is_active ? 'active' : 'inactive',
          created_at: lc.created_at,
        }))
      ];

      if (currentCampaigns) {
        setCampaigns(currentCampaigns);

        // Buscar campanhas do período anterior
        const previousStart = new Date(currentStart);
        previousStart.setDate(previousStart.getDate() - days);
        
        const { data: previousMarketingCampaigns } = await supabase
          .from('marketing_campaigns')
          .select('*')
          .eq('network_id', managerData.network_id)
          .gte('created_at', previousStart.toISOString())
          .lt('created_at', currentStart.toISOString());

        const { data: previousLoyaltyCampaigns } = await supabase
          .from('loyalty_campaigns')
          .select('*')
          .eq('network_id', managerData.network_id)
          .gte('created_at', previousStart.toISOString())
          .lt('created_at', currentStart.toISOString());

        const previousCampaigns = [
          ...(previousMarketingCampaigns || []),
          ...(previousLoyaltyCampaigns || []).map(lc => ({
            id: lc.id,
            sent_count: 0,
            total_cost: 0,
          }))
        ];

        const currentMetrics = {
          campaigns: currentCampaigns.length,
          messages: currentCampaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0),
          cost: currentCampaigns.reduce((sum, c) => sum + Number(c.total_cost || 0), 0),
          revenue: currentCampaigns.reduce((sum, c) => sum + Number(c.total_cost || 0), 0) * 3, // Estimativa 3x do custo
        };

        const previousMetrics = {
          campaigns: previousCampaigns?.length || 0,
          messages: previousCampaigns?.reduce((sum, c) => sum + (c.sent_count || 0), 0) || 0,
          cost: previousCampaigns?.reduce((sum, c) => sum + Number(c.total_cost || 0), 0) || 0,
          revenue: (previousCampaigns?.reduce((sum, c) => sum + Number(c.total_cost || 0), 0) || 0) * 3,
        };

        setComparison({
          current: currentMetrics,
          previous: previousMetrics,
        });

        // Dados do Funil
        const totalSent = currentMetrics.messages;
        const totalDelivered = totalSent - currentCampaigns.reduce((sum, c) => sum + (c.failed_count || 0), 0);
        const estimatedOpened = Math.floor(totalDelivered * 0.25); // Estimativa 25%
        const estimatedConverted = Math.floor(estimatedOpened * 0.15); // Estimativa 15%

        setFunnelData([
          { name: 'Enviadas', value: totalSent, fill: 'hsl(var(--primary))' },
          { name: 'Entregues', value: totalDelivered, fill: 'hsl(var(--chart-1))' },
          { name: 'Abertas*', value: estimatedOpened, fill: 'hsl(var(--chart-2))' },
          { name: 'Convertidas*', value: estimatedConverted, fill: 'hsl(var(--chart-3))' },
        ]);

        // Performance por Canal
        const channelStats: ChannelPerformance[] = ['whatsapp', 'sms', 'email'].map(channel => {
          const channelCampaigns = currentCampaigns.filter(c => c.campaign_type === channel);
          const sent = channelCampaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0);
          const failed = channelCampaigns.reduce((sum, c) => sum + (c.failed_count || 0), 0);
          const cost = channelCampaigns.reduce((sum, c) => sum + Number(c.total_cost || 0), 0);
          const estimatedRevenue = (currentMetrics.revenue / currentCampaigns.length) * channelCampaigns.length;
          
          return {
            channel,
            campaigns: channelCampaigns.length,
            sent,
            failed,
            cost,
            revenue: estimatedRevenue,
            roi: cost > 0 ? ((estimatedRevenue - cost) / cost) * 100 : 0,
            deliveryRate: sent + failed > 0 ? (sent / (sent + failed)) * 100 : 0,
          };
        }).filter(c => c.campaigns > 0);

        setChannelPerformance(channelStats);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-green-600 dark:text-green-400";
    if (change < 0) return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  const getChannelLabel = (type: string) => {
    switch (type) {
      case 'whatsapp': return 'WhatsApp';
      case 'sms': return 'SMS';
      case 'email': return 'E-mail';
      default: return type;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluída';
      case 'pending': return 'Pendente';
      case 'processing': return 'Processando';
      case 'draft': return 'Rascunho';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/levaloja/marketing/impacto-insights')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Análise Detalhada de Marketing</h1>
            <p className="text-muted-foreground text-sm">
              ROI, funil de conversão e análises avançadas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="60">Últimos 60 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ROI e Receita */}
      {comparison && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Receita Atribuída
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {comparison.current.revenue.toFixed(2)}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {calculateChange(comparison.current.revenue, comparison.previous.revenue) >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span className={`text-sm font-medium ${getChangeColor(
                  calculateChange(comparison.current.revenue, comparison.previous.revenue)
                )}`}>
                  {Math.abs(calculateChange(comparison.current.revenue, comparison.previous.revenue)).toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                ROI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {comparison.current.cost > 0 
                  ? ((comparison.current.revenue / comparison.current.cost) * 100).toFixed(0)
                  : '0'}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Retorno sobre investimento
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Investimento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {comparison.current.cost.toFixed(2)}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {calculateChange(comparison.current.cost, comparison.previous.cost) >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-green-600" />
                )}
                <span className={`text-sm font-medium ${getChangeColor(
                  calculateChange(comparison.current.cost, comparison.previous.cost)
                )}`}>
                  {Math.abs(calculateChange(comparison.current.cost, comparison.previous.cost)).toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R$ {(comparison.current.revenue - comparison.current.cost).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Receita - Custos
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Funil de Conversão */}
      <Card>
        <CardHeader>
          <CardTitle>Funil de Conversão</CardTitle>
          <CardDescription>Jornada das mensagens até conversão (*estimado)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {funnelData.map((stage, index) => {
              const prevValue = index > 0 ? funnelData[index - 1].value : stage.value;
              const conversionRate = prevValue > 0 ? (stage.value / prevValue) * 100 : 100;
              return (
                <Card key={stage.name} style={{ borderColor: stage.fill }}>
                  <CardContent className="p-6 text-center">
                    <p className="text-sm font-medium text-muted-foreground mb-2">{stage.name}</p>
                    <p className="text-3xl font-bold mb-1">{stage.value}</p>
                    {index > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {conversionRate.toFixed(1)}% do anterior
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            * Valores de abertura e conversão são estimativas baseadas em médias do mercado
          </p>
        </CardContent>
      </Card>

      {/* Tabela de Campanhas Detalhada */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Histórico de Campanhas</CardTitle>
              <CardDescription>Todas as campanhas do período selecionado</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma campanha encontrada no período selecionado
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Destinatários</TableHead>
                  <TableHead>Enviadas</TableHead>
                  <TableHead>Falhas</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.campaign_name}</TableCell>
                    <TableCell>{getChannelLabel(campaign.campaign_type)}</TableCell>
                    <TableCell>
                      {format(new Date(campaign.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{campaign.total_recipients}</TableCell>
                    <TableCell className="text-green-600">{campaign.sent_count}</TableCell>
                    <TableCell className="text-red-600">{campaign.failed_count}</TableCell>
                    <TableCell>R$ {Number(campaign.total_cost).toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        campaign.status === 'completed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : campaign.status === 'processing'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                      }`}>
                        {getStatusLabel(campaign.status)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Performance por Canal com ROI */}
      <Card>
        <CardHeader>
          <CardTitle>Performance por Canal</CardTitle>
          <CardDescription>Análise comparativa com ROI e métricas de qualidade</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead>Campanhas</TableHead>
                <TableHead>Enviadas</TableHead>
                <TableHead>Taxa Entrega</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>Receita*</TableHead>
                <TableHead>ROI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channelPerformance.map((channel) => (
                <TableRow key={channel.channel}>
                  <TableCell className="font-medium">{getChannelLabel(channel.channel)}</TableCell>
                  <TableCell>{channel.campaigns}</TableCell>
                  <TableCell>{channel.sent}</TableCell>
                  <TableCell>
                    <span className={channel.deliveryRate >= 95 ? 'text-green-600' : 'text-orange-600'}>
                      {channel.deliveryRate.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell>R$ {channel.cost.toFixed(2)}</TableCell>
                  <TableCell>R$ {channel.revenue.toFixed(2)}</TableCell>
                  <TableCell>
                    <span className={channel.roi > 0 ? 'text-green-600 font-semibold' : 'text-red-600'}>
                      {channel.roi.toFixed(0)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-4">
            * Receita estimada com base na distribuição proporcional de campanhas
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnaliseDetalhada;