import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Users, TrendingUp, Calendar, Star, AlertCircle, Download, Gift, Clock, Award, BarChart3, Lightbulb, FileText } from "lucide-react";
import { format, addMonths, startOfMonth, endOfMonth, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TransferImpact {
  client_name: string;
  transfer_type: 'gained' | 'lost';
  transferred_at: string;
  monthly_value: number;
  other_network_name: string;
}

interface CommissionConfig {
  commission_type: string;
  commission_value: number;
  payment_day_offset: number;
}

interface Subscription {
  id: string;
  client_id: string;
  status: string;
  subscription_status: string;
  monthly_value: number;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  clients: {
    full_name: string;
    email: string;
    phone: string;
  };
}

interface MonthlyStats {
  active_members: number;
  monthly_revenue: number;
  network_commission: number;
  projected_payment_date: string;
}

interface PromotionStats {
  id: string;
  name: string;
  total_redemptions: number;
  unique_clients: number;
  conversion_rate: number;
}

interface HourlyStats {
  hour: string;
  redemptions: number;
}

interface ClientActivity {
  client_name: string;
  client_email: string;
  redemptions_count: number;
}

export default function LevaOneFinancial() {
  const [isLoading, setIsLoading] = useState(true);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [networkName, setNetworkName] = useState<string>("");
  const [commissionConfig, setCommissionConfig] = useState<CommissionConfig | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [transferImpacts, setTransferImpacts] = useState<TransferImpact[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
    active_members: 0,
    monthly_revenue: 0,
    network_commission: 0,
    projected_payment_date: "",
  });
  
  // Estados para analytics de promoções
  const [topPromotions, setTopPromotions] = useState<PromotionStats[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyStats[]>([]);
  const [topClients, setTopClients] = useState<ClientActivity[]>([]);
  const [dailyRedemptions, setDailyRedemptions] = useState<any[]>([]);
  const [totalRedemptions, setTotalRedemptions] = useState(0);
  const [activePromotionsCount, setActivePromotionsCount] = useState(0);
  const [isEligibleForCommission, setIsEligibleForCommission] = useState(true);
  
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const fetchSubscriptions = async (networkId: string): Promise<any[]> => {
    const response: any = await (supabase as any)
      .from("client_subscriptions_one")
      .select("*, clients(id, full_name, email, phone)")
      .eq("network_id", networkId)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    
    if (response.error) throw response.error;
    return response.data || [];
  };

  const fetchClients = async (networkId: string): Promise<any[]> => {
    const response: any = await (supabase as any)
      .from("clients")
      .select("id, full_name, email, phone")
      .eq("network_id", networkId);
    
    return response.data || [];
  };

  const loadData = async () => {
    try {
      const { data: { user } } = await (supabase as any).auth.getUser();
      if (!user) return;

      // Buscar network_id do usuário
      const { data: managerData } = await (supabase as any)
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!managerData?.network_id) {
        toast({
          title: "Erro",
          description: "Rede não encontrada para este usuário.",
          variant: "destructive",
        });
        return;
      }

      setNetworkId(managerData.network_id);

      // Buscar nome da rede
      const { data: networkData } = await supabase
        .from("networks")
        .select("name")
        .eq("id", managerData.network_id)
        .single();

      if (networkData) {
        setNetworkName(networkData.name);
      }

      // Buscar transferências do mês atual
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
        .lte("processed_at", currentMonthEnd.toISOString())
        .or(`from_network_id.eq.${managerData.network_id},to_network_id.eq.${managerData.network_id}`);

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
            const isGained = transfer.to_network_id === managerData.network_id;
            transferImpactsList.push({
              client_name: transfer.client?.full_name || "Cliente",
              transfer_type: isGained ? 'gained' : 'lost',
              transferred_at: transfer.processed_at!,
              monthly_value: subscription.monthly_value,
              other_network_name: isGained 
                ? transfer.from_network?.name || "Rede Anterior"
                : transfer.to_network?.name || "Rede Nova"
            });
          }
        }
      }

      setTransferImpacts(transferImpactsList);

      // Buscar configuração de comissão
      const { data: configData } = await (supabase as any)
        .from("network_one_commission_config")
        .select("*")
        .eq("network_id", managerData.network_id)
        .single();

      setCommissionConfig(configData as any);

      // Buscar dados usando funções auxiliares
      const subsDataRaw = await fetchSubscriptions(managerData.network_id);
      
      // Enriquecer com dados de clientes que já vêm do join
      const enrichedSubs = subsDataRaw.map((sub: any) => ({
        ...sub,
        clients: sub.clients || { full_name: 'N/A', email: 'N/A', phone: 'N/A' }
      }));

      setSubscriptions(enrichedSubs);

      // Verificar quantidade de promoções ativas
      const { data: activePromos, count: activePromosCount } = await supabase
        .from('one_promotions')
        .select('id', { count: 'exact', head: true })
        .eq('network_id', managerData.network_id)
        .eq('is_active', true)
        .gte('end_date', new Date().toISOString());

      const promosCount = activePromosCount || 0;
      setActivePromotionsCount(promosCount);
      setIsEligibleForCommission(promosCount >= 5);

      // Calcular estatísticas
      calculateMonthlyStats(enrichedSubs, configData as any);
      
      // Carregar analytics de promoções
      await loadPromotionAnalytics(managerData.network_id);
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

  const loadPromotionAnalytics = async (networkId: string) => {
    try {
      // Buscar todas as promoções da rede com resgates
      const { data: promotions } = await supabase
        .from('one_promotions')
        .select(`
          id,
          name,
          one_promotion_redemptions (
            id,
            redeemed_at,
            client_id,
            clients (
              full_name,
              email
            )
          )
        `)
        .eq('network_id', networkId);

      if (!promotions) return;

      // Calcular estatísticas por promoção
      const promoStats: PromotionStats[] = promotions.map(promo => {
        const redemptions = promo.one_promotion_redemptions || [];
        const uniqueClients = new Set(redemptions.map((r: any) => r.client_id)).size;
        
        return {
          id: promo.id,
          name: promo.name,
          total_redemptions: redemptions.length,
          unique_clients: uniqueClients,
          conversion_rate: uniqueClients > 0 ? (redemptions.length / uniqueClients) : 0
        };
      }).sort((a, b) => b.total_redemptions - a.total_redemptions).slice(0, 5);

      setTopPromotions(promoStats);

      // Resgates dos últimos 7 dias
      const last7Days = subDays(new Date(), 7);
      const { data: recentRedemptions } = await supabase
        .from('one_promotion_redemptions')
        .select('redeemed_at, client_id, clients(full_name, email)')
        .gte('redeemed_at', last7Days.toISOString())
        .order('redeemed_at', { ascending: true });

      if (recentRedemptions) {
        setTotalRedemptions(recentRedemptions.length);

        // Agrupar por dia
        const dailyMap = new Map();
        recentRedemptions.forEach((r: any) => {
          const day = format(new Date(r.redeemed_at), 'dd/MM');
          dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
        });
        
        const dailyData = Array.from(dailyMap.entries()).map(([day, count]) => ({
          day,
          resgates: count
        }));
        setDailyRedemptions(dailyData);

        // Agrupar por hora
        const hourlyMap = new Map();
        for (let h = 0; h < 24; h++) {
          hourlyMap.set(h, 0);
        }
        
        recentRedemptions.forEach((r: any) => {
          const hour = new Date(r.redeemed_at).getHours();
          hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
        });

        const hourlyData = Array.from(hourlyMap.entries())
          .map(([hour, count]) => ({
            hour: `${hour.toString().padStart(2, '0')}h`,
            redemptions: count
          }))
          .filter(d => d.redemptions > 0)
          .sort((a, b) => b.redemptions - a.redemptions)
          .slice(0, 10);
        
        setHourlyData(hourlyData);

        // Clientes mais ativos
        const clientMap = new Map();
        recentRedemptions.forEach((r: any) => {
          const clientId = r.client_id;
          if (!clientMap.has(clientId)) {
            clientMap.set(clientId, {
              client_name: r.clients?.full_name || 'Cliente',
              client_email: r.clients?.email || '-',
              redemptions_count: 0
            });
          }
          const client = clientMap.get(clientId);
          client.redemptions_count++;
        });

        const topClientsList = Array.from(clientMap.values())
          .sort((a, b) => b.redemptions_count - a.redemptions_count)
          .slice(0, 5);
        
        setTopClients(topClientsList);
      }
    } catch (error) {
      console.error('Error loading promotion analytics:', error);
    }
  };

  const calculateMonthlyStats = (subs: any[], config: CommissionConfig | null) => {
    const activeMembersCount = subs.length;
    const totalRevenue = subs.reduce((sum, sub) => sum + (sub.monthly_value || 0), 0);

    let networkCommission = 0;
    if (config) {
      if (config.commission_type === "percentage") {
        networkCommission = totalRevenue * (config.commission_value / 100);
      } else {
        networkCommission = activeMembersCount * config.commission_value;
      }
    }

    // Calcular data de pagamento projetada
    const today = new Date();
    const nextMonth = addMonths(today, 1);
    const paymentDay = config?.payment_day_offset || 10;
    const projectedPaymentDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), paymentDay);

    setMonthlyStats({
      active_members: activeMembersCount,
      monthly_revenue: totalRevenue,
      network_commission: networkCommission,
      projected_payment_date: format(projectedPaymentDate, "dd/MM/yyyy", { locale: ptBR }),
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: "Ativo", className: "bg-green-500" },
      suspended: { label: "Suspenso", className: "bg-yellow-500" },
      cancelled: { label: "Cancelado", className: "bg-red-500" },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, className: "bg-gray-500" };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const generateInvoicePDF = async () => {
    try {
      // Validar elegibilidade antes de gerar fatura
      if (!isEligibleForCommission) {
        toast({
          title: "Não elegível para comissão",
          description: `Sua rede possui apenas ${activePromotionsCount} promoções ativas. É necessário ter no mínimo 5 promoções ativas para receber comissão mensal.`,
          variant: "destructive"
        });
        return;
      }

      // Buscar dados da rede
      const { data: networkData } = await supabase
        .from('networks')
        .select('name, cnpj')
        .eq('id', networkId)
        .single();

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      
      // Cabeçalho
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('FATURA - LEVA+ ONE', pageWidth / 2, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Comissão de Assinaturas', pageWidth / 2, 28, { align: 'center' });
      
      // Linha separadora
      doc.setLineWidth(0.5);
      doc.line(15, 32, pageWidth - 15, 32);
      
      // Informações da Rede
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('DADOS DO BENEFICIÁRIO', 15, 42);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Rede: ${networkData?.name || 'N/A'}`, 15, 50);
      doc.text(`CNPJ: ${networkData?.cnpj || 'N/A'}`, 15, 56);
      
      // Período de Referência
      const currentMonth = format(new Date(), 'MMMM/yyyy', { locale: ptBR });
      doc.setFont('helvetica', 'bold');
      doc.text('PERÍODO DE REFERÊNCIA', 15, 68);
      doc.setFont('helvetica', 'normal');
      doc.text(currentMonth.toUpperCase(), 15, 74);
      
      // Resumo Financeiro
      let yPos = 88;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('RESUMO FINANCEIRO', 15, yPos);
      
      yPos += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const summaryData = [
        ['Membros Ativos ONE', monthlyStats.active_members.toString()],
        ['Receita Total Leva+', `R$ ${monthlyStats.monthly_revenue.toFixed(2)}`],
        ['Tipo de Comissão', commissionConfig?.commission_type === 'percentage' ? 'Percentual' : 'Valor Fixo'],
        ['Taxa de Comissão', commissionConfig?.commission_type === 'percentage' 
          ? `${commissionConfig.commission_value}%` 
          : `R$ ${commissionConfig?.commission_value.toFixed(2)} por membro`],
      ];
      
      autoTable(doc, {
        startY: yPos,
        head: [],
        body: summaryData,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 80 },
          1: { cellWidth: 'auto' }
        }
      });
      
      // Valor da Comissão (Destaque)
      yPos = (doc as any).lastAutoTable.finalY + 10;
      doc.setFillColor(255, 237, 213); // fundo amarelo claro
      doc.rect(15, yPos, pageWidth - 30, 20, 'F');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('VALOR DA COMISSÃO:', 20, yPos + 8);
      
      doc.setFontSize(16);
      doc.setTextColor(34, 139, 34); // verde
      doc.text(`R$ ${monthlyStats.network_commission.toFixed(2)}`, 20, yPos + 16);
      doc.setTextColor(0, 0, 0);
      
      // Data de Vencimento
      yPos += 28;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('DATA DE VENCIMENTO', 15, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(monthlyStats.projected_payment_date, 15, yPos + 6);
      
      // Lista de Membros (se couber)
      yPos += 18;
      if (subscriptions.length > 0 && yPos < 240) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('MEMBROS ATIVOS', 15, yPos);
        
        const memberRows = subscriptions.map(sub => [
          sub.clients.full_name,
          format(new Date(sub.created_at), 'dd/MM/yyyy', { locale: ptBR }),
          `R$ ${sub.monthly_value.toFixed(2)}`
        ]);
        
        autoTable(doc, {
          startY: yPos + 4,
          head: [['Cliente', 'Membro Desde', 'Valor Mensal']],
          body: memberRows,
          theme: 'striped',
          headStyles: { fillColor: [255, 193, 7], textColor: [0, 0, 0], fontStyle: 'bold' },
          styles: { fontSize: 9, cellPadding: 2 },
        });
      }
      
      // Rodapé
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
      
      // Salvar PDF
      doc.save(`fatura-leva-one-${format(new Date(), 'yyyy-MM')}.pdf`);
      
      toast({
        title: "Fatura gerada!",
        description: "O PDF da fatura foi baixado com sucesso.",
      });
    } catch (error: any) {
      console.error('Error generating invoice:', error);
      toast({
        title: "Erro ao gerar fatura",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const exportToCSV = () => {
    const headers = ["Cliente", "Email", "Telefone", "Valor Mensal", "Status", "Data Início"];
    const rows = subscriptions.map(sub => [
      sub.clients.full_name,
      sub.clients.email,
      sub.clients.phone,
      `R$ ${sub.monthly_value.toFixed(2)}`,
      sub.subscription_status,
      format(new Date(sub.created_at), "dd/MM/yyyy", { locale: ptBR }),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `leva-one-financeiro-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();

    toast({
      title: "Exportado com sucesso!",
      description: "O relatório foi baixado em formato CSV.",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatório Financeiro ONE</h1>
          <p className="text-muted-foreground mt-1">
            Acompanhamento de receita e comissões
          </p>
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

  if (!commissionConfig) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatório Financeiro ONE</h1>
          <p className="text-muted-foreground mt-1">
            Acompanhamento de receita e comissões
          </p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Configuração de comissão não encontrada. Entre em contato com o administrador para configurar
            os parâmetros de comissão do Leva+ One.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
            Dashboard Leva+ One
          </h1>
          <p className="text-muted-foreground mt-1">
            Financeiro e Analytics de Promoções
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={generateInvoicePDF} variant="default">
            <FileText className="h-4 w-4 mr-2" />
            Gerar Fatura
          </Button>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <Tabs defaultValue="financeiro" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="promocoes">Analytics</TabsTrigger>
          <TabsTrigger value="roi">ROI & Custos</TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro" className="space-y-6">

      {/* Alerta de Elegibilidade para Comissão */}
      {!isEligibleForCommission && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Atenção: Não Elegível para Comissão</AlertTitle>
          <AlertDescription>
            Sua rede possui apenas <strong>{activePromotionsCount} promoções ativas</strong>. 
            É necessário ter <strong>no mínimo 5 promoções ativas</strong> para ter direito à remuneração mensal do Leva+ One. 
            Crie mais promoções para se qualificar para o recebimento de comissões.
          </AlertDescription>
        </Alert>
      )}

      {isEligibleForCommission && activePromotionsCount < 10 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Status de Elegibilidade</AlertTitle>
          <AlertDescription>
            ✅ Sua rede possui <strong>{activePromotionsCount} promoções ativas</strong> e está elegível para receber a comissão mensal. 
            Continue criando promoções para engajar mais membros ONE!
          </AlertDescription>
        </Alert>
      )}

      {/* Cards de Estatísticas */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membros Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyStats.active_members}</div>
            <p className="text-xs text-muted-foreground">
              Assinaturas ativas ONE
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {monthlyStats.monthly_revenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total de assinaturas ONE
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comissão da Rede</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {monthlyStats.network_commission.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {commissionConfig.commission_type === "percentage" 
                ? `${commissionConfig.commission_value}% sobre receita`
                : `R$ ${commissionConfig.commission_value} por membro`
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Previsão Pagamento</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {monthlyStats.projected_payment_date}
            </div>
            <p className="text-xs text-muted-foreground">
              Dia {commissionConfig.payment_day_offset} do próximo mês
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de Transferências */}
      {transferImpacts.length > 0 && (
        <Alert className="border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20">
          <Calendar className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-900 dark:text-blue-100 font-bold">
            Impacto de Transferências de Rede - {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
          </AlertTitle>
          <AlertDescription className="mt-3 space-y-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Houve {transferImpacts.length} transferência{transferImpacts.length > 1 ? 's' : ''} de rede este mês:
            </p>
            
            <div className="space-y-2">
              {transferImpacts.map((impact, index) => (
                <div key={index} className="p-3 bg-background rounded-lg border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{impact.client_name}</span>
                    <Badge variant={impact.transfer_type === 'gained' ? 'default' : 'secondary'}>
                      {impact.transfer_type === 'gained' ? '✅ Ganho' : '❌ Perda'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    R$ {impact.monthly_value.toFixed(2)}/mês • {impact.transfer_type === 'gained' ? 'De' : 'Para'}: {impact.other_network_name}
                  </p>
                  <p className="text-xs text-muted-foreground italic">
                    {impact.transfer_type === 'gained' 
                      ? `✅ Você receberá comissão deste cliente a partir de ${format(new Date(), "MMMM", { locale: ptBR })}`
                      : `⚠️ Você recebeu a última comissão deste cliente em ${format(new Date(), "MMMM", { locale: ptBR })}`
                    }
                  </p>
                </div>
              ))}
            </div>
            
            <div className="pt-2 border-t text-xs text-blue-700 dark:text-blue-300">
              <strong>Como funciona:</strong> Quando um cliente troca de rede favorita, a rede anterior recebe 
              comissão do mês fechado, e a rede nova passa a receber a partir do mês atual.
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Informações da Comissão */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração de Comissão</CardTitle>
          <CardDescription>
            Parâmetros definidos para cálculo de comissão da rede
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tipo de Comissão:</span>
              <Badge variant="secondary">
                {commissionConfig.commission_type === "percentage" ? "Percentual" : "Valor Fixo"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Valor da Comissão:</span>
              <span className="font-bold">
                {commissionConfig.commission_type === "percentage" 
                  ? `${commissionConfig.commission_value}%`
                  : `R$ ${commissionConfig.commission_value.toFixed(2)} por membro`
                }
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Dia de Pagamento:</span>
              <span className="font-bold">
                Dia {commissionConfig.payment_day_offset} de cada mês
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Assinaturas */}
      <Card>
        <CardHeader>
          <CardTitle>Membros Ativos</CardTitle>
          <CardDescription>
            Lista de todos os membros com assinatura ativa do Leva+ One
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Nenhum membro ativo
              </h3>
              <p className="text-muted-foreground">
                Quando clientes assinarem o Leva+ One, eles aparecerão aqui.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Valor Mensal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Membro Desde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">
                      {sub.clients.full_name}
                    </TableCell>
                    <TableCell>{sub.clients.email}</TableCell>
                    <TableCell>{sub.clients.phone || "-"}</TableCell>
                    <TableCell>
                      <span className="font-bold text-green-600">
                        R$ {sub.monthly_value.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(sub.status)}</TableCell>
                    <TableCell>
                      {format(new Date(sub.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Resumo do Mês */}
      <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/20 dark:to-yellow-900/20 border-yellow-200 dark:border-yellow-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-yellow-600" />
            Resumo do Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total de Receita</p>
              <p className="text-2xl font-bold">
                R$ {monthlyStats.monthly_revenue.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Comissão da Rede</p>
              <p className="text-2xl font-bold text-green-600">
                R$ {monthlyStats.network_commission.toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="promocoes" className="space-y-6">
          {/* Cards de Estatísticas de Promoções */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resgates (7 dias)</CardTitle>
                <Gift className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalRedemptions}</div>
                <p className="text-xs text-muted-foreground">
                  Total de resgates na última semana
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Promoções Ativas</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{topPromotions.length}</div>
                <p className="text-xs text-muted-foreground">
                  Promoções com resgates
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa Média Conversão</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {topPromotions.length > 0 
                    ? (topPromotions.reduce((acc, p) => acc + p.conversion_rate, 0) / topPromotions.length).toFixed(1)
                    : '0'
                  }x
                </div>
                <p className="text-xs text-muted-foreground">
                  Resgates por cliente
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{topClients.length}</div>
                <p className="text-xs text-muted-foreground">
                  Clientes que resgataram
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Resgates por Dia */}
            <Card>
              <CardHeader>
                <CardTitle>Resgates nos Últimos 7 Dias</CardTitle>
                <CardDescription>Evolução diária de resgates</CardDescription>
              </CardHeader>
              <CardContent>
                {dailyRedemptions.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dailyRedemptions}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="resgates" stroke="#f59e0b" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Nenhum resgate nos últimos 7 dias
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Horários de Pico */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Horários de Pico
                </CardTitle>
                <CardDescription>Top 10 horários com mais resgates</CardDescription>
              </CardHeader>
              <CardContent>
                {hourlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="redemptions" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Sem dados de horários
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Promoções Mais Populares */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-yellow-500" />
                Top 5 Promoções Mais Populares
              </CardTitle>
              <CardDescription>
                Ranking de promoções por número de resgates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topPromotions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Posição</TableHead>
                      <TableHead>Promoção</TableHead>
                      <TableHead>Total Resgates</TableHead>
                      <TableHead>Clientes Únicos</TableHead>
                      <TableHead>Taxa Conversão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topPromotions.map((promo, index) => (
                      <TableRow key={promo.id}>
                        <TableCell>
                          <Badge variant={index === 0 ? "default" : "outline"}>
                            {index + 1}º
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{promo.name}</TableCell>
                        <TableCell>
                          <span className="font-bold text-primary">
                            {promo.total_redemptions}
                          </span>
                        </TableCell>
                        <TableCell>{promo.unique_clients}</TableCell>
                        <TableCell>{promo.conversion_rate.toFixed(1)}x</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <Gift className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    Nenhum resgate ainda
                  </h3>
                  <p className="text-muted-foreground">
                    Quando as promoções forem resgatadas, as estatísticas aparecerão aqui.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Clientes Mais Ativos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Top 5 Clientes Mais Ativos
              </CardTitle>
              <CardDescription>
                Clientes com mais resgates nos últimos 7 dias
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topClients.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Posição</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Resgates</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topClients.map((client, index) => (
                      <TableRow key={client.client_email}>
                        <TableCell>
                          <Badge variant={index === 0 ? "default" : "outline"}>
                            {index + 1}º
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{client.client_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {client.client_email}
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-blue-600">
                            {client.redemptions_count}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    Nenhum cliente ativo
                  </h3>
                  <p className="text-muted-foreground">
                    Quando clientes resgatarem promoções, eles aparecerão aqui.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Nova Aba: ROI & Custos */}
        <TabsContent value="roi" className="space-y-6">
          {/* Cards de ROI */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita ONE</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  R$ {monthlyStats.network_commission.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Comissão mensal recebida
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resgates (Mês)</CardTitle>
                <Gift className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(() => {
                    const startOfThisMonth = startOfMonth(new Date());
                    return topPromotions.reduce((sum, promo) => sum + promo.total_redemptions, 0);
                  })()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total de resgates este mês
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  R$ {monthlyStats.active_members > 0 
                    ? (monthlyStats.monthly_revenue / monthlyStats.active_members).toFixed(2)
                    : '0.00'
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  Receita por membro
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa Engajamento</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {(() => {
                    const totalRedemptionsMonth = topPromotions.reduce((sum, promo) => sum + promo.total_redemptions, 0);
                    const rate = monthlyStats.active_members > 0 
                      ? ((totalRedemptionsMonth / monthlyStats.active_members) * 100)
                      : 0;
                    return rate.toFixed(1);
                  })()}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Membros que resgatam
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Análise de Viabilidade */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Análise de Viabilidade do Programa
              </CardTitle>
              <CardDescription>
                Avaliação do retorno sobre investimento das promoções ONE
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-white/50 dark:bg-black/20 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">💰 Receita Mensal</p>
                  <p className="text-xl font-bold text-green-600">
                    R$ {monthlyStats.network_commission.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {monthlyStats.active_members} membros x R$ {monthlyStats.active_members > 0 
                      ? (monthlyStats.monthly_revenue / monthlyStats.active_members).toFixed(2)
                      : '0'
                    }
                  </p>
                </div>

                <div className="p-4 bg-white/50 dark:bg-black/20 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">📊 Engajamento</p>
                  <p className="text-xl font-bold text-blue-600">
                    {(() => {
                      const totalRedemptionsMonth = topPromotions.reduce((sum, promo) => sum + promo.total_redemptions, 0);
                      const rate = monthlyStats.active_members > 0 
                        ? ((totalRedemptionsMonth / monthlyStats.active_members) * 100)
                        : 0;
                      return rate.toFixed(1);
                    })()}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Taxa de utilização das promoções
                  </p>
                </div>

                <div className="p-4 bg-white/50 dark:bg-black/20 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">✅ Status</p>
                  <p className="text-xl font-bold">
                    {(() => {
                      const engagementRate = monthlyStats.active_members > 0 
                        ? ((topPromotions.reduce((sum, promo) => sum + promo.total_redemptions, 0) / monthlyStats.active_members) * 100)
                        : 0;
                      
                      if (engagementRate >= 50) return <span className="text-green-600">🚀 Excelente</span>;
                      if (engagementRate >= 30) return <span className="text-blue-600">✓ Bom</span>;
                      if (engagementRate >= 15) return <span className="text-yellow-600">⚠ Regular</span>;
                      return <span className="text-red-600">❌ Atenção</span>;
                    })()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Desempenho do programa
                  </p>
                </div>
              </div>

              {/* Insights */}
              <div className="p-4 bg-white/50 dark:bg-black/20 rounded-lg space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-600" />
                  Insights e Recomendações
                </h4>
                <div className="space-y-2 text-sm">
                  {(() => {
                    const engagementRate = monthlyStats.active_members > 0 
                      ? ((topPromotions.reduce((sum, promo) => sum + promo.total_redemptions, 0) / monthlyStats.active_members) * 100)
                      : 0;
                    
                    const insights = [];
                    
                    if (engagementRate >= 50) {
                      insights.push("✅ Alta taxa de engajamento! Seus membros estão muito ativos nas promoções.");
                      insights.push("💡 Continue investindo em promoções exclusivas para manter esse patamar.");
                    } else if (engagementRate >= 30) {
                      insights.push("✓ Boa taxa de engajamento. O programa está funcionando bem.");
                      insights.push("💡 Considere criar promoções mais atrativas para aumentar a participação.");
                    } else if (engagementRate >= 15) {
                      insights.push("⚠ Taxa de engajamento regular. Há espaço para melhorias.");
                      insights.push("💡 Revise suas promoções e crie campanhas de comunicação mais efetivas.");
                    } else {
                      insights.push("❌ Baixo engajamento. É necessário repensar a estratégia.");
                      insights.push("💡 Fale com seus membros para entender o que eles gostariam de ver nas promoções.");
                    }

                    if (monthlyStats.active_members < 10) {
                      insights.push("📈 Foco em crescimento! Incentive mais clientes a assinarem o Leva+ One.");
                    }

                    if (monthlyStats.active_members >= 50) {
                      insights.push("🎯 Base sólida de membros! Ótimo momento para escalar as promoções.");
                    }

                    return insights.map((insight, i) => (
                      <p key={i} className="text-muted-foreground leading-relaxed">
                        {insight}
                      </p>
                    ));
                  })()}
                </div>
              </div>

              {/* Comparativo */}
              <div className="p-4 bg-white/50 dark:bg-black/20 rounded-lg">
                <h4 className="font-semibold mb-3">📊 Métricas de Desempenho</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Membros Ativos:</span>
                    <span className="font-bold">{monthlyStats.active_members}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Receita por Membro:</span>
                    <span className="font-bold text-green-600">
                      R$ {monthlyStats.active_members > 0 
                        ? (monthlyStats.monthly_revenue / monthlyStats.active_members).toFixed(2)
                        : '0.00'
                      }
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Resgates por Membro:</span>
                    <span className="font-bold text-blue-600">
                      {monthlyStats.active_members > 0 
                        ? (topPromotions.reduce((sum, promo) => sum + promo.total_redemptions, 0) / monthlyStats.active_members).toFixed(1)
                        : '0'
                      }x
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Promoções Ativas:</span>
                    <span className="font-bold">{topPromotions.length}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top 5 Promoções por ROI */}
          <Card>
            <CardHeader>
              <CardTitle>🏆 Top 5 Promoções por Engajamento</CardTitle>
              <CardDescription>
                Promoções com melhor taxa de conversão e participação
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topPromotions.length === 0 ? (
                <div className="text-center py-12">
                  <Gift className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    Nenhuma promoção resgatada ainda
                  </h3>
                  <p className="text-muted-foreground">
                    Quando clientes resgatarem promoções, as estatísticas aparecerão aqui.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ranking</TableHead>
                      <TableHead>Promoção</TableHead>
                      <TableHead>Total Resgates</TableHead>
                      <TableHead>Clientes Únicos</TableHead>
                      <TableHead>Taxa Conversão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topPromotions.map((promo, index) => (
                      <TableRow key={promo.id}>
                        <TableCell>
                          <Badge variant={index === 0 ? "default" : index === 1 ? "secondary" : "outline"}>
                            {index === 0 && "🥇"} {index === 1 && "🥈"} {index === 2 && "🥉"}
                            {index > 2 && `${index + 1}º`}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{promo.name}</TableCell>
                        <TableCell>
                          <span className="font-bold text-blue-600">{promo.total_redemptions}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-green-600">{promo.unique_clients}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={promo.conversion_rate >= 2 ? "default" : "secondary"}>
                            {promo.conversion_rate.toFixed(1)}x
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
