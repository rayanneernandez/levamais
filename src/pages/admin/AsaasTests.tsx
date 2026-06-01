import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, PlayCircle, FileText, CreditCard, Webhook, RefreshCw, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";

interface TestResult {
  name: string;
  status: 'success' | 'error' | 'warning' | 'pending';
  message: string;
  details?: any;
}

interface WebhookEvent {
  id: string;
  event_type: string;
  payment_id: string | null;
  subscription_id: string | null;
  processed: boolean;
  error_message: string | null;
  created_at: string;
  payload: any;
}

export default function AsaasTests() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [clientId, setClientId] = useState("");
  const [networkId, setNetworkId] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [subscriptionResult, setSubscriptionResult] = useState<any>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isSuspending, setIsSuspending] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);

  const addTestResult = (result: TestResult) => {
    setTestResults(prev => [...prev, result]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  // Carregar logs de webhook automaticamente
  useEffect(() => {
    loadWebhookEvents();
    // Atualizar a cada 10 segundos
    const interval = setInterval(loadWebhookEvents, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadWebhookEvents = async () => {
    try {
      setLoadingWebhooks(true);
      const { data, error } = await supabase
        .from('asaas_webhook_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setWebhookEvents(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar webhooks:', error);
    } finally {
      setLoadingWebhooks(false);
    }
  };

  const loadTestData = async () => {
    try {
      // Buscar cliente Renata pelo CPF (código 0003, Rede JB)
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, email, favorite_network_id, cpf, full_name')
        .eq('cpf', '11020848758') // CPF da Renata da Luz Leandro
        .maybeSingle();

      if (clientError) throw clientError;

      if (!client) {
        toast({
          title: "Cliente não encontrado",
          description: "Não foi possível encontrar a Renata (CPF 110.208.487-58) no banco",
          variant: "destructive",
        });
        return;
      }

      if (!client.favorite_network_id) {
        toast({
          title: "Rede não configurada",
          description: "Cliente encontrado mas sem rede favorita definida",
          variant: "destructive",
        });
        return;
      }

      setClientId(client.id);
      setNetworkId(client.favorite_network_id);

      // Buscar assinatura ativa da Renata
      console.log('🔍 Buscando assinatura para client_id:', client.id);
      
      const { data: existingSub, error: subError } = await supabase
        .from('client_subscriptions_one')
        .select('*')
        .eq('client_id', client.id)
        .in('status', ['active', 'pending', 'suspended'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('📊 Assinatura encontrada:', existingSub);
      console.log('❌ Erro na busca:', subError);

      if (existingSub) {
        const resultData = {
          subscription_id: existingSub.id,
          asaas_subscription_id: existingSub.asaas_subscription_id,
          status: existingSub.status,
        };
        console.log('✅ Setando subscriptionResult:', resultData);
        setSubscriptionResult(resultData);
      }

      toast({
        title: "Dados carregados!",
        description: `${client.full_name} (CPF: ${client.cpf}) - ${existingSub ? '✅ Assinatura encontrada!' : '⚠️ Sem assinatura ativa'}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Teste 1: Verificar configuração
  const testConfiguration = async () => {
    try {
      const { data: config, error } = await supabase
        .from('asaas_config')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (!config) {
        addTestResult({
          name: "Configuração Asaas",
          status: "error",
          message: "Nenhuma configuração encontrada. Acesse /adm/configuracoes/asaas para configurar.",
        });
        return false;
      }

      // Se não está ativa, ativar automaticamente
      if (!config.is_active) {
        const { error: updateError } = await supabase
          .from('asaas_config')
          .update({ is_active: true })
          .eq('id', config.id);

        if (updateError) {
          console.error('Erro ao ativar config:', updateError);
        } else {
          console.log('✅ Configuração ativada automaticamente');
          config.is_active = true;
        }
      }

      const apiKey = config.is_sandbox ? config.api_key_sandbox : config.api_key_production;
      
      if (!apiKey) {
        addTestResult({
          name: "Configuração Asaas",
          status: "error",
          message: `API Key ${config.is_sandbox ? 'Sandbox' : 'Produção'} não configurada`,
        });
        return false;
      }

      if (!config.webhook_token) {
        addTestResult({
          name: "Configuração Asaas",
          status: "warning",
          message: "Token do webhook não configurado",
        });
      }

      addTestResult({
        name: "Configuração Asaas",
        status: "success",
        message: `Configuração OK - Modo: ${config.is_sandbox ? 'Sandbox' : 'Produção'}`,
        details: config,
      });

      return true;
    } catch (error: any) {
      addTestResult({
        name: "Configuração Asaas",
        status: "error",
        message: error.message,
      });
      return false;
    }
  };

  // Teste 2: Testar conexão com API
  const testApiConnection = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('asaas-test-connection', {
        body: {},
      });

      if (error) throw error;

      if (data?.success) {
        addTestResult({
          name: "Conexão API",
          status: "success",
          message: "API Asaas respondendo corretamente",
          details: data,
        });
        return true;
      } else {
        throw new Error(data?.error || "Falha na conexão");
      }
    } catch (error: any) {
      addTestResult({
        name: "Conexão API",
        status: "error",
        message: error.message,
      });
      return false;
    }
  };

  // Teste 3: Criar assinatura teste com cartão
  const testCreateCreditCardSubscription = async () => {
    if (!clientId || !networkId) {
      addTestResult({
        name: "Criar Assinatura Teste",
        status: "error",
        message: "Preencha Client ID e Network ID",
      });
      return false;
    }

    try {
      // Dados de cartão de teste do Asaas Sandbox
      const testCardData = {
        client_id: clientId,
        network_id: networkId,
        card: {
          holderName: "TESTE SANDBOX",
          number: "5162306219378829",
          expiryMonth: "12",
          expiryYear: "2028",
          ccv: "318"
        },
        address: {
          postalCode: "89223-005",
          addressNumber: "123"
        }
      };

      addTestResult({
        name: "Criar Assinatura Teste",
        status: "pending",
        message: "Criando assinatura com cartão de teste...",
      });

      const { data, error } = await supabase.functions.invoke('create-one-credit-card-subscription', {
        body: testCardData,
      });

      if (error) throw error;

      if (data?.success) {
        // Remover o resultado pendente
        setTestResults(prev => prev.filter(r => r.name !== "Criar Assinatura Teste" || r.status !== "pending"));
        
        const resultData = {
          subscription_id: data.subscription?.id,
          asaas_subscription_id: data.asaas_subscription_id,
          status: data.subscription?.status,
        };
        
        // Armazenar para usar nos testes de cenários
        setSubscriptionResult(resultData);
        
        addTestResult({
          name: "Criar Assinatura Teste",
          status: "success",
          message: "Assinatura criada com sucesso no Sandbox",
          details: resultData,
        });
        
        toast({
          title: "Assinatura criada!",
          description: "Aguarde alguns segundos e verifique os logs de webhook",
        });
        
        return true;
      } else {
        throw new Error(data?.error || "Falha ao criar assinatura");
      }
    } catch (error: any) {
      setTestResults(prev => prev.filter(r => r.name !== "Criar Assinatura Teste" || r.status !== "pending"));
      
      addTestResult({
        name: "Criar Assinatura Teste",
        status: "error",
        message: error.message,
      });
      return false;
    }
  };

  // Teste 4: Verificar logs de webhook
  const testWebhookLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('asaas_webhook_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const processedCount = data?.filter(e => e.processed).length || 0;
      const totalCount = data?.length || 0;

      addTestResult({
        name: "Logs de Webhook",
        status: totalCount > 0 ? "success" : "warning",
        message: totalCount > 0 
          ? `${processedCount}/${totalCount} eventos processados`
          : "Nenhum evento de webhook recebido ainda",
        details: data,
      });

      return true;
    } catch (error: any) {
      addTestResult({
        name: "Logs de Webhook",
        status: "error",
        message: error.message,
      });
      return false;
    }
  };

  // Teste 5: Verificar assinaturas ativas
  const testActiveSubscriptions = async () => {
    try {
      const { data, error } = await supabase
        .from('client_subscriptions_one')
        .select('*, clients(id, email), networks(name)')
        .eq('status', 'active')
        .limit(10);

      if (error) throw error;

      addTestResult({
        name: "Assinaturas Ativas (Banco Local)",
        status: "success",
        message: `${data?.length || 0} assinaturas ativas encontradas no banco`,
        details: data,
      });

      return true;
    } catch (error: any) {
      addTestResult({
        name: "Assinaturas Ativas (Banco Local)",
        status: "error",
        message: error.message,
      });
      return false;
    }
  };

  // Teste 6: Listar assinaturas direto da API Asaas
  const testAsaasListSubscriptions = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('asaas-list-subscriptions', {
        body: {},
      });

      if (error) throw error;

      if (data?.success) {
        const subscriptions = data.subscriptions || [];
        
        addTestResult({
          name: "Listar Assinaturas (API Asaas)",
          status: "success",
          message: `${subscriptions.length} assinaturas encontradas no Asaas`,
          details: subscriptions.map((sub: any) => ({
            id: sub.id,
            customer: sub.customer,
            status: sub.status,
            value: sub.value,
            billingType: sub.billingType,
            nextDueDate: sub.nextDueDate,
          })),
        });

        return true;
      } else {
        throw new Error(data?.error || 'Erro ao listar assinaturas');
      }
    } catch (error: any) {
      addTestResult({
        name: "Listar Assinaturas (API Asaas)",
        status: "error",
        message: error.message,
      });
      return false;
    }
  };

  // Executar todos os testes
  const runAllTests = async () => {
    setLoading(true);
    clearResults();
    
    try {
      await testConfiguration();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await testApiConnection();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await testWebhookLogs();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await testActiveSubscriptions();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await testAsaasListSubscriptions();
      
      toast({
        title: "Testes concluídos",
        description: "Verifique os resultados abaixo",
      });
    } catch (error: any) {
      toast({
        title: "Erro nos testes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Loader2 className="h-5 w-5 animate-spin" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    const variants: Record<string, any> = {
      success: "default",
      error: "destructive",
      warning: "secondary",
      pending: "outline",
    };
    return variants[status] || "outline";
  };

  // Teste manual de geração de boletos mensais
  const testGenerateMonthlyCharges = async () => {
    try {
      setLoading(true);
      
      addTestResult({
        name: "Gerar Boletos Mensais",
        status: "pending",
        message: "Verificando networks para cobrança hoje...",
      });

      const { data, error } = await supabase.functions.invoke('generate-monthly-charges', {
        body: {},
      });

      if (error) throw error;

      setTestResults(prev => prev.filter(r => r.name !== "Gerar Boletos Mensais" || r.status !== "pending"));

      if (data?.success) {
        addTestResult({
          name: "Gerar Boletos Mensais",
          status: "success",
          message: `✅ ${data.summary?.success || 0} cobranças criadas, ${data.summary?.skipped || 0} puladas`,
          details: data.results,
        });

        toast({
          title: "Boletos gerados!",
          description: `${data.summary?.success || 0} cobranças criadas com sucesso`,
        });
      } else {
        throw new Error(data?.error || "Falha ao gerar boletos");
      }
    } catch (error: any) {
      setTestResults(prev => prev.filter(r => r.name !== "Gerar Boletos Mensais" || r.status !== "pending"));
      
      addTestResult({
        name: "Gerar Boletos Mensais",
        status: "error",
        message: error.message,
      });
      
      toast({
        title: "Erro ao gerar boletos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscriptionResult?.asaas_subscription_id) {
      toast({
        title: "Erro",
        description: "Nenhuma assinatura teste encontrada. Crie uma primeiro.",
        variant: "destructive",
      });
      return;
    }

    setIsCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-test-cancel-subscription', {
        body: { asaas_subscription_id: subscriptionResult.asaas_subscription_id }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "✅ Assinatura Cancelada",
          description: "Status atualizado para Cancelled",
        });
        setSubscriptionResult({ ...subscriptionResult, status: 'cancelled' });
      } else {
        throw new Error(data?.error || 'Erro ao cancelar');
      }
    } catch (error: any) {
      toast({
        title: "Erro ao cancelar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleSuspendSubscription = async () => {
    if (!subscriptionResult?.asaas_subscription_id) {
      toast({
        title: "Erro",
        description: "Nenhuma assinatura teste encontrada. Crie uma primeiro.",
        variant: "destructive",
      });
      return;
    }

    setIsSuspending(true);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-test-suspend-subscription', {
        body: { asaas_subscription_id: subscriptionResult.asaas_subscription_id }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "⚠️ Assinatura Suspensa",
          description: "Status atualizado para Suspended (simulando atraso)",
        });
        setSubscriptionResult({ ...subscriptionResult, status: 'suspended' });
      } else {
        throw new Error(data?.error || 'Erro ao suspender');
      }
    } catch (error: any) {
      toast({
        title: "Erro ao suspender",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSuspending(false);
    }
  };

  const handleReactivateSubscription = async () => {
    if (!subscriptionResult?.asaas_subscription_id) {
      toast({
        title: "Erro",
        description: "Nenhuma assinatura teste encontrada. Crie uma primeiro.",
        variant: "destructive",
      });
      return;
    }

    setIsReactivating(true);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-test-reactivate-subscription', {
        body: { asaas_subscription_id: subscriptionResult.asaas_subscription_id }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "✅ Assinatura Reativada",
          description: "Status atualizado para Active",
        });
        setSubscriptionResult({ ...subscriptionResult, status: 'active' });
      } else {
        throw new Error(data?.error || 'Erro ao reativar');
      }
    } catch (error: any) {
      toast({
        title: "Erro ao reativar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsReactivating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Testes Asaas</h1>
        <p className="text-muted-foreground">
          Validação completa da integração Asaas antes de produção
        </p>
      </div>

      <Alert>
        <FileText className="h-4 w-4" />
        <AlertTitle>Checklist de Testes</AlertTitle>
        <AlertDescription>
          <ol className="list-decimal list-inside space-y-1 mt-2">
            <li>Configurar API Keys (Sandbox e/ou Produção)</li>
            <li>Gerar e configurar Token de Webhook</li>
            <li>Configurar URL do Webhook no painel Asaas</li>
            <li>Executar testes automatizados</li>
            <li>Criar assinatura teste</li>
            <li>Pagar assinatura teste (Sandbox)</li>
            <li>Verificar webhook recebido</li>
            <li>Validar status da assinatura</li>
          </ol>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="automated" className="space-y-4">
        <TabsList>
          <TabsTrigger value="automated">Testes Automatizados</TabsTrigger>
          <TabsTrigger value="manual">Testes Manuais</TabsTrigger>
          <TabsTrigger value="scenarios">Cenários</TabsTrigger>
          <TabsTrigger value="results">Resultados</TabsTrigger>
        </TabsList>

        <TabsContent value="automated" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Testes Automatizados</CardTitle>
              <CardDescription>
                Execute testes automáticos de configuração, conexão e status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={runAllTests} disabled={loading} size="lg" className="w-full">
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="mr-2 h-4 w-4" />
                )}
                Executar Todos os Testes
              </Button>

              <Separator />

              <div className="space-y-2">
                <h3 className="font-medium">Testes Individuais:</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={testConfiguration} size="sm">
                    1. Configuração
                  </Button>
                  <Button variant="outline" onClick={testApiConnection} size="sm">
                    2. Conexão API
                  </Button>
                  <Button variant="outline" onClick={testWebhookLogs} size="sm">
                    3. Logs Webhook
                  </Button>
                  <Button variant="outline" onClick={testActiveSubscriptions} size="sm">
                    4. Assinaturas (DB)
                  </Button>
                  <Button variant="outline" onClick={testAsaasListSubscriptions} size="sm" className="col-span-2">
                    5. Listar Assinaturas (Asaas API)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Teste de Criação de Assinatura
              </CardTitle>
              <CardDescription>
                Crie uma assinatura de teste com cartão de crédito no Sandbox
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                variant="outline" 
                onClick={loadTestData}
                className="w-full"
              >
                Usar Dados da Renata (Código 0004)
              </Button>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="clientId">Client ID (UUID)</Label>
                <Input
                  id="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="networkId">Network ID (UUID)</Label>
                <Input
                  id="networkId"
                  value={networkId}
                  onChange={(e) => setNetworkId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </div>

              <Button 
                onClick={testCreateCreditCardSubscription} 
                disabled={!clientId || !networkId}
                className="w-full"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Criar Assinatura Teste (Cartão)
              </Button>

              <Alert>
                <AlertDescription className="text-xs space-y-2">
                  <p><strong>ℹ️ Cartão de teste do Sandbox Asaas:</strong></p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Número: 5162306219378829</li>
                    <li>Nome: TESTE SANDBOX</li>
                    <li>Validade: 12/2028</li>
                    <li>CVV: 318</li>
                  </ul>
                  <p className="mt-2">Use IDs de clientes e redes existentes. O webhook será disparado automaticamente.</p>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <Webhook className="h-5 w-5" />
                  Logs de Webhook (Tempo Real)
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadWebhookEvents}
                  disabled={loadingWebhooks}
                >
                  <RefreshCw className={`h-4 w-4 ${loadingWebhooks ? 'animate-spin' : ''}`} />
                </Button>
              </CardTitle>
              <CardDescription>
                Eventos recebidos nos últimos minutos (atualiza automaticamente)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {webhookEvents.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                  <p>Nenhum evento de webhook recebido ainda</p>
                  <p className="text-xs mt-1">Crie uma assinatura para disparar eventos</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webhookEvents.slice(0, 10).map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="text-xs">
                            {format(toZonedTime(new Date(event.created_at), "America/Sao_Paulo"), "dd/MM HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              event.event_type.includes('RECEIVED') || event.event_type.includes('CONFIRMED') 
                                ? 'default' 
                                : event.event_type.includes('OVERDUE') 
                                ? 'secondary' 
                                : 'destructive'
                            }>
                              {event.event_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {event.processed ? (
                              <Badge variant="default" className="gap-1 bg-green-600">
                                <CheckCircle2 className="h-3 w-3" />
                                OK
                              </Badge>
                            ) : event.error_message ? (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="h-3 w-3" />
                                Erro
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Pendente
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Teste de Geração de Boletos Mensais
              </CardTitle>
              <CardDescription>
                Simula a execução do cron job que gera boletos mensais automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Como funciona:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>O sistema executa automaticamente às 9h todos os dias</li>
                    <li>Gera boletos 7 dias ANTES do dia de pagamento</li>
                    <li>Exemplo: Se hoje é dia {new Date().getDate()}, gera boletos com vencimento dia {new Date().getDate() + 7}</li>
                    <li>Isso dá tempo para o cliente se organizar</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <Button 
                onClick={testGenerateMonthlyCharges} 
                disabled={loading}
                variant="secondary"
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Gerar Boletos Mensais (Teste Manual)
              </Button>

              <Alert variant="default">
                <AlertDescription className="text-xs">
                  💡 Para que boletos sejam gerados, é necessário que existam networks com:
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Status: active</li>
                    <li>Implantado: true</li>
                    <li>billing_day = {new Date().getDate() + 7} (7 dias à frente do dia atual)</li>
                    <li>asaas_customer_id configurado</li>
                    <li>Vencimento será no dia {new Date().getDate() + 7}</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scenarios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>🧪 Testes de Cenários</CardTitle>
              <CardDescription>
                Simule cancelamento, suspensão e reativação de assinaturas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!subscriptionResult?.asaas_subscription_id ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="mb-2">Crie uma assinatura teste primeiro na aba "Testes Manuais"</p>
                    <p className="text-xs text-muted-foreground">
                      Após criar a assinatura, os botões de teste ficarão disponíveis aqui
                    </p>
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-2 p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Assinatura Teste Carregada:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Status:</span>{' '}
                        <Badge>{subscriptionResult.status || 'N/A'}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground break-all">
                        <span className="font-medium">ID:</span> {subscriptionResult.asaas_subscription_id}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium mb-1 flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          Cancelamento (Com Validação 12 meses)
                        </h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          Testa o cancelamento real com validação do período mínimo de 12 meses
                        </p>
                        <div className="flex gap-2">
                          <Button 
                            onClick={async () => {
                              if (!subscriptionResult?.subscription_id) {
                                toast({ title: "Erro", description: "ID da assinatura não encontrado", variant: "destructive" });
                                return;
                              }
                              setIsCancelling(true);
                              try {
                                const { data, error } = await supabase.functions.invoke('cancel-one-subscription', {
                                  body: { 
                                    subscription_id: subscriptionResult.subscription_id,
                                    is_admin_cancellation: true 
                                  }
                                });
                                if (error) throw error;
                                if (!data.success) throw new Error(data.error);
                                toast({ title: "✅ Cancelado", description: "Validação passou e assinatura foi cancelada" });
                                setSubscriptionResult({ ...subscriptionResult, status: 'cancelled' });
                              } catch (error: any) {
                                toast({ 
                                  title: "Validação de 12 meses", 
                                  description: error.message,
                                  variant: error.message.includes('12 meses') ? 'default' : 'destructive'
                                });
                              } finally {
                                setIsCancelling(false);
                              }
                            }}
                            disabled={isCancelling}
                            variant="outline"
                            size="sm"
                          >
                            {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Testar Validação
                          </Button>
                          <Button 
                            onClick={handleCancelSubscription}
                            disabled={isCancelling || subscriptionResult.status === 'cancelled'}
                            variant="destructive"
                            size="sm"
                          >
                            {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Forçar Cancelamento
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-medium mb-1 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          Suspensão (Simular Atraso)
                        </h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          Simula suspensão por atraso de pagamento. Atualiza status para "suspended" localmente
                        </p>
                        <Button 
                          onClick={handleSuspendSubscription}
                          disabled={isSuspending || subscriptionResult.status === 'suspended' || subscriptionResult.status === 'cancelled'}
                          variant="outline"
                          size="sm"
                        >
                          {isSuspending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {isSuspending ? 'Suspendendo...' : 'Suspender Assinatura'}
                        </Button>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-medium mb-1 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Reativação
                        </h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          Reativa uma assinatura suspensa ou cancelada (somente para testes)
                        </p>
                        <Button 
                          onClick={handleReactivateSubscription}
                          disabled={isReactivating || subscriptionResult.status === 'active'}
                          variant="default"
                          size="sm"
                        >
                          {isReactivating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {isReactivating ? 'Reativando...' : 'Reativar Assinatura'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Alert>
                    <Webhook className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>💡 Validação de Webhooks:</strong> Após cada ação, verifique os logs de webhook na aba 
                      "Testes Manuais" ou acesse diretamente{' '}
                      <code className="text-xs">/adm/configuracoes/asaas-webhook-logs</code>
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resultados dos Testes</CardTitle>
              <CardDescription>
                {testResults.length > 0 
                  ? `${testResults.filter(r => r.status === 'success').length}/${testResults.length} testes passaram`
                  : "Nenhum teste executado ainda"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {testResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Execute os testes para ver os resultados aqui
                </p>
              ) : (
                testResults.map((result, index) => (
                  <Card key={index}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        {getStatusIcon(result.status)}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{result.name}</h4>
                            <Badge variant={getStatusBadge(result.status)}>
                              {result.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{result.message}</p>
                          {result.details && (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                Ver detalhes
                              </summary>
                              <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-40">
                                {JSON.stringify(result.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}

              {testResults.length > 0 && (
                <Button variant="outline" onClick={clearResults} className="w-full">
                  Limpar Resultados
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950">
        <CardHeader>
          <CardTitle className="text-orange-700 dark:text-orange-300">
            ⚠️ Antes de ir para Produção
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>✅ Todos os testes automatizados devem passar</p>
          <p>✅ Criar assinatura teste e receber webhook com sucesso</p>
          <p>✅ Verificar que status muda de pending para active</p>
          <p>✅ Testar cancelamento após período mínimo (12 meses)</p>
          <p>✅ Configurar webhook no painel PRODUÇÃO do Asaas</p>
          <p>✅ Alterar modo para Produção na configuração</p>
          <p>✅ Fazer teste com valor real mínimo (R$ 0,01)</p>
        </CardContent>
      </Card>
    </div>
  );
}
