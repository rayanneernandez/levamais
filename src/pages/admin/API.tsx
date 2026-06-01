import { useState, useEffect } from "react";
import { Plus, Copy, Eye, EyeOff, Trash2, RefreshCw, Key, Code, Plug, PlugZap, Power, Pencil, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientPortalAPIDocumentation } from "@/components/admin/ClientPortalAPIDocumentation";
import { LIMITS, trimmedString, trimmedOptional, cleanText } from "@/lib/input-sanitization";

const formSchema = z.object({
  network_id: z.string().min(1, "Selecione uma rede"),
  name: trimmedString(LIMITS.NAME, { min: 3, minMessage: "Nome deve ter pelo menos 3 caracteres" }),
  description: trimmedOptional(LIMITS.MEDIUM_TEXT),
});

const integrationFormSchema = z.object({
  name: trimmedString(LIMITS.NAME, { min: 3, minMessage: "Nome deve ter pelo menos 3 caracteres" }),
  provider: z.string().min(1, "Selecione um provider"),
  description: trimmedOptional(LIMITS.MEDIUM_TEXT),
  config: z.string().max(2000).optional(),
  // Credenciais
  api_key: z.string().trim().max(500).optional(),
  api_secret: z.string().trim().max(500).optional(),
  account_sid: z.string().trim().max(500).optional(),
  auth_token: z.string().trim().max(500).optional(),
  endpoint: z.string().trim().max(500).optional(),
  token: z.string().trim().max(500).optional(),
});

type FormData = z.infer<typeof formSchema>;
type IntegrationFormData = z.infer<typeof integrationFormSchema>;

interface ApiToken {
  id: string;
  network_id: string;
  token: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  networks?: {
    name: string;
  };
}

interface ApiIntegration {
  id: string;
  name: string;
  provider: string;
  description: string | null;
  status: string;
  config: any;
  credentials: any;
  last_used_at: string | null;
  created_at: string;
}

interface ApiUsageConfig {
  id: string;
  config_type: string;
  integration_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  api_integrations?: {
    name: string;
    provider: string;
  } | null;
}

interface ApiBalance {
  provider: string;
  balance: number | string;
  loading: boolean;
  error: string | null;
  cached_at?: string;
  monthly_usage?: number;
  last_used_at?: string;
  // Para Resend
  transactional?: { limit: number; used: number; remaining: number };
  marketing?: { limit: number; used: number; remaining: number };
  billing_day?: number;
  next_reset?: string;
}

