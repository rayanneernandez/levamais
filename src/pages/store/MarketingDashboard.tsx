import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageSquare, MessageCircle, Users, TrendingUp, BarChart3, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface NetworkData {
  email_marketing_limit: number;
  email_marketing_used: number;
  whatsapp_marketing_limit: number;
  whatsapp_marketing_used: number;
  sms_marketing_limit: number;
  sms_marketing_used: number;
}

interface CampaignStats {
  total_campaigns: number;
  email_campaigns: number;
  whatsapp_campaigns: number;
  sms_campaigns: number;
  notification_campaigns: number;
  total_sent: number;
  email_sent: number;
  whatsapp_sent: number;
  sms_sent: number;
  notification_sent: number;
  notification_reads: number;
}

export default function MarketingDashboard() {
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [clientsCount, setClientsCount] = useState(0);
  const [campaignStats, setCampaignStats] = useState<CampaignStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Obter user_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Obter network_id do usuário
      const { data: manager, error: managerError } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .is("store_id", null)
        .single();

      if (managerError) throw managerError;

      // Buscar dados da rede
      const { data: network, error: networkError } = await supabase
        .from("networks")
        .select("email_marketing_limit, email_marketing_used, whatsapp_marketing_limit, whatsapp_marketing_used, sms_marketing_limit, sms_marketing_used")
        .eq("id", manager.network_id)
        .single();

      if (networkError) throw networkError;
      setNetworkData(network);

      // Contar clientes da rede
      const { count: clientCount, error: clientError } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("network_id", manager.network_id);

      if (clientError) throw clientError;
      setClientsCount(clientCount || 0);

      // Buscar estatísticas de campanhas
      const { data: campaigns, error: campaignError } = await supabase
        .from("marketing_campaigns")
        .select("*")
        .eq("network_id", manager.network_id);

      if (campaignError) throw campaignError;

      // Buscar estatísticas de notificações
      const { data: notifications, error: notificationError } = await supabase
        .from("client_notifications")
        .select("*")
        .eq("network_id", manager.network_id);

      if (notificationError) throw notificationError;

      const stats: CampaignStats = {
        total_campaigns: (campaigns?.length || 0) + (notifications?.length || 0),
        email_campaigns: campaigns?.filter(c => c.campaign_type === "email").length || 0,
        whatsapp_campaigns: campaigns?.filter(c => c.campaign_type === "whatsapp").length || 0,
        sms_campaigns: campaigns?.filter(c => c.campaign_type === "sms").length || 0,
        notification_campaigns: notifications?.length || 0,
        total_sent: (campaigns?.reduce((acc, c) => acc + (c.sent_count || 0), 0) || 0) + (notifications?.reduce((acc, n) => acc + (n.sent_count || 0), 0) || 0),
        email_sent: campaigns?.filter(c => c.campaign_type === "email").reduce((acc, c) => acc + (c.sent_count || 0), 0) || 0,
        whatsapp_sent: campaigns?.filter(c => c.campaign_type === "whatsapp").reduce((acc, c) => acc + (c.sent_count || 0), 0) || 0,
        sms_sent: campaigns?.filter(c => c.campaign_type === "sms").reduce((acc, c) => acc + (c.sent_count || 0), 0) || 0,
        notification_sent: notifications?.reduce((acc, n) => acc + (n.sent_count || 0), 0) || 0,
        notification_reads: notifications?.reduce((acc, n) => acc + (n.read_count || 0), 0) || 0,
      };
      setCampaignStats(stats);

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

  const emailPercentage = networkData?.email_marketing_limit 
    ? (networkData.email_marketing_used / networkData.email_marketing_limit) * 100 
    : 0;
    
  const whatsappPercentage = networkData?.whatsapp_marketing_limit 
    ? (networkData.whatsapp_marketing_used / networkData.whatsapp_marketing_limit) * 100 
    : 0;

  const smsPercentage = networkData?.sms_marketing_limit 
    ? (networkData.sms_marketing_used / networkData.sms_marketing_limit) * 100 
    : 0;

  const chartData = [
    { name: "E-mail", campanhas: campaignStats?.email_campaigns || 0, enviados: campaignStats?.email_sent || 0 },
    { name: "WhatsApp", campanhas: campaignStats?.whatsapp_campaigns || 0, enviados: campaignStats?.whatsapp_sent || 0 },
    { name: "SMS", campanhas: campaignStats?.sms_campaigns || 0, enviados: campaignStats?.sms_sent || 0 },
    { name: "Notificações", campanhas: campaignStats?.notification_campaigns || 0, enviados: campaignStats?.notification_sent || 0 },
  ];

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketing Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Acompanhe suas campanhas e disparos de marketing
        </p>
      </div>

      {/* Cards de métricas principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Cadastrados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientsCount}</div>
            <p className="text-xs text-muted-foreground">
              Base total de clientes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Campanhas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaignStats?.total_campaigns || 0}</div>
            <p className="text-xs text-muted-foreground">
              Campanhas criadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">E-mails Enviados</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaignStats?.email_sent || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total de envios por e-mail
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WhatsApp Enviados</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaignStats?.whatsapp_sent || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total de envios por WhatsApp
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SMS Enviados</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaignStats?.sms_sent || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total de envios por SMS
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notificações Enviadas</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaignStats?.notification_sent || 0}</div>
            <p className="text-xs text-muted-foreground">
              {campaignStats?.notification_reads || 0} leituras ({campaignStats?.notification_sent ? ((campaignStats.notification_reads / campaignStats.notification_sent) * 100).toFixed(1) : 0}%)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cards de uso de créditos */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Créditos de E-mail
              </span>
              {networkData?.email_marketing_limit === 0 ? (
                <Badge variant="secondary">Sem pacote</Badge>
              ) : (
                <Badge variant={emailPercentage >= 90 ? "destructive" : "default"}>
                  {emailPercentage >= 90 ? "Atenção" : "Ativo"}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Uso do pacote de e-mails marketing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {networkData?.email_marketing_limit === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <p>Nenhum pacote de e-mail contratado</p>
                <p className="text-xs mt-2">Entre em contato para adquirir um pacote</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Usados</span>
                  <span className="font-medium">
                    {networkData?.email_marketing_used || 0} / {networkData?.email_marketing_limit || 0}
                  </span>
                </div>
                <Progress value={emailPercentage} className="h-2" />
                <div className="text-xs text-muted-foreground">
                  {networkData?.email_marketing_limit && networkData.email_marketing_used 
                    ? `${networkData.email_marketing_limit - networkData.email_marketing_used} créditos disponíveis`
                    : `${networkData?.email_marketing_limit || 0} créditos disponíveis`
                  }
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Créditos de WhatsApp
              </span>
              {networkData?.whatsapp_marketing_limit === 0 ? (
                <Badge variant="secondary">Sem pacote</Badge>
              ) : (
                <Badge variant={whatsappPercentage >= 90 ? "destructive" : "default"}>
                  {whatsappPercentage >= 90 ? "Atenção" : "Ativo"}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Uso do pacote de disparos WhatsApp</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {networkData?.whatsapp_marketing_limit === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <p>Nenhum pacote de WhatsApp contratado</p>
                <p className="text-xs mt-2">Entre em contato para adquirir um pacote</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Usados</span>
                  <span className="font-medium">
                    {networkData?.whatsapp_marketing_used || 0} / {networkData?.whatsapp_marketing_limit || 0}
                  </span>
                </div>
                <Progress value={whatsappPercentage} className="h-2" />
                <div className="text-xs text-muted-foreground">
                  {networkData?.whatsapp_marketing_limit && networkData.whatsapp_marketing_used 
                    ? `${networkData.whatsapp_marketing_limit - networkData.whatsapp_marketing_used} créditos disponíveis`
                    : `${networkData?.whatsapp_marketing_limit || 0} créditos disponíveis`
                  }
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Créditos de SMS
              </span>
              {networkData?.sms_marketing_limit === 0 ? (
                <Badge variant="secondary">Sem pacote</Badge>
              ) : (
                <Badge variant={smsPercentage >= 90 ? "destructive" : "default"}>
                  {smsPercentage >= 90 ? "Atenção" : "Ativo"}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Uso do pacote de disparos SMS</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {networkData?.sms_marketing_limit === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <p>Nenhum pacote de SMS contratado</p>
                <p className="text-xs mt-2">Entre em contato para adquirir um pacote</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Usados</span>
                  <span className="font-medium">
                    {networkData?.sms_marketing_used || 0} / {networkData?.sms_marketing_limit || 0}
                  </span>
                </div>
                <Progress value={smsPercentage} className="h-2" />
                <div className="text-xs text-muted-foreground">
                  {networkData?.sms_marketing_limit && networkData.sms_marketing_used 
                    ? `${networkData.sms_marketing_limit - networkData.sms_marketing_used} créditos disponíveis`
                    : `${networkData?.sms_marketing_limit || 0} créditos disponíveis`
                  }
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de campanhas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Estatísticas de Campanhas
          </CardTitle>
          <CardDescription>Comparativo de campanhas e envios por canal</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="campanhas" fill="hsl(var(--primary))" name="Campanhas" />
              <Bar dataKey="enviados" fill="hsl(var(--accent))" name="Enviados" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
