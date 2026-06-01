import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Calendar, ArrowRight, Users, TrendingUp, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Transfer {
  id: string;
  client_id: string;
  from_network_id: string;
  to_network_id: string;
  scheduled_for: string;
  status: string;
  requested_at: string;
  processed_at: string | null;
  client: {
    full_name: string;
    cpf: string;
  };
  from_network: {
    name: string;
  };
  to_network: {
    name: string;
  };
}

interface NetworkOption {
  id: string;
  name: string;
}

const TransferenciasRede = () => {
  const { toast } = useToast();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [filteredTransfers, setFilteredTransfers] = useState<Transfer[]>([]);
  const [networks, setNetworks] = useState<NetworkOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [networkFilter, setNetworkFilter] = useState<string>("all");

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processed: 0,
    cancelled: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [transfers, searchTerm, statusFilter, networkFilter]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Carregar transferências
      const { data: transfersData, error: transfersError } = await supabase
        .from("pending_network_transfers")
        .select(`
          *,
          client:clients!pending_network_transfers_client_id_fkey(full_name, cpf),
          from_network:networks!pending_network_transfers_from_network_id_fkey(name),
          to_network:networks!pending_network_transfers_to_network_id_fkey(name)
        `)
        .order("requested_at", { ascending: false });

      if (transfersError) throw transfersError;

      setTransfers(transfersData || []);

      // Calcular estatísticas
      const pending = transfersData?.filter(t => t.status === "pending").length || 0;
      const processed = transfersData?.filter(t => t.status === "processed").length || 0;
      const cancelled = transfersData?.filter(t => t.status === "cancelled").length || 0;

      setStats({
        total: transfersData?.length || 0,
        pending,
        processed,
        cancelled
      });

      // Carregar redes para filtro
      const { data: networksData, error: networksError } = await supabase
        .from("networks")
        .select("id, name")
        .eq("status", "active")
        .order("name");

      if (networksError) throw networksError;
      setNetworks(networksData || []);

    } catch (error: any) {
      toast({
        title: "Erro ao carregar transferências",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...transfers];

    // Filtro de busca (nome do cliente ou CPF)
    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.client.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.client.cpf.includes(searchTerm)
      );
    }

    // Filtro de status
    if (statusFilter !== "all") {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    // Filtro de rede (origem ou destino)
    if (networkFilter !== "all") {
      filtered = filtered.filter(t =>
        t.from_network_id === networkFilter || t.to_network_id === networkFilter
      );
    }

    setFilteredTransfers(filtered);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "destructive" | "secondary" | "outline", label: string }> = {
      pending: { variant: "default", label: "Agendada" },
      processed: { variant: "secondary", label: "Processada" },
      cancelled: { variant: "destructive", label: "Cancelada" }
    };

    const config = variants[status] || { variant: "outline", label: status };

    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Transferências de Rede</h1>
        <p className="text-muted-foreground">
          Acompanhe e gerencie as transferências de rede favorita dos clientes
        </p>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">transferências</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agendadas</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">aguardando processamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processadas</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.processed}</div>
            <p className="text-xs text-muted-foreground">concluídas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Canceladas</CardTitle>
            <ArrowRight className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.cancelled}</div>
            <p className="text-xs text-muted-foreground">canceladas pelo cliente</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <CardTitle>Filtros</CardTitle>
          </div>
          <CardDescription>Filtre as transferências por critérios específicos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar Cliente</label>
              <Input
                placeholder="Nome ou CPF do cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Agendadas</SelectItem>
                  <SelectItem value="processed">Processadas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Rede</label>
              <Select value={networkFilter} onValueChange={setNetworkFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as redes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as redes</SelectItem>
                  {networks.map(network => (
                    <SelectItem key={network.id} value={network.id}>
                      {network.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Transferências */}
      <Card>
        <CardHeader>
          <CardTitle>Transferências ({filteredTransfers.length})</CardTitle>
          <CardDescription>
            Histórico completo de transferências de rede favorita
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTransfers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhuma transferência encontrada</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Rede Origem</TableHead>
                    <TableHead>Rede Destino</TableHead>
                    <TableHead>Agendada Para</TableHead>
                    <TableHead>Solicitada Em</TableHead>
                    <TableHead>Processada Em</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransfers.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell className="font-medium">
                        {transfer.client.full_name}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {transfer.client.cpf}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {transfer.from_network.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="outline">
                            {transfer.to_network.name}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(transfer.scheduled_for), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(transfer.requested_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {transfer.processed_at
                          ? format(new Date(transfer.processed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "-"
                        }
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(transfer.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TransferenciasRede;