export default function API() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [integrations, setIntegrations] = useState<ApiIntegration[]>([]);
  const [usageConfigs, setUsageConfigs] = useState<ApiUsageConfig[]>([]);
  const [balances, setBalances] = useState<Record<string, ApiBalance>>({});
  const [networks, setNetworks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isIntegrationDialogOpen, setIsIntegrationDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<ApiIntegration | null>(null);
  const [visibleTokens, setVisibleTokens] = useState<Set<string>>(new Set());
  const [deleteTokenId, setDeleteTokenId] = useState<string | null>(null);
  const [deleteIntegrationId, setDeleteIntegrationId] = useState<string | null>(null);
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      network_id: "",
      name: "",
      description: "",
    },
  });

  const integrationForm = useForm<IntegrationFormData>({
    resolver: zodResolver(integrationFormSchema),
    defaultValues: {
      name: "",
      provider: "",
      description: "",
      config: "",
      api_key: "",
      api_secret: "",
      account_sid: "",
      auth_token: "",
      endpoint: "",
      token: "",
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  // Auto-refresh de saldos a cada 1 hora (alinhado com o cache)
  useEffect(() => {
    if (integrations.length > 0) {
      loadBalances();
      
      const intervalId = setInterval(() => {
        loadBalances();
      }, 60 * 60 * 1000); // 1 hora

      return () => clearInterval(intervalId);
    }
  }, [integrations]);

  const loadData = async () => {
    try {
      const [tokensResult, integrationsResult, usageConfigsResult, networksResult] = await Promise.all([
        supabase
          .from("external_api_tokens")
          .select("*, networks(name)")
          .order("created_at", { ascending: false }),
        supabase
          .from("api_integrations")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("api_usage_configs")
          .select("*, api_integrations(name, provider)")
          .order("config_type"),
        supabase.from("networks").select("id, name, status").eq("status", "active").order("name"),
      ]);

      if (tokensResult.error) throw tokensResult.error;
      if (integrationsResult.error) throw integrationsResult.error;
      if (usageConfigsResult.error) throw usageConfigsResult.error;
      if (networksResult.error) throw networksResult.error;

      setTokens(tokensResult.data || []);
      setIntegrations(integrationsResult.data || []);
      setUsageConfigs(usageConfigsResult.data || []);
      setNetworks(networksResult.data || []);
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

  const generateToken = () => {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    return "leva_" + Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  };

  const onSubmit = async (data: FormData) => {
    try {
      const token = generateToken();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("external_api_tokens").insert({
        network_id: data.network_id,
        token: token,
        name: cleanText(data.name, LIMITS.NAME),
        description: cleanText(data.description, LIMITS.MEDIUM_TEXT) || null,
        created_by: user.id,
      });

      if (error) throw error;

      toast({
        title: "Token criado!",
        description: "O token de API foi criado com sucesso. Copie-o agora, não será exibido novamente.",
      });

      setNewlyCreatedToken(token);
      setIsDialogOpen(false);
      form.reset();
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao criar token",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const onSubmitIntegration = async (data: IntegrationFormData) => {
    try {
      let config = null;
      if (data.config) {
        try {
          config = JSON.parse(data.config);
        } catch {
          toast({
            title: "Configuração inválida",
            description: "Use formato JSON válido.",
            variant: "destructive",
          });
          return;
        }
      }

      // Montar objeto de credenciais
      const credentials: any = {};
      
      if (data.provider === "twilio") {
        if (data.account_sid) credentials.account_sid = data.account_sid.trim();
        if (data.auth_token) credentials.auth_token = data.auth_token.trim();
      } else if (data.provider === "resend") {
        if (data.api_key) credentials.api_key = data.api_key.trim();
      } else if (data.provider === "mex10") {
        if (data.token) credentials.token = data.token.trim();
        if (data.endpoint) credentials.endpoint = data.endpoint.trim();
      } else {
        // Para outros providers, usar campos genéricos
        if (data.api_key) credentials.api_key = data.api_key.trim();
        if (data.api_secret) credentials.api_secret = data.api_secret.trim();
      }

      const cleanName = cleanText(data.name, LIMITS.NAME);
      const cleanDescription = cleanText(data.description, LIMITS.MEDIUM_TEXT) || null;

      if (editingIntegration) {
        // Atualizar integração existente
        const { error } = await supabase
          .from("api_integrations")
          .update({
            name: cleanName,
            provider: data.provider,
            description: cleanDescription,
            config,
            credentials: Object.keys(credentials).length > 0 ? credentials : null,
          })
          .eq("id", editingIntegration.id);

        if (error) throw error;

        toast({
          title: "Integração atualizada!",
          description: "A integração foi atualizada com sucesso.",
        });
      } else {
        // Criar nova integração
        const { error } = await supabase.from("api_integrations").insert({
          name: cleanName,
          provider: data.provider,
          description: cleanDescription,
          status: "active",
          config,
          credentials: Object.keys(credentials).length > 0 ? credentials : null,
        });

        if (error) throw error;

        toast({
          title: "Integração criada!",
          description: "A integração foi adicionada com sucesso.",
        });
      }

      setIsIntegrationDialogOpen(false);
      setEditingIntegration(null);
      integrationForm.reset();
      loadData();
    } catch (error: any) {
      toast({
        title: editingIntegration ? "Erro ao atualizar integração" : "Erro ao criar integração",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditIntegration = (integration: ApiIntegration) => {
    setEditingIntegration(integration);
    
    const credentials = integration.credentials || {};
    
    integrationForm.reset({
      name: integration.name,
      provider: integration.provider,
      description: integration.description || "",
      config: integration.config ? JSON.stringify(integration.config, null, 2) : "",
      api_key: credentials.api_key || "",
      api_secret: credentials.api_secret || "",
      account_sid: credentials.account_sid || "",
      auth_token: credentials.auth_token || "",
      endpoint: credentials.endpoint || "",
      token: credentials.token || "",
    });
    setIsIntegrationDialogOpen(true);
  };

  const handleCloseIntegrationDialog = () => {
    setIsIntegrationDialogOpen(false);
    setEditingIntegration(null);
    integrationForm.reset({
      name: "",
      provider: "",
      description: "",
      config: "",
      api_key: "",
      api_secret: "",
      account_sid: "",
      auth_token: "",
      endpoint: "",
      token: "",
    });
  };

  const handleOpenChangeIntegrationDialog = (open: boolean) => {
    if (!open) {
      handleCloseIntegrationDialog();
    } else {
      setIsIntegrationDialogOpen(true);
    }
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast({
      title: "Token copiado!",
      description: "O token foi copiado para a área de transferência.",
    });
  };

  const toggleTokenVisibility = (tokenId: string) => {
    setVisibleTokens((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tokenId)) {
        newSet.delete(tokenId);
      } else {
        newSet.add(tokenId);
      }
      return newSet;
    });
  };

  const handleDeleteToken = async () => {
    if (!deleteTokenId) return;

    try {
      const { error } = await supabase.from("external_api_tokens").delete().eq("id", deleteTokenId);

      if (error) throw error;

      toast({
        title: "Token excluído!",
        description: "O token foi removido com sucesso.",
      });

      setDeleteTokenId(null);
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir token",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteIntegration = async () => {
    if (!deleteIntegrationId) return;

    try {
      const { error } = await supabase.from("api_integrations").delete().eq("id", deleteIntegrationId);

      if (error) throw error;

      toast({
        title: "Integração removida!",
        description: "A integração foi removida com sucesso.",
      });

      setDeleteIntegrationId(null);
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao remover integração",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (tokenId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("external_api_tokens")
        .update({ is_active: !currentStatus })
        .eq("id", tokenId);

      if (error) throw error;

      toast({
        title: currentStatus ? "Token desativado!" : "Token ativado!",
        description: `O token foi ${currentStatus ? "desativado" : "ativado"} com sucesso.`,
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar token",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleIntegrationStatus = async (integrationId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "active" ? "inactive" : "active";
      
      const { error } = await supabase
        .from("api_integrations")
        .update({ status: newStatus })
        .eq("id", integrationId);

      if (error) throw error;

      toast({
        title: `Integração ${newStatus === "active" ? "ativada" : "desativada"}!`,
        description: `A integração foi ${newStatus === "active" ? "ativada" : "desativada"} com sucesso.`,
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const maskToken = (token: string) => {
    if (token.length < 20) return token;
    return token.substring(0, 10) + "..." + token.substring(token.length - 10);
  };

  const getProviderBadge = (provider: string) => {
    const badges: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      twilio: { label: "Twilio", variant: "default" },
      mex10: { label: "Mex10", variant: "default" },
      resend: { label: "Resend", variant: "secondary" },
      "zapresponder": { label: "Zap Responder (WhatsApp)", variant: "default" },
      brasil_api_cnpj: { label: "CNPJ", variant: "outline" },
      brasil_api_cep: { label: "CEP", variant: "outline" },
      custom: { label: "Personalizado", variant: "outline" },
    };
    
    return badges[provider] || { label: provider, variant: "outline" };
  };

  const getConfigTypeInfo = (type: string) => {
    const info: Record<string, { label: string; description: string; purposes: string[] }> = {
      internal_sms: {
        label: "SMS Interno",
        description: "SMS enviados pelo sistema",
        purposes: [
          "Código de verificação de cadastro",
          "Código de recuperação de senha",
          "Notificações administrativas",
        ],
      },
      internal_email: {
        label: "Email Interno",
        description: "Emails enviados pelo sistema",
        purposes: [
          "Email de boas-vindas",
          "Email de verificação de conta",
          "Recuperação de senha",
          "Notificações de transações",
          "Alertas de pontos expirando",
        ],
      },
      internal_whatsapp: {
        label: "WhatsApp Interno",
        description: "WhatsApp enviados pelo sistema",
        purposes: [
          "Notificações de transações",
          "Alertas de pontos expirando",
          "Notificações administrativas",
        ],
      },
      client_sms: {
        label: "SMS Cliente",
        description: "SMS enviados pelos clientes (cobrados)",
        purposes: [
          "Campanhas de marketing",
          "Promoções personalizadas",
          "Mensagens de aniversário",
        ],
      },
      client_email: {
        label: "Email Cliente",
        description: "Emails enviados pelos clientes (cobrados)",
        purposes: [
          "Campanhas de email marketing",
          "Newsletters",
          "Promoções exclusivas",
        ],
      },
      client_whatsapp: {
        label: "WhatsApp Cliente",
        description: "WhatsApp enviados pelos clientes (cobrados)",
        purposes: [
          "Campanhas promocionais",
          "Ofertas personalizadas",
          "Mensagens de aniversário",
          "Alertas de expiração de pontos",
        ],
      },
    };
    return info[type] || { label: type, description: "", purposes: [] };
  };

  const handleUpdateUsageConfig = async (configType: string, integrationId: string | null) => {
    try {
      const { error } = await supabase
        .from("api_usage_configs")
        .upsert(
          {
            config_type: configType,
            integration_id: integrationId,
            is_active: integrationId !== null,
          },
          { onConflict: "config_type" }
        );

      if (error) throw error;

      toast({
        title: "Configuração atualizada!",
        description: "A configuração de utilização foi atualizada com sucesso.",
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar configuração",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadBalances = async (forceRefresh = false) => {
    const CACHE_DURATION = 60 * 60 * 1000; // 1 hora em millisegundos
    const now = Date.now();

    const activeIntegrations = integrations.filter(
      (integration) => integration.status === "active"
    );

    for (const integration of activeIntegrations) {
      // Verificar se há cache válido (menos de 1 hora)
      const cached = balances[integration.provider];
      if (!forceRefresh && cached && cached.cached_at) {
        const cacheAge = now - new Date(cached.cached_at).getTime();
        if (cacheAge < CACHE_DURATION) {
          console.log(`Usando cache para ${integration.provider} (${Math.round(cacheAge / 1000 / 60)} min)`);
          continue; // Pular, usar cache (não mostra loading)
        }
      }

      // Só mostra loading se não tiver cache válido
      setBalances((prev) => ({
        ...prev,
        [integration.provider]: {
          provider: integration.provider,
          balance: "Carregando...",
          loading: true,
          error: null,
        },
      }));

      try {
        let balanceData = null;

        if (integration.provider === "mex10") {
          const { data, error } = await supabase.functions.invoke("get-mex10-balance");
          if (error) throw error;
          balanceData = data;
        } else if (integration.provider === "twilio") {
          const { data, error } = await supabase.functions.invoke("get-twilio-balance");
          if (error) throw error;
          balanceData = data;
        } else if (integration.provider === "resend") {
          const { data, error } = await supabase.functions.invoke("get-resend-balance");
          if (error) throw error;
          balanceData = data;
        }

        if (balanceData && balanceData.success) {
          setBalances((prev) => ({
            ...prev,
            [integration.provider]: {
              provider: integration.provider,
              balance: balanceData.balance || balanceData.transactional?.remaining || "N/A",
              loading: false,
              error: null,
              cached_at: new Date().toISOString(),
              monthly_usage: balanceData.monthly_usage,
              last_used_at: balanceData.last_used_at,
              transactional: balanceData.transactional,
              marketing: balanceData.marketing,
              billing_day: balanceData.billing_day,
              next_reset: balanceData.next_reset,
            },
          }));
        } else {
          throw new Error("Erro ao buscar saldo");
        }
      } catch (error: any) {
        console.error(`Erro ao buscar saldo ${integration.provider}:`, error);
        setBalances((prev) => ({
          ...prev,
          [integration.provider]: {
            provider: integration.provider,
            balance: "Indisponível",
            loading: false,
            error: error.message,
          },
        }));
      }
    }
  };

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const baseUrl = `https://${projectId}.supabase.co/functions/v1`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gerenciamento de API</h1>
        <p className="text-muted-foreground">
          Gerencie tokens de acesso e integrações com serviços externos
        </p>
      </div>

      <Tabs defaultValue="tokens" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="tokens">
            <PlugZap className="h-4 w-4 mr-2" />
            Tokens de API
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Plug className="h-4 w-4 mr-2" />
            Integrações
          </TabsTrigger>
          <TabsTrigger value="set-api">
            <RefreshCw className="h-4 w-4 mr-2" />
            Set API
          </TabsTrigger>
          <TabsTrigger value="usage">
            <Key className="h-4 w-4 mr-2" />
            Utilização
          </TabsTrigger>
          <TabsTrigger value="client-portal">
            <Smartphone className="h-4 w-4 mr-2" />
            API Portal Cliente
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tokens" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Tokens de Acesso</h2>
              <p className="text-sm text-muted-foreground">
                Tokens para consulta de transações via API
              </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Token
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Criar Token de API
                  </DialogTitle>
                  <DialogDescription>
                    Crie um novo token para permitir acesso externo aos dados de transações
                  </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="network_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rede *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a rede" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {networks.map((network) => (
                                <SelectItem key={network.id} value={network.id}>
                                  {network.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ex: Sistema ERP" maxLength={LIMITS.NAME} />
                          </FormControl>
                          <FormDescription>Identificador para este token</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descrição</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Descrição opcional do uso deste token" rows={3} maxLength={LIMITS.MEDIUM_TEXT} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit">Criar Token</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {newlyCreatedToken && (
            <Card className="border-green-200 bg-green-50 dark:bg-green-950">
              <CardHeader>
                <CardTitle className="text-green-700 dark:text-green-300">Token Criado com Sucesso!</CardTitle>
                <CardDescription>
                  Copie este token agora. Por segurança, ele não será exibido novamente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Input value={newlyCreatedToken} readOnly className="font-mono text-sm" />
                  <Button size="sm" onClick={() => handleCopyToken(newlyCreatedToken)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setNewlyCreatedToken(null)}>
                    Fechar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Tokens Ativos</CardTitle>
              <CardDescription>Gerencie os tokens de acesso à API</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Rede</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último Uso</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : tokens.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum token criado ainda
                      </TableCell>
                    </TableRow>
                  ) : (
                    tokens.map((token) => (
                      <TableRow key={token.id}>
                        <TableCell className="font-medium">{token.name}</TableCell>
                        <TableCell>{token.networks?.name || "N/A"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono">
                              {visibleTokens.has(token.id) ? token.token : maskToken(token.token)}
                            </code>
                            <Button size="sm" variant="ghost" onClick={() => toggleTokenVisibility(token.id)}>
                              {visibleTokens.has(token.id) ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleCopyToken(token.token)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={token.is_active ? "default" : "secondary"}>
                            {token.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {token.last_used_at ? new Date(token.last_used_at).toLocaleString("pt-BR") : "Nunca usado"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleActive(token.id, token.is_active)}
                              title={token.is_active ? "Desativar" : "Ativar"}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteTokenId(token.id)}
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Documentação da API
              </CardTitle>
              <CardDescription>Endpoints disponíveis para consulta de transações</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">GET /api-transactions</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Retorna todas as transações da rede associada ao token
                  </p>
                  
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">URL Base</Label>
                      <code className="block p-2 bg-muted rounded-md text-sm mt-1">
                        {baseUrl}/api-transactions
                      </code>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Headers</Label>
                      <code className="block p-2 bg-muted rounded-md text-sm mt-1">
                        Authorization: Bearer YOUR_TOKEN_HERE
                      </code>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Query Parameters (opcionais)</Label>
                      <div className="mt-1 space-y-1">
                        <code className="block p-2 bg-muted rounded-md text-sm">?startDate=2025-01-01</code>
                        <code className="block p-2 bg-muted rounded-md text-sm">?endDate=2025-12-31</code>
                        <code className="block p-2 bg-muted rounded-md text-sm">?status=confirmed</code>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Resposta de Exemplo</Label>
                      <pre className="p-4 bg-muted rounded-md text-xs mt-1 overflow-x-auto">
{`{
  "success": true,
  "data": [
    {
      "codigoVenda": "VENDA-001",
      "dataHora": "2025-01-15T14:30:00.000Z",
      "produtos": [...],
      "cliente": {...},
      "status": "confirmed"
    }
  ]
}`}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Integrações de API</h2>
              <p className="text-sm text-muted-foreground">
                Serviços externos conectados ao sistema
              </p>
            </div>
            <Dialog open={isIntegrationDialogOpen} onOpenChange={handleOpenChangeIntegrationDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Integração
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingIntegration ? "Editar Integração" : "Nova Integração"}</DialogTitle>
                  <DialogDescription>
                    {editingIntegration 
                      ? "Edite as informações da integração de API externa"
                      : "Adicione uma nova integração de API externa"
                    }
                  </DialogDescription>
                </DialogHeader>
                <Form {...integrationForm}>
                  <form onSubmit={integrationForm.handleSubmit(onSubmitIntegration)} className="space-y-4">
                    <FormField
                      control={integrationForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome da Integração *</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: API de SMS Principal" maxLength={LIMITS.NAME} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={integrationForm.control}
                      name="provider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Provider *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o provider" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="twilio">Twilio (SMS)</SelectItem>
                              <SelectItem value="mex10">Mex10 (SMS)</SelectItem>
                              <SelectItem value="resend">Resend (Email)</SelectItem>
                              <SelectItem value="zapresponder">Zap Responder (WhatsApp)</SelectItem>
                              <SelectItem value="brasil_api_cnpj">BrasilAPI CNPJ</SelectItem>
                              <SelectItem value="brasil_api_cep">BrasilAPI CEP</SelectItem>
                              <SelectItem value="custom">Personalizado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Campos de credenciais condicionais baseados no provider */}
                    {integrationForm.watch("provider") === "twilio" && (
                      <>
                        <FormField
                          control={integrationForm.control}
                          name="account_sid"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account SID *</FormLabel>
                              <FormControl>
                                <Input 
                                  type="password"
                                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                Encontre no dashboard do Twilio
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={integrationForm.control}
                          name="auth_token"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Auth Token *</FormLabel>
                              <FormControl>
                                <Input 
                                  type="password"
                                  placeholder="********************************" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                Token de autenticação do Twilio
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {integrationForm.watch("provider") === "zapresponder" && (
                      <>
                        <FormField
                          control={integrationForm.control}
                          name="api_key"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>API Key *</FormLabel>
                              <FormControl>
                                <Input 
                                  type="password"
                                  placeholder="********************************" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                Chave de API fornecida pelo Zap Responder
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={integrationForm.control}
                          name="endpoint"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number ID</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="1234567890"
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                ID do número de telefone do WhatsApp Business
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {integrationForm.watch("provider") === "resend" && (
                      <FormField
                        control={integrationForm.control}
                        name="api_key"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>API Key *</FormLabel>
                            <FormControl>
                              <Input 
                                type="password"
                                placeholder="re_xxxxxxxxxxxxxxxxxxxx" 
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Chave de API do Resend (https://resend.com/api-keys)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {integrationForm.watch("provider") === "mex10" && (
                      <>
                        <FormField
                          control={integrationForm.control}
                          name="token"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Token *</FormLabel>
                              <FormControl>
                                <Input 
                                  type="password"
                                  placeholder="Token de acesso da API Mex10" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                Token fornecido pela Mex10
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={integrationForm.control}
                          name="endpoint"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Endpoint *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="https://mex10.com/api/shortcodeV2.aspx" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                URL base da API Mex10
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {integrationForm.watch("provider") === "custom" && (
                      <>
                        <FormField
                          control={integrationForm.control}
                          name="api_key"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>API Key</FormLabel>
                              <FormControl>
                                <Input 
                                  type="password"
                                  placeholder="Chave de API" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={integrationForm.control}
                          name="api_secret"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>API Secret</FormLabel>
                              <FormControl>
                                <Input 
                                  type="password"
                                  placeholder="Secret da API" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    <FormField
                      control={integrationForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descrição</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Descreva o propósito desta integração" 
                              maxLength={LIMITS.MEDIUM_TEXT}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={integrationForm.control}
                      name="config"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Configuração Adicional (JSON)</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder='{"endpoint": "https://api.example.com", "timeout": 30}' 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Configurações não sensíveis em formato JSON
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={handleCloseIntegrationDialog}>
                        Cancelar
                      </Button>
                      <Button type="submit">
                        {editingIntegration ? "Salvar Alterações" : "Criar Integração"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Integrações Configuradas</CardTitle>
              <CardDescription>
                Lista de serviços externos conectados
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última Utilização</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : integrations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma integração configurada ainda
                      </TableCell>
                    </TableRow>
                  ) : (
                    integrations.map((integration) => {
                      const providerBadge = getProviderBadge(integration.provider);
                      return (
                        <TableRow key={integration.id}>
                          <TableCell className="font-medium">{integration.name}</TableCell>
                          <TableCell>
                            <Badge variant={providerBadge.variant}>
                              {providerBadge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {integration.description || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={integration.status === "active" ? "default" : "secondary"}>
                              {integration.status === "active" ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {integration.last_used_at
                              ? new Date(integration.last_used_at).toLocaleString("pt-BR")
                              : "Nunca utilizado"}
                          </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditIntegration(integration)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleIntegrationStatus(integration.id, integration.status)}
                              title={integration.status === "active" ? "Desativar" : "Ativar"}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteIntegrationId(integration.id)}
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="set-api" className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Configuração de Utilização</h2>
            <p className="text-sm text-muted-foreground">
              Configure quais APIs serão usadas para cada tipo de envio
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Configurações Internas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Uso Interno (Sistema)
                </CardTitle>
                <CardDescription>
                  Configurações para envios do sistema (sem cobrança ao cliente)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {usageConfigs
                  .filter((config) => config.config_type.startsWith("internal_"))
                  .map((config) => {
                    const info = getConfigTypeInfo(config.config_type);
                    const availableIntegrations = integrations.filter((integration) => {
                      if (config.config_type.includes("sms")) {
                        return integration.provider === "twilio" || integration.provider === "mex10";
                      }
                      if (config.config_type.includes("email")) {
                        return integration.provider === "resend";
                      }
                      return false;
                    });

                    return (
                      <div key={config.id} className="space-y-3 border-b pb-4 last:border-0">
                        <div>
                          <Label className="text-base font-semibold">{info.label}</Label>
                          <p className="text-sm text-muted-foreground">{info.description}</p>
                        </div>

                        <Select
                          value={config.integration_id || "none"}
                          onValueChange={(value) =>
                            handleUpdateUsageConfig(
                              config.config_type,
                              value === "none" ? null : value
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a API" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma (desativado)</SelectItem>
                            {availableIntegrations.map((integration) => (
                              <SelectItem key={integration.id} value={integration.id}>
                                {integration.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {config.integration_id && config.api_integrations && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="outline">
                              {config.api_integrations.name}
                            </Badge>
                            <span>•</span>
                            <span className="text-xs">
                              {config.is_active ? "Ativo" : "Inativo"}
                            </span>
                          </div>
                        )}

                        <div className="bg-muted/50 rounded-md p-3">
                          <p className="text-xs font-medium mb-2">Utilizado para:</p>
                          <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                            {info.purposes.map((purpose, idx) => (
                              <li key={idx}>{purpose}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>

            {/* Configurações Cliente */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plug className="h-5 w-5" />
                  Uso Cliente (Cobrado)
                </CardTitle>
                <CardDescription>
                  Configurações para envios dos clientes (com cobrança)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {usageConfigs
                  .filter((config) => config.config_type.startsWith("client_"))
                  .map((config) => {
                    const info = getConfigTypeInfo(config.config_type);
                    const availableIntegrations = integrations.filter((integration) => {
                      if (config.config_type.includes("sms")) {
                        return integration.provider === "twilio" || integration.provider === "mex10";
                      }
                      if (config.config_type.includes("email")) {
                        return integration.provider === "resend";
                      }
                      return false;
                    });

                    return (
                      <div key={config.id} className="space-y-3 border-b pb-4 last:border-0">
                        <div>
                          <Label className="text-base font-semibold">{info.label}</Label>
                          <p className="text-sm text-muted-foreground">{info.description}</p>
                        </div>

                        <Select
                          value={config.integration_id || "none"}
                          onValueChange={(value) =>
                            handleUpdateUsageConfig(
                              config.config_type,
                              value === "none" ? null : value
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a API" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma (desativado)</SelectItem>
                            {availableIntegrations.map((integration) => (
                              <SelectItem key={integration.id} value={integration.id}>
                                {integration.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {config.integration_id && config.api_integrations && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="outline">
                              {config.api_integrations.name}
                            </Badge>
                            <span>•</span>
                            <span className="text-xs">
                              {config.is_active ? "Ativo" : "Inativo"}
                            </span>
                          </div>
                        )}

                        <div className="bg-muted/50 rounded-md p-3">
                          <p className="text-xs font-medium mb-2">Utilizado para:</p>
                          <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                            {info.purposes.map((purpose, idx) => (
                              <li key={idx}>{purpose}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Utilização e Saldo</h2>
              <p className="text-sm text-muted-foreground">
                Monitore o consumo e saldo das APIs integradas
              </p>
            </div>
            <Button onClick={() => loadBalances(true)} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar Saldos
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Card para cada integração ativa */}
            {integrations
              .filter((integration) => 
                integration.status === "active" && 
                integration.provider !== "brasil_api_cnpj" && 
                integration.provider !== "brasil_api_cep"
              )
              .map((integration) => {
                const balance = balances[integration.provider];
                return (
                  <Card key={integration.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{integration.name}</span>
                        <Badge variant={getProviderBadge(integration.provider).variant}>
                          {getProviderBadge(integration.provider).label}
                        </Badge>
                      </CardTitle>
                      <CardDescription>{integration.description || "API de comunicação"}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Saldo disponível</span>
                           <span className="font-semibold">
                             {balance?.loading ? (
                               <span className="text-muted-foreground">Carregando...</span>
                             ) : balance?.error ? (
                               <span className="text-destructive">Erro</span>
                             ) : balance?.balance !== undefined && balance?.balance !== null ? (
                               <span className="text-green-600">
                                 {integration.provider === "twilio" 
                                   ? `$${typeof balance.balance === "number" ? balance.balance.toFixed(2) : balance.balance}`
                                   : typeof balance.balance === "number"
                                   ? `${balance.balance.toLocaleString('pt-BR')} créditos`
                                   : balance.balance}
                               </span>
                             ) : (
                               <span className="text-muted-foreground">-</span>
                             )}
                           </span>
                        </div>
                         <div className="flex items-center justify-between text-sm">
                           <span className="text-muted-foreground">Consumo do mês</span>
                           <span className="font-semibold">
                             {balance?.monthly_usage !== undefined 
                               ? `${Math.round(balance.monthly_usage).toLocaleString('pt-BR')} ${integration.provider === 'mex10' || integration.provider === 'twilio' ? 'SMS' : 'emails'}`
                               : balance?.transactional
                               ? `${balance.transactional.used.toLocaleString('pt-BR')} emails`
                               : "N/A"}
                           </span>
                         </div>
                         {integration.provider === "resend" && balance?.transactional && (
                           <>
                             <div className="flex items-center justify-between text-sm">
                               <span className="text-muted-foreground">Email Transacional</span>
                               <span className="font-semibold text-xs">
                                 {balance.transactional.used.toLocaleString('pt-BR')} / {balance.transactional.limit.toLocaleString('pt-BR')}
                               </span>
                             </div>
                             <div className="flex items-center justify-between text-sm">
                               <span className="text-muted-foreground">Email Marketing</span>
                               <span className="font-semibold text-xs">
                                 {balance.marketing?.used.toLocaleString('pt-BR') || 0} / {balance.marketing?.limit.toLocaleString('pt-BR') || 0}
                               </span>
                             </div>
                             <div className="flex items-center justify-between text-sm">
                               <span className="text-muted-foreground">Próxima renovação</span>
                               <span className="font-semibold text-xs text-muted-foreground">
                                 {balance.next_reset 
                                   ? new Date(balance.next_reset).toLocaleDateString('pt-BR')
                                   : "N/A"}
                               </span>
                             </div>
                           </>
                         )}
                         <div className="flex items-center justify-between text-sm">
                           <span className="text-muted-foreground">Última utilização</span>
                           <span className="text-xs text-muted-foreground">
                             {balance?.last_used_at
                               ? new Date(balance.last_used_at).toLocaleString("pt-BR", {
                                   day: "2-digit",
                                   month: "2-digit",
                                   year: "numeric",
                                   hour: "2-digit",
                                   minute: "2-digit",
                                 })
                               : integration.last_used_at
                               ? new Date(integration.last_used_at).toLocaleString("pt-BR", {
                                   day: "2-digit",
                                   month: "2-digit",
                                   year: "numeric",
                                   hour: "2-digit",
                                   minute: "2-digit",
                                })
                              : "Nunca utilizada"}
                          </span>
                        </div>
                     </div>
                   </CardContent>
                 </Card>
                );
              })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Consumo por Cliente</CardTitle>
              <CardDescription>
                Visualize o consumo de APIs por rede/cliente (em desenvolvimento)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Esta funcionalidade estará disponível em breve. Você poderá visualizar:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
                <li>Consumo de SMS por cliente</li>
                <li>Consumo de Email por cliente</li>
                <li>Custo total por cliente</li>
                <li>Histórico de utilização mensal</li>
              </ul>
            </CardContent>
          </Card>

          {/* Seção de Testes MEX10 */}
          {integrations.some(i => i.provider === "mex10" && i.status === "active") && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Testes MEX10 - SMS API
                </CardTitle>
                <CardDescription>
                  Teste as funcionalidades da API MEX10 diretamente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Teste de Saldo */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">1. Consultar Saldo</Label>
                  <p className="text-sm text-muted-foreground">
                    Endpoint: GET ?token=&t=saldo
                  </p>
                  <Button 
                    onClick={async () => {
                      try {
                        toast({ title: "Consultando saldo..." });
                        const { data, error } = await supabase.functions.invoke("get-mex10-balance");
                        if (error) throw error;
                        toast({
                          title: "Saldo consultado!",
                          description: `SMS: ${data.balance} | Email: ${data.email_balance || 0} | WhatsApp: ${data.whatsapp_balance || 0}`,
                        });
                      } catch (error: any) {
                        toast({
                          title: "Erro ao consultar saldo",
                          description: error.message,
                          variant: "destructive",
                        });
                      }
                    }}
                    variant="outline"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Testar Consulta de Saldo
                  </Button>
                </div>

                {/* Teste de Envio SMS */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">2. Enviar SMS</Label>
                  <p className="text-sm text-muted-foreground">
                    Endpoint: GET ?token=&t=send&n=PHONE&m=MESSAGE
                  </p>
                  <div className="flex gap-2">
                    <Input
                      id="test-phone"
                      placeholder="Telefone com DDD (ex: 13981460806)"
                      className="flex-1"
                    />
                    <Input
                      id="test-message"
                      placeholder="Mensagem de teste"
                      className="flex-1"
                    />
                  </div>
                  <Button 
                    onClick={async () => {
                      const phone = (document.getElementById("test-phone") as HTMLInputElement)?.value;
                      const message = (document.getElementById("test-message") as HTMLInputElement)?.value;
                      
                      if (!phone || !message) {
                        toast({
                          title: "Campos obrigatórios",
                          description: "Preencha telefone e mensagem",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      try {
                        toast({ title: "Enviando SMS..." });
                        const { data, error } = await supabase.functions.invoke("send-sms-mex10", {
                          body: { phone, message }
                        });
                        if (error) throw error;
                        toast({
                          title: "SMS enviado!",
                          description: `Código: ${data.sms_code || "N/A"}`,
                        });
                      } catch (error: any) {
                        toast({
                          title: "Erro ao enviar SMS",
                          description: error.message,
                          variant: "destructive",
                        });
                      }
                    }}
                    variant="outline"
                  >
                    <Code className="h-4 w-4 mr-2" />
                    Testar Envio de SMS
                  </Button>
                </div>

                {/* Teste de Status SMS */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">3. Consultar Status SMS</Label>
                  <p className="text-sm text-muted-foreground">
                    Endpoint: GET ?token=&t=status&code=CODE
                  </p>
                  <div className="flex gap-2">
                    <Input
                      id="test-sms-code"
                      placeholder="Código do SMS (UUID)"
                      className="flex-1"
                    />
                    <Button 
                      onClick={async () => {
                        const code = (document.getElementById("test-sms-code") as HTMLInputElement)?.value;
                        
                        if (!code) {
                          toast({
                            title: "Código obrigatório",
                            description: "Informe o código do SMS",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        try {
                          toast({ title: "Consultando status..." });
                          const { data, error } = await supabase.functions.invoke("check-sms-status-mex10", {
                            body: { sms_code: code }
                          });
                          if (error) throw error;
                          toast({
                            title: "Status consultado!",
                            description: `Status: ${data.status || "N/A"}`,
                          });
                        } catch (error: any) {
                          toast({
                            title: "Erro ao consultar status",
                            description: error.message,
                            variant: "destructive",
                          });
                        }
                      }}
                      variant="outline"
                    >
                      <Code className="h-4 w-4 mr-2" />
                      Consultar Status
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="client-portal" className="space-y-6">
          <ClientPortalAPIDocumentation />
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteTokenId} onOpenChange={() => setDeleteTokenId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Token</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este token? Esta ação não pode ser desfeita e o token não poderá mais ser usado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteToken} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteIntegrationId} onOpenChange={() => setDeleteIntegrationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Integração</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta integração? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteIntegration} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
