import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, startOfMonth, endOfMonth } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, TrendingUp, TrendingDown, Clock, Wallet, DollarSign, Shield, UserCheck, Star, ChevronLeft, ChevronRight, CreditCard, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Client {
  id: string;
  codigo: string | null;
  cpf: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  total_points: number;
  favorite_network_id: string | null;
  is_favorite_network?: boolean;
  is_one_member?: boolean;
  one_member_since?: string | null;
  one_card_number?: string | null;
}

interface ReferralInfo {
  referrer_cpf: string;
  referrer_name: string;
  bonus_amount: number;
  bonus_type: string;
  bonus_applied: boolean;
  created_at: string;
}

interface RetentionCommitment {
  commitment_months: number;
  multiplier_applied: number;
  expires_at: string;
  started_at: string;
}

interface Store {
  loyalty_type: string;
}

interface Transaction {
  id: string;
  amount: number;
  points: number;
  type: string;
  description: string | null;
  created_at: string;
  store_id: string;
  is_one_promotion?: boolean;
  stores: {
    name: string;
  } | null;
}

interface OneRedemption {
  id: string;
  redeemed_at: string;
  benefit_value: number;
  metadata: any;
  one_promotions: {
    name: string;
    promotion_type: string;
  };
  stores: {
    name: string;
  } | null;
}

interface NetworkBalance {
  network_id: string;
  network_name: string;
  total_points: number;
}

