import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, TrendingUp, TrendingDown, History, Store, Trash2, Shield } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LIMITS, cleanText, trimmedOptional, trimmedString } from "@/lib/input-sanitization";

const adjustmentSchema = z.object({
  cpf: z.string().trim().min(11, "CPF deve ter 11 dígitos").max(LIMITS.CPF_CNPJ, "CPF inválido"),
  store_id: z.string().min(1, "Selecione uma loja"),
  action_type: z.enum(["adjust", "add", "subtract"], {
    required_error: "Selecione o tipo de ação",
  }),
  balance_type: z.enum(["cashback", "points"], {
    required_error: "Selecione cashback ou pontos",
  }),
  amount: z.coerce.number().min(0.01, "Valor deve ser maior que zero"),
  reason: trimmedString(LIMITS.MEDIUM_TEXT, { min: 10, minMessage: "Justificativa deve ter no mínimo 10 caracteres" }),
  description: trimmedOptional(LIMITS.SHORT_TEXT),
});

type AdjustmentFormValues = z.infer<typeof adjustmentSchema>;

interface Client {
  id: string;
  full_name: string;
  cpf: string;
  total_points: number;
  network_id: string;
}

interface Store {
  id: string;
  name: string;
  cnpj: string;
}

interface AdjustmentLog {
  id: string;
  client_id: string;
  adjustment_type: string;
  amount: number;
  reason: string;
  created_at: string;
  adjusted_by: string;
  clients: {
    full_name: string;
    cpf: string;
  };
  profiles: {
    full_name: string;
  };
}

