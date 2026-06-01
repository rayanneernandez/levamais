import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Loader2, DollarSign, Search, Users, Store, TrendingUp, UserX, Mail, Settings } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ResellerExtractDialog } from "@/components/admin/ResellerExtractDialog";
import { ResellerCommissionRulesDialog } from "@/components/admin/ResellerCommissionRulesDialog";

interface Reseller {
  id: string;
  company_name: string;
  cnpj: string;
  razao_social: string;
  owner_name: string;
  phone: string;
  email: string;
  financial_contact_name: string | null;
  financial_contact_email: string | null;
  financial_contact_phone: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  is_active: boolean;
  created_at: string;
}

const Revendas = () => {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState<{ id: string; name: string } | null>(null);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [associatedClients, setAssociatedClients] = useState(0);
  const [canceledClients, setCanceledClients] = useState(0);
  const [newClientsThisMonth, setNewClientsThisMonth] = useState(0);
  const [newClientsLastMonth, setNewClientsLastMonth] = useState(0);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    company_name: "",
    cnpj: "",
    razao_social: "",
    owner_name: "",
    phone: "",
    email: "",
    financial_contact_name: "",
    financial_contact_email: "",
    financial_contact_phone: "",
    address_street: "",
    address_number: "",
    address_complement: "",
    address_neighborhood: "",
    address_city: "",
    address_state: "",
    address_zip: "",
    is_active: true,
  });

  useEffect(() => {
    fetchResellers();
    loadClientsStats();
  }, []);

  const fetchResellers = async () => {
    try {
      const { data, error } = await supabase
        .from("resellers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setResellers(data || []);
    } catch (error) {
      console.error("Erro ao buscar revendas:", error);
      toast({
        title: "Erro ao carregar revendas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCNPJData = async (cnpj: string) => {
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    if (cleanCNPJ.length !== 14) {
      toast({
        title: "CNPJ inválido",
        description: "O CNPJ deve conter 14 dígitos",
        variant: "destructive",
      });
      return;
    }

    setCnpjLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('buscar-cnpj', {
        body: { cnpj: cleanCNPJ }
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: "CNPJ não encontrado",
          description: "CNPJ não encontrado na base da Receita Federal. Preencha os dados manualmente.",
          variant: "destructive",
        });
        return;
      }

      setFormData(prev => ({
        ...prev,
        razao_social: data.razao_social || "",
        address_street: data.logradouro || "",
        address_number: data.numero || "",
        address_complement: data.complemento || "",
        address_neighborhood: data.bairro || "",
        address_city: data.municipio || "",
        address_state: data.uf || "",
        address_zip: data.cep || "",
      }));

      toast({
        title: "Dados do CNPJ carregados com sucesso",
      });
    } catch (error) {
      console.error('Erro ao buscar CNPJ:', error);
      toast({
        title: "Erro ao consultar CNPJ",
        description: "Não foi possível consultar o CNPJ. Preencha os dados manualmente.",
        variant: "destructive",
      });
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingReseller) {
        const { error } = await supabase
          .from("resellers")
          .update(formData)
          .eq("id", editingReseller.id);

        if (error) throw error;

        toast({
          title: "Revenda atualizada com sucesso",
        });
      } else {
        const { data, error } = await supabase
          .from("resellers")
          .insert([formData])
          .select();

        if (error) throw error;

        // Enviar email de boas-vindas para nova revenda
        try {
          const { error: emailError } = await supabase.functions.invoke('send-reseller-welcome', {
            body: { resellerId: data[0].id }
          });

          if (emailError) {
            console.error('Erro ao enviar email de boas-vindas:', emailError);
            toast({
              title: "Revenda cadastrada com sucesso",
              description: "Porém houve um erro ao enviar o email de boas-vindas",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Revenda cadastrada com sucesso",
              description: "Um email com as credenciais foi enviado para " + formData.email,
            });
          }
        } catch (emailError) {
          console.error('Erro ao enviar email:', emailError);
          toast({
            title: "Revenda cadastrada com sucesso",
            description: "Porém houve um erro ao enviar o email de boas-vindas",
            variant: "destructive",
          });
        }
      }

      setDialogOpen(false);
      resetForm();
      fetchResellers();
    } catch (error: any) {
      console.error("Erro ao salvar revenda:", error);
      toast({
        title: "Erro ao salvar revenda",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      company_name: "",
      cnpj: "",
      razao_social: "",
      owner_name: "",
      phone: "",
      email: "",
      financial_contact_name: "",
      financial_contact_email: "",
      financial_contact_phone: "",
      address_street: "",
      address_number: "",
      address_complement: "",
      address_neighborhood: "",
      address_city: "",
      address_state: "",
      address_zip: "",
      is_active: true,
    });
    setEditingReseller(null);
  };

  const handleEdit = (reseller: Reseller) => {
    setEditingReseller(reseller);
    setFormData({
      company_name: reseller.company_name,
      cnpj: reseller.cnpj,
      razao_social: reseller.razao_social,
      owner_name: reseller.owner_name,
      phone: reseller.phone,
      email: reseller.email,
      financial_contact_name: reseller.financial_contact_name || "",
      financial_contact_email: reseller.financial_contact_email || "",
      financial_contact_phone: reseller.financial_contact_phone || "",
      address_street: reseller.address_street || "",
      address_number: reseller.address_number || "",
      address_complement: reseller.address_complement || "",
      address_neighborhood: reseller.address_neighborhood || "",
      address_city: reseller.address_city || "",
      address_state: reseller.address_state || "",
      address_zip: reseller.address_zip || "",
      is_active: reseller.is_active,
    });
    setDialogOpen(true);
  };

  const handleResendEmail = async (resellerId: string, resellerEmail: string) => {
    setSendingEmail(resellerId);
    try {
      const { error } = await supabase.functions.invoke('send-reseller-welcome', {
        body: { resellerId }
      });

      if (error) throw error;

      toast({
        title: "E-mail enviado com sucesso",
        description: `E-mail de boas-vindas reenviado para ${resellerEmail}`,
      });
    } catch (error: any) {
      console.error('Erro ao reenviar email:', error);
      toast({
        title: "Erro ao enviar e-mail",
        description: error.message || "Não foi possível enviar o e-mail",
        variant: "destructive",
      });
    } finally {
      setSendingEmail(null);
    }
  };

  const formatCNPJ = (cnpj: string) => {
    const cleaned = cnpj.replace(/\D/g, '');
    if (cleaned.length !== 14) return cnpj;
    return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  const loadClientsStats = async () => {
    try {
      // Clientes associados a revendas (networks com reseller_id não nulo)
      const { data: clientsData, error: associatedError } = await supabase
        .from("clients")
        .select(`
          id,
          cpf,
          network:networks!clients_network_id_fkey(reseller_id, status)
        `)
        .not("network_id", "is", null);

      if (associatedError) throw associatedError;
      
      // Filtrar apenas clientes cujas networks têm reseller_id e network está ativa
      const associated = clientsData?.filter(c => 
        c.network?.reseller_id && c.network?.status === 'active'
      ) || [];
      
      // Contar CPFs únicos
      const uniqueCPFs = new Set(associated.map(c => c.cpf));
      setAssociatedClients(uniqueCPFs.size);

      // Clientes cancelados - CPFs únicos de networks inativas com reseller_id
      const canceled = clientsData?.filter(c => 
        c.network?.reseller_id && c.network?.status === 'inactive'
      ) || [];
      
      const uniqueCanceledCPFs = new Set(canceled.map(c => c.cpf));
      setCanceledClients(uniqueCanceledCPFs.size);

      // Novos clientes este mês (apenas de networks ativas com reseller)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: thisMonthData, error: thisMonthError } = await supabase
        .from("clients")
        .select(`
          id,
          cpf,
          created_at,
          network:networks!clients_network_id_fkey(reseller_id, status)
        `)
        .gte("created_at", startOfMonth.toISOString())
        .not("network_id", "is", null);

      if (thisMonthError) throw thisMonthError;
      
      const thisMonth = thisMonthData?.filter(c => 
        c.network?.reseller_id && c.network?.status === 'active'
      ) || [];
      const uniqueThisMonth = new Set(thisMonth.map(c => c.cpf));
      setNewClientsThisMonth(uniqueThisMonth.size);

      // Novos clientes mês passado (apenas de networks ativas com reseller)
      const startOfLastMonth = new Date();
      startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);
      startOfLastMonth.setDate(1);
      startOfLastMonth.setHours(0, 0, 0, 0);

      const endOfLastMonth = new Date();
      endOfLastMonth.setDate(0);
      endOfLastMonth.setHours(23, 59, 59, 999);

      const { data: lastMonthData, error: lastMonthError } = await supabase
        .from("clients")
        .select(`
          id,
          cpf,
          created_at,
          network:networks!clients_network_id_fkey(reseller_id, status)
        `)
        .gte("created_at", startOfLastMonth.toISOString())
        .lte("created_at", endOfLastMonth.toISOString())
        .not("network_id", "is", null);

      if (lastMonthError) throw lastMonthError;
      
      const lastMonth = lastMonthData?.filter(c => 
        c.network?.reseller_id && c.network?.status === 'active'
      ) || [];
      const uniqueLastMonth = new Set(lastMonth.map(c => c.cpf));
      setNewClientsLastMonth(uniqueLastMonth.size);
    } catch (error: any) {
      console.error("Erro ao carregar estatísticas de clientes:", error);
    }
  };

  const filteredResellers = resellers.filter(reseller =>
    reseller.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reseller.cnpj.includes(searchTerm) ||
    reseller.owner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reseller.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeResellers = resellers.filter(r => r.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Revendas</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie as revendas parceiras</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar revenda..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button variant="outline" onClick={() => setRulesDialogOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Regras
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Revenda
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingReseller ? "Editar Revenda" : "Nova Revenda"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Nome da Empresa*</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ*</Label>
                    <div className="flex gap-2">
                      <Input
                        id="cnpj"
                        value={formData.cnpj}
                        onChange={(e) => setFormData(prev => ({ ...prev, cnpj: e.target.value }))}
                        required
                        disabled={!!editingReseller}
                      />
                      {!editingReseller && (
                        <Button
                          type="button"
                          onClick={() => fetchCNPJData(formData.cnpj)}
                          disabled={cnpjLoading}
                        >
                          {cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="razao_social">Razão Social*</Label>
                    <Input
                      id="razao_social"
                      value={formData.razao_social}
                      onChange={(e) => setFormData(prev => ({ ...prev, razao_social: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="owner_name">Nome do Dono*</Label>
                    <Input
                      id="owner_name"
                      value={formData.owner_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, owner_name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone*</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail*</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-4">Contato Financeiro</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="financial_contact_name">Nome</Label>
                      <Input
                        id="financial_contact_name"
                        value={formData.financial_contact_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, financial_contact_name: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="financial_contact_phone">Telefone</Label>
                      <Input
                        id="financial_contact_phone"
                        value={formData.financial_contact_phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, financial_contact_phone: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="financial_contact_email">E-mail</Label>
                      <Input
                        id="financial_contact_email"
                        type="email"
                        value={formData.financial_contact_email}
                        onChange={(e) => setFormData(prev => ({ ...prev, financial_contact_email: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-4">Endereço</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="address_zip">CEP</Label>
                      <Input
                        id="address_zip"
                        value={formData.address_zip}
                        onChange={(e) => setFormData(prev => ({ ...prev, address_zip: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address_state">Estado</Label>
                      <Input
                        id="address_state"
                        value={formData.address_state}
                        onChange={(e) => setFormData(prev => ({ ...prev, address_state: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="address_street">Rua</Label>
                      <Input
                        id="address_street"
                        value={formData.address_street}
                        onChange={(e) => setFormData(prev => ({ ...prev, address_street: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address_number">Número</Label>
                      <Input
                        id="address_number"
                        value={formData.address_number}
                        onChange={(e) => setFormData(prev => ({ ...prev, address_number: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address_complement">Complemento</Label>
                      <Input
                        id="address_complement"
                        value={formData.address_complement}
                        onChange={(e) => setFormData(prev => ({ ...prev, address_complement: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address_neighborhood">Bairro</Label>
                      <Input
                        id="address_neighborhood"
                        value={formData.address_neighborhood}
                        onChange={(e) => setFormData(prev => ({ ...prev, address_neighborhood: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address_city">Cidade</Label>
                      <Input
                        id="address_city"
                        value={formData.address_city}
                        onChange={(e) => setFormData(prev => ({ ...prev, address_city: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label htmlFor="is_active">Ativo</Label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingReseller ? "Atualizar" : "Cadastrar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Revendas</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resellers.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeResellers} ativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Associados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{associatedClients}</div>
            <p className="text-xs text-muted-foreground">
              Clientes de revendas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Cancelados</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{canceledClients}</div>
            <p className="text-xs text-muted-foreground">
              Empresas inativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evolução Mensal</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {newClientsThisMonth > 0 ? '+' : ''}{newClientsThisMonth}
            </div>
            <p className="text-xs text-muted-foreground">
              {newClientsLastMonth > 0 && (
                <>
                  {newClientsThisMonth > newClientsLastMonth ? '↑' : newClientsThisMonth < newClientsLastMonth ? '↓' : '='} 
                  {' '}{Math.abs(newClientsThisMonth - newClientsLastMonth)} vs mês anterior
                </>
              )}
              {newClientsLastMonth === 0 && 'Novos este mês'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revendas Cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredResellers.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">
              {searchTerm ? "Nenhuma revenda encontrada" : "Nenhuma revenda cadastrada"}
            </p>
          ) : (
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResellers.map((reseller) => (
                    <TableRow key={reseller.id}>
                      <TableCell className="font-medium">{reseller.company_name}</TableCell>
                      <TableCell>{formatCNPJ(reseller.cnpj)}</TableCell>
                      <TableCell>{reseller.owner_name}</TableCell>
                      <TableCell>{reseller.email}</TableCell>
                      <TableCell>{reseller.phone}</TableCell>
                      <TableCell>
                        <Badge variant={reseller.is_active ? "default" : "secondary"}>
                          {reseller.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(reseller)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResendEmail(reseller.id, reseller.email)}
                          disabled={sendingEmail === reseller.id}
                          title="Reenviar e-mail de boas-vindas"
                        >
                          {sendingEmail === reseller.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Mail className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedReseller({ id: reseller.id, name: reseller.company_name });
                            setExtractDialogOpen(true);
                          }}
                        >
                          <DollarSign className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </CardContent>
      </Card>

        {selectedReseller && (
          <ResellerExtractDialog
            open={extractDialogOpen}
            onOpenChange={setExtractDialogOpen}
            resellerId={selectedReseller.id}
            resellerName={selectedReseller.name}
          />
        )}

        <ResellerCommissionRulesDialog
          open={rulesDialogOpen}
          onOpenChange={setRulesDialogOpen}
        />
    </div>
  );
};

export default Revendas;
