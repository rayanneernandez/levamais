import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Download, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface Charge {
  id: string;
  asaas_charge_id: string;
  network_id: string;
  subscription_id: string;
  amount: number;
  due_date: string;
  payment_date: string | null;
  status: string;
  billing_type: string;
  description: string;
  created_at: string;
  network?: {
    name: string;
  };
  subscription?: {
    client_id: string;
    clients?: {
      full_name: string;
      cpf: string;
    };
  };
}

export default function AssinaturasPagamentos() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [filteredCharges, setFilteredCharges] = useState<Charge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();

  useEffect(() => {
    loadCharges();
  }, []);

  useEffect(() => {
    filterCharges();
  }, [charges, searchTerm, statusFilter]);

  const loadCharges = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('asaas_charges')
        .select('*')
        .eq('charge_type', 'subscription')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar dados relacionados
      if (data && data.length > 0) {
        const networksIds = [...new Set(data.map(c => c.network_id))];
        const subscriptionsIds = [...new Set(data.map(c => c.subscription_id).filter(Boolean))];

        const { data: networks } = await supabase
          .from('networks')
          .select('id, name')
          .in('id', networksIds);

        const { data: subscriptions } = await supabase
          .from('client_subscriptions_one')
          .select('id, client_id')
          .in('id', subscriptionsIds);

        const clientsIds = [...new Set(subscriptions?.map(s => s.client_id).filter(Boolean) || [])];
        const { data: clients } = await supabase
          .from('clients')
          .select('id, full_name, cpf')
          .in('id', clientsIds);

        // Combinar dados
        const enrichedCharges = data.map(charge => {
          const network = networks?.find(n => n.id === charge.network_id);
          const subscription = subscriptions?.find(s => s.id === charge.subscription_id);
          const client = clients?.find(c => c.id === subscription?.client_id);

          return {
            ...charge,
            network,
            subscription: subscription ? {
              ...subscription,
              clients: client
            } : undefined
          };
        });

        setCharges(enrichedCharges as any);
      } else {
        setCharges([]);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar cobranças",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterCharges = () => {
    let filtered = charges;

    if (statusFilter !== "all") {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(c => 
        c.network?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.subscription?.clients?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.subscription?.clients?.cpf?.includes(searchTerm)
      );
    }

    setFilteredCharges(filtered);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
      'PENDING': { label: 'Em Processamento', variant: 'secondary', className: 'bg-amber-100 text-amber-800 border-amber-200' },
      'CONFIRMED': { label: 'Confirmado', variant: 'default' },
      'RECEIVED': { label: 'Recebido', variant: 'default' },
      'OVERDUE': { label: 'Vencido', variant: 'destructive' },
      'REFUNDED': { label: 'Reembolsado', variant: 'outline' },
      'REFUND_REQUESTED': { label: 'Reembolso Solicitado', variant: 'outline' },
      'CHARGEBACK_REQUESTED': { label: 'Estorno Solicitado', variant: 'destructive' },
      'CHARGEBACK_DISPUTE': { label: 'Em Disputa', variant: 'destructive' },
      'AWAITING_CHARGEBACK_REVERSAL': { label: 'Aguardando Reversão', variant: 'secondary' },
    };

    const config = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const exportToCSV = () => {
    const csvData = filteredCharges.map(c => ({
      'Rede': c.network?.name || '-',
      'Cliente': c.subscription?.clients?.full_name || '-',
      'CPF': c.subscription?.clients?.cpf || '-',
      'Valor': `R$ ${c.amount.toFixed(2)}`,
      'Vencimento': format(new Date(c.due_date), 'dd/MM/yyyy'),
      'Pagamento': c.payment_date ? format(new Date(c.payment_date), 'dd/MM/yyyy') : '-',
      'Status': c.status,
      'Tipo': c.billing_type,
      'Descrição': c.description
    }));

    const headers = Object.keys(csvData[0]);
    const csv = [
      headers.join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assinaturas-pagamentos-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const stats = {
    total: filteredCharges.length,
    pending: filteredCharges.filter(c => c.status === 'PENDING').length,
    confirmed: filteredCharges.filter(c => c.status === 'CONFIRMED' || c.status === 'RECEIVED').length,
    overdue: filteredCharges.filter(c => c.status === 'OVERDUE').length,
    totalValue: filteredCharges.reduce((sum, c) => sum + c.amount, 0),
    receivedValue: filteredCharges.filter(c => c.status === 'CONFIRMED' || c.status === 'RECEIVED').reduce((sum, c) => sum + c.amount, 0)
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Assinaturas & Pagamentos</h1>
          <p className="text-muted-foreground">Gestão de cobranças Leva+ One via Asaas</p>
        </div>
        <Button onClick={loadCharges} variant="outline" size="icon">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <p className="text-xs text-muted-foreground">Total de Cobranças</p>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <p className="text-xs text-muted-foreground">Pendentes</p>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
          <p className="text-xs text-muted-foreground">Confirmados</p>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
          <p className="text-xs text-muted-foreground">Vencidos</p>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">R$ {stats.totalValue.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Valor Total</p>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">R$ {stats.receivedValue.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Recebido</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por rede, cliente ou CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="PENDING">Pendentes</SelectItem>
              <SelectItem value="CONFIRMED">Confirmados</SelectItem>
              <SelectItem value="RECEIVED">Recebidos</SelectItem>
              <SelectItem value="OVERDUE">Vencidos</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rede</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tipo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCharges.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Nenhuma cobrança encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredCharges.map((charge) => (
                <TableRow key={charge.id}>
                  <TableCell className="font-medium">{charge.network?.name || '-'}</TableCell>
                  <TableCell>{charge.subscription?.clients?.full_name || '-'}</TableCell>
                  <TableCell className="font-mono text-sm">{charge.subscription?.clients?.cpf || '-'}</TableCell>
                  <TableCell className="font-bold">R$ {charge.amount.toFixed(2)}</TableCell>
                  <TableCell>{format(new Date(charge.due_date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    {charge.payment_date ? format(new Date(charge.payment_date), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(charge.status)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{charge.billing_type}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
