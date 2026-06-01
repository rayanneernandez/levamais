import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { 
  Lightbulb, 
  TrendingUp, 
  Target, 
  Users, 
  MessageSquare,
  DollarSign,
  Zap,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  CalendarIcon
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, startOfMonth, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MarketingMetrics {
  total_campaigns: number;
  total_messages_sent: number;
  total_cost: number;
  avg_campaign_cost: number;
  whatsapp_count: number;
  sms_count: number;
  email_count: number;
}

interface Insight {
  type: 'success' | 'warning' | 'info';
  title: string;
  description: string;
  action?: string;
}

const ImpactoInsights = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<MarketingMetrics | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(new Date());

  useEffect(() => {
    loadData();
  }, [dateFrom, dateTo]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: managerData } = await supabase
        .from('store_managers')
        .select('network_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!managerData?.network_id) return;

      // Buscar campanhas de marketing com filtro de data
      const { data: marketingCampaigns } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .eq('network_id', managerData.network_id)
        .gte('created_at', startOfDay(dateFrom).toISOString())
        .lte('created_at', endOfDay(dateTo).toISOString());

      // Buscar campanhas de ações (loyalty_campaigns) com filtro de data
      const { data: loyaltyCampaigns } = await supabase
        .from('loyalty_campaigns')
        .select('*')
        .eq('network_id', managerData.network_id)
        .gte('created_at', startOfDay(dateFrom).toISOString())
        .lte('created_at', endOfDay(dateTo).toISOString());

      // Combinar campanhas
      const campaigns = [
        ...(marketingCampaigns || []),
        ...(loyaltyCampaigns || []).map(lc => ({
          id: lc.id,
          network_id: lc.network_id,
          campaign_name: lc.name,
          campaign_type: `acao_${lc.action_type}`,
          sent_count: 0,
          failed_count: 0,
          total_cost: 0,
          status: lc.is_active ? 'active' : 'inactive',
          created_at: lc.created_at,
        }))
      ];

      if (campaigns.length > 0) {
        const metricsData: MarketingMetrics = {
          total_campaigns: campaigns.length,
          total_messages_sent: campaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0),
          total_cost: campaigns.reduce((sum, c) => sum + Number(c.total_cost || 0), 0),
          avg_campaign_cost: campaigns.length > 0 
            ? campaigns.reduce((sum, c) => sum + Number(c.total_cost || 0), 0) / campaigns.length 
            : 0,
          whatsapp_count: campaigns.filter(c => c.campaign_type?.includes('whatsapp')).length,
          sms_count: campaigns.filter(c => c.campaign_type?.includes('sms')).length,
          email_count: campaigns.filter(c => c.campaign_type?.includes('email')).length,
        };

        setMetrics(metricsData);
        generateInsights(metricsData, campaigns);
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

  const generateInsights = (metrics: MarketingMetrics, campaigns: any[]) => {
    const generatedInsights: Insight[] = [];

    // Insight: Canal mais usado
    const mostUsedChannel = 
      metrics.whatsapp_count >= metrics.sms_count && metrics.whatsapp_count >= metrics.email_count
        ? 'WhatsApp'
        : metrics.sms_count >= metrics.email_count
        ? 'SMS'
        : 'E-mail';

    generatedInsights.push({
      type: 'success',
      title: `${mostUsedChannel} é seu canal preferido`,
      description: `${metrics.whatsapp_count > 0 ? metrics.whatsapp_count : metrics.sms_count > 0 ? metrics.sms_count : metrics.email_count} campanhas enviadas. Continue investindo neste canal!`,
    });

    // Insight: Custo médio
    if (metrics.avg_campaign_cost > 0) {
      generatedInsights.push({
        type: 'info',
        title: 'Custo médio por campanha',
        description: `R$ ${metrics.avg_campaign_cost.toFixed(2)} - ${
          metrics.avg_campaign_cost < 50 
            ? 'Excelente custo-benefício!' 
            : 'Considere otimizar suas campanhas.'
        }`,
      });
    }

    // Insight: Mensagens enviadas
    if (metrics.total_messages_sent > 0) {
      const avgMessagesPerCampaign = metrics.total_messages_sent / metrics.total_campaigns;
      generatedInsights.push({
        type: 'success',
        title: `${metrics.total_messages_sent} mensagens enviadas`,
        description: `Média de ${Math.round(avgMessagesPerCampaign)} destinatários por campanha.`,
      });
    }

    // Insight: Recomendação
    if (campaigns.length === 0) {
      generatedInsights.push({
        type: 'warning',
        title: 'Comece sua estratégia de marketing',
        description: 'Crie sua primeira campanha para engajar clientes e aumentar vendas.',
        action: 'Criar campanha',
      });
    } else if (campaigns.length < 5) {
      generatedInsights.push({
        type: 'info',
        title: 'Amplie sua presença',
        description: 'Teste diferentes canais e mensagens para descobrir o que funciona melhor.',
      });
    }

    setInsights(generatedInsights);
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Impacto e Insights</h1>
          <p className="text-muted-foreground text-sm">
            Análises inteligentes para melhorar sua estratégia de marketing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateFrom, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
            </PopoverContent>
          </Popover>
          <span className="text-sm text-muted-foreground">até</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateTo, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
            </PopoverContent>
          </Popover>
          <Button onClick={() => navigate('/levaloja/marketing/analise-detalhada')}>
            Análise Detalhada
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Métricas Principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Campanhas</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.total_campaigns || 0}</div>
            <p className="text-xs text-muted-foreground">
              Campanhas realizadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Enviadas</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.total_messages_sent || 0}</div>
            <p className="text-xs text-muted-foreground">
              Alcance total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Investimento Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {metrics?.total_cost.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Em campanhas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {metrics?.avg_campaign_cost.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Por campanha
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição de Canais */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Canal</CardTitle>
          <CardDescription>Como suas campanhas estão distribuídas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">WhatsApp</span>
              </div>
              <span className="text-sm text-muted-foreground">{metrics?.whatsapp_count || 0} campanhas</span>
            </div>
            <Progress 
              value={metrics?.total_campaigns ? (metrics.whatsapp_count / metrics.total_campaigns) * 100 : 0} 
              className="h-2"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">SMS</span>
              </div>
              <span className="text-sm text-muted-foreground">{metrics?.sms_count || 0} campanhas</span>
            </div>
            <Progress 
              value={metrics?.total_campaigns ? (metrics.sms_count / metrics.total_campaigns) * 100 : 0} 
              className="h-2"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">E-mail</span>
              </div>
              <span className="text-sm text-muted-foreground">{metrics?.email_count || 0} campanhas</span>
            </div>
            <Progress 
              value={metrics?.total_campaigns ? (metrics.email_count / metrics.total_campaigns) * 100 : 0} 
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Insights Automáticos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Insights Inteligentes
          </CardTitle>
          <CardDescription>Recomendações baseadas em suas campanhas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Crie campanhas para receber insights personalizados
            </p>
          ) : (
            insights.map((insight, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-4 rounded-lg border ${
                  insight.type === 'success'
                    ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                    : insight.type === 'warning'
                    ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
                    : 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800'
                }`}
              >
                {insight.type === 'success' && <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />}
                {insight.type === 'warning' && <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />}
                {insight.type === 'info' && <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />}
                
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{insight.title}</p>
                  <p className="text-xs text-muted-foreground">{insight.description}</p>
                  {insight.action && (
                    <Button size="sm" variant="outline" className="mt-2">
                      {insight.action}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* CTA para Análise Detalhada */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Quer mais detalhes?</h3>
              <p className="text-sm text-muted-foreground">
                Acesse análises aprofundadas, comparativos temporais e relatórios completos
              </p>
            </div>
            <Button onClick={() => navigate('/levaloja/marketing/analise-detalhada')}>
              Ver Análise Completa
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ImpactoInsights;
