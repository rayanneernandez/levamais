import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Search, Store, ArrowLeft, Eye, Power, Upload } from "lucide-react";
import { StoreImportDialog } from "@/components/admin/StoreImportDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { LIMITS, trimmedString, trimmedOptional, cleanText, cleanEmail } from "@/lib/input-sanitization";

const formSchema = z.object({
  network_id: z.string().min(1, "Selecione uma empresa"),
  cnpj: trimmedString(LIMITS.CPF_CNPJ, { min: 14, minMessage: "CNPJ deve ter 14 dígitos" }),
  razao_social: trimmedString(LIMITS.NAME, { min: 2, minMessage: "Razão social é obrigatória" }),
  nome_fantasia: trimmedOptional(LIMITS.NAME),
  apelido: trimmedString(LIMITS.NAME, { min: 2, minMessage: "Apelido da loja é obrigatório" }),
  logradouro: trimmedOptional(LIMITS.ADDRESS),
  numero: trimmedOptional(20),
  complemento: trimmedOptional(LIMITS.SHORT_TEXT),
  bairro: trimmedOptional(LIMITS.CITY),
  municipio: trimmedOptional(LIMITS.CITY),
  uf: trimmedOptional(2),
  cep: trimmedOptional(LIMITS.CEP),
  contact_name: trimmedOptional(LIMITS.NAME),
  contact_phone: trimmedOptional(LIMITS.PHONE),
  contact_email: z.string().trim().toLowerCase().email("Email inválido").max(LIMITS.EMAIL).optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
});

type FormData = z.infer<typeof formSchema>;

interface Network {
  id: string;
  name: string;
  max_stores: number;
}

interface Store {
  id: string;
  network_id: string;
  name: string;
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: string;
  networks: {
    name: string;
  };
}