export default function Reajuste() {
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [adjustmentLogs, setAdjustmentLogs] = useState<AdjustmentLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [pendingAdjustment, setPendingAdjustment] = useState<AdjustmentFormValues | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const { toast } = useToast();

  // Carregar histórico ao montar o componente
  useEffect(() => {
    loadAdjustmentLogs();
  }, []);

  const form = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      cpf: "",
      store_id: "",
      action_type: "adjust",
      balance_type: "cashback",
      amount: 0,
      reason: "",
      description: "",
    },
  });

  const actionType = form.watch("action_type");

  const searchClient = async () => {
    const cpf = form.getValues("cpf").replace(/\D/g, "");
    
    if (cpf.length !== 11) {
      toast({
        title: "CPF inválido",
        description: "Digite um CPF válido com 11 dígitos",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: manager } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!manager) throw new Error("Gerente não encontrado");

      const { data: client, error } = await supabase
        .from("clients")
        .select("*")
        .eq("cpf", cpf)
        .eq("network_id", manager.network_id)
        .single();

      if (error || !client) {
        toast({
          title: "Cliente não encontrado",
          description: "Nenhum cliente encontrado com este CPF na sua rede",
          variant: "destructive",
        });
        setSelectedClient(null);
        return;
      }

      setSelectedClient(client);
      
      // Carregar lojas da rede
      await loadNetworkStores(manager.network_id);
      
      toast({
        title: "Cliente encontrado",
        description: `${client.full_name || "Cliente"}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao buscar cliente",
        description: error.message,
        variant: "destructive",
      });
      setSelectedClient(null);
    } finally {
      setIsSearching(false);
    }
  };

  const loadNetworkStores = async (networkId: string) => {
    setIsLoadingStores(true);
    try {
      const { data: storesData, error } = await supabase
        .from("stores")
        .select("id, name, cnpj")
        .eq("network_id", networkId)
        .eq("status", "active")
        .order("name");

      if (error) throw error;

      setStores(storesData || []);
      
      if (storesData && storesData.length === 0) {
        toast({
          title: "Atenção",
          description: "Nenhuma loja ativa encontrada nesta rede",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar lojas",
        description: error.message,
        variant: "destructive",
      });
      setStores([]);
    } finally {
      setIsLoadingStores(false);
    }
  };

  const loadAdjustmentLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: manager } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!manager) throw new Error("Gerente não encontrado");

      const { data: logs, error } = await supabase
        .from("balance_adjustments")
        .select(`
          *,
          clients (full_name, cpf)
        `)
        .eq("network_id", manager.network_id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Buscar dados dos usuários que fizeram os ajustes
      const userIds = [...new Set(logs?.map(log => log.adjusted_by) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const logsWithProfiles = logs?.map(log => ({
        ...log,
        profiles: profilesMap.get(log.adjusted_by) || { full_name: "Usuário desconhecido" }
      })) || [];

      setAdjustmentLogs(logsWithProfiles);
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

  const deleteAdjustment = async (logId: string) => {
    setDeletingIds(prev => new Set(prev).add(logId));
    try {
      const { error } = await supabase
        .from("balance_adjustments")
        .delete()
        .eq("id", logId);

      if (error) throw error;

      toast({
        title: "Ajuste excluído",
        description: "O ajuste foi removido com sucesso",
      });

      // Recarregar lista
      await loadAdjustmentLogs();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir ajuste",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(logId);
        return newSet;
      });
    }
  };

  const sendVerificationCode = async (values: AdjustmentFormValues) => {
    if (!selectedClient) return;

    setIsSendingCode(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: manager } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!manager) throw new Error("Gerente não encontrado");

      // Buscar email do admin da rede
      const { data: network, error: networkError } = await supabase
        .from("networks")
        .select("email")
        .eq("id", manager.network_id)
        .single();

      if (networkError || !network?.email) {
        toast({
          title: "Erro",
          description: "Email do administrador não encontrado. Configure o email da rede.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("send-adjustment-verification", {
        body: {
          network_id: manager.network_id,
          client_id: selectedClient.id,
          adjustment_data: {
            action_type: values.action_type,
            balance_type: values.balance_type,
            amount: values.amount,
            reason: values.reason,
            store_id: values.store_id,
            description: values.description,
          },
        },
      });

      if (error) throw error;

      const emailSentTo = data?.email_sent_to || network.email;
      const hasWarning = data?.warning;

      setAdminEmail(emailSentTo);
      setPendingAdjustment(values);
      setShowVerificationDialog(true);

      toast({
        title: "Código enviado",
        description: hasWarning 
          ? `Código enviado para ${emailSentTo} (configure o email da rede nas configurações)`
          : `Um código foi enviado para ${emailSentTo}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar código",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSendingCode(false);
    }
  };

  const verifyCodeAndSubmit = async () => {
    if (!pendingAdjustment || !selectedClient || !verificationCode) return;

    setIsVerifyingCode(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: manager } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!manager) throw new Error("Gerente não encontrado");

      // Verificar código
      const { data: codeData, error: codeError } = await supabase
        .from("adjustment_verification_codes")
        .select("*")
        .eq("network_id", manager.network_id)
        .eq("code", verificationCode)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .single();

      if (codeError || !codeData) {
        toast({
          title: "Código inválido",
          description: "O código está incorreto ou expirado",
          variant: "destructive",
        });
        return;
      }

      // Marcar código como usado
      await supabase
        .from("adjustment_verification_codes")
        .update({ used: true, used_at: new Date().toISOString() })
        .eq("id", codeData.id);

      // Realizar o ajuste
      const values = pendingAdjustment;
      const currentBalance = selectedClient.total_points || 0;
      let newBalance = currentBalance;
      let finalAmount = values.amount;
      let transactionType: "accumulation" | "redemption" = "accumulation";

      if (values.action_type === "adjust") {
        newBalance = values.amount;
        finalAmount = values.amount - currentBalance;
        transactionType = finalAmount >= 0 ? "accumulation" : "redemption";
      } else if (values.action_type === "add") {
        newBalance = currentBalance + values.amount;
        finalAmount = values.amount;
        transactionType = "accumulation";
      } else if (values.action_type === "subtract") {
        newBalance = currentBalance - values.amount;
        finalAmount = -values.amount;
        transactionType = "redemption";
      }

      if (newBalance < 0) {
        toast({
          title: "Saldo insuficiente",
          description: "A operação resultaria em saldo negativo",
          variant: "destructive",
        });
        return;
      }

      // Atualizar saldo do cliente
      const { error: updateError } = await supabase
        .from("clients")
        .update({ total_points: newBalance })
        .eq("id", selectedClient.id);

      if (updateError) throw updateError;

      // Registrar no log de ajustes
      const { error: logError } = await supabase
        .from("balance_adjustments")
        .insert({
          client_id: selectedClient.id,
          adjusted_by: user.id,
          network_id: manager.network_id,
          adjustment_type: values.balance_type,
          amount: finalAmount,
          reason: values.reason,
        });

      if (logError) throw logError;

      // Criar transação
      let transactionDescription = "";
      if (values.action_type === "adjust") {
        transactionDescription = `Ajuste de saldo: ${values.reason}`;
      } else if (values.action_type === "add") {
        transactionDescription = values.description || `Adição manual: ${values.reason}`;
      } else if (values.action_type === "subtract") {
        transactionDescription = values.description || `Subtração manual: ${values.reason}`;
      }

      const { error: transactionError } = await supabase
        .from("transactions")
        .insert({
          client_id: selectedClient.id,
          store_id: values.store_id,
          type: transactionType,
          amount: Math.abs(finalAmount),
          points: Math.abs(finalAmount),
          description: transactionDescription,
        });

      if (transactionError) throw transactionError;

      const actionMessages = {
        adjust: "Saldo ajustado",
        add: `${values.balance_type === "cashback" ? "Cashback" : "Pontos"} adicionado`,
        subtract: `${values.balance_type === "cashback" ? "Cashback" : "Pontos"} subtraído`,
      };

      toast({
        title: actionMessages[values.action_type],
        description: "Operação realizada com sucesso",
      });

      // Limpar e fechar
      setShowVerificationDialog(false);
      setVerificationCode("");
      setPendingAdjustment(null);
      form.reset();
      setSelectedClient(null);
      loadAdjustmentLogs();
    } catch (error: any) {
      toast({
        title: "Erro ao realizar ajuste",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const onSubmit = async (values: AdjustmentFormValues) => {
    const sanitizedValues = {
      ...values,
      cpf: values.cpf.replace(/\D/g, "").slice(0, 11),
      reason: cleanText(values.reason, LIMITS.MEDIUM_TEXT),
      description: cleanText(values.description, LIMITS.SHORT_TEXT),
    };

    if (isSubmitting || isSendingCode) return;

    if (!selectedClient) {
      toast({
        title: "Erro",
        description: "Selecione um cliente antes de realizar o ajuste",
        variant: "destructive",
      });
      return;
    }

    if (!sanitizedValues.store_id) {
      toast({
        title: "Erro",
        description: "Selecione uma loja antes de realizar o ajuste",
        variant: "destructive",
      });
      return;
    }

    // Enviar código de verificação
    await sendVerificationCode(sanitizedValues);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reajuste de Saldo</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Ajuste manualmente o saldo de cashback ou pontos dos clientes
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Buscar Cliente */}
          <Card>
            <CardHeader>
              <CardTitle>Buscar Cliente</CardTitle>
              <CardDescription>
                Digite o CPF do cliente para realizar o ajuste
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input
                          placeholder="000.000.000-00"
                          {...field}
                          maxLength={LIMITS.CPF_CNPJ}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "");
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="button" onClick={searchClient} disabled={isSearching}>
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {selectedClient && (
                <div className="p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{selectedClient.full_name || "Cliente"}</p>
                      <p className="text-sm text-muted-foreground">CPF: {selectedClient.cpf}</p>
                      <p className="text-sm font-medium mt-1">
                        Saldo atual: {selectedClient.total_points || 0}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selecionar Loja */}
          {selectedClient && stores.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Selecionar Loja
                </CardTitle>
                <CardDescription>
                  Escolha a loja onde o ajuste será registrado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="store_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loja *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma loja" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {stores.map((store) => (
                            <SelectItem key={store.id} value={store.id}>
                              {store.name} - {store.cnpj}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        O ajuste ficará registrado no histórico desta loja
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Configurar Operação */}
          {selectedClient && form.watch("store_id") && (
            <Card>
              <CardHeader>
                <CardTitle>Configurar Operação</CardTitle>
                <CardDescription>
                  Escolha o tipo de operação a ser realizada
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Tipo de Ação */}
                <FormField
                  control={form.control}
                  name="action_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Operação</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="grid grid-cols-3 gap-4"
                        >
                          <div>
                            <RadioGroupItem
                              value="adjust"
                              id="adjust"
                              className="peer sr-only"
                            />
                            <label
                              htmlFor="adjust"
                              className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-all"
                            >
                              <span className="text-2xl mb-2">⚖️</span>
                              <span className="text-sm font-semibold text-center">Ajustar Saldo</span>
                            </label>
                          </div>
                          <div>
                            <RadioGroupItem
                              value="add"
                              id="add"
                              className="peer sr-only"
                            />
                            <label
                              htmlFor="add"
                              className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-all"
                            >
                              <span className="text-2xl mb-2">➕</span>
                              <span className="text-sm font-semibold text-center">Inserir</span>
                            </label>
                          </div>
                          <div>
                            <RadioGroupItem
                              value="subtract"
                              id="subtract"
                              className="peer sr-only"
                            />
                            <label
                              htmlFor="subtract"
                              className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-all"
                            >
                              <span className="text-2xl mb-2">➖</span>
                              <span className="text-sm font-semibold text-center">Subtrair</span>
                            </label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tipo de Saldo */}
                <FormField
                  control={form.control}
                  name="balance_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Saldo</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="grid grid-cols-2 gap-4"
                        >
                          <div>
                            <RadioGroupItem
                              value="cashback"
                              id="balance-cashback"
                              className="peer sr-only"
                            />
                            <label
                              htmlFor="balance-cashback"
                              className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                            >
                              <span className="text-base font-semibold">💰 Cashback</span>
                            </label>
                          </div>
                          <div>
                            <RadioGroupItem
                              value="points"
                              id="balance-points"
                              className="peer sr-only"
                            />
                            <label
                              htmlFor="balance-points"
                              className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                            >
                              <span className="text-base font-semibold">⭐ Pontos</span>
                            </label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Valor */}
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {actionType === "adjust" && "Novo Saldo"}
                        {actionType === "add" && "Valor a Adicionar"}
                        {actionType === "subtract" && "Valor a Subtrair"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder={
                            actionType === "adjust"
                              ? "Digite o novo saldo total"
                              : "Digite o valor"
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {actionType === "adjust" && (
                          <>Saldo atual: {selectedClient.total_points || 0}</>
                        )}
                        {actionType === "add" && (
                          <>
                            <TrendingUp className="inline h-4 w-4 mr-1 text-green-600" />
                            Será adicionado ao saldo atual
                          </>
                        )}
                        {actionType === "subtract" && (
                          <>
                            <TrendingDown className="inline h-4 w-4 mr-1 text-red-600" />
                            Será subtraído do saldo atual
                          </>
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Descrição para Inserir/Subtrair */}
                {(actionType === "add" || actionType === "subtract") && (
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição para o Extrato</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: Bônus especial, Correção de erro..."
                            maxLength={LIMITS.SHORT_TEXT}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Aparecerá no extrato do cliente (máx. 100 caracteres)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Justificativa */}
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Justificativa Interna *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Ex: Correção de saldo inicial, ajuste por erro de sistema..."
                          className="min-h-[80px]"
                          maxLength={LIMITS.MEDIUM_TEXT}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Motivo para registro interno (auditoria)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  disabled={isSubmitting || isSendingCode || !selectedClient} 
                  className="w-full"
                  onClick={(e) => {
                    if (isSubmitting || isSendingCode) {
                      e.preventDefault();
                      return;
                    }
                  }}
                >
                  {isSendingCode ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando código...
                    </>
                  ) : (
                    <>
                      {actionType === "adjust" && "Confirmar Ajuste"}
                      {actionType === "add" && "Confirmar Inserção"}
                      {actionType === "subtract" && "Confirmar Subtração"}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </form>
      </Form>

      {/* Dialog de Verificação */}
      <Dialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Verificação de Segurança
            </DialogTitle>
            <DialogDescription>
              Um código de verificação foi enviado para <strong>{adminEmail}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="verification-code" className="text-sm font-medium">
                Código de Verificação
              </label>
              <Input
                id="verification-code"
                placeholder="Digite o código de 6 dígitos"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                className="text-center text-2xl font-mono tracking-widest"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                O código expira em 10 minutos
              </p>
            </div>

            {pendingAdjustment && (
              <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
                <p className="text-sm font-medium">Detalhes do Reajuste:</p>
                <div className="text-xs space-y-1 text-muted-foreground">
                  <p>Ação: {pendingAdjustment.action_type === "adjust" ? "Ajustar" : pendingAdjustment.action_type === "add" ? "Adicionar" : "Subtrair"}</p>
                  <p>Tipo: {pendingAdjustment.balance_type === "cashback" ? "Cashback" : "Pontos"}</p>
                  <p>Valor: {pendingAdjustment.amount}</p>
                  <p>Motivo: {pendingAdjustment.reason}</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowVerificationDialog(false);
                setVerificationCode("");
                setPendingAdjustment(null);
              }}
              disabled={isVerifyingCode}
            >
              Cancelar
            </Button>
            <Button
              onClick={verifyCodeAndSubmit}
              disabled={verificationCode.length !== 6 || isVerifyingCode}
            >
              {isVerifyingCode ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Confirmar Reajuste"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Histórico de Ajustes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Ajustes
              </CardTitle>
              <CardDescription>
                Últimos 50 ajustes realizados na rede
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadAdjustmentLogs}
              disabled={isLoadingLogs}
            >
              {isLoadingLogs ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Atualizar"
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {adjustmentLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum ajuste realizado ainda
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Realizado por</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustmentLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{log.clients.full_name}</p>
                          <p className="text-xs text-muted-foreground">{log.clients.cpf}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {log.adjustment_type === "cashback" ? "Cashback" : "Pontos"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            log.amount > 0
                              ? "text-green-600 font-semibold"
                              : "text-red-600 font-semibold"
                          }
                        >
                          {log.amount > 0 ? "+" : ""}
                          {log.amount}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={log.reason}>
                        {log.reason}
                      </TableCell>
                      <TableCell>{log.profiles.full_name}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={deletingIds.has(log.id)}
                            >
                              {deletingIds.has(log.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-destructive" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir este ajuste? Esta ação não pode ser desfeita.
                                <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
                                  <p><strong>Cliente:</strong> {log.clients.full_name}</p>
                                  <p><strong>Valor:</strong> {log.amount > 0 ? "+" : ""}{log.amount}</p>
                                  <p><strong>Tipo:</strong> {log.adjustment_type === "cashback" ? "Cashback" : "Pontos"}</p>
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteAdjustment(log.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
}
