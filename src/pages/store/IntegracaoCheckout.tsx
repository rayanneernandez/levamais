import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Key, Zap, Code, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function IntegracaoCheckout() {
  const [apiKey, setApiKey] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const { toast } = useToast();
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('manage-api-key', {
        body: { action: 'list' }
      });

      if (error) throw error;

      if (data?.api_keys && data.api_keys.length > 0) {
        const liveKey = data.api_keys.find((k: any) => k.key_type === 'live' && k.is_active);
        if (liveKey) {
          setApiKey(liveKey.api_key);
          setHasApiKey(true);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar API keys:', error);
    }
  };

  const generateApiKey = async (keyType: 'live' | 'test' = 'live') => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-api-key', {
        body: { action: 'generate', key_type: keyType }
      });

      if (error) throw error;

      if (data?.api_key) {
        setApiKey(data.api_key.api_key);
        setHasApiKey(true);
        toast({
          title: "API Key Gerada!",
          description: `Sua chave de ${keyType === 'live' ? 'produção' : 'teste'} foi criada com sucesso`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao gerar API Key",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const regenerateApiKey = async () => {
    if (!confirm('Tem certeza que deseja regenerar a API Key? A chave antiga será desativada.')) {
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-api-key', {
        body: { action: 'regenerate', key_type: 'live' }
      });

      if (error) throw error;

      if (data?.api_key) {
        setApiKey(data.api_key.api_key);
        toast({
          title: "API Key Regenerada!",
          description: "Sua nova chave foi criada. Atualize suas integrações!",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao regenerar API Key",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para área de transferência`,
    });
  };

  const baseUrl = `https://${projectId}.supabase.co/functions/v1`;

  const endpointExamples = [
    {
      method: "POST",
      endpoint: `${baseUrl}/auth-token`,
      description: "1. Autenticação - Gera bearer token para uso nos demais endpoints",
      example: {
        usuario: "parceiro.webposto",
        senha: "S3nh@F0rte!",
        codigoEmpresa: "10.825.333/0002-91"
      }
    },
    {
      method: "POST",
      endpoint: `${baseUrl}/venda-validar`,
      description: "2. Pré-Venda - Valida voucher/CPF e retorna idTransacao",
      example: {
        codigoEmpresa: "10.353.336/0001-91",
        codigoVoucher: "123.456.789-09",
        horaVenda: "14:13:50",
        dataVenda: "08/12/2023",
        codigoVenda: "6978",
        produtos: [
          {
            codigoSequencia: 1,
            codigoColaborador: 2,
            nomeColaborador: "ANTONIO CARLOS",
            codigoProduto: "00001",
            nomeProduto: "GASOLINA COMUM",
            valorVenda: 50.0,
            quantidade: 10.225,
            valorUnitario: 4.89
          }
        ]
      }
    },
    {
      method: "POST",
      endpoint: `${baseUrl}/venda-enviar`,
      description: "3. Pós-Venda - Confirma a venda e efetiva pontos/cashback",
      example: {
        codigoEmpresa: "10.333.333/0001-00",
        codigoVenda: "6978",
        idTransacao: "19640141",
        produtos: [
          {
            codigoSequencia: 1,
            codigoColaborador: 2,
            nomeColaborador: "ANTONIO CARLOS",
            codigoProduto: "00001",
            nomeProduto: "GASOLINA COMUM",
            valorVenda: 50.0,
            quantidade: 10.225,
            valorUnitario: 4.89
          }
        ],
        pagamentos: [
          {
            descricaoFormaPagamento: "DINHEIRO",
            tipoPagamento: 1,
            valorPagamento: 38.5,
            idTransacao: ""
          }
        ]
      }
    },
    {
      method: "POST",
      endpoint: `${baseUrl}/venda-cancelar`,
      description: "4. Cancelamento - Cancela transação e reverte pontos/cashback",
      example: {
        codigoEmpresa: "10.825.333/0002-91",
        codigoVenda: "6978",
        idTransacao: "19640141"
      }
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integração Checkout</h1>
        <p className="text-muted-foreground text-sm">
          Configure a integração da sua plataforma de checkout com o Leva+
        </p>
      </div>

      <Tabs defaultValue="api" className="space-y-4">
        <TabsList>
          <TabsTrigger value="api" className="text-sm">
            <Key className="h-4 w-4 mr-2" />
            API Key
          </TabsTrigger>
          <TabsTrigger value="endpoints" className="text-sm">
            <Zap className="h-4 w-4 mr-2" />
            Endpoints
          </TabsTrigger>
          <TabsTrigger value="docs" className="text-sm">
            <Code className="h-4 w-4 mr-2" />
            Documentação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Chave de API</CardTitle>
              <CardDescription className="text-xs">
                Use esta chave para autenticar requisições à API do Leva+
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasApiKey ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Chave de Produção</Label>
                      <Badge variant="secondary" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Ativa
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={apiKey}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(apiKey, "API Key")}
                        disabled={!apiKey}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ⚠️ Mantenha sua chave em segredo. Não a compartilhe publicamente.
                    </p>
                  </div>

                  <div className="pt-4 border-t space-y-2">
                    <Label className="text-xs">Ações</Label>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs"
                        onClick={regenerateApiKey}
                        disabled={isLoading}
                      >
                        {isLoading && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                        Regenerar Chave
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs"
                        onClick={() => generateApiKey('test')}
                        disabled={isLoading}
                      >
                        {isLoading && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                        Criar Chave de Teste
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Você ainda não possui uma API Key. Gere uma para começar a integração.
                  </p>
                  <Button 
                    onClick={() => generateApiKey('live')}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Gerar API Key de Produção
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Key className="h-4 w-4" />
                Como usar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Inclua sua API Key no header de todas as requisições:
              </p>
              <div className="bg-background rounded-md p-3 border">
                <code className="text-xs">
                  Authorization: Bearer {apiKey || 'sua_api_key_aqui'}
                </code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-3">
          {endpointExamples.map((endpoint, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 flex-1">
                    <Badge variant={endpoint.method === "POST" ? "default" : "secondary"} className="text-xs shrink-0">
                      {endpoint.method}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <code className="text-xs font-mono block break-all">{endpoint.endpoint}</code>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(endpoint.endpoint, "Endpoint")}
                    className="shrink-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <CardDescription className="text-xs mt-2">
                  {endpoint.description}
                </CardDescription>
              </CardHeader>
              {endpoint.example && (
                <CardContent className="pt-0">
                  <Label className="text-xs mb-2 block">Exemplo de Request:</Label>
                  <div className="bg-muted rounded-md p-3">
                    <pre className="text-xs overflow-x-auto">
                      <code>{JSON.stringify(endpoint.example, null, 2)}</code>
                    </pre>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground break-all">
                <strong>Base URL:</strong> {baseUrl}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Documentação da API</CardTitle>
              <CardDescription className="text-xs">
                Guias completos para integração
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Exemplos de Integração</h4>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start text-xs" size="sm">
                    <Code className="h-3 w-3 mr-2" />
                    1. Autenticar (Gerar Token)
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-xs" size="sm">
                    <Code className="h-3 w-3 mr-2" />
                    2. Validar Venda (Pré-Venda)
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-xs" size="sm">
                    <Code className="h-3 w-3 mr-2" />
                    3. Confirmar Venda (Pós-Venda)
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-xs" size="sm">
                    <Code className="h-3 w-3 mr-2" />
                    4. Cancelar Venda
                  </Button>
                </div>
              </div>

              <div className="pt-3 border-t space-y-2">
                <h4 className="text-sm font-semibold">Recursos</h4>
                <div className="space-y-2">
                  <a
                    href="#"
                    className="flex items-center text-xs text-primary hover:underline"
                  >
                    📘 Documentação Completa →
                  </a>
                  <a
                    href="#"
                    className="flex items-center text-xs text-primary hover:underline"
                  >
                    💬 Suporte para Desenvolvedores →
                  </a>
                  <a
                    href="#"
                    className="flex items-center text-xs text-primary hover:underline"
                  >
                    🔧 SDK e Bibliotecas →
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Exemplo de Request</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-background rounded-md p-3 border">
                <pre className="text-xs overflow-x-auto">
                  <code>{`POST ${baseUrl}/venda-validar
Authorization: Bearer ${apiKey || 'sua_api_key_aqui'}
Content-Type: application/json

{
  "codigoEmpresa": "10.353.336/0001-91",
  "codigoVoucher": "123.456.789-09",
  "horaVenda": "14:13:50",
  "dataVenda": "08/12/2023",
  "codigoVenda": "6978",
  "produtos": [
    {
      "codigoSequencia": 1,
      "codigoColaborador": 2,
      "nomeColaborador": "ANTONIO CARLOS",
      "codigoProduto": "00001",
      "nomeProduto": "GASOLINA COMUM",
      "valorVenda": 50.0,
      "quantidade": 10.225,
      "valorUnitario": 4.89
    }
  ]
}`}</code>
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
