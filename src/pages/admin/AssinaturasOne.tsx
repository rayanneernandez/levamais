import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Search, DollarSign, Calendar, CreditCard, Ban, CheckCircle, XCircle, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Subscription {
  id: string;
  client_id: string;
  network_id: string;
  status: string;
  monthly_value: number;
  asaas_subscription_id: string;
  asaas_customer_id: string;
  start_date: string;
  cancelled_at: string | null;
  created_at: string;
  clients: {
    full_name: string;
    email: string;
    phone: string;
    cpf: string;
  };
  networks: {
    name: string;
  };
}

interface Charge {
  id: string;
  asaas_charge_id: string;
  subscription_id: string;
  amount: number;
  status: string;
  due_date: string;
  payment_date: string | null;
  confirmed_at: string | null;
  payment_method: string | null;
  billing_type: string;
  bank_slip_url: string | null;
  pix_qrcode: string | null;
  created_at: string;
}

export default function AssinaturasOne() {
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<Subscription[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [showChargesDialog, setShowChargesDialog] = useState(false);
  const [isLoadingCharges, setIsLoadingCharges] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSubscriptions();
  }, []);

  useEffect(() => {
    filterSubscriptions();
  }, [searchTerm, subscriptions]);

  const loadSubscriptions = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("client_subscriptions_one")
        .select(`
          *,
          clients!inner(
            full_name,
            email,
            phone,
            cpf
          ),
          networks!inner(
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setSubscriptions(data || []);
      setFilteredSubscriptions(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar assinaturas:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as assinaturas.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterSubscriptions = () => {
    if (!searchTerm.trim()) {
      setFilteredSubscriptions(subscriptions);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = subscriptions.filter(
      (sub) =>
        sub.clients.full_name.toLowerCase().includes(term) ||
        sub.clients.email.toLowerCase().includes(term) ||
        sub.networks.name.toLowerCase().includes(term) ||
        sub.asaas_subscription_id.toLowerCase().includes(term)
    );
    setFilteredSubscriptions(filtered);
  };

  const loadCharges = async (subscriptionId: string) => {
    setIsLoadingCharges(true);
    try {
      const { data, error } = await (supabase as any)
        .from("asaas_charges")
        .select("*")
        .eq("subscription_id", subscriptionId)
        .eq("charge_type", "one_subscription")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setCharges(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar cobranças:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o histórico de cobranças.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCharges(false);
    }
  };

  const handleViewCharges = async (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    setShowChargesDialog(true);
    await loadCharges(subscription.id);
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    if (!confirm("Tem certeza que deseja cancelar esta assinatura?")) return;

    try {
      const { error } = await (supabase as any).functions.invoke("cancel-one-subscription", {
        body: { 
          subscription_id: subscriptionId,
          is_admin_cancellation: true 
        },
      });

      if (error) throw error;

      toast({
        title: "Assinatura cancelada",
        description: "A assinatura foi cancelada com sucesso.",
      });

      await loadSubscriptions();
    } catch (error: any) {
      console.error("Erro ao cancelar assinatura:", error);
      toast({
        title: "Erro",
        description: "Não foi possível cancelar a assinatura.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
      active: { label: "Ativo", className: "bg-green-500", icon: CheckCircle },
      suspended: { label: "Suspenso", className: "bg-yellow-500", icon: Ban },
      cancelled: { label: "Cancelado", className: "bg-red-500", icon: XCircle },
    };
    const config = statusConfig[status] || { label: status, className: "bg-gray-500", icon: Star };
    const Icon = config.icon;
    return (
      <Badge className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      pending: { label: "Pendente", className: "bg-yellow-500" },
      received: { label: "Pago", className: "bg-green-500" },
      confirmed: { label: "Confirmado", className: "bg-blue-500" },
      overdue: { label: "Vencido", className: "bg-red-500" },
      refunded: { label: "Reembolsado", className: "bg-gray-500" },
    };
    const config = statusConfig[status] || { label: status, className: "bg-gray-500" };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter((s) => s.status === "active").length,
    suspended: subscriptions.filter((s) => s.status === "suspended").length,
    cancelled: subscriptions.filter((s) => s.status === "cancelled").length,
    revenue: subscriptions
      .filter((s) => s.status === "active")
      .reduce((sum, s) => sum + s.monthly_value, 0),
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Assinaturas ONE</h1>
          <p className="text-muted-foreground mt-1">
            Gerenciamento completo de membros Leva+ One
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-4">
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
          Gestão de Assinaturas ONE
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerenciamento completo de membros Leva+ One e histórico de pagamentos
        </p>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assinaturas</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Todas as assinaturas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Pagamentos em dia</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspensos/Cancelados</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.suspended + stats.cancelled}
            </div>
            <p className="text-xs text-muted-foreground">Inativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {stats.revenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Assinaturas ativas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Pesquisar Assinaturas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email, rede ou ID da assinatura..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Assinaturas */}
      <Card>
        <CardHeader>
          <CardTitle>Todas as Assinaturas</CardTitle>
          <CardDescription>
            {filteredSubscriptions.length} assinatura(s) encontrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Rede</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assinatura Desde</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Nenhuma assinatura encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredSubscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.clients.full_name}</TableCell>
                    <TableCell>{sub.networks.name}</TableCell>
                    <TableCell>{sub.clients.email}</TableCell>
                    <TableCell>
                      <span className="font-bold text-green-600">
                        R$ {sub.monthly_value.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(sub.status)}</TableCell>
                    <TableCell>
                      {format(new Date(sub.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewCharges(sub)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Histórico
                        </Button>
                        {(sub.status === "active" || sub.status === "pending_payment" || sub.status === "pending") && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleCancelSubscription(sub.id)}
                          >
                            <Ban className="h-4 w-4 mr-1" />
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Histórico de Cobranças */}
      <Dialog open={showChargesDialog} onOpenChange={setShowChargesDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Cobranças</DialogTitle>
            <DialogDescription>
              {selectedSubscription?.clients.full_name} - {selectedSubscription?.networks.name}
            </DialogDescription>
          </DialogHeader>

          {isLoadingCharges ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : charges.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma cobrança encontrada</h3>
              <p className="text-muted-foreground">
                O histórico de cobranças aparecerá aqui quando houver registros.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {charges.map((charge) => (
                <Card key={charge.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-bold text-lg">R$ {charge.amount.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">
                          ID: {charge.asaas_charge_id}
                        </p>
                      </div>
                      {getPaymentStatusBadge(charge.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Criada em:</p>
                        <p className="font-medium">
                          {format(new Date(charge.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Vencimento:</p>
                        <p className="font-medium">
                          {format(new Date(charge.due_date), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      {charge.confirmed_at && (
                        <div>
                          <p className="text-muted-foreground">Confirmada em:</p>
                          <p className="font-medium">
                            {format(new Date(charge.confirmed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      )}
                      {charge.payment_date && (
                        <div>
                          <p className="text-muted-foreground">Pagamento:</p>
                          <p className="font-medium">
                            {format(new Date(charge.payment_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      )}
                      {charge.payment_method && (
                        <div>
                          <p className="text-muted-foreground">Método:</p>
                          <p className="font-medium">{charge.payment_method}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-muted-foreground">Tipo:</p>
                        <p className="font-medium">{charge.billing_type}</p>
                      </div>
                    </div>
                    {(charge.bank_slip_url || charge.pix_qrcode) && (
                      <div className="mt-4 pt-4 border-t flex gap-2">
                        {charge.bank_slip_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(charge.bank_slip_url!, "_blank")}
                          >
                            Ver Boleto
                          </Button>
                        )}
                        {charge.pix_qrcode && (
                          <Button size="sm" variant="outline">
                            Ver QR Code PIX
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
