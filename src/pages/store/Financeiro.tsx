import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, AlertCircle, CheckCircle2, Clock, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Charge {
  id: string;
  asaas_charge_id: string;
  amount: number;
  status: string;
  due_date: string;
  payment_date: string | null;
  payment_method: string | null;
  billing_type: string;
  bank_slip_url: string | null;
  invoice_url: string | null;
  pix_qrcode: string | null;
  description: string | null;
  created_at: string;
  charge_type: string;
}

export default function Financeiro() {
  const [isLoading, setIsLoading] = useState(true);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadNetworkData();
  }, []);

  const loadNetworkData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: managerData } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!managerData?.network_id) return;

      setNetworkId(managerData.network_id);
      await loadCharges(managerData.network_id);
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

  const loadCharges = async (networkId: string) => {
    try {
      const { data, error } = await supabase
        .from("asaas_charges")
        .select("*")
        .eq("network_id", networkId)
        .order("due_date", { ascending: false });

      if (error) throw error;

      setCharges(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar cobranças:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as cobranças.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      PENDING: { label: "Pendente", variant: "secondary" },
      RECEIVED: { label: "Pago", variant: "default" },
      CONFIRMED: { label: "Confirmado", variant: "default" },
      OVERDUE: { label: "Vencido", variant: "destructive" },
      REFUNDED: { label: "Estornado", variant: "outline" },
    };

    const config = statusConfig[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "RECEIVED":
      case "CONFIRMED":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "OVERDUE":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const filterCharges = (type: "all" | "pending" | "paid" | "overdue") => {
    if (type === "all") return charges;
    if (type === "pending") return charges.filter(c => c.status === "PENDING");
    if (type === "paid") return charges.filter(c => c.status === "RECEIVED" || c.status === "CONFIRMED");
    if (type === "overdue") return charges.filter(c => c.status === "OVERDUE");
    return charges;
  };

  const getTotalAmount = (charges: Charge[]) => {
    return charges.reduce((sum, charge) => sum + Number(charge.amount), 0);
  };

  const pendingCharges = filterCharges("pending");
  const paidCharges = filterCharges("paid");
  const overdueCharges = filterCharges("overdue");

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie seus boletos, notas fiscais e pagamentos
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total em Aberto</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getTotalAmount(pendingCharges))}
              </div>
              <p className="text-xs text-muted-foreground">
                {pendingCharges.length} cobrança(s) pendente(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pagos este mês</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getTotalAmount(paidCharges))}
              </div>
              <p className="text-xs text-muted-foreground">
                {paidCharges.length} pagamento(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getTotalAmount(overdueCharges))}
              </div>
              <p className="text-xs text-muted-foreground">
                {overdueCharges.length} cobrança(s) vencida(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Cobranças</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{charges.length}</div>
              <p className="text-xs text-muted-foreground">
                Todas as cobranças
              </p>
            </CardContent>
          </Card>
      </div>

      {/* Tabela de cobranças */}
      <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">Todas ({charges.length})</TabsTrigger>
            <TabsTrigger value="pending">Pendentes ({pendingCharges.length})</TabsTrigger>
            <TabsTrigger value="paid">Pagas ({paidCharges.length})</TabsTrigger>
            <TabsTrigger value="overdue">Vencidas ({overdueCharges.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <ChargesTable charges={charges} getStatusBadge={getStatusBadge} getStatusIcon={getStatusIcon} />
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            <ChargesTable charges={pendingCharges} getStatusBadge={getStatusBadge} getStatusIcon={getStatusIcon} />
          </TabsContent>

          <TabsContent value="paid" className="space-y-4">
            <ChargesTable charges={paidCharges} getStatusBadge={getStatusBadge} getStatusIcon={getStatusIcon} />
          </TabsContent>

        <TabsContent value="overdue" className="space-y-4">
          <ChargesTable charges={overdueCharges} getStatusBadge={getStatusBadge} getStatusIcon={getStatusIcon} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ChargesTableProps {
  charges: Charge[];
  getStatusBadge: (status: string) => JSX.Element;
  getStatusIcon: (status: string) => JSX.Element;
}

function ChargesTable({ charges, getStatusBadge, getStatusIcon }: ChargesTableProps) {
  if (charges.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma cobrança encontrada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {charges.map((charge) => (
              <TableRow key={charge.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(charge.status)}
                    {getStatusBadge(charge.status)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{charge.description || "Cobrança"}</div>
                  <div className="text-sm text-muted-foreground">#{charge.asaas_charge_id}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {charge.charge_type === "implementation" ? "Implantação" : "Mensalidade"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {format(new Date(charge.due_date), "dd/MM/yyyy", { locale: ptBR })}
                </TableCell>
                <TableCell className="font-medium">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(charge.amount))}
                </TableCell>
                <TableCell>
                  {charge.payment_date ? (
                    <div className="text-sm">
                      <div>{format(new Date(charge.payment_date), "dd/MM/yyyy", { locale: ptBR })}</div>
                      <div className="text-muted-foreground">{charge.payment_method || "-"}</div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {charge.bank_slip_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(charge.bank_slip_url!, '_blank')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Boleto
                      </Button>
                    )}
                    {charge.invoice_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(charge.invoice_url!, '_blank')}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Nota Fiscal
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
