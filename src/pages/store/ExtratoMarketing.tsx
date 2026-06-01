import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageSquare, MessageCircle, Receipt, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfDay, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface NetworkPricing {
  email_marketing_limit?: number;
  email_marketing_price?: number;
  email_marketing_used?: number;
  whatsapp_marketing_limit?: number;
  whatsapp_marketing_price?: number;
  whatsapp_marketing_used?: number;
  sms_marketing_limit?: number;
  sms_marketing_price?: number;
  sms_marketing_used?: number;
}

interface Campaign {
  id: string;
  campaign_name: string;
  campaign_type: string;
  sent_count: number;
  created_at: string;
  status: string;
}

export default function ExtratoMarketing() {
  const [pricing, setPricing] = useState<NetworkPricing | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const { toast } = useToast();

  useEffect(() => {
    loadExtratoData();
  }, [dateFrom, dateTo]);

  const loadExtratoData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: manager, error: managerError } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .is("store_id", null)
        .single();

      if (managerError) throw managerError;

      // Buscar preços da rede
      const { data: networkData, error: networkError } = await supabase
        .from("networks")
        .select("email_marketing_limit, email_marketing_price, email_marketing_used, whatsapp_marketing_limit, whatsapp_marketing_price, whatsapp_marketing_used, sms_marketing_limit, sms_marketing_price, sms_marketing_used")
        .eq("id", manager.network_id)
        .single();

      if (networkError) throw networkError;
      setPricing(networkData);

      // Buscar campanhas com filtro de data
      const { data: campaignsData, error: campaignsError } = await supabase
        .from("marketing_campaigns")
        .select("id, campaign_name, campaign_type, sent_count, created_at, status")
        .eq("network_id", manager.network_id)
        .gte("created_at", startOfDay(dateFrom).toISOString())
        .lte("created_at", endOfDay(dateTo).toISOString())
        .order("created_at", { ascending: false });

      if (campaignsError) throw campaignsError;
      setCampaigns(campaignsData || []);

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

  const calculateCostPerDispatch = (type: string): number => {
    if (!pricing) return 0;
    
    switch (type) {
      case "email":
        return pricing.email_marketing_price || 0;
      case "whatsapp":
        return pricing.whatsapp_marketing_price || 0;
      case "sms":
        return pricing.sms_marketing_price || 0;
      default:
        return 0;
    }
  };

  const calculateCampaignCost = (campaign: Campaign): number => {
    const costPerDispatch = calculateCostPerDispatch(campaign.campaign_type);
    return costPerDispatch * campaign.sent_count;
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case "email":
        return <Mail className="h-4 w-4" />;
      case "whatsapp":
        return <MessageSquare className="h-4 w-4" />;
      case "sms":
        return <MessageCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getChannelName = (type: string) => {
    switch (type) {
      case "email":
        return "E-mail";
      case "whatsapp":
        return "WhatsApp";
      case "sms":
        return "SMS";
      default:
        return type;
    }
  };

  const filterCampaignsByType = (type: string) => {
    return campaigns.filter(c => c.campaign_type === type);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Extrato de Marketing</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Acompanhe o histórico e custos dos seus disparos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateFrom, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={(d) => d && setDateFrom(d)}
                initialFocus
                className="p-3 pointer-events-auto"
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          <span className="text-sm text-muted-foreground">até</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateTo, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={(d) => d && setDateTo(d)}
                initialFocus
                className="p-3 pointer-events-auto"
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Cards de custo por disparo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-5 w-5" />
              E-mail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <div className="text-2xl font-bold">
                  {pricing?.email_marketing_used || 0} / {pricing?.email_marketing_limit || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Disparos utilizados
                </p>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">Custo por disparo:</p>
                <p className="text-sm font-semibold">
                  {formatCurrency(calculateCostPerDispatch("email"))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-5 w-5" />
              WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <div className="text-2xl font-bold">
                  {pricing?.whatsapp_marketing_used || 0} / {pricing?.whatsapp_marketing_limit || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Disparos utilizados
                </p>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">Custo por disparo:</p>
                <p className="text-sm font-semibold">
                  {formatCurrency(calculateCostPerDispatch("whatsapp"))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-5 w-5" />
              SMS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <div className="text-2xl font-bold">
                  {pricing?.sms_marketing_used || 0} / {pricing?.sms_marketing_limit || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Disparos utilizados
                </p>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">Custo por disparo:</p>
                <p className="text-sm font-semibold">
                  {formatCurrency(calculateCostPerDispatch("sms"))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Histórico de disparos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Histórico de Disparos
          </CardTitle>
          <CardDescription>
            Últimos 50 disparos realizados com custos calculados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="email">E-mail</TabsTrigger>
              <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
              <TabsTrigger value="sms">SMS</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Canal</TableHead>
                      <TableHead>Nome da Campanha</TableHead>
                      <TableHead className="text-right">Enviados</TableHead>
                      <TableHead className="text-right">Custo Unitário</TableHead>
                      <TableHead className="text-right">Custo Total</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          Nenhum disparo realizado
                        </TableCell>
                      </TableRow>
                    ) : (
                      campaigns.map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getChannelIcon(campaign.campaign_type)}
                              {getChannelName(campaign.campaign_type)}
                            </div>
                          </TableCell>
                          <TableCell>{campaign.campaign_name}</TableCell>
                          <TableCell className="text-right">{campaign.sent_count}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(calculateCostPerDispatch(campaign.campaign_type))}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(calculateCampaignCost(campaign))}
                          </TableCell>
                          <TableCell>
                            {format(new Date(campaign.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={campaign.status === "completed" ? "default" : "secondary"}>
                              {campaign.status === "completed" ? "Concluído" : campaign.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="email" className="mt-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome da Campanha</TableHead>
                      <TableHead className="text-right">Enviados</TableHead>
                      <TableHead className="text-right">Custo Unitário</TableHead>
                      <TableHead className="text-right">Custo Total</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterCampaignsByType("email").length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Nenhum disparo de e-mail realizado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filterCampaignsByType("email").map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell>{campaign.campaign_name}</TableCell>
                          <TableCell className="text-right">{campaign.sent_count}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(calculateCostPerDispatch("email"))}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(calculateCampaignCost(campaign))}
                          </TableCell>
                          <TableCell>
                            {format(new Date(campaign.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={campaign.status === "completed" ? "default" : "secondary"}>
                              {campaign.status === "completed" ? "Concluído" : campaign.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="whatsapp" className="mt-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome da Campanha</TableHead>
                      <TableHead className="text-right">Enviados</TableHead>
                      <TableHead className="text-right">Custo Unitário</TableHead>
                      <TableHead className="text-right">Custo Total</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterCampaignsByType("whatsapp").length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Nenhum disparo de WhatsApp realizado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filterCampaignsByType("whatsapp").map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell>{campaign.campaign_name}</TableCell>
                          <TableCell className="text-right">{campaign.sent_count}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(calculateCostPerDispatch("whatsapp"))}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(calculateCampaignCost(campaign))}
                          </TableCell>
                          <TableCell>
                            {format(new Date(campaign.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={campaign.status === "completed" ? "default" : "secondary"}>
                              {campaign.status === "completed" ? "Concluído" : campaign.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="sms" className="mt-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome da Campanha</TableHead>
                      <TableHead className="text-right">Enviados</TableHead>
                      <TableHead className="text-right">Custo Unitário</TableHead>
                      <TableHead className="text-right">Custo Total</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterCampaignsByType("sms").length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Nenhum disparo de SMS realizado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filterCampaignsByType("sms").map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell>{campaign.campaign_name}</TableCell>
                          <TableCell className="text-right">{campaign.sent_count}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(calculateCostPerDispatch("sms"))}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(calculateCampaignCost(campaign))}
                          </TableCell>
                          <TableCell>
                            {format(new Date(campaign.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={campaign.status === "completed" ? "default" : "secondary"}>
                              {campaign.status === "completed" ? "Concluído" : campaign.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
