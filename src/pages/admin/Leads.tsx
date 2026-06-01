import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Calendar, 
  Filter, 
  Mail, 
  Phone, 
  Building, 
  MessageSquare,
  User,
  Thermometer,
  Eye,
  Edit,
  Trash2,
  List,
  LayoutGrid,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  status: string;
  temperature?: string;
  source: string;
  assigned_to?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
  };
}

const STATUS_CONFIG = {
  new: { label: "Novo", color: "bg-blue-500" },
  contacted: { label: "Contatado", color: "bg-yellow-500" },
  qualified: { label: "Qualificado", color: "bg-purple-500" },
  proposal: { label: "Proposta", color: "bg-orange-500" },
  won: { label: "Ganho", color: "bg-green-500" },
  lost: { label: "Perdido", color: "bg-red-500" },
};

const TEMPERATURE_CONFIG = {
  cold: { label: "Frio", icon: "❄️" },
  warm: { label: "Morno", icon: "🌤️" },
  hot: { label: "Quente", icon: "🔥" },
};

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [newLead, setNewLead] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: "",
    status: "new",
    temperature: "warm",
    source: "website",
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadLeads();
    loadUsers();
  }, []);

  useEffect(() => {
    filterLeads();
  }, [leads, searchTerm, dateFilter, statusFilter]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("is_seller", true);

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar usuários:", error);
    }
  };

  const loadLeads = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Buscar perfis separadamente se houver assigned_to
      const leadsWithProfiles = await Promise.all(
        (data || []).map(async (lead) => {
          if (lead.assigned_to) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", lead.assigned_to)
              .single();
            
            return { ...lead, profiles: profile };
          }
          return lead;
        })
      );

      setLeads(leadsWithProfiles);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar leads",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterLeads = () => {
    let filtered = [...leads];

    if (searchTerm) {
      filtered = filtered.filter(
        (lead) =>
          lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.company?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateFilter) {
      filtered = filtered.filter(
        (lead) => format(new Date(lead.created_at), "yyyy-MM-dd") === dateFilter
      );
    }

    if (statusFilter && statusFilter !== "all") {
      filtered = filtered.filter((lead) => lead.status === statusFilter);
    }

    setFilteredLeads(filtered);
  };

  const handleUpdateLead = async (leadId: string, updates: Partial<Lead>) => {
    try {
      // Remover campos que não devem ser atualizados (relations, timestamps automáticos)
      const { profiles, created_at, updated_at, id, ...allowedUpdates } = updates;
      
      const { error } = await supabase
        .from("leads")
        .update(allowedUpdates)
        .eq("id", leadId);

      if (error) throw error;

      toast({
        title: "Lead atualizado!",
        description: "As informações foram atualizadas com sucesso.",
      });

      loadLeads();
      setIsDetailDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar lead",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm("Tem certeza que deseja excluir este lead?")) return;

    try {
      const { error } = await supabase.from("leads").delete().eq("id", leadId);

      if (error) throw error;

      toast({
        title: "Lead excluído!",
        description: "O lead foi removido com sucesso.",
      });

      loadLeads();
      setIsDetailDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao excluir lead",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateLead = async () => {
    if (!newLead.name || !newLead.email) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha pelo menos nome e email.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("leads").insert([newLead]);

      if (error) throw error;

      toast({
        title: "Lead criado!",
        description: "O novo lead foi adicionado com sucesso.",
      });

      setNewLead({
        name: "",
        email: "",
        phone: "",
        company: "",
        message: "",
        status: "new",
        temperature: "warm",
        source: "website",
      });
      setIsCreateDialogOpen(false);
      loadLeads();
    } catch (error: any) {
      toast({
        title: "Erro ao criar lead",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleConvertToBudget = () => {
    if (!selectedLead) return;
    
    // Navegar para Orçamentos com dados do Lead
    navigate('/adm/orcamentos', { 
      state: { 
        fromLead: true,
        leadData: {
          lead_id: selectedLead.id,
          requester_name: selectedLead.name,
          requester_email: selectedLead.email,
          requester_phone: selectedLead.phone || '',
          company: selectedLead.company || '',
          temperature: selectedLead.temperature,
          seller_id: selectedLead.assigned_to,
        }
      } 
    });
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
    return (
      <Badge variant="outline" className="gap-1">
        <div className={`w-2 h-2 rounded-full ${config?.color || "bg-gray-500"}`} />
        {config?.label || status}
      </Badge>
    );
  };

  const renderListView = () => (
    <Card>
      <CardHeader>
        <CardTitle>Lista de Leads</CardTitle>
        <CardDescription>{filteredLeads.length} leads encontrados</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Temperatura</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Nenhum lead encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-sm">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {lead.email}
                      </div>
                      {lead.phone && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {lead.phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{lead.company || "-"}</TableCell>
                  <TableCell>{getStatusBadge(lead.status)}</TableCell>
                  <TableCell>
                    {lead.temperature ? (
                      <span>
                        {TEMPERATURE_CONFIG[lead.temperature as keyof typeof TEMPERATURE_CONFIG]?.icon}{" "}
                        {TEMPERATURE_CONFIG[lead.temperature as keyof typeof TEMPERATURE_CONFIG]?.label}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{lead.source}</Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedLead(lead);
                        setIsDetailDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  const renderKanbanView = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {Object.entries(STATUS_CONFIG).map(([status, config]) => {
        const statusLeads = filteredLeads.filter((lead) => lead.status === status);
        return (
          <Card key={status}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${config.color}`} />
                  {config.label}
                </span>
                <Badge variant="secondary">{statusLeads.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {statusLeads.map((lead) => (
                <Card
                  key={lead.id}
                  className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    setSelectedLead(lead);
                    setIsDetailDialogOpen(true);
                  }}
                >
                  <div className="space-y-2">
                    <div className="font-medium text-sm">{lead.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {lead.email}
                    </div>
                    {lead.company && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        {lead.company}
                      </div>
                    )}
                    {lead.temperature && (
                      <div className="text-xs">
                        {TEMPERATURE_CONFIG[lead.temperature as keyof typeof TEMPERATURE_CONFIG]?.icon}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(lead.created_at), "dd/MM", { locale: ptBR })}
                    </div>
                  </div>
                </Card>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">LEADs</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie e acompanhe seus leads de vendas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="mr-2"
          >
            Novo Lead
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4 mr-2" />
            Lista
          </Button>
          <Button
            variant={viewMode === "kanban" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("kanban")}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Kanban
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Nome, email ou empresa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <div className="relative">
                <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="date"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo */}
      {viewMode === "list" ? renderListView() : renderKanbanView()}

      {/* Dialog de Detalhes */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Lead</DialogTitle>
            <DialogDescription>
              Visualize e edite as informações do lead
            </DialogDescription>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={selectedLead.name}
                    onChange={(e) =>
                      setSelectedLead({ ...selectedLead, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={selectedLead.email}
                    onChange={(e) =>
                      setSelectedLead({ ...selectedLead, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={selectedLead.phone || ""}
                    onChange={(e) =>
                      setSelectedLead({ ...selectedLead, phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Input
                    value={selectedLead.company || ""}
                    onChange={(e) =>
                      setSelectedLead({ ...selectedLead, company: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={selectedLead.status}
                    onValueChange={(value) =>
                      setSelectedLead({ ...selectedLead, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                        <SelectItem key={value} value={value}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Temperatura</Label>
                  <Select
                    value={selectedLead.temperature || ""}
                    onValueChange={(value) =>
                      setSelectedLead({ ...selectedLead, temperature: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TEMPERATURE_CONFIG).map(([value, config]) => (
                        <SelectItem key={value} value={value}>
                          {config.icon} {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Responsável</Label>
                  <Select
                    value={selectedLead.assigned_to || ""}
                    onValueChange={(value) =>
                      setSelectedLead({ ...selectedLead, assigned_to: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Mensagem Original</Label>
                <Textarea value={selectedLead.message || ""} disabled rows={3} />
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={selectedLead.notes || ""}
                  onChange={(e) =>
                    setSelectedLead({ ...selectedLead, notes: e.target.value })
                  }
                  rows={4}
                  placeholder="Adicione observações sobre este lead..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                  <strong>Origem:</strong> {selectedLead.source}
                </div>
                <div>
                  <strong>Criado em:</strong>{" "}
                  {format(new Date(selectedLead.created_at), "dd/MM/yyyy HH:mm", {
                    locale: ptBR,
                  })}
                </div>
              </div>

              <div className="flex justify-between gap-2 pt-4">
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => handleDeleteLead(selectedLead.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleConvertToBudget}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Converter em Orçamento
                  </Button>
                </div>
                <Button onClick={() => handleUpdateLead(selectedLead.id, selectedLead)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Criar Lead */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Criar Novo Lead</DialogTitle>
            <DialogDescription>
              Adicione um novo lead manualmente ao sistema
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={newLead.name}
                  onChange={(e) =>
                    setNewLead({ ...newLead, name: e.target.value })
                  }
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={newLead.email}
                  onChange={(e) =>
                    setNewLead({ ...newLead, email: e.target.value })
                  }
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={newLead.phone}
                  onChange={(e) =>
                    setNewLead({ ...newLead, phone: e.target.value })
                  }
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Input
                  value={newLead.company}
                  onChange={(e) =>
                    setNewLead({ ...newLead, company: e.target.value })
                  }
                  placeholder="Nome da empresa"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={newLead.status}
                  onValueChange={(value) =>
                    setNewLead({ ...newLead, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                      <SelectItem key={value} value={value}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Temperatura</Label>
                <Select
                  value={newLead.temperature}
                  onValueChange={(value) =>
                    setNewLead({ ...newLead, temperature: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TEMPERATURE_CONFIG).map(([value, config]) => (
                      <SelectItem key={value} value={value}>
                        {config.icon} {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Origem</Label>
                <Select
                  value={newLead.source}
                  onValueChange={(value) =>
                    setNewLead({ ...newLead, source: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="whatsapp_button">WhatsApp</SelectItem>
                    <SelectItem value="indicacao">Indicação</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="rede_social">Rede Social</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={newLead.message}
                onChange={(e) =>
                  setNewLead({ ...newLead, message: e.target.value })
                }
                placeholder="Mensagem ou observações sobre o lead..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateLead}>
                Criar Lead
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
