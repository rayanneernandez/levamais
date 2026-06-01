import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Download, FileText, AlertCircle, CheckCircle2, Clock, DollarSign, Edit, Trash2, Search, AlertTriangle, Calendar, Ban } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Charge {
  id: string;
  asaas_charge_id: string;
  network_id: string;
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
  is_penalty: boolean;
  penalty_percentage: number | null;
  networks: {
    name: string;
    contract_end_date: string | null;
    cancellation_penalty_percentage: number;
  };
}

interface Network {
  id: string;
  name: string;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_status: string;
  monthly_fee: number;
  cancellation_penalty_percentage: number;
}

export default function FinanceiroAdmin() {
  const [isLoading, setIsLoading] = useState(true);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [filteredCharges, setFilteredCharges] = useState<Charge[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingCharge, setEditingCharge] = useState<Charge | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ due_date: "", amount: "" });
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelingNetwork, setCancelingNetwork] = useState<Network | null>(null);
  const [penaltyPercentage, setPenaltyPercentage] = useState<string>("50");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadCharges();
  }, []);

  useEffect(() => {
    filterCharges();
  }, [searchTerm, statusFilter, charges]);

  const loadCharges = async () => {
    try {
      const { data, error } = await supabase
        .from("asaas_charges")
        .select(`
          *,
          networks (
            name,
            contract_end_date,
            cancellation_penalty_percentage
          )
        `)
        .order("due_date", { ascending: false });

      if (error) throw error;

      setCharges(data || []);
      setFilteredCharges(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar cobranças:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as cobranças.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterCharges = () => {
    let filtered = charges;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(charge =>
        charge.networks?.name.toLowerCase().includes(term) ||
        charge.asaas_charge_id.toLowerCase().includes(term) ||
        charge.description?.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(charge => charge.status === statusFilter);
    }

    setFilteredCharges(filtered);
  };

  const handleEditCharge = (charge: Charge) => {
    setEditingCharge(charge);
    setEditForm({
      due_date: charge.due_date,
      amount: charge.amount.toString(),
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingCharge) return;

    try {
      setIsProcessing(true);

      // Atualizar no Asaas primeiro
      const { data: asaasConfig } = await supabase
        .from("asaas_config")
        .select("*")
        .eq("is_active", true)
        .single();

      if (!asaasConfig) throw new Error("Configuração Asaas não encontrada");

      const asaasApiKey = asaasConfig.is_sandbox 
        ? asaasConfig.api_key_sandbox 
        : asaasConfig.api_key_production;
      
      const asaasUrl = asaasConfig.is_sandbox
        ? "https://sandbox.asaas.com/api/v3"
        : "https://www.asaas.com/api/v3";

      const updateData: any = {};
      if (editForm.due_date !== editingCharge.due_date) {
        updateData.dueDate = editForm.due_date;
      }
      if (parseFloat(editForm.amount) !== editingCharge.amount) {
        updateData.value = parseFloat(editForm.amount);
      }

      const updateResponse = await fetch(`${asaasUrl}/payments/${editingCharge.asaas_charge_id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": asaasApiKey,
        },
        body: JSON.stringify(updateData),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(`Erro ao atualizar no Asaas: ${JSON.stringify(errorData)}`);
      }

      // Atualizar localmente
      const { error } = await supabase
        .from("asaas_charges")
        .update({
          due_date: editForm.due_date,
          amount: parseFloat(editForm.amount),
        })
        .eq("id", editingCharge.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Cobrança atualizada com sucesso.",
      });

      setIsEditDialogOpen(false);
      loadCharges();
    } catch (error: any) {
      console.error("Erro ao atualizar cobrança:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar a cobrança.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelCharge = async (chargeId: string, asaasChargeId: string) => {
    if (!confirm("Tem certeza que deseja cancelar esta cobrança?")) return;

    try {
      setIsProcessing(true);

      // Cancelar no Asaas
      const { data: asaasConfig } = await supabase
        .from("asaas_config")
        .select("*")
        .eq("is_active", true)
        .single();

      if (!asaasConfig) throw new Error("Configuração Asaas não encontrada");

      const asaasApiKey = asaasConfig.is_sandbox 
        ? asaasConfig.api_key_sandbox 
        : asaasConfig.api_key_production;
      
      const asaasUrl = asaasConfig.is_sandbox
        ? "https://sandbox.asaas.com/api/v3"
        : "https://www.asaas.com/api/v3";

      const cancelResponse = await fetch(`${asaasUrl}/payments/${asaasChargeId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "access_token": asaasApiKey,
        },
      });

      if (!cancelResponse.ok) {
        const errorData = await cancelResponse.json();
        throw new Error(`Erro ao cancelar no Asaas: ${JSON.stringify(errorData)}`);
      }

      // Atualizar status localmente
      const { error } = await supabase
        .from("asaas_charges")
        .update({ status: "REFUNDED" })
        .eq("id", chargeId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Cobrança cancelada com sucesso.",
      });

      loadCharges();
    } catch (error: any) {
      console.error("Erro ao cancelar cobrança:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível cancelar a cobrança.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelContract = async (network: Network) => {
    setCancelingNetwork(network);
    setPenaltyPercentage(network.cancellation_penalty_percentage?.toString() || "50");
    setIsCancelDialogOpen(true);
  };

  const calculatePenalty = () => {
    if (!cancelingNetwork || !cancelingNetwork.contract_end_date) return 0;

    const today = new Date();
    const contractEnd = new Date(cancelingNetwork.contract_end_date);
    const monthsRemaining = Math.ceil((contractEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    const remainingValue = cancelingNetwork.monthly_fee * monthsRemaining;
    const penaltyValue = (remainingValue * parseFloat(penaltyPercentage)) / 100;
    
    return penaltyValue;
  };

  const handleConfirmCancelContract = async () => {
    if (!cancelingNetwork) return;

    try {
      setIsProcessing(true);

      const penaltyValue = calculatePenalty();

      const { data, error } = await supabase.functions.invoke('cancel-network-contract', {
        body: {
          network_id: cancelingNetwork.id,
          penalty_percentage: parseFloat(penaltyPercentage),
          penalty_amount: penaltyValue,
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Contrato cancelado. Multa de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(penaltyValue)} gerada.`,
      });

      setIsCancelDialogOpen(false);
      loadCharges();
    } catch (error: any) {
      console.error("Erro ao cancelar contrato:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível cancelar o contrato.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      PENDING: { label: "Pendente", variant: "secondary" },
      RECEIVED: { label: "Pago", variant: "default" },
      CONFIRMED: { label: "Confirmado", variant: "default" },
      OVERDUE: { label: "Vencido", variant: "destructive" },
      REFUNDED: { label: "Cancelado", variant: "outline" },
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

  const getTotalAmount = (charges: Charge[]) => {
    return charges.reduce((sum, charge) => sum + Number(charge.amount), 0);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="container mx-auto p-6 space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  const pendingCharges = filteredCharges.filter(c => c.status === "PENDING");
  const paidCharges = filteredCharges.filter(c => c.status === "RECEIVED" || c.status === "CONFIRMED");
  const overdueCharges = filteredCharges.filter(c => c.status === "OVERDUE");
  const penaltyCharges = filteredCharges.filter(c => c.is_penalty);

  return (
    <AdminLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financeiro - Gestão de Cobranças</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie todas as cobranças, vencimentos e contratos
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
              <CardTitle className="text-sm font-medium">Multas Rescisórias</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getTotalAmount(penaltyCharges))}
              </div>
              <p className="text-xs text-muted-foreground">
                {penaltyCharges.length} multa(s)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por rede, código Asaas ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PENDING">Pendentes</SelectItem>
              <SelectItem value="RECEIVED">Pagos</SelectItem>
              <SelectItem value="CONFIRMED">Confirmados</SelectItem>
              <SelectItem value="OVERDUE">Vencidos</SelectItem>
              <SelectItem value="REFUNDED">Cancelados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabela de cobranças */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">Todas ({filteredCharges.length})</TabsTrigger>
            <TabsTrigger value="pending">Pendentes ({pendingCharges.length})</TabsTrigger>
            <TabsTrigger value="paid">Pagas ({paidCharges.length})</TabsTrigger>
            <TabsTrigger value="overdue">Vencidas ({overdueCharges.length})</TabsTrigger>
            <TabsTrigger value="penalty">Multas ({penaltyCharges.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <ChargesTable 
              charges={filteredCharges} 
              getStatusBadge={getStatusBadge} 
              getStatusIcon={getStatusIcon}
              onEdit={handleEditCharge}
              onCancel={handleCancelCharge}
              isProcessing={isProcessing}
            />
          </TabsContent>

          <TabsContent value="pending">
            <ChargesTable 
              charges={pendingCharges} 
              getStatusBadge={getStatusBadge} 
              getStatusIcon={getStatusIcon}
              onEdit={handleEditCharge}
              onCancel={handleCancelCharge}
              isProcessing={isProcessing}
            />
          </TabsContent>

          <TabsContent value="paid">
            <ChargesTable 
              charges={paidCharges} 
              getStatusBadge={getStatusBadge} 
              getStatusIcon={getStatusIcon}
              onEdit={handleEditCharge}
              onCancel={handleCancelCharge}
              isProcessing={isProcessing}
            />
          </TabsContent>

          <TabsContent value="overdue">
            <ChargesTable 
              charges={overdueCharges} 
              getStatusBadge={getStatusBadge} 
              getStatusIcon={getStatusIcon}
              onEdit={handleEditCharge}
              onCancel={handleCancelCharge}
              isProcessing={isProcessing}
            />
          </TabsContent>

          <TabsContent value="penalty">
            <ChargesTable 
              charges={penaltyCharges} 
              getStatusBadge={getStatusBadge} 
              getStatusIcon={getStatusIcon}
              onEdit={handleEditCharge}
              onCancel={handleCancelCharge}
              isProcessing={isProcessing}
            />
          </TabsContent>
        </Tabs>

        {/* Dialog de edição */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Cobrança</DialogTitle>
              <DialogDescription>
                Atualize o vencimento ou valor da cobrança
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Data de Vencimento</Label>
                <Input
                  type="date"
                  value={editForm.due_date}
                  onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Valor</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} disabled={isProcessing}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de cancelamento de contrato */}
        <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancelar Contrato</DialogTitle>
              <DialogDescription>
                Gerar boleto de multa rescisória
              </DialogDescription>
            </DialogHeader>
            {cancelingNetwork && (
              <div className="space-y-4">
                <div>
                  <Label>Rede</Label>
                  <p className="text-sm font-medium">{cancelingNetwork.name}</p>
                </div>
                <div>
                  <Label>Término do Contrato</Label>
                  <p className="text-sm">
                    {cancelingNetwork.contract_end_date 
                      ? format(new Date(cancelingNetwork.contract_end_date), "dd/MM/yyyy", { locale: ptBR })
                      : "Não definido"}
                  </p>
                </div>
                <div>
                  <Label>Percentual da Multa (%)</Label>
                  <Input
                    type="number"
                    value={penaltyPercentage}
                    onChange={(e) => setPenaltyPercentage(e.target.value)}
                  />
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Valor da Multa Calculada:</p>
                  <p className="text-2xl font-bold text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatePenalty())}
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleConfirmCancelContract} disabled={isProcessing}>
                Confirmar Cancelamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

interface ChargesTableProps {
  charges: Charge[];
  getStatusBadge: (status: string) => JSX.Element;
  getStatusIcon: (status: string) => JSX.Element;
  onEdit: (charge: Charge) => void;
  onCancel: (chargeId: string, asaasChargeId: string) => void;
  isProcessing: boolean;
}

function ChargesTable({ charges, getStatusBadge, getStatusIcon, onEdit, onCancel, isProcessing }: ChargesTableProps) {
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
              <TableHead>Rede</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
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
                  <div className="font-medium">{charge.networks?.name}</div>
                  <div className="text-sm text-muted-foreground">#{charge.asaas_charge_id}</div>
                </TableCell>
                <TableCell>
                  {charge.is_penalty ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Multa {charge.penalty_percentage}%
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      {charge.charge_type === "implementation" ? "Implantação" : "Mensalidade"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="max-w-xs truncate">{charge.description || "-"}</div>
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
                    {charge.status === "PENDING" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(charge)}
                          disabled={isProcessing}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onCancel(charge.id, charge.asaas_charge_id)}
                          disabled={isProcessing}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
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
                        NF
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
