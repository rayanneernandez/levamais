import { useState, useEffect } from "react";
import { Plus, Pencil, FileText, Building2, ArrowLeft, Eye, XCircle, History, Trash2, Search, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { LIMITS, trimmedEmail, trimmedOptional } from "@/lib/input-sanitization";

const formSchema = z.object({
  network_id: z.string().min(1, "Selecione uma empresa"),
  max_stores: z.coerce.number().min(1, "Quantidade deve ser maior que 0"),
  monthly_fee: z.coerce.number().min(0, "Valor deve ser maior ou igual a 0"),
  billing_day: z.enum(["5", "10", "20"], {
    required_error: "Selecione um dia de cobrança",
  }),
  financial_email: trimmedEmail(LIMITS.EMAIL),
  valor_implantacao: z.coerce.number().min(0, "Valor deve ser maior ou igual a 0").optional(),
  implantado: z.boolean().optional(),
  email_marketing_limit: z.coerce.number().min(0, "Valor deve ser maior ou igual a 0").optional(),
  email_marketing_price: z.coerce.number().min(0, "Valor deve ser maior ou igual a 0").optional(),
  whatsapp_marketing_limit: z.coerce.number().min(0, "Valor deve ser maior ou igual a 0").optional(),
  whatsapp_marketing_price: z.coerce.number().min(0, "Valor deve ser maior ou igual a 0").optional(),
  sms_marketing_limit: z.coerce.number().min(0, "Valor deve ser maior ou igual a 0").optional(),
  sms_marketing_price: z.coerce.number().min(0, "Valor deve ser maior ou igual a 0").optional(),
  ai_credits_limit: z.coerce.number().min(0, "Valor deve ser maior ou igual a 0").optional(),
  ai_credits_price: z.coerce.number().min(0, "Valor deve ser maior ou igual a 0").optional(),
  fuel_analysis_enabled: z.boolean().optional(),
  fuel_analysis_price: z.coerce.number().min(0, "Valor deve ser maior ou igual a 0").optional(),
  fuel_analysis_scope: z.enum(["estado", "brasil"]).optional(),
  location_estado: z.string().optional(),
  support_whatsapp: trimmedOptional(LIMITS.PHONE),
  support_whatsapp_message: z.string().trim().max(LIMITS.SHORT_TEXT, `Máximo de ${LIMITS.SHORT_TEXT} caracteres`).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Network {
  id: string;
  name: string;
  cnpj: string | null;
  max_stores: number;
  monthly_fee: number | null;
  billing_day: number | null;
  financial_contact_email: string | null;
  status: string;
  stores_count?: number;
  valor_implantacao?: number | null;
  implantado?: boolean;
  email_marketing_limit?: number | null;
  email_marketing_price?: number | null;
  whatsapp_marketing_limit?: number | null;
  whatsapp_marketing_price?: number | null;
  sms_marketing_limit?: number | null;
  sms_marketing_price?: number | null;
  ai_credits_limit?: number | null;
  ai_credits_used?: number | null;
  ai_credits_price?: number | null;
  fuel_analysis_enabled?: boolean;
  fuel_analysis_price?: number | null;
  fuel_analysis_scope?: string | null;
  location_estado?: string | null;
  support_whatsapp?: string | null;
  support_whatsapp_message?: string | null;
}

interface AuditLog {
  id: string;
  changed_at: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_profile?: {
    full_name: string;
    email: string;
  };
}

export default function Licencas() {
  const navigate = useNavigate();
  const [networks, setNetworks] = useState<Network[]>([]);
  const [availableNetworks, setAvailableNetworks] = useState<Network[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNetwork, setEditingNetwork] = useState<Network | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterNetwork, setFilterNetwork] = useState<string>("all");
  const [availableEstados, setAvailableEstados] = useState<string[]>([]);
  const [availableCidades, setAvailableCidades] = useState<string[]>([]);
  const [availableMunicipios, setAvailableMunicipios] = useState<string[]>([]);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      network_id: "",
      max_stores: 1,
      monthly_fee: 0,
      billing_day: "5",
      financial_email: "",
      valor_implantacao: 0,
      implantado: false,
      email_marketing_limit: 0,
      email_marketing_price: 0,
      whatsapp_marketing_limit: 0,
      whatsapp_marketing_price: 0,
      sms_marketing_limit: 0,
      sms_marketing_price: 0,
      ai_credits_limit: 0,
      ai_credits_price: 0,
      fuel_analysis_enabled: false,
      fuel_analysis_price: 0,
      fuel_analysis_scope: "estado",
      support_whatsapp: "",
      support_whatsapp_message: "",
    },
  });

  useEffect(() => {
    loadNetworks();
  }, []);

  const loadNetworks = async () => {
    try {
      const { data: networksData, error: networksError } = await supabase
        .from("networks")
        .select("*")
        .order("name");

      if (networksError) throw networksError;

      // Buscar contagem de lojas para cada network
      const { data: storesData, error: storesError } = await supabase
        .from("stores")
        .select("network_id")
        .eq("status", "active");

      if (storesError) throw storesError;

      // Contar lojas por network
      const storesCounts = storesData?.reduce((acc: Record<string, number>, store) => {
        acc[store.network_id] = (acc[store.network_id] || 0) + 1;
        return acc;
      }, {});

      // Adicionar contagem aos networks
      const networksWithCounts = networksData?.map(network => ({
        ...network,
        stores_count: storesCounts?.[network.id] || 0,
      }));

      setNetworks(networksWithCounts || []);
      setAvailableNetworks(networksWithCounts || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar empresas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      const { error } = await supabase
        .from("networks")
        .update({
          max_stores: data.max_stores,
          monthly_fee: data.monthly_fee,
          billing_day: parseInt(data.billing_day),
          financial_contact_email: data.financial_email,
          valor_implantacao: data.valor_implantacao,
          implantado: data.implantado,
          email_marketing_limit: data.email_marketing_limit || 0,
          email_marketing_price: data.email_marketing_price || 0,
          whatsapp_marketing_limit: data.whatsapp_marketing_limit || 0,
          whatsapp_marketing_price: data.whatsapp_marketing_price || 0,
          sms_marketing_limit: data.sms_marketing_limit || 0,
          sms_marketing_price: data.sms_marketing_price || 0,
          ai_credits_limit: data.ai_credits_limit || 0,
          ai_credits_price: data.ai_credits_price || 0,
          fuel_analysis_enabled: data.fuel_analysis_enabled || false,
          fuel_analysis_price: data.fuel_analysis_price || 0,
          fuel_analysis_scope: data.fuel_analysis_scope || null,
          location_estado: data.location_estado || null,
          support_whatsapp: data.support_whatsapp || null,
          support_whatsapp_message: data.support_whatsapp_message || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.network_id);

      if (error) throw error;

      toast({
        title: "Licença configurada!",
        description: "As configurações de licença foram salvas com sucesso.",
      });

      setIsDialogOpen(false);
      form.reset();
      setEditingNetwork(null);
      loadNetworks();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar licença",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleView = (network: Network) => {
    setEditingNetwork(network);
    setIsViewMode(true);
    form.reset({
      network_id: network.id,
      max_stores: network.max_stores || 1,
      monthly_fee: network.monthly_fee || 0,
      billing_day: network.billing_day?.toString() as "5" | "10" | "20" || "5",
      financial_email: network.financial_contact_email || "",
      valor_implantacao: network.valor_implantacao || 0,
      implantado: network.implantado || false,
      email_marketing_limit: network.email_marketing_limit || 0,
      email_marketing_price: network.email_marketing_price || 0,
      whatsapp_marketing_limit: network.whatsapp_marketing_limit || 0,
      whatsapp_marketing_price: network.whatsapp_marketing_price || 0,
      sms_marketing_limit: network.sms_marketing_limit || 0,
      sms_marketing_price: network.sms_marketing_price || 0,
      ai_credits_limit: network.ai_credits_limit || 0,
      ai_credits_price: network.ai_credits_price || 0,
      fuel_analysis_enabled: network.fuel_analysis_enabled || false,
      fuel_analysis_price: network.fuel_analysis_price || 0,
      fuel_analysis_scope: network.fuel_analysis_scope as any || "estado",
      location_estado: network.location_estado || "",
      support_whatsapp: network.support_whatsapp || "",
      support_whatsapp_message: network.support_whatsapp_message || "",
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (network: Network) => {
    setEditingNetwork(network);
    setIsViewMode(false);
    form.reset({
      network_id: network.id,
      max_stores: network.max_stores || 1,
      monthly_fee: network.monthly_fee || 0,
      billing_day: network.billing_day?.toString() as "5" | "10" | "20" || "5",
      financial_email: network.financial_contact_email || "",
      valor_implantacao: network.valor_implantacao || 0,
      implantado: network.implantado || false,
      email_marketing_limit: network.email_marketing_limit || 0,
      email_marketing_price: network.email_marketing_price || 0,
      whatsapp_marketing_limit: network.whatsapp_marketing_limit || 0,
      whatsapp_marketing_price: network.whatsapp_marketing_price || 0,
      sms_marketing_limit: network.sms_marketing_limit || 0,
      sms_marketing_price: network.sms_marketing_price || 0,
      ai_credits_limit: network.ai_credits_limit || 0,
      ai_credits_price: network.ai_credits_price || 0,
      fuel_analysis_enabled: network.fuel_analysis_enabled || false,
      fuel_analysis_price: network.fuel_analysis_price || 0,
      fuel_analysis_scope: network.fuel_analysis_scope as any || "estado",
      location_estado: network.location_estado || "",
      support_whatsapp: network.support_whatsapp || "",
      support_whatsapp_message: network.support_whatsapp_message || "",
    });
    setIsDialogOpen(true);
  };

  const handleDeactivate = async () => {
    if (!selectedNetwork) return;

    try {
      // Inativar a empresa
      const { error: networkError } = await supabase
        .from("networks")
        .update({ 
          status: "inactive",
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedNetwork.id);

      if (networkError) throw networkError;

      // Inativar todas as lojas da empresa
      const { error: storesError } = await supabase
        .from("stores")
        .update({ 
          status: "inactive",
          updated_at: new Date().toISOString()
        })
        .eq("network_id", selectedNetwork.id);

      if (storesError) throw storesError;

      toast({
        title: "Licença inativada!",
        description: `A empresa ${selectedNetwork.name} e todas as suas lojas foram inativadas.`,
      });

      setIsDeactivateOpen(false);
      setSelectedNetwork(null);
      loadNetworks();
    } catch (error: any) {
      toast({
        title: "Erro ao inativar licença",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadAuditLogs = async (networkId: string) => {
    setIsLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from("license_audit_logs")
        .select("*")
        .eq("network_id", networkId)
        .order("changed_at", { ascending: false });

      if (error) throw error;

      // Buscar perfis dos usuários que fizeram alterações
      const userIds = [...new Set(data?.map(log => log.changed_by) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      // Mapear perfis aos logs
      const logsWithProfiles = data?.map(log => ({
        ...log,
        changed_by_profile: profiles?.find(p => p.id === log.changed_by),
      })) || [];

      setAuditLogs(logsWithProfiles);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar histórico",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleShowHistory = async (network: Network) => {
    setSelectedNetwork(network);
    setIsHistoryOpen(true);
    await loadAuditLogs(network.id);
  };

  const handleDelete = async (network: Network) => {
    if (!confirm(`Tem certeza que deseja excluir a licença da empresa ${network.name}?`)) return;

    try {
      const { error } = await supabase
        .from("networks")
        .update({ 
          max_stores: 0,
          monthly_fee: null,
          billing_day: null,
          financial_contact_email: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", network.id);

      if (error) throw error;

      toast({
        title: "Licença excluída!",
        description: "A configuração de licença foi removida com sucesso.",
      });

      loadNetworks();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir licença",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setIsDialogOpen(false);
      setEditingNetwork(null);
      setIsViewMode(false);
      form.reset();
    } else {
      setIsDialogOpen(true);
    }
  };

  const getFieldLabel = (fieldName: string) => {
    const labels: Record<string, string> = {
      total_licenses: "Total de Licenças",
      max_stores: "Quantidade de Lojas",
      monthly_fee: "Mensalidade",
      billing_day: "Dia de Cobrança",
    };
    return labels[fieldName] || fieldName;
  };

  const formatValue = (fieldName: string, value: string | null) => {
    if (!value) return "-";
    
    if (fieldName === "monthly_fee") {
      return formatCurrency(parseFloat(value));
    }
    if (fieldName === "billing_day") {
      return `Dia ${value}`;
    }
    return value;
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const licensedNetworks = networks.filter(
    (n) => n.max_stores > 0 || n.monthly_fee || n.billing_day
  );

  const filteredNetworks = filterNetwork === "all"
    ? licensedNetworks
    : licensedNetworks.filter(network => network.id === filterNetwork);

  const searchFilteredNetworks = filteredNetworks.filter(network =>
    network.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (network.cnpj && network.cnpj.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Licenças</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure as licenças e valores de mensalidade das empresas</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Configurar Licença
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {isViewMode ? "Visualizar Licença" : editingNetwork ? "Editar Licença" : "Nova Licença"}
              </DialogTitle>
              <DialogDescription>
                {isViewMode ? "Visualização das informações da licença" : "Configure a licença e valores para a empresa selecionada"}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="network_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empresa *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={!!editingNetwork || isViewMode}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a empresa" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableNetworks.map((network) => (
                            <SelectItem key={network.id} value={network.id}>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                {network.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="max_stores"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade de Lojas *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            placeholder="Ex: 10"
                            disabled={isViewMode}
                          />
                        </FormControl>
                        <FormDescription>
                          Máximo de lojas que a rede pode cadastrar
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="monthly_fee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mensalidade (R$) *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            placeholder="Ex: 299.90"
                            disabled={isViewMode}
                          />
                        </FormControl>
                        <FormDescription>Valor mensal da licença</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="billing_day"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dia de Cobrança *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isViewMode}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o dia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="5">Dia 5</SelectItem>
                          <SelectItem value="10">Dia 10</SelectItem>
                          <SelectItem value="20">Dia 20</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Dia do mês para cobrança do boleto
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="financial_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Financeiro *</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          {...field}
                          placeholder="financeiro@empresa.com"
                          maxLength={LIMITS.EMAIL}
                          disabled={isViewMode}
                        />
                      </FormControl>
                      <FormDescription>
                        Email para envio de boleto e NFSe
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="valor_implantacao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor Implantação (R$)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            placeholder="Ex: 1500.00"
                            disabled={isViewMode}
                          />
                        </FormControl>
                        <FormDescription>Valor único de implantação</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="implantado"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Implantado</FormLabel>
                          <FormDescription>
                            Marcar quando implantação concluída
                          </FormDescription>
                        </div>
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            disabled={isViewMode}
                            className="h-4 w-4"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="pt-4 border-t space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Pacotes de Marketing</h3>
                    <Badge variant="secondary">Novidade</Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email_marketing_limit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Limite E-mails/Mês</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value?.toString()} disabled={isViewMode}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o pacote" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="0">Sem pacote</SelectItem>
                              <SelectItem value="100">100 envios</SelectItem>
                              <SelectItem value="500">500 envios</SelectItem>
                              <SelectItem value="1000">1000 envios</SelectItem>
                              <SelectItem value="2500">2500 envios</SelectItem>
                              <SelectItem value="5000">5000 envios</SelectItem>
                              <SelectItem value="10000">10000 envios</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Quantidade de e-mails marketing por mês
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email_marketing_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preço Pacote E-mail (R$)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              {...field}
                              placeholder="Ex: 49.90"
                              disabled={isViewMode}
                            />
                          </FormControl>
                          <FormDescription>Valor mensal do pacote</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="whatsapp_marketing_limit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Limite WhatsApp/Mês</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value?.toString()} disabled={isViewMode}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o pacote" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="0">Sem pacote</SelectItem>
                              <SelectItem value="100">100 envios</SelectItem>
                              <SelectItem value="500">500 envios</SelectItem>
                              <SelectItem value="1000">1000 envios</SelectItem>
                              <SelectItem value="2500">2500 envios</SelectItem>
                              <SelectItem value="5000">5000 envios</SelectItem>
                              <SelectItem value="10000">10000 envios</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Quantidade de disparos WhatsApp por mês
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="whatsapp_marketing_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preço Pacote WhatsApp (R$)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              {...field}
                              placeholder="Ex: 99.90"
                              disabled={isViewMode}
                            />
                          </FormControl>
                          <FormDescription>Valor mensal do pacote</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="sms_marketing_limit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Limite SMS/Mês</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value?.toString()} disabled={isViewMode}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o pacote" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="0">Sem pacote</SelectItem>
                              <SelectItem value="100">100 envios</SelectItem>
                              <SelectItem value="500">500 envios</SelectItem>
                              <SelectItem value="1000">1000 envios</SelectItem>
                              <SelectItem value="2500">2500 envios</SelectItem>
                              <SelectItem value="5000">5000 envios</SelectItem>
                              <SelectItem value="10000">10000 envios</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Quantidade de disparos SMS por mês
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sms_marketing_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preço Pacote SMS (R$)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              {...field}
                              placeholder="Ex: 79.90"
                              disabled={isViewMode}
                            />
                          </FormControl>
                          <FormDescription>Valor mensal do pacote</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Créditos de IA</h3>
                    <Badge variant="secondary">Assistente Insights</Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="ai_credits_limit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Limite Créditos +Coins</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value?.toString()} disabled={isViewMode}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o pacote" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="0">Sem pacote</SelectItem>
                              <SelectItem value="50">50 +Coins</SelectItem>
                              <SelectItem value="100">100 +Coins</SelectItem>
                              <SelectItem value="200">200 +Coins</SelectItem>
                              <SelectItem value="300">300 +Coins</SelectItem>
                              <SelectItem value="500">500 +Coins</SelectItem>
                              <SelectItem value="1000">1000 +Coins</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Créditos mensais para Assistente de IA
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ai_credits_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preço Pacote IA (R$)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              {...field}
                              placeholder="Ex: 29.90"
                              disabled={isViewMode}
                            />
                          </FormControl>
                          <FormDescription>Valor mensal do pacote</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Módulo de Análise de Combustível</h3>
                    <Badge variant="secondary">Novo</Badge>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="fuel_analysis_enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Módulo Habilitado</FormLabel>
                          <FormDescription>
                            Ativar módulo de análise de preços de combustível
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isViewMode}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="fuel_analysis_scope"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Abrangência da Análise</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={isViewMode}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a abrangência" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[300px]">
                              <SelectItem value="estado">Estado</SelectItem>
                              <SelectItem value="brasil">Brasil</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            <strong>Estado:</strong> Cliente vê apenas dados do estado escolhido (filtros: Cidade → Município → Bairro)
                            <br />
                            <strong>Brasil:</strong> Cliente vê dados de todo o país (filtros: Estado → Cidade → Município → Bairro)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="fuel_analysis_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preço do Módulo (R$)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              {...field}
                              placeholder="Ex: 99.90"
                              disabled={isViewMode}
                            />
                          </FormControl>
                          <FormDescription>Valor mensal do módulo</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {form.watch("fuel_analysis_scope") === "estado" && (
                    <FormField
                      control={form.control}
                      name="location_estado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={isViewMode}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o estado" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[300px]">
                              <SelectItem value="ACRE">Acre</SelectItem>
                              <SelectItem value="ALAGOAS">Alagoas</SelectItem>
                              <SelectItem value="AMAPA">Amapá</SelectItem>
                              <SelectItem value="AMAZONAS">Amazonas</SelectItem>
                              <SelectItem value="BAHIA">Bahia</SelectItem>
                              <SelectItem value="CEARA">Ceará</SelectItem>
                              <SelectItem value="DISTRITO FEDERAL">Distrito Federal</SelectItem>
                              <SelectItem value="ESPIRITO SANTO">Espírito Santo</SelectItem>
                              <SelectItem value="GOIAS">Goiás</SelectItem>
                              <SelectItem value="MARANHAO">Maranhão</SelectItem>
                              <SelectItem value="MATO GROSSO">Mato Grosso</SelectItem>
                              <SelectItem value="MATO GROSSO DO SUL">Mato Grosso do Sul</SelectItem>
                              <SelectItem value="MINAS GERAIS">Minas Gerais</SelectItem>
                              <SelectItem value="PARA">Pará</SelectItem>
                              <SelectItem value="PARAIBA">Paraíba</SelectItem>
                              <SelectItem value="PARANA">Paraná</SelectItem>
                              <SelectItem value="PERNAMBUCO">Pernambuco</SelectItem>
                              <SelectItem value="PIAUI">Piauí</SelectItem>
                              <SelectItem value="RIO DE JANEIRO">Rio de Janeiro</SelectItem>
                              <SelectItem value="RIO GRANDE DO NORTE">Rio Grande do Norte</SelectItem>
                              <SelectItem value="RIO GRANDE DO SUL">Rio Grande do Sul</SelectItem>
                              <SelectItem value="RONDONIA">Rondônia</SelectItem>
                              <SelectItem value="RORAIMA">Roraima</SelectItem>
                              <SelectItem value="SANTA CATARINA">Santa Catarina</SelectItem>
                              <SelectItem value="SAO PAULO">São Paulo</SelectItem>
                              <SelectItem value="SERGIPE">Sergipe</SelectItem>
                              <SelectItem value="TOCANTINS">Tocantins</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Estado para análise (somente para licença tipo "Estado")
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="pt-4 border-t space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">WhatsApp Suporte</h3>
                    <Badge variant="secondary">Atendimento</Badge>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="support_whatsapp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número do WhatsApp</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Ex: 5521999999999"
                            maxLength={LIMITS.PHONE}
                            disabled={isViewMode}
                          />
                        </FormControl>
                        <FormDescription>
                          Número completo com DDI + DDD + número (ex: 5521999999999)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="support_whatsapp_message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mensagem de Boas-Vindas</FormLabel>
                        <FormControl>
                          <textarea
                            {...field}
                            placeholder="Olá! Sou cliente Leva+ e preciso de ajuda."
                            disabled={isViewMode}
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            maxLength={200}
                          />
                        </FormControl>
                        <FormDescription>
                          Mensagem pré-preenchida ao clicar no botão (máx. 200 caracteres)
                          {field.value && <span className="ml-2 text-xs">({field.value.length}/200)</span>}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                    {isViewMode ? "Fechar" : "Cancelar"}
                  </Button>
                  {!isViewMode && (
                    <Button type="submit">
                      {editingNetwork ? "Atualizar" : "Salvar"}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterNetwork} onValueChange={setFilterNetwork}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Filtrar por empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {licensedNetworks.map((network) => (
              <SelectItem key={network.id} value={network.id}>
                {network.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead className="text-center">Licenças</TableHead>
              <TableHead className="text-right">Mensalidade</TableHead>
              <TableHead className="text-center">Dia Cobrança</TableHead>
              <TableHead className="text-center">E-mail</TableHead>
              <TableHead className="text-center">WhatsApp</TableHead>
              <TableHead className="text-center">SMS</TableHead>
              <TableHead className="text-center">IA +Coins</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : searchFilteredNetworks.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-center text-muted-foreground"
                >
                  {licensedNetworks.length === 0 ? "Nenhuma licença configurada" : "Nenhum resultado encontrado"}
                </TableCell>
              </TableRow>
            ) : (
              searchFilteredNetworks.map((network) => (
                <TableRow key={network.id}>
                  <TableCell className="font-medium">{network.name}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Badge 
                        variant={
                          (network.stores_count || 0) >= network.max_stores 
                            ? "destructive" 
                            : "outline"
                        }
                      >
                        {network.stores_count || 0} / {network.max_stores}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(network.monthly_fee)}
                  </TableCell>
                  <TableCell className="text-center">
                    {network.billing_day ? (
                      <Badge>Dia {network.billing_day}</Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {network.email_marketing_limit && network.email_marketing_limit > 0 ? (
                      <Badge variant="outline">{network.email_marketing_limit}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {network.whatsapp_marketing_limit && network.whatsapp_marketing_limit > 0 ? (
                      <Badge variant="outline">{network.whatsapp_marketing_limit}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {network.sms_marketing_limit && network.sms_marketing_limit > 0 ? (
                      <Badge variant="outline">{network.sms_marketing_limit}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {network.ai_credits_limit && network.ai_credits_limit > 0 ? (
                      <div className="flex flex-col items-center gap-1">
                        <Badge variant="outline">{network.ai_credits_limit}</Badge>
                        {network.ai_credits_price && network.ai_credits_price > 0 && (
                          <span className="text-xs text-muted-foreground">{formatCurrency(network.ai_credits_price)}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={network.status === "active" ? "default" : "secondary"}
                    >
                      {network.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-background z-50">
                        <DropdownMenuItem onClick={() => handleView(network)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(network)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleShowHistory(network)}>
                          <History className="h-4 w-4 mr-2" />
                          Histórico
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => {
                            setSelectedNetwork(network);
                            setIsDeactivateOpen(true);
                          }}
                          disabled={network.status === "inactive"}
                          className="text-amber-600"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Inativar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(network)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!isLoading && networks.length > licensedNetworks.length && (
        <div className="text-sm text-muted-foreground">
          {networks.length - licensedNetworks.length} empresa(s) sem licença
          configurada
        </div>
      )}

      {/* Dialog de Confirmação para Inativar */}
      <AlertDialog open={isDeactivateOpen} onOpenChange={setIsDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inativar Licença</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja inativar a licença da empresa <strong>{selectedNetwork?.name}</strong>?
              <br /><br />
              Esta ação irá:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Inativar a empresa</li>
                <li>Inativar todas as {selectedNetwork?.stores_count || 0} loja(s) cadastrada(s)</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Inativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Histórico */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Alterações - {selectedNetwork?.name}
            </DialogTitle>
            <DialogDescription>
              Registro de todas as alterações realizadas nas licenças desta empresa
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[500px] pr-4">
            {isLoadingLogs ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando histórico...
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma alteração registrada ainda
              </div>
            ) : (
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <div key={log.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-medium text-sm">
                          {getFieldLabel(log.field_name)}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">De:</span>
                          <Badge variant="outline">{formatValue(log.field_name, log.old_value)}</Badge>
                          <span className="text-muted-foreground">→</span>
                          <Badge>{formatValue(log.field_name, log.new_value)}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <span>Por:</span>
                        <span className="font-medium">
                          {log.changed_by_profile?.full_name || "Sistema"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Em:</span>
                        <span className="font-medium">
                          {new Date(log.changed_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
