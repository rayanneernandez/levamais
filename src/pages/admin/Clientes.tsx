import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Search, Eye, Users, CheckCircle, Star, CreditCard, Calendar, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Client {
  id: string;
  codigo: string;
  full_name: string;
  cpf: string;
  email: string | null;
  phone: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  address_country: string;
  network_id: string | null;
  favorite_network_id: string | null;
  favorite_network_changed_at: string | null;
  is_validated: boolean;
  email_validated: boolean;
  total_points: number;
  created_at: string;
  user_id: string | null;
  is_one_member?: boolean;
  one_member_since?: string | null;
  one_card_number?: string | null;
  network?: {
    name: string;
  };
  favorite_network?: {
    name: string;
  };
}

interface NetworkRecord {
  id: string;
  codigo: string;
  network_id: string;
  total_points: number;
  created_at: string;
  network: {
    name: string;
  };
}

interface OneSubscription {
  id: string;
  status: string;
  monthly_value: number;
  start_date: string;
  asaas_subscription_id: string;
  created_at: string;
  network: {
    name: string;
  };
}

interface AsaasCharge {
  id: string;
  asaas_charge_id: string;
  subscription_id: string | null;
  amount: number;
  status: string;
  due_date: string;
  payment_date: string | null;
  payment_method: string | null;
  created_at: string;
}