export default function Lojas() {
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [isSearchingCNPJ, setIsSearchingCNPJ] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      network_id: "",
      cnpj: "",
      razao_social: "",
      nome_fantasia: "",
      apelido: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      municipio: "",
      uf: "",
      cep: "",
      contact_name: "",
      contact_phone: "",
      contact_email: "",
      status: "active",
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Carregar lojas
      const { data: storesData, error: storesError } = await supabase
        .from("stores")
        .select("id, network_id, name, cnpj, razao_social, nome_fantasia, address, contact_name, contact_phone, contact_email, status, networks(name)")
        .order("created_at", { ascending: false });

      if (storesError) throw storesError;
      setStores(storesData || []);

      // Carregar empresas com licença
      const { data: networksData, error: networksError } = await supabase
        .from("networks")
        .select("id, name, max_stores")
        .gt("max_stores", 0)
        .eq("status", "active")
        .order("name");

      if (networksError) throw networksError;
      setNetworks(networksData || []);

    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const searchCNPJ = async () => {
    const cnpj = form.getValues("cnpj");
    if (!cnpj || cnpj.length < 14) {
      toast({
        title: "CNPJ inválido",
        description: "Digite um CNPJ válido com 14 dígitos",
        variant: "destructive",
      });
      return;
    }

    setIsSearchingCNPJ(true);
    console.log("Buscando CNPJ:", cnpj);

    try {
      const { data, error } = await supabase.functions.invoke("buscar-cnpj", {
        body: { cnpj },
      });

      if (error) throw error;

      console.log("Dados recebidos:", data);

      if (data.error) {
        toast({
          title: "Erro ao buscar CNPJ",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      // Preencher o formulário com os dados
      form.setValue("razao_social", data.razao_social || "");
      form.setValue("nome_fantasia", data.nome_fantasia || "");
      form.setValue("logradouro", data.logradouro || "");
      form.setValue("numero", data.numero || "");
      form.setValue("complemento", data.complemento || "");
      form.setValue("bairro", data.bairro || "");
      form.setValue("municipio", data.municipio || "");
      form.setValue("uf", data.uf || "");
      form.setValue("cep", data.cep || "");
      
      if (data.ddd_telefone_1) {
        form.setValue("contact_phone", data.ddd_telefone_1);
      }
      
      if (data.email) {
        form.setValue("contact_email", data.email);
      }

      toast({
        title: "Dados encontrados!",
        description: "Os campos foram preenchidos automaticamente",
      });

    } catch (error: any) {
      console.error("Erro ao buscar CNPJ:", error);
      toast({
        title: "Erro ao buscar CNPJ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSearchingCNPJ(false);
    }
  };

  const validateStoreLimit = async (networkId: string): Promise<boolean> => {
    // Contar lojas ATIVAS da empresa
    const { count, error } = await supabase
      .from("stores")
      .select("*", { count: "exact", head: true })
      .eq("network_id", networkId)
      .eq("status", "active");

    if (error) throw error;

    // Buscar limite da empresa
    const network = networks.find(n => n.id === networkId);
    if (!network) {
      toast({
        title: "Erro",
        description: "Empresa não encontrada",
        variant: "destructive",
      });
      return false;
    }

    if (count !== null && count >= network.max_stores) {
      toast({
        title: "Limite atingido",
        description: `Esta empresa já atingiu o limite de ${network.max_stores} loja(s) cadastrada(s)`,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const onSubmit = async (data: FormData) => {
    console.log("Form submitted with data:", data);
    
    try {
      if (!editingStore) {
        // Validar limite de lojas ao criar
        const canCreate = await validateStoreLimit(data.network_id);
        if (!canCreate) return;
      }

      // Montar endereço completo para salvar - manter todos os campos para preservar a ordem
      const endereco = [
        data.logradouro || "",
        data.numero || "",
        data.complemento || "",
        data.bairro || "",
        data.municipio || "",
        data.uf || "",
        data.cep || ""
      ].join(", ");

      if (editingStore) {
        // Update
        const { error } = await supabase
          .from("stores")
          .update({
            network_id: data.network_id,
            cnpj: data.cnpj,
            name: data.apelido,
            razao_social: data.razao_social || null,
            nome_fantasia: data.nome_fantasia || null,
            contact_name: data.contact_name || null,
            contact_phone: data.contact_phone || null,
            contact_email: data.contact_email || null,
            address: endereco || null,
            status: data.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingStore.id);

        if (error) throw error;

        toast({
          title: "Loja atualizada!",
          description: "A loja foi atualizada com sucesso.",
        });
      } else {
        // Create - Buscar configurações da primeira loja da rede para manter consistência
        const { data: networkStore } = await supabase
          .from("stores")
          .select("*")
          .eq("network_id", data.network_id)
          .limit(1)
          .maybeSingle();

        // Usar configurações da rede ou valores padrão
        const storeData: any = {
          network_id: data.network_id,
          cnpj: data.cnpj,
          name: data.apelido,
          razao_social: data.razao_social || null,
          nome_fantasia: data.nome_fantasia || null,
          contact_name: data.contact_name || null,
          contact_phone: data.contact_phone || null,
          contact_email: data.contact_email || null,
          address: endereco || null,
          status: data.status,
        };

        if (networkStore) {
          // Herdar todas as configurações de fidelidade da rede
          storeData.loyalty_type = networkStore.loyalty_type;
          storeData.points_per_real = networkStore.points_per_real;
          storeData.real_per_point = networkStore.real_per_point;
          storeData.cashback_type = networkStore.cashback_type;
          storeData.cashback_percentage = networkStore.cashback_percentage;
          storeData.cashback_fixed_value = networkStore.cashback_fixed_value;
          storeData.signup_bonus_points = networkStore.signup_bonus_points;
          storeData.signup_bonus_cashback = networkStore.signup_bonus_cashback;
          storeData.points_validity_days = networkStore.points_validity_days;
          storeData.min_redeem_cashback = networkStore.min_redeem_cashback;
          storeData.max_redeem_cashback = networkStore.max_redeem_cashback;
          storeData.min_redeem_points = networkStore.min_redeem_points;
          storeData.max_redeem_points = networkStore.max_redeem_points;
          storeData.max_redemptions_24h = networkStore.max_redemptions_24h;
          storeData.enable_cashback_accumulation_block = networkStore.enable_cashback_accumulation_block;
          storeData.block_accumulation_cashback_limit = networkStore.block_accumulation_cashback_limit;
          storeData.enable_points_accumulation_block = networkStore.enable_points_accumulation_block;
          storeData.block_accumulation_points_limit = networkStore.block_accumulation_points_limit;
        } else {
          // Valores padrão caso seja a primeira loja da rede
          storeData.loyalty_type = "points";
          storeData.points_per_real = 1;
          storeData.points_validity_days = 365;
        }

        const { error } = await supabase.from("stores").insert([storeData]);

        if (error) throw error;

        toast({
          title: "Loja cadastrada!",
          description: "A loja foi cadastrada com sucesso.",
        });
      }

      setIsDialogOpen(false);
      form.reset();
      setEditingStore(null);
      loadData();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({
        title: "Erro ao salvar loja",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleView = (store: Store) => {
    setEditingStore(store);
    setIsViewMode(true);
    const addressParts = store.address?.split(", ") || [];
    form.reset({
      network_id: store.network_id,
      cnpj: store.cnpj,
      razao_social: store.razao_social || "",
      nome_fantasia: store.nome_fantasia || "",
      apelido: store.name,
      logradouro: addressParts[0] || "",
      numero: addressParts[1] || "",
      complemento: addressParts[2] || "",
      bairro: addressParts[3] || "",
      municipio: addressParts[4] || "",
      uf: addressParts[5] || "",
      cep: addressParts[6] || "",
      contact_name: store.contact_name || "",
      contact_phone: store.contact_phone || "",
      contact_email: store.contact_email || "",
      status: store.status as "active" | "inactive",
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (store: Store) => {
    setEditingStore(store);
    setIsViewMode(false);
    const addressParts = store.address?.split(", ") || [];
    form.reset({
      network_id: store.network_id,
      cnpj: store.cnpj,
      razao_social: store.razao_social || "",
      nome_fantasia: store.nome_fantasia || "",
      apelido: store.name,
      logradouro: addressParts[0] || "",
      numero: addressParts[1] || "",
      complemento: addressParts[2] || "",
      bairro: addressParts[3] || "",
      municipio: addressParts[4] || "",
      uf: addressParts[5] || "",
      cep: addressParts[6] || "",
      contact_name: store.contact_name || "",
      contact_phone: store.contact_phone || "",
      contact_email: store.contact_email || "",
      status: store.status as "active" | "inactive",
    });
    setIsDialogOpen(true);
  };

  const handleToggleStatus = async (store: Store) => {
    const newStatus = store.status === "active" ? "inactive" : "active";
    const action = newStatus === "inactive" ? "desativar" : "ativar";
    
    if (!confirm(`Tem certeza que deseja ${action} a loja "${store.name}"?`)) return;

    try {
      const { error } = await supabase
        .from("stores")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", store.id);

      if (error) throw error;

      toast({
        title: `Loja ${newStatus === "active" ? "ativada" : "desativada"}!`,
        description: `A loja "${store.name}" foi ${newStatus === "active" ? "ativada" : "desativada"} com sucesso.`,
      });
      loadData();
    } catch (error: any) {
      toast({
        title: `Erro ao ${action} loja`,
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta loja? Esta ação é irreversível.")) return;

    try {
      const { error } = await supabase.from("stores").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Loja excluída!",
        description: "A loja foi excluída com sucesso.",
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir loja",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setIsDialogOpen(false);
      setEditingStore(null);
      setIsViewMode(false);
      form.reset();
    } else {
      setIsDialogOpen(true);
    }
  };

  const filteredStores = selectedNetwork === "all" 
    ? stores 
    : stores.filter(store => store.network_id === selectedNetwork);

  const searchFilteredStores = filteredStores.filter(store =>
    store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.cnpj.includes(searchTerm) ||
    store.networks.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lojas</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie as lojas cadastradas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar planilha
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Loja
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                {isViewMode ? "Visualizar Loja" : editingStore ? "Editar Loja" : "Nova Loja"}
              </DialogTitle>
              <DialogDescription>
                {isViewMode ? "Informações da loja" : "Preencha os dados da loja abaixo"}
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
                <FormField
                  control={form.control}
                  name="network_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empresa *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={!!editingStore || isViewMode}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a empresa" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {networks.map((network) => (
                            <SelectItem key={network.id} value={network.id}>
                              {network.name} (Máx: {network.max_stores} lojas)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Selecione a empresa que esta loja pertence
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="cnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ *</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="00.000.000/0000-00"
                              maxLength={18}
                              disabled={isViewMode}
                            />
                          </FormControl>
                          {!isViewMode && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={searchCNPJ}
                              disabled={isSearchingCNPJ}
                            >
                              <Search className="h-4 w-4 mr-2" />
                              {isSearchingCNPJ ? "Buscando..." : "Buscar"}
                            </Button>
                          )}
                        </div>
                        <FormDescription>
                          Digite o CNPJ e clique em Buscar para preencher automaticamente
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="razao_social"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Razão Social *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Razão social da empresa" maxLength={LIMITS.NAME} disabled={isViewMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nome_fantasia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Fantasia</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nome fantasia (opcional)" maxLength={LIMITS.NAME} disabled={isViewMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="apelido"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apelido da Loja *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nome de identificação da loja" maxLength={LIMITS.NAME} disabled={isViewMode} />
                        </FormControl>
                        <FormDescription>
                          Este será o nome exibido na listagem
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Endereço</h3>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="logradouro"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Logradouro</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Rua, Avenida, etc" maxLength={LIMITS.ADDRESS} disabled={isViewMode} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="numero"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Nº" maxLength={20} disabled={isViewMode} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="complemento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Complemento</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Sala, Loja, etc (opcional)" maxLength={LIMITS.SHORT_TEXT} disabled={isViewMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="bairro"
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
                        name="cep"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CEP</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="00000-000" maxLength={LIMITS.CEP} disabled={isViewMode} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="municipio"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
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
                        name="uf"
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

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Contato na Loja</h3>
                    <FormField
                      control={form.control}
                      name="contact_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Contato</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Nome do responsável" maxLength={LIMITS.NAME} disabled={isViewMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="contact_phone"
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
                        name="contact_email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="email@loja.com" maxLength={LIMITS.EMAIL} disabled={isViewMode} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
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
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                    {isViewMode ? "Fechar" : "Cancelar"}
                  </Button>
                  {!isViewMode && (
                    <Button type="submit">
                      {editingStore ? "Atualizar" : "Cadastrar"}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <StoreImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        networks={networks}
        onImported={loadData}
      />

      <div className="flex gap-4 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CNPJ ou empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Filtrar por empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {networks.map((network) => (
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
              <TableHead>Nome</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : searchFilteredStores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {searchTerm || selectedNetwork !== "all" ? "Nenhuma loja encontrada" : "Nenhuma loja cadastrada"}
                </TableCell>
              </TableRow>
            ) : (
              searchFilteredStores.map((store) => (
                <TableRow key={store.id}>
                  <TableCell className="font-medium">{store.name}</TableCell>
                  <TableCell>{store.cnpj}</TableCell>
                  <TableCell>{store.networks.name}</TableCell>
                  <TableCell>
                    <Badge variant={store.status === "active" ? "default" : "secondary"}>
                      {store.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleView(store)}
                        title="Visualizar"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(store)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleStatus(store)}
                        title={store.status === "active" ? "Desativar" : "Ativar"}
                      >
                        <Power className={`h-4 w-4 ${store.status === "active" ? "text-destructive" : "text-green-600"}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(store.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
