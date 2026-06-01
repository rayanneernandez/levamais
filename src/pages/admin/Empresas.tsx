import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Building2, ArrowLeft, Search, Eye, Power, Mail, KeyRound, MapPin, Star, Download, Loader2 } from "lucide-react";
import { PromotionsDetailDialog } from "@/components/admin/PromotionsDetailDialog";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { LoadingPage } from "@/components/ui/loading-page";
import { LIMITS, trimmedString, trimmedEmail, trimmedOptional } from "@/lib/input-sanitization";

const optionalEmail = z.string().trim().toLowerCase().email("Email inválido").max(LIMITS.EMAIL).optional().or(z.literal(""));

const formSchema = z.object({
  name: trimmedString(LIMITS.NAME, { min: 2, minMessage: "Nome deve ter no mínimo 2 caracteres" }),
  email: trimmedEmail(LIMITS.EMAIL),
  phone: trimmedOptional(LIMITS.PHONE),
  commercial_contact_name: trimmedOptional(LIMITS.NAME),
  commercial_contact_phone: trimmedOptional(LIMITS.PHONE),
  commercial_contact_email: optionalEmail,
  technical_contact_name: trimmedOptional(LIMITS.NAME),
  technical_contact_phone: trimmedOptional(LIMITS.PHONE),
  technical_contact_email: optionalEmail,
  financial_contact_name: trimmedOptional(LIMITS.NAME),
  financial_contact_phone: trimmedOptional(LIMITS.PHONE),
  financial_contact_email: optionalEmail,
  address_street: trimmedOptional(LIMITS.ADDRESS),
  address_number: trimmedOptional(20),
  address_complement: trimmedOptional(LIMITS.SHORT_TEXT),
  address_neighborhood: trimmedOptional(LIMITS.CITY),
  address_city: trimmedOptional(LIMITS.CITY),
  address_state: trimmedOptional(2),
  address_zip: trimmedOptional(LIMITS.CEP),
  status: z.enum(["active", "inactive", "negotiation"]),
  reseller_id: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Network {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  total_licenses: number;
  commercial_contact_name: string | null;
  commercial_contact_phone: string | null;
  commercial_contact_email: string | null;
  technical_contact_name: string | null;
  technical_contact_phone: string | null;
  technical_contact_email: string | null;
  financial_contact_name: string | null;
  financial_contact_phone: string | null;
  financial_contact_email: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  reseller_id: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  billing_day?: number | null;
  billing_type?: string | null;
  main_billing_cnpj?: string | null;
  cnpjs?: string[] | null;
  financial_email?: string | null;
}

export default function Empresas() {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [resellers, setResellers] = useState<any[]>([]);
  const [promotionCounts, setPromotionCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNetwork, setEditingNetwork] = useState<Network | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchingCEP, setIsSearchingCEP] = useState(false);
  const [showPromotionsDialog, setShowPromotionsDialog] = useState(false);
  const [selectedNetworkForPromos, setSelectedNetworkForPromos] = useState<{ id: string; name: string } | null>(null);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      commercial_contact_name: "",
      commercial_contact_phone: "",
      commercial_contact_email: "",
      technical_contact_name: "",
      technical_contact_phone: "",
      technical_contact_email: "",
      financial_contact_name: "",
      financial_contact_phone: "",
      financial_contact_email: "",
      address_street: "",
      address_number: "",
      address_complement: "",
      address_neighborhood: "",
      address_city: "",
      address_state: "",
      address_zip: "",
      status: "active",
      reseller_id: undefined,
    },
  });

  useEffect(() => {
    loadNetworks();
    loadResellers();
    loadPromotionCounts();
  }, []);

  const loadNetworks = async () => {
    try {
      const { data, error } = await supabase
        .from("networks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNetworks(data || []);
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

  const loadResellers = async () => {
    try {
      const { data, error } = await supabase
        .from("resellers")
        .select("id, company_name")
        .eq("is_active", true)
        .order("company_name", { ascending: true });

      if (error) throw error;
      setResellers(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar revendas:", error);
    }
  };

  const loadPromotionCounts = async () => {
    try {
      const { data, error } = await supabase
        .from("one_promotions")
        .select("network_id, is_active");

      if (error) throw error;

      // Contar promoções ativas por rede
      const counts: Record<string, number> = {};
      data?.forEach((promo) => {
        if (promo.is_active) {
          counts[promo.network_id] = (counts[promo.network_id] || 0) + 1;
        }
      });

      setPromotionCounts(counts);
    } catch (error: any) {
      console.error("Erro ao carregar contagem de promoções:", error);
    }
  };

  const handleSearchCEP = async () => {
    const cep = form.getValues("address_zip");
    
    if (!cep) {
      toast({
        title: "CEP obrigatório",
        description: "Digite um CEP para buscar",
        variant: "destructive",
      });
      return;
    }

    setIsSearchingCEP(true);
    console.log("Buscando CEP:", cep);

    try {
      const { data, error } = await supabase.functions.invoke("buscar-cep", {
        body: { cep },
      });

      if (error) throw error;

      console.log("Dados recebidos:", data);

      if (data.error) {
        toast({
          title: "Erro ao buscar CEP",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      // Preencher o formulário com os dados
      form.setValue("address_street", data.logradouro || "");
      form.setValue("address_neighborhood", data.bairro || "");
      form.setValue("address_city", data.municipio || "");
      form.setValue("address_state", data.uf || "");

      toast({
        title: "Dados encontrados!",
        description: "Os campos foram preenchidos automaticamente. Preencha o número e complemento.",
      });

    } catch (error: any) {
      console.error("Erro ao buscar CEP:", error);
      toast({
        title: "Erro ao buscar CEP",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSearchingCEP(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    console.log("Form submitted with data:", data);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado",
          variant: "destructive",
        });
        return;
      }

      console.log("User session:", session.session.user.id);

      if (editingNetwork) {
        // Update
        console.log("Updating network:", editingNetwork.id);
        const { error } = await supabase
          .from("networks")
          .update({
            ...data,
            reseller_id: data.reseller_id || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingNetwork.id);

        if (error) {
          console.error("Update error:", error);
          throw error;
        }

        toast({
          title: "Empresa atualizada!",
          description: "A empresa foi atualizada com sucesso.",
        });
      } else {
        // Create
        console.log("Creating new network");
        const insertData = {
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          commercial_contact_name: data.commercial_contact_name || null,
          commercial_contact_phone: data.commercial_contact_phone || null,
          commercial_contact_email: data.commercial_contact_email || null,
          technical_contact_name: data.technical_contact_name || null,
          technical_contact_phone: data.technical_contact_phone || null,
          technical_contact_email: data.technical_contact_email || null,
          financial_contact_name: data.financial_contact_name || null,
          financial_contact_phone: data.financial_contact_phone || null,
          financial_contact_email: data.financial_contact_email || null,
          address_street: data.address_street || null,
          address_number: data.address_number || null,
          address_complement: data.address_complement || null,
          address_neighborhood: data.address_neighborhood || null,
          address_city: data.address_city || null,
          address_state: data.address_state || null,
          address_zip: data.address_zip || null,
          status: data.status,
          reseller_id: data.reseller_id || null,
          created_by: session.session.user.id,
          total_licenses: 0,
        };
        
        console.log("Insert data:", insertData);
        
        const { data: newNetwork, error } = await supabase
          .from("networks")
          .insert([insertData])
          .select()
          .single();

        if (error) {
          console.error("Insert error:", error);
          throw error;
        }

        // Só criar gestor e enviar email se status for 'active'
        if (data.status === 'active') {
          try {
            const { error: managerError } = await supabase.functions.invoke('create-network-manager', {
              body: {
                name: data.commercial_contact_name || data.name,
                email: data.email,
                network_id: newNetwork.id,
                network_name: data.name
              }
            });

            if (managerError) {
              console.error('Erro ao criar gestor:', managerError);
              toast({
                title: "Empresa cadastrada!",
                description: "Empresa criada, mas houve erro ao criar o usuário gestor. Configure manualmente.",
                variant: "default",
              });
            } else {
              toast({
                title: "Empresa cadastrada!",
                description: "Empresa criada e e-mail de boas-vindas enviado para criar a senha de acesso.",
              });
            }
          } catch (managerErr) {
            console.error('Erro ao criar gestor:', managerErr);
            toast({
              title: "Empresa cadastrada!",
              description: "Empresa criada, mas houve erro ao enviar e-mail de boas-vindas.",
            });
          }
        } else if (data.status === 'negotiation') {
          toast({
            title: "Empresa cadastrada!",
            description: "Empresa cadastrada como 'Em Negociação'. Ative a empresa para criar o acesso e enviar e-mail de boas-vindas.",
          });
        } else {
          toast({
            title: "Empresa cadastrada!",
            description: "Empresa cadastrada com sucesso.",
          });
        }
      }

      setIsDialogOpen(false);
      form.reset();
      setEditingNetwork(null);
      loadNetworks();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({
        title: "Erro ao salvar empresa",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleView = (network: Network) => {
    setEditingNetwork(network);
    setIsViewMode(true);
    form.reset({
      name: network.name,
      email: network.email,
      phone: network.phone || "",
      commercial_contact_name: network.commercial_contact_name || "",
      commercial_contact_phone: network.commercial_contact_phone || "",
      commercial_contact_email: network.commercial_contact_email || "",
      technical_contact_name: network.technical_contact_name || "",
      technical_contact_phone: network.technical_contact_phone || "",
      technical_contact_email: network.technical_contact_email || "",
      financial_contact_name: network.financial_contact_name || "",
      financial_contact_phone: network.financial_contact_phone || "",
      financial_contact_email: network.financial_contact_email || "",
      address_street: network.address_street || "",
      address_number: network.address_number || "",
      address_complement: network.address_complement || "",
      address_neighborhood: network.address_neighborhood || "",
      address_city: network.address_city || "",
      address_state: network.address_state || "",
      address_zip: network.address_zip || "",
      status: network.status as "active" | "inactive" | "negotiation",
      reseller_id: network.reseller_id || undefined,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (network: Network) => {
    setEditingNetwork(network);
    setIsViewMode(false);
    form.reset({
      name: network.name,
      email: network.email,
      phone: network.phone || "",
      commercial_contact_name: network.commercial_contact_name || "",
      commercial_contact_phone: network.commercial_contact_phone || "",
      commercial_contact_email: network.commercial_contact_email || "",
      technical_contact_name: network.technical_contact_name || "",
      technical_contact_phone: network.technical_contact_phone || "",
      technical_contact_email: network.technical_contact_email || "",
      financial_contact_name: network.financial_contact_name || "",
      financial_contact_phone: network.financial_contact_phone || "",
      financial_contact_email: network.financial_contact_email || "",
      address_street: network.address_street || "",
      address_number: network.address_number || "",
      address_complement: network.address_complement || "",
      address_neighborhood: network.address_neighborhood || "",
      address_city: network.address_city || "",
      address_state: network.address_state || "",
      address_zip: network.address_zip || "",
      status: network.status as "active" | "inactive" | "negotiation",
      reseller_id: network.reseller_id || undefined,
    });
    setIsDialogOpen(true);
  };

  const handleActivateNetwork = async (network: Network) => {
    if (!confirm(`Ao ativar a empresa ${network.name}, será criado o acesso do gestor e enviado e-mail de boas-vindas. Confirma?`)) return;

    try {
      // Atualizar status para ativa
      const { error: updateError } = await supabase
        .from("networks")
        .update({ 
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq("id", network.id);

      if (updateError) throw updateError;

      // Criar gestor e enviar e-mail de boas-vindas
      try {
        const { error: managerError } = await supabase.functions.invoke('create-network-manager', {
          body: {
            name: network.commercial_contact_name || network.name,
            email: network.email,
            network_id: network.id,
            network_name: network.name
          }
        });

        if (managerError) {
          console.error('Erro ao criar gestor:', managerError);
          toast({
            title: "Empresa ativada!",
            description: "Empresa ativada, mas houve erro ao criar o usuário gestor. Configure manualmente.",
            variant: "default",
          });
        } else {
          toast({
            title: "Empresa ativada!",
            description: "Empresa ativada e e-mail de boas-vindas enviado para criar a senha de acesso.",
          });
        }
      } catch (managerErr) {
        console.error('Erro ao criar gestor:', managerErr);
        toast({
          title: "Empresa ativada!",
          description: "Empresa ativada, mas houve erro ao enviar e-mail de boas-vindas.",
        });
      }

      loadNetworks();
    } catch (error: any) {
      toast({
        title: "Erro ao ativar empresa",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = async (network: Network) => {
    const newStatus = network.status === "active" ? "inactive" : "active";
    const action = newStatus === "active" ? "ativar" : "inativar";
    
    if (!confirm(`Tem certeza que deseja ${action} a empresa ${network.name}?`)) return;

    try {
      const { error } = await supabase
        .from("networks")
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", network.id);

      if (error) throw error;

      toast({
        title: `Empresa ${newStatus === "active" ? "ativada" : "inativada"}!`,
        description: `A empresa foi ${newStatus === "active" ? "ativada" : "inativada"} com sucesso.`,
      });

      loadNetworks();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta empresa?")) return;

    try {
      const { error } = await supabase.from("networks").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Empresa excluída!",
        description: "A empresa foi excluída com sucesso.",
      });
      loadNetworks();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir empresa",
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

  const handleResendWelcomeEmail = async (network: Network) => {
    try {
      const { error } = await supabase.functions.invoke('resend-welcome-email', {
        body: { network_id: network.id }
      });

      if (error) throw error;

      toast({
        title: "E-mail reenviado!",
        description: `E-mail de boas-vindas reenviado para ${network.email}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao reenviar e-mail",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async (network: Network) => {
    if (!confirm(`Resetar a senha do gestor da rede ${network.name} para "Leva+2025"?`)) return;
    
    try {
      // First, get the user_id for this network
      const { data: managerData, error: managerError } = await supabase
        .from('store_managers')
        .select('user_id')
        .eq('network_id', network.id)
        .is('store_id', null)
        .single();

      if (managerError || !managerData) {
        throw new Error('Gestor não encontrado');
      }

      const { error } = await supabase.functions.invoke('reset-network-manager-password', {
        body: { user_id: managerData.user_id }
      });

      if (error) throw error;

      toast({
        title: "Senha resetada com sucesso!",
        description: "A senha foi resetada para Leva+2025. O gestor deverá trocar a senha no próximo login.",
      });
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        title: "Erro ao resetar senha",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const navigate = useNavigate();

  const filteredNetworks = networks.filter(network =>
    network.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    network.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie as empresas cadastradas</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Empresa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isViewMode ? "Visualizar Empresa" : editingNetwork ? "Editar Empresa" : "Nova Empresa"}
              </DialogTitle>
              <DialogDescription>
                {isViewMode ? "Informações da empresa" : "Preencha os dados da empresa abaixo"}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form 
                onSubmit={(e) => {
                  console.log("Form submit event triggered");
                  form.handleSubmit(onSubmit)(e);
                }} 
                className="space-y-6"
              >
                {/* Dados Gerais */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Dados Gerais
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Nome da Empresa *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Nome da empresa" maxLength={LIMITS.NAME} disabled={isViewMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="email@empresa.com" maxLength={LIMITS.EMAIL} disabled={isViewMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="(00) 0000-0000" maxLength={LIMITS.PHONE} disabled={isViewMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Status *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isViewMode}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Ativo</SelectItem>
                              <SelectItem value="inactive">Inativo</SelectItem>
                              <SelectItem value="negotiation">Em Negociação</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="reseller_id"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Revenda</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              // Convert "none" back to empty string
                              field.onChange(value === "none" ? "" : value);
                            }} 
                            value={field.value || "none"} 
                            disabled={isViewMode}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione uma revenda (opcional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Nenhuma</SelectItem>
                              {resellers.map((reseller) => (
                                <SelectItem key={reseller.id} value={reseller.id}>
                                  {reseller.company_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Contato Comercial */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Contato Comercial</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="commercial_contact_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Nome do contato" maxLength={LIMITS.NAME} disabled={isViewMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="commercial_contact_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="(00) 00000-0000" maxLength={LIMITS.PHONE} disabled={isViewMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="commercial_contact_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="email@empresa.com" maxLength={LIMITS.EMAIL} disabled={isViewMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Contato Técnico */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Contato Técnico</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="technical_contact_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Nome do contato" maxLength={LIMITS.NAME} disabled={isViewMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="technical_contact_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="(00) 00000-0000" maxLength={LIMITS.PHONE} disabled={isViewMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="technical_contact_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="email@empresa.com" maxLength={LIMITS.EMAIL} disabled={isViewMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Contato Financeiro */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Contato Financeiro</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="financial_contact_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Nome do contato" maxLength={LIMITS.NAME} disabled={isViewMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="financial_contact_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="(00) 00000-0000" maxLength={LIMITS.PHONE} disabled={isViewMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="financial_contact_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="email@empresa.com" maxLength={LIMITS.EMAIL} disabled={isViewMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Endereço */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Endereço da Sede</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="address_zip"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input {...field} placeholder="00000-000" maxLength={LIMITS.CEP} disabled={isViewMode} />
                            </FormControl>
                            {!isViewMode && (
                              <Button
                                type="button"
                                onClick={handleSearchCEP}
                                disabled={isSearchingCEP}
                                size="sm"
                                className="shrink-0"
                              >
                                <MapPin className="h-4 w-4 mr-1" />
                                {isSearchingCEP ? "Buscando..." : "Buscar"}
                              </Button>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address_street"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rua</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Nome da rua" maxLength={LIMITS.ADDRESS} disabled={isViewMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="123" maxLength={20} disabled={isViewMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address_complement"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Complemento</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Sala, andar, etc" maxLength={LIMITS.SHORT_TEXT} disabled={isViewMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address_neighborhood"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bairro</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Bairro" maxLength={LIMITS.CITY} disabled={isViewMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address_city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Cidade" maxLength={LIMITS.CITY} disabled={isViewMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address_state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="UF" maxLength={2} disabled={isViewMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Dados do Contrato - Apenas visualização */}
                {isViewMode && editingNetwork && (
                  <div className="space-y-4">
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-lg">Dados do Contrato</h3>
                        <Button
                          variant="outline"
                          size="sm"
                          id="download-contract-btn"
                          onClick={async () => {
                            const btn = document.getElementById("download-contract-btn");
                            if (btn) btn.setAttribute("data-loading", "true");
                            
                            try {
                              toast({
                                title: "Gerando contrato",
                                description: "Por favor aguarde...",
                              });

                              // Buscar orçamento aprovado da network
                              const { data: budget } = await supabase
                                .from("budgets")
                                .select("id, budget_number")
                                .eq("network_id", editingNetwork.id)
                                .eq("status", "approved")
                                .order("approved_at", { ascending: false })
                                .limit(1)
                                .maybeSingle();

                              if (!budget) {
                                toast({
                                  title: "Contrato não encontrado",
                                  description: "Nenhum orçamento aprovado encontrado para esta empresa",
                                  variant: "destructive",
                                });
                                return;
                              }

                              // Gerar HTML via edge function
                              const { data, error } = await supabase.functions.invoke("generate-audit-pdf", {
                                body: { budget_id: budget.id },
                              });

                              if (error) throw error;

                              // Criar elemento temporário para renderizar HTML
                              const tempDiv = document.createElement('div');
                              tempDiv.innerHTML = data.html;
                              tempDiv.style.width = '210mm';
                              tempDiv.style.position = 'absolute';
                              tempDiv.style.left = '-9999px';
                              tempDiv.style.top = '0';
                              tempDiv.style.backgroundColor = 'white';
                              document.body.appendChild(tempDiv);

                              // Aguardar renderização
                              await new Promise(resolve => setTimeout(resolve, 500));

                              // Gerar canvas e PDF
                              const canvas = await html2canvas(tempDiv, {
                                scale: 2,
                                useCORS: true,
                                logging: false,
                                backgroundColor: '#ffffff',
                              });

                              // Remover elemento temporário
                              document.body.removeChild(tempDiv);

                              // Criar PDF
                              const pdf = new jsPDF('p', 'mm', 'a4');
                              const imgWidth = 210;
                              const pageHeight = 297;
                              const imgHeight = (canvas.height * imgWidth) / canvas.width;
                              let heightLeft = imgHeight;
                              let position = 0;

                              // Adicionar primeira página
                              pdf.addImage(
                                canvas.toDataURL('image/jpeg', 0.95),
                                'JPEG',
                                0,
                                position,
                                imgWidth,
                                imgHeight
                              );
                              heightLeft -= pageHeight;

                              // Adicionar páginas adicionais se necessário
                              while (heightLeft >= 0) {
                                position = heightLeft - imgHeight;
                                pdf.addPage();
                                pdf.addImage(
                                  canvas.toDataURL('image/jpeg', 0.95),
                                  'JPEG',
                                  0,
                                  position,
                                  imgWidth,
                                  imgHeight
                                );
                                heightLeft -= pageHeight;
                              }

                              // Download do PDF
                              pdf.save(`Contrato_${budget.budget_number}.pdf`);

                              toast({
                                title: "Download concluído",
                                description: "Contrato baixado com sucesso",
                              });
                            } catch (error: any) {
                              console.error("Erro ao gerar PDF:", error);
                              toast({
                                title: "Erro ao baixar contrato",
                                description: error.message,
                                variant: "destructive",
                              });
                            } finally {
                              const btn = document.getElementById("download-contract-btn");
                              if (btn) btn.removeAttribute("data-loading");
                            }
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Baixar Contrato
                        </Button>
                      </div>
                      
                      {editingNetwork.contract_start_date && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <Label>Data de Início</Label>
                            <div className="mt-1 p-2 bg-muted rounded-md text-sm">
                              {new Date(editingNetwork.contract_start_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                          <div>
                            <Label>Data de Término</Label>
                            <div className="mt-1 p-2 bg-muted rounded-md text-sm">
                              {editingNetwork.contract_end_date 
                                ? new Date(editingNetwork.contract_end_date + 'T00:00:00').toLocaleDateString('pt-BR')
                                : 'Não definido'
                              }
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {editingNetwork.billing_day && (
                          <div>
                            <Label>Dia de Vencimento</Label>
                            <div className="mt-1 p-2 bg-muted rounded-md text-sm">
                              Dia {editingNetwork.billing_day}
                            </div>
                          </div>
                        )}
                        
                        {editingNetwork.billing_type && (
                          <div>
                            <Label>Tipo de Faturamento</Label>
                            <div className="mt-1 p-2 bg-muted rounded-md text-sm">
                              {editingNetwork.billing_type === 'per_cnpj' ? 'Um boleto por CNPJ' : 'Boleto único consolidado'}
                            </div>
                          </div>
                        )}
                      </div>

                      {editingNetwork.financial_email && (
                        <div className="mb-4">
                          <Label>E-mail Financeiro</Label>
                          <div className="mt-1 p-2 bg-muted rounded-md text-sm">
                            {editingNetwork.financial_email}
                          </div>
                        </div>
                      )}

                      {editingNetwork.billing_type === 'single_cnpj' && editingNetwork.main_billing_cnpj && (
                        <div className="mb-4">
                          <Label>CNPJ Principal para Faturamento</Label>
                          <div className="mt-1 p-2 bg-muted rounded-md text-sm font-mono">
                            {editingNetwork.main_billing_cnpj.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
                          </div>
                        </div>
                      )}

                      {editingNetwork.cnpjs && editingNetwork.cnpjs.length > 0 && (
                        <div>
                          <Label>CNPJs da Proposta ({editingNetwork.cnpjs.length})</Label>
                          <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                            {editingNetwork.cnpjs.map((cnpj, index) => (
                              <div key={index} className="p-2 bg-muted rounded-md text-sm font-mono">
                                {cnpj.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                    {isViewMode ? "Fechar" : "Cancelar"}
                  </Button>
                  {!isViewMode && (
                    <Button type="submit">
                      {editingNetwork ? "Atualizar" : "Cadastrar"}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Promoções ONE</TableHead>
              <TableHead className="text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredNetworks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {searchTerm ? "Nenhuma empresa encontrada" : "Nenhuma empresa cadastrada"}
                </TableCell>
              </TableRow>
            ) : (
              filteredNetworks.map((network) => {
                const promoCount = promotionCounts[network.id] || 0;
                return (
                <TableRow key={network.id}>
                  <TableCell className="font-medium">{network.name}</TableCell>
                  <TableCell>{network.email}</TableCell>
                  <TableCell>{network.phone || "-"}</TableCell>
                  <TableCell>{network.address_city || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={
                      network.status === "active" ? "default" : 
                      network.status === "negotiation" ? "outline" : 
                      "secondary"
                    }>
                      {network.status === "active" ? "Ativo" : 
                       network.status === "negotiation" ? "Em Negociação" : 
                       "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        promoCount > 5 ? "default" : 
                        promoCount > 0 ? "secondary" : 
                        "outline"
                      }
                      className={`cursor-pointer transition-all ${
                        promoCount > 5 ? "bg-yellow-500 hover:bg-yellow-600" : 
                        promoCount > 0 ? "bg-blue-500 hover:bg-blue-600" : 
                        ""
                      }`}
                      onClick={() => {
                        setSelectedNetworkForPromos({ id: network.id, name: network.name });
                        setShowPromotionsDialog(true);
                      }}
                    >
                      <Star className="h-3 w-3 mr-1" />
                      {promoCount} {promoCount === 1 ? 'promoção' : 'promoções'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {network.status === "negotiation" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleActivateNetwork(network)}
                          title="Ativar e Enviar Boas-Vindas"
                          className="text-green-600 hover:text-green-700"
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleView(network)}
                        title="Visualizar"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(network)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleResendWelcomeEmail(network)}
                        title="Reenviar e-mail de boas-vindas"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleResetPassword(network)}
                        title="Resetar senha para Leva+2025"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleStatus(network)}
                        title={network.status === "active" ? "Inativar" : "Ativar"}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(network.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
              })
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Modal de Detalhes de Promoções */}
      {selectedNetworkForPromos && (
        <PromotionsDetailDialog
          open={showPromotionsDialog}
          onOpenChange={setShowPromotionsDialog}
          networkId={selectedNetworkForPromos.id}
          networkName={selectedNetworkForPromos.name}
        />
      )}
    </div>
  );
}