const ClienteDetalhes = () => {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [oneRedemptions, setOneRedemptions] = useState<OneRedemption[]>([]);
  const [networkBalances, setNetworkBalances] = useState<NetworkBalance[]>([]);
  const [loyaltyType, setLoyaltyType] = useState<string>("points");
  const [retentionCommitment, setRetentionCommitment] = useState<RetentionCommitment | null>(null);
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const itemsPerPage = 10;
  const [stats, setStats] = useState({
    totalEarned: 0,
    totalRedeemed: 0,
    avgEarnDays: 0,
    avgRedeemDays: 0,
    avgTicket: 0,
    visitCount: 0,
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    if (id) {
      loadClientData();
    }
  }, [id]);

  useEffect(() => {
    filterTransactions();
  }, [transactions, startDate, endDate]);

  const filterTransactions = () => {
    const filtered = transactions.filter(t => {
      const transDate = format(new Date(t.created_at), 'yyyy-MM-dd');
      return transDate >= startDate && transDate <= endDate;
    });
    setFilteredTransactions(filtered);
    setCurrentPage(1);
  };

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/levaloja/auth");
    }
  };

  const loadClientData = async () => {
    try {
      // Buscar network_id do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: managerData } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .is("store_id", null)
        .maybeSingle();

      if (!managerData) throw new Error("Network não encontrada");
      const userNetworkId = managerData.network_id;

      // Buscar loyalty_type da primeira loja da rede
      const { data: storeData } = await supabase
        .from("stores")
        .select("loyalty_type")
        .eq("network_id", userNetworkId)
        .limit(1)
        .maybeSingle();

      if (storeData) {
        setLoyaltyType(storeData.loyalty_type);
      }

      // Carregar dados do cliente
      const { data: clientData, error: clientError} = await supabase
        .from("clients")
        .select("id, codigo, cpf, full_name, email, phone, total_points, favorite_network_id, is_one_member, one_member_since")
        .eq("id", id)
        .single();

      if (clientError) throw clientError;

      // Buscar número do cartão ONE se for membro
      let oneCardNumber = null;
      if (clientData?.is_one_member) {
        const { data: cardData } = await supabase
          .from("one_card_numbers")
          .select("card_number")
          .eq("client_id", id)
          .maybeSingle();
        
        oneCardNumber = cardData?.card_number;
      }

      // Verifica se é rede favorita
      const isFavoriteNetwork = clientData.favorite_network_id === userNetworkId;
      
      setClient({
        ...clientData,
        is_favorite_network: isFavoriteNetwork,
        email: isFavoriteNetwork ? clientData.email : null,
        phone: isFavoriteNetwork ? clientData.phone : null,
        one_card_number: oneCardNumber,
      });

      // Carregar transações com informações da loja
      const { data: transData, error: transError } = await supabase
        .from("transactions")
        .select(`
          *,
          stores (
            name,
            network_id,
            networks (
              name
            )
          )
        `)
        .eq("client_id", id)
        .order("created_at", { ascending: false });

      if (transError) throw transError;
      setTransactions(transData || []);

      // Carregar resgates Leva+ One
      const { data: redemptionsData } = await supabase
        .from('one_promotion_redemptions')
        .select(`
          *,
          one_promotions!inner(name, promotion_type),
          stores(name)
        `)
        .eq('client_id', id)
        .order('redeemed_at', { ascending: false });

      setOneRedemptions((redemptionsData || []) as OneRedemption[]);

      // Calcular estatísticas
      calculateStats(transData || []);
      calculateNetworkBalances(transData || []);

      // Buscar compromisso ativo de retenção
      const { data: commitment } = await supabase
        .from("client_retention_commitments")
        .select("commitment_months, multiplier_applied, expires_at, started_at")
        .eq("client_id", id)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (commitment) {
        setRetentionCommitment(commitment);
      }

      // Buscar informações de indicação
      const { data: referralData } = await supabase
        .from("client_referrals")
        .select(`
          referrer_client_id,
          referrer_bonus_amount,
          referred_bonus_amount,
          bonus_type,
          bonus_applied,
          created_at
        `)
        .eq("referred_client_id", id)
        .maybeSingle();

      if (referralData && referralData.referrer_client_id) {
        // Buscar dados do cliente indicador
        const { data: referrerClient } = await supabase
          .from("clients")
          .select("cpf, full_name")
          .eq("id", referralData.referrer_client_id)
          .single();

        if (referrerClient) {
          setReferralInfo({
            referrer_cpf: referrerClient.cpf,
            referrer_name: referrerClient.full_name || "Cliente",
            bonus_amount: referralData.referred_bonus_amount,
            bonus_type: referralData.bonus_type,
            bonus_applied: referralData.bonus_applied,
            created_at: referralData.created_at,
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const calculateStats = (trans: Transaction[]) => {
    const earnTransactions = trans.filter((t) => t.type === "accumulation");
    const redeemTransactions = trans.filter((t) => t.type === "redemption");

    const totalEarned = earnTransactions.reduce((sum, t) => sum + Number(t.points), 0);
    const totalRedeemed = redeemTransactions.reduce((sum, t) => sum + Math.abs(Number(t.points)), 0);

    // Calcular ticket médio
    const visitCount = earnTransactions.length;
    const totalAmount = earnTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const avgTicket = visitCount > 0 ? totalAmount / visitCount : 0;

    // Calcular tempo médio entre acúmulos
    let avgEarnDays = 0;
    if (earnTransactions.length > 1) {
      const earnDiffs = earnTransactions
        .slice(0, -1)
        .map((t, i) => 
          differenceInDays(
            new Date(t.created_at),
            new Date(earnTransactions[i + 1].created_at)
          )
        );
      avgEarnDays = Math.round(
        earnDiffs.reduce((sum, days) => sum + days, 0) / earnDiffs.length
      );
    }

    // Calcular tempo médio entre resgates
    let avgRedeemDays = 0;
    if (redeemTransactions.length > 1) {
      const redeemDiffs = redeemTransactions
        .slice(0, -1)
        .map((t, i) =>
          differenceInDays(
            new Date(t.created_at),
            new Date(redeemTransactions[i + 1].created_at)
          )
        );
      avgRedeemDays = Math.round(
        redeemDiffs.reduce((sum, days) => sum + days, 0) / redeemDiffs.length
      );
    }

    setStats({
      totalEarned,
      totalRedeemed,
      avgEarnDays,
      avgRedeemDays,
      avgTicket,
      visitCount,
    });
  };

  const calculateNetworkBalances = (trans: Transaction[]) => {
    const balancesByNetwork: { [key: string]: { name: string; points: number } } = {};

    trans.forEach((t) => {
      const store = t.stores as any;
      if (store?.networks) {
        const networkId = store.network_id;
        const networkName = store.networks.name;

        if (!balancesByNetwork[networkId]) {
          balancesByNetwork[networkId] = { name: networkName, points: 0 };
        }

        if (t.type === "accumulation") {
          balancesByNetwork[networkId].points += Number(t.points);
        } else {
          balancesByNetwork[networkId].points -= Math.abs(Number(t.points));
        }
      }
    });

    const balances = Object.entries(balancesByNetwork).map(([networkId, data]) => ({
      network_id: networkId,
      network_name: data.name,
      total_points: data.points,
    }));

    setNetworkBalances(balances);
  };

  if (!client) {
    return (
      <div className="space-y-6">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {client && !client.is_favorite_network && (
        <div className="mb-6 bg-amber-500/10 px-4 py-3 rounded-lg border border-amber-500/20">
          <div className="flex items-start gap-2">
            <span className="text-xl">ℹ️</span>
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Acesso Limitado aos Dados
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Este cliente está vinculado a outra rede. Você pode visualizar apenas: Nome, CPF, Endereço e histórico de transações.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/levaloja/clientes")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{client.full_name}</h1>
            {client.is_one_member && (
              <Badge className="bg-yellow-500 text-white">
                <Star className="h-3 w-3 mr-1 fill-white" />
                Membro One
              </Badge>
            )}
            {client.is_favorite_network ? (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                ✓ Acesso Completo
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                🔒 Acesso Limitado
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {client.codigo} • CPF: {client.cpf}
            {client.is_favorite_network && client.email && ` • ${client.email}`}
            {client.is_favorite_network && client.phone && ` • ${client.phone}`}
          </p>
          {client.is_one_member && client.one_card_number && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-yellow-500" />
                <span className="text-muted-foreground">Cartão One:</span>
                <span className="font-mono font-medium">{client.one_card_number.replace(/(\d{4})(?=\d)/g, '$1 ')}</span>
              </div>
              {client.one_member_since && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-yellow-500" />
                  <span className="text-muted-foreground">Membro desde:</span>
                  <span className="font-medium">
                    {format(new Date(client.one_member_since), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card de Indicação */}
      {referralInfo && (
        <Card className="mb-6 border-blue-200/50 bg-gradient-to-br from-blue-50/30 to-blue-100/20 dark:border-blue-800/50 dark:from-blue-950/20 dark:to-blue-900/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Cliente Indicado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Indicado por</p>
                  <p className="text-base font-medium">{referralInfo.referrer_name}</p>
                  <p className="text-xs text-muted-foreground">CPF: {referralInfo.referrer_cpf}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bônus recebido</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {referralInfo.bonus_type === "cashback"
                      ? `R$ ${referralInfo.bonus_amount.toFixed(2)}`
                      : `${referralInfo.bonus_amount} pontos`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Data da indicação</p>
                <p className="text-sm font-medium">
                  {format(new Date(referralInfo.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
                <Badge variant={referralInfo.bonus_applied ? "default" : "secondary"} className="mt-2">
                  {referralInfo.bonus_applied ? "Bônus Aplicado" : "Bônus Pendente"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card de Retenção */}
      {retentionCommitment && (
        <Card className="mb-6 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Programa de Retenção Ativo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Plano</p>
                {retentionCommitment.commitment_months === 6 && (
                  <Badge variant="outline" className="mt-1 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                    <Shield className="h-3 w-3 mr-1" />
                    6 meses
                  </Badge>
                )}
                {retentionCommitment.commitment_months === 9 && (
                  <Badge variant="outline" className="mt-1 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800">
                    <Shield className="h-3 w-3 mr-1" />
                    9 meses
                  </Badge>
                )}
                {retentionCommitment.commitment_months === 12 && (
                  <Badge variant="outline" className="mt-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                    <Shield className="h-3 w-3 mr-1" />
                    12 meses
                  </Badge>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bônus Aplicado</p>
                <p className="text-lg font-bold text-primary mt-1">+{retentionCommitment.multiplier_applied}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Início</p>
                <p className="text-sm font-medium mt-1">
                  {format(new Date(retentionCommitment.started_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expira em</p>
                <p className="text-sm font-medium mt-1">
                  {format(new Date(retentionCommitment.expires_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ({differenceInDays(new Date(retentionCommitment.expires_at), new Date())} dias restantes)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Se não tem compromisso, mostrar badge padrão */}
      {!retentionCommitment && (
        <Card className="mb-6 border-red-200/50 bg-gradient-to-br from-red-50/30 to-red-100/20 dark:border-red-800/50 dark:from-red-950/20 dark:to-red-900/10">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
                <div>
                  <p className="text-sm font-medium">Plano Padrão</p>
                  <p className="text-xs text-muted-foreground">Cliente sem compromisso de retenção ativo</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
                Padrão
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loyaltyType === "cashback" 
                ? `R$ ${Number(client.total_points).toFixed(2)}`
                : `${client.total_points} pts`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Acumulado</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {loyaltyType === "cashback" 
                ? `R$ ${Number(stats.totalEarned).toFixed(2)}`
                : `${stats.totalEarned} pts`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Resgatado</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {loyaltyType === "cashback" 
                ? `R$ ${Number(stats.totalRedeemed).toFixed(2)}`
                : `${stats.totalRedeemed} pts`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              R$ {stats.avgTicket.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.visitCount} visitas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <p className="font-medium">Acúmulo: {stats.avgEarnDays || "-"} dias</p>
              <p className="font-medium">Resgate: {stats.avgRedeemDays || "-"} dias</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {networkBalances.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Saldo por Rede</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {networkBalances.map((balance) => (
                <div
                  key={balance.network_id}
                  className="flex justify-between items-center p-3 border rounded-lg"
                >
                  <span className="font-medium">{balance.network_name}</span>
                  <span className="text-lg font-bold">
                    {loyaltyType === "cashback" 
                      ? `R$ ${Number(balance.total_points).toFixed(2)}`
                      : `${balance.total_points} pts`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>Histórico do Cliente</CardTitle>
            {client?.is_one_member && (
              <Badge className="bg-yellow-500 text-white">
                <Star className="h-3 w-3 mr-1 fill-white" />
                Membro One
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="transactions" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="transactions">Transações Regulares</TabsTrigger>
              <TabsTrigger value="one-redemptions">Resgates Leva+ One</TabsTrigger>
            </TabsList>

            <TabsContent value="transactions" className="space-y-4">
              {/* Filtros de Período */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label>Data Inicial</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Final</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor da Venda</TableHead>
                    <TableHead className="text-right">
                      {loyaltyType === "cashback" ? "Cashback" : "Pontos"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {formatInTimeZone(new Date(transaction.created_at), "America/Sao_Paulo", "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          {transaction.type === "accumulation" ? (
                            <span className="text-green-600 font-medium">Acúmulo</span>
                          ) : (
                            <span className="text-orange-600 font-medium">Resgate</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {transaction.stores?.name || "-"}
                        </TableCell>
                        <TableCell>{transaction.description || "-"}</TableCell>
                        <TableCell className="text-right">
                          R$ {Number(transaction.amount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {transaction.type === "accumulation" ? "+" : "-"}
                          {loyaltyType === "cashback" 
                            ? `R$ ${Math.abs(Number(transaction.points)).toFixed(2)}`
                            : `${Math.abs(Number(transaction.points))} pts`}
                        </TableCell>
                      </TableRow>
                    ))}
                  {filteredTransactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhuma transação registrada no período
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Paginação */}
              {filteredTransactions.length > itemsPerPage && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, filteredTransactions.length)} a{" "}
                    {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} de {filteredTransactions.length} transações
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredTransactions.length / itemsPerPage), p + 1))}
                      disabled={currentPage >= Math.ceil(filteredTransactions.length / itemsPerPage)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="one-redemptions" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data do Resgate</TableHead>
                    <TableHead>Promoção</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead className="text-right">Benefício</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {oneRedemptions.map((redemption) => (
                    <TableRow key={redemption.id}>
                      <TableCell>
                        {formatInTimeZone(new Date(redemption.redeemed_at), "America/Sao_Paulo", "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {redemption.one_promotions.name}
                      </TableCell>
                      <TableCell>
                        {redemption.one_promotions.promotion_type === 'buy_x_get_y' && (
                          <Badge className="bg-green-500 text-white">Leve + Pague -</Badge>
                        )}
                        {redemption.one_promotions.promotion_type === 'percentage' && (
                          <Badge className="bg-blue-500 text-white">Desconto %</Badge>
                        )}
                        {redemption.one_promotions.promotion_type === 'combo' && (
                          <Badge className="bg-purple-500 text-white">Combo</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {redemption.stores?.name || "-"}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        R$ {Number(redemption.benefit_value || 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {oneRedemptions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhum resgate Leva+ One realizado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClienteDetalhes;
