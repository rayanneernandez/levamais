import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Copy, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AsaasConfig() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showProdKey, setShowProdKey] = useState(false);
  const [showSandboxKey, setShowSandboxKey] = useState(false);
  const [config, setConfig] = useState<any>({
    id: undefined,
    api_key_production: "",
    api_key_sandbox: "",
    is_sandbox: true,
    webhook_token: "",
  });
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    loadConfig();
    generateWebhookUrl();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("asaas_config")
        .select("*")
        .single();

      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        setConfig(data);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar configuração",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const generateWebhookUrl = () => {
    const projectUrl = import.meta.env.VITE_SUPABASE_URL;
    const url = `${projectUrl}/functions/v1/asaas-webhook-one`;
    setWebhookUrl(url);
  };

  const generateWebhookToken = () => {
    const token = crypto.randomUUID();
    setConfig({ ...config, webhook_token: token });
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("asaas_config")
        .upsert({
          id: config.id || crypto.randomUUID(),
          ...config,
        });

      if (error) throw error;

      toast({
        title: "Configuração salva",
        description: "As configurações do Asaas foram atualizadas com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const apiKey = config.is_sandbox ? config.api_key_sandbox : config.api_key_production;
      
      if (!apiKey) {
        toast({
          title: "API Key não configurada",
          description: "Configure a API Key antes de testar a conexão.",
          variant: "destructive",
        });
        return;
      }

      // Chamar Edge Function para testar conexão
      const { data, error } = await supabase.functions.invoke('asaas-test-connection', {
        body: {
          apiKey,
          isSandbox: config.is_sandbox,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Conexão bem-sucedida",
          description: "A API do Asaas está respondendo corretamente.",
        });
        // Recarregar config para pegar as datas atualizadas
        await loadConfig();
      } else {
        throw new Error(data?.error || "Falha na conexão com Asaas");
      }
    } catch (error: any) {
      toast({
        title: "Erro na conexão",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "URL copiada para a área de transferência.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuração Asaas</h1>
        <p className="text-muted-foreground">
          Configure a integração com o gateway de pagamento Asaas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chaves de API</CardTitle>
          <CardDescription>
            Configure suas chaves de API para produção e sandbox
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Modo Sandbox</Label>
              <p className="text-sm text-muted-foreground">
                Use a API de testes do Asaas
              </p>
            </div>
            <Switch
              checked={config.is_sandbox}
              onCheckedChange={(checked) =>
                setConfig({ ...config, is_sandbox: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_key_production">API Key Produção</Label>
            <div className="flex gap-2">
              <Input
                id="api_key_production"
                type={showProdKey ? "text" : "password"}
                value={config.api_key_production}
                onChange={(e) =>
                  setConfig({ ...config, api_key_production: e.target.value })
                }
                placeholder="Cole ou digite a API Key de produção"
              />
              <Button
                variant="outline"
                size="icon"
                type="button"
                onClick={() => setShowProdKey(!showProdKey)}
              >
                {showProdKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Comece digitando para substituir a chave atual
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_key_sandbox">API Key Sandbox</Label>
            <div className="flex gap-2">
              <Input
                id="api_key_sandbox"
                type={showSandboxKey ? "text" : "password"}
                value={config.api_key_sandbox}
                onChange={(e) =>
                  setConfig({ ...config, api_key_sandbox: e.target.value })
                }
                placeholder="Cole ou digite a API Key de sandbox"
              />
              <Button
                variant="outline"
                size="icon"
                type="button"
                onClick={() => setShowSandboxKey(!showSandboxKey)}
              >
                {showSandboxKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Comece digitando para substituir a chave atual
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveConfig} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Configuração
            </Button>
            <Button onClick={testConnection} variant="outline" disabled={testing}>
              {testing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Testar Conexão
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook</CardTitle>
          <CardDescription>
            Configure o webhook no painel do Asaas para receber notificações de pagamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              <strong>⚠️ IMPORTANTE - Passos para configurar o Webhook no Asaas:</strong>
              <ol className="mt-2 ml-4 list-decimal space-y-1">
                <li>Acesse o painel Asaas: <strong>Menu Usuário → Integrações → Webhooks</strong></li>
                <li>Clique em <strong>"Criar Webhook"</strong> (ou edite o existente)</li>
                <li>Cole a <strong>URL do Webhook</strong> abaixo no campo "URL"</li>
                <li>⚠️ <strong>CRÍTICO:</strong> No campo <strong>"Access Token"</strong>, cole o <strong>Token de Segurança</strong> mostrado abaixo</li>
                <li>Marque os eventos: <strong>PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE, PAYMENT_DELETED, PAYMENT_REFUNDED</strong></li>
                <li>Salve o webhook no Asaas</li>
              </ol>
              <p className="mt-2 text-amber-600 font-medium">
                💡 Se o webhook retornar erro 401 (Unauthorized), verifique se o Access Token está configurado corretamente no Asaas!
              </p>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>URL do Webhook</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(webhookUrl)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook_token" className="text-base font-semibold">
              🔐 Token de Segurança (Access Token)
            </Label>
            <div className="flex gap-2">
              <Input
                id="webhook_token"
                value={config.webhook_token}
                readOnly
                className="font-mono bg-amber-50 border-amber-200"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={generateWebhookToken}
                title="Gerar novo token"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(config.webhook_token)}
                title="Copiar token"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm font-medium text-amber-600">
              ⚠️ Este token DEVE ser configurado no campo "Access Token" do webhook no painel do Asaas!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