export default function AdminClientes() {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientNetworkRecords, setClientNetworkRecords] = useState<NetworkRecord[]>([]);
  const [clientSubscriptions, setClientSubscriptions] = useState<OneSubscription[]>([]);
  const [subscriptionCharges, setSubscriptionCharges] = useState<AsaasCharge[]>([]);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = clients.filter(client =>
        client.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.cpf?.includes(searchTerm) ||
        client.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients(clients);
    }
  }, [searchTerm, clients]);

  // Conta quantas vezes cada CPF aparece (em quantas redes está)
  const cpfNetworkCount = useMemo(() => {
    const count: Record<string, number> = {};
    clients.forEach(client => {
      if (client.cpf) {
        count[client.cpf] = (count[client.cpf] || 0) + 1;
      }
    });
    return count;
  }, [clients]);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select(`
          *,
          network:networks!clients_network_id_fkey(name),
          favorite_network:networks!clients_favorite_network_id_fkey(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClients(data || []);
      setFilteredClients(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar clientes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewClient = async (client: Client) => {
    setSelectedClient(client);
    setIsViewDialogOpen(true);
    
    // Buscar número do cartão ONE se for membro
    if (client.is_one_member) {
      const { data: cardData } = await supabase
        .from("one_card_numbers")
        .select("card_number")
        .eq("client_id", client.id)
        .maybeSingle();
      
      if (cardData) {
        setSelectedClient({ ...client, one_card_number: cardData.card_number });
      }
    }
    
    // Buscar todos os registros desse CPF em diferentes redes
    try {
      const { data, error } = await supabase
        .from("clients")
        .select(`
          id,
          codigo,
          network_id,
          total_points,
          created_at,
          network:networks!clients_network_id_fkey(name)
        `)
        .eq("cpf", client.cpf)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setClientNetworkRecords(data || []);
    } catch (error: any) {
      console.error("Erro ao buscar registros de rede:", error);
      setClientNetworkRecords([]);
    }

    // Buscar assinaturas ONE do cliente
    try {
      const { data: subscriptions, error: subError } = await supabase
        .from("client_subscriptions_one")
        .select(`
          id,
          status,
          monthly_value,
          start_date,
          asaas_subscription_id,
          created_at,
          network:networks(name)
        `)
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });

      if (subError) throw subError;
      setClientSubscriptions(subscriptions || []);

      // Se houver assinaturas, buscar as cobranças
      if (subscriptions && subscriptions.length > 0) {
        const subscriptionIds = subscriptions.map(s => s.id);
        
        const { data: charges, error: chargesError } = await supabase
          .from("asaas_charges")
          .select("*")
          .in("subscription_id", subscriptionIds)
          .order("created_at", { ascending: false });

        if (chargesError) throw chargesError;
        setSubscriptionCharges(charges || []);
      } else {
        setSubscriptionCharges([]);
      }
    } catch (error: any) {
      console.error("Erro ao buscar assinaturas:", error);
      setClientSubscriptions([]);
      setSubscriptionCharges([]);
    }
  };

  const canChangeFavoriteNetwork = (client: Client) => {
    if (!client.favorite_network_changed_at) return true;
    
    const lastChange = new Date(client.favorite_network_changed_at);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysDiff >= 90;
  };

  const getDaysUntilCanChange = (client: Client) => {
    if (!client.favorite_network_changed_at) return 0;
    
    const lastChange = new Date(client.favorite_network_changed_at);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24));
    
    return Math.max(0, 90 - daysDiff);
  };

  const formatAddress = (client: Client) => {
    const parts = [
      client.address_street,
      client.address_number,
      client.address_neighborhood,
      client.address_city,
      client.address_state,
      client.address_zip,
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(", ") : "Não informado";
  };

  const handleValidateClient = async (clientId: string) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ is_validated: true })
        .eq('id', clientId);

      if (error) throw error;

      toast({
        title: "Cliente validado!",
        description: "O cliente foi validado manualmente com sucesso.",
      });

      loadClients();
      setIsViewDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao validar cliente",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSendInvite = async (client: Client) => {
    if (!client.email) {
      toast({
        title: "Email necessário",
        description: "Este cliente não possui email cadastrado. Por favor, adicione um email antes de enviar o convite.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('send-client-invite', {
        body: {
          clientId: client.id,
          email: client.email
        }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao enviar convite');
      }

      toast({
        title: "Convite enviado!",
        description: `Um email foi enviado para ${client.email} com instruções para criar a senha.`,
      });

      loadClients();
    } catch (error: any) {
      toast({
        title: "Erro ao enviar convite",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleGenerateCardNumbers = async () => {
    setIsGeneratingCards(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-missing-card-numbers');

      if (error) throw error;

      toast({
        title: "Cartões gerados!",
        description: `${data.success} cartões gerados com sucesso. ${data.failed > 0 ? `${data.failed} falharam.` : ''}`,
      });

      if (data.errors && data.errors.length > 0) {
        console.error('Erros na geração:', data.errors);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao gerar cartões",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingCards(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">Todos os clientes cadastrados no sistema</p>
        </div>
        <Button
          onClick={handleGenerateCardNumbers}
          disabled={isGeneratingCards}
          variant="outline"
        >
          {isGeneratingCards ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Gerando cartões...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Gerar Cartões ONE Faltantes
            </>
          )}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Validados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clients.filter(c => c.is_validated).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes de Validação</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clients.filter(c => !c.is_validated).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Buscar Clientes</CardTitle>
          <CardDescription>
            Busque por nome, CPF, código ou email
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>
            Visualize todos os clientes cadastrados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Rede Cadastro</TableHead>
                  <TableHead>Rede Favorita</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Acesso App</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-mono text-sm">
                        {client.codigo || "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {client.full_name}
                      </TableCell>
                       <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{client.cpf}</span>
                          {cpfNetworkCount[client.cpf] > 1 && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              <Users className="h-3 w-3 mr-1" />
                              {cpfNetworkCount[client.cpf]} redes
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {client.network?.name || "Não definida"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {client.favorite_network?.name || "Não definida"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={client.is_validated ? "default" : "destructive"}>
                          {client.is_validated ? "Validado" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {client.user_id && client.email_validated ? (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Ativo
                          </Badge>
                        ) : client.user_id && !client.email_validated ? (
                          <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                            Aguardando
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(client.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {client.email && (!client.user_id || (client.user_id && !client.email_validated)) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendInvite(client)}
                              title={client.user_id ? "Reenviar convite" : "Enviar convite para criar senha"}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewClient(client)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Client Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Cliente</DialogTitle>
            <DialogDescription>
              Informações completas do cliente (visão administrativa)
            </DialogDescription>
          </DialogHeader>

          {selectedClient && (
            <div className="space-y-6">
              {/* Dados Pessoais */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Dados Pessoais</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Código
                    </label>
                    <p className="font-mono">{selectedClient.codigo || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Nome Completo
                    </label>
                    <p>{selectedClient.full_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      CPF
                    </label>
                    <p>{selectedClient.cpf}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Email
                    </label>
                    <p>{selectedClient.email || "Não informado"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Telefone
                    </label>
                    <p>{selectedClient.phone || "Não informado"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Status
                    </label>
                    <div>
                      <Badge variant={selectedClient.is_validated ? "default" : "destructive"}>
                        {selectedClient.is_validated ? "Validado" : "Pendente de Validação"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cartão Leva+ One */}
              {selectedClient.is_one_member && (
                <div className="space-y-4 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    <h3 className="text-lg font-semibold">Membro Leva+ One</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedClient.one_card_number && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Número do Cartão
                        </label>
                        <p className="font-mono font-semibold text-lg">
                          {selectedClient.one_card_number.replace(/(\d{4})(?=\d)/g, '$1 ')}
                        </p>
                      </div>
                    )}
                    {selectedClient.one_member_since && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Membro desde
                        </label>
                        <p className="font-medium">
                          {new Date(selectedClient.one_member_since).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    )}
                    {selectedClient.favorite_network && (
                      <div className="col-span-2">
                        <label className="text-sm font-medium text-muted-foreground">
                          Rede Favorita
                        </label>
                        <p className="font-medium">
                          {selectedClient.favorite_network.name}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Endereço */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Endereço</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Endereço Completo
                    </label>
                    <p>{formatAddress(selectedClient)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      País
                    </label>
                    <p>{selectedClient.address_country}</p>
                  </div>
                </div>
              </div>

              {/* Informações de Rede */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Redes Associadas</h3>
                
                {clientNetworkRecords.length > 0 && (
                  <div className="space-y-3">
                    {clientNetworkRecords.map((record) => (
                      <Card key={record.id} className={record.network_id === selectedClient.favorite_network_id ? "border-primary" : ""}>
                        <CardContent className="pt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">
                                Rede
                              </label>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant={record.network_id === selectedClient.favorite_network_id ? "default" : "outline"}>
                                  {record.network.name}
                                </Badge>
                                {record.network_id === selectedClient.favorite_network_id && (
                                  <Badge variant="secondary" className="text-xs">
                                    Favorita ⭐
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">
                                Código
                              </label>
                              <p className="font-mono mt-1">{record.codigo}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">
                                Saldo
                              </label>
                              <p className="font-semibold text-lg mt-1">
                                R$ {Number(record.total_points).toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">
                                Data de Associação
                              </label>
                              <p className="mt-1">
                                {new Date(record.created_at).toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Status de Troca de Rede Favorita
                    </label>
                    <div className="mt-2">
                      {canChangeFavoriteNetwork(selectedClient) ? (
                        <Badge variant="default">Pode trocar agora</Badge>
                      ) : (
                        <Badge variant="destructive">
                          Pode trocar em {getDaysUntilCanChange(selectedClient)} dias
                        </Badge>
                      )}
                    </div>
                  </div>
                  {selectedClient.favorite_network_changed_at && (
                    <div className="mt-4">
                      <label className="text-sm font-medium text-muted-foreground">
                        Última Troca de Rede Favorita
                      </label>
                      <p className="mt-1">
                        {new Date(selectedClient.favorite_network_changed_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Datas */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Datas</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Data de Cadastro
                    </label>
                    <p>
                      {new Date(selectedClient.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Informações Importantes */}
              <div className="rounded-lg bg-muted p-4">
                <h4 className="font-semibold mb-2">Regra de Visibilidade de Dados</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• A <strong>Rede Favorita</strong> ({selectedClient.favorite_network?.name || "não definida"}) tem acesso completo aos dados do cliente</li>
                  <li>• Outras redes veem apenas: Nome, CPF e Endereço</li>
                  <li>• Outras redes NÃO veem: Email e Telefone</li>
                  <li>• Cliente pode trocar de rede favorita a cada 90 dias</li>
                </ul>
              </div>

              {/* Assinaturas Leva+ One */}
              {clientSubscriptions.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    Assinaturas Leva+ One
                  </h3>
                  
                  <div className="space-y-3">
                    {clientSubscriptions.map((subscription) => (
                      <Card key={subscription.id} className="border-yellow-200">
                        <CardContent className="pt-4">
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">
                                  Status
                                </label>
                                <div className="mt-1">
                                  <Badge
                                    variant={
                                      subscription.status === 'active' ? 'default' :
                                      subscription.status === 'pending' ? 'secondary' :
                                      'destructive'
                                    }
                                  >
                                    {subscription.status === 'active' ? 'Ativo' :
                                     subscription.status === 'pending' ? 'Pendente' :
                                     subscription.status === 'suspended' ? 'Suspenso' : 'Cancelado'}
                                  </Badge>
                                </div>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">
                                  Mensalidade
                                </label>
                                <p className="font-semibold text-lg mt-1">
                                  R$ {Number(subscription.monthly_value).toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">
                                  Rede
                                </label>
                                <p className="mt-1">{subscription.network?.name || "N/A"}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">
                                  Início
                                </label>
                                <p className="mt-1">
                                  {new Date(subscription.start_date).toLocaleDateString("pt-BR")}
                                </p>
                              </div>
                              <div className="col-span-2">
                                <label className="text-sm font-medium text-muted-foreground">
                                  ID Asaas
                                </label>
                                <p className="font-mono text-xs mt-1">
                                  {subscription.asaas_subscription_id}
                                </p>
                              </div>
                            </div>

                            {/* Cobranças da Assinatura */}
                            {subscriptionCharges.filter(c => c.subscription_id === subscription.id).length > 0 && (
                              <div className="border-t pt-4 mt-4">
                                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                  <CreditCard className="h-4 w-4" />
                                  Histórico de Cobranças
                                </h4>
                                <div className="space-y-2">
                                  {subscriptionCharges
                                    .filter(c => c.subscription_id === subscription.id)
                                    .map((charge) => (
                                      <div 
                                        key={charge.id} 
                                        className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm"
                                      >
                                        <div className="flex items-center gap-4">
                                          <div>
                                            <p className="font-medium">
                                              R$ {Number(charge.amount).toFixed(2)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              Venc: {new Date(charge.due_date).toLocaleDateString("pt-BR")}
                                            </p>
                                          </div>
                                          <Badge
                                            variant={
                                              charge.status === 'confirmed' || charge.status === 'received' ? 'default' :
                                              charge.status === 'pending' ? 'secondary' :
                                              'destructive'
                                            }
                                            className="text-xs"
                                          >
                                            {charge.status === 'confirmed' || charge.status === 'received' ? 'Pago' :
                                             charge.status === 'pending' ? 'Pendente' :
                                             charge.status === 'overdue' ? 'Vencido' : charge.status}
                                          </Badge>
                                        </div>
                                        <div className="text-right">
                                          {charge.payment_date && (
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                              <Calendar className="h-3 w-3" />
                                              Pago: {new Date(charge.payment_date).toLocaleDateString("pt-BR")}
                                            </p>
                                          )}
                                          {charge.payment_method && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                              {charge.payment_method}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Botão de Validação Manual */}
              {!selectedClient.is_validated && (
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={() => handleValidateClient(selectedClient.id)}
                    className="gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Validar Cliente Manualmente
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
