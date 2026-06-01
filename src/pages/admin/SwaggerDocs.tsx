import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Download, ExternalLink } from "lucide-react";
import openApiSpec from "@/config/openapi-spec.json";

const SwaggerDocs = () => {
  const handleDownloadSpec = () => {
    const blob = new Blob([JSON.stringify(openApiSpec, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leva-api-spec.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Documentação da API - Swagger</h1>
          <p className="text-muted-foreground">
            API REST para integração de ERPs com a plataforma Leva+
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Guia de Integração
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs">
                Siga a ordem: 1) Autenticação, 2) Validar, 3) Enviar, 4) Cancelar (se necessário)
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Base URL</CardTitle>
            </CardHeader>
            <CardContent>
              <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                https://auivszkscfcpczrkecoc.supabase.co/functions/v1
              </code>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start"
                onClick={handleDownloadSpec}
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar OpenAPI Spec
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start"
                onClick={() => window.open("/INTEGRACAO-WEBPOSTO.md", "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver Documentação MD
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/40">
          <CardHeader>
            <CardTitle>Fluxo de Integração</CardTitle>
            <CardDescription>
              Entenda o processo completo de uma transação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <h3 className="font-semibold">Autenticação</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  POST /auth-token com CNPJ, usuário e senha para obter Bearer Token
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                    2
                  </div>
                  <h3 className="font-semibold">Validação</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  POST /venda-validar com CPF e dados da venda. Retorna idTransacao e tipo (acúmulo/resgate)
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                    3
                  </div>
                  <h3 className="font-semibold">Confirmação</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  POST /venda-enviar com idTransacao para confirmar e processar pontos/cashback
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center text-sm font-semibold">
                    4
                  </div>
                  <h3 className="font-semibold">Cancelamento</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  POST /venda-cancelar com idTransacao para reverter a transação (opcional)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Endpoints Interativos</CardTitle>
            <CardDescription>
              Teste os endpoints diretamente pelo Swagger UI abaixo. Insira o Bearer Token em "Authorize" para testar.
            </CardDescription>
          </CardHeader>
          <CardContent className="swagger-container">
            <SwaggerUI 
              spec={openApiSpec}
              persistAuthorization={true}
              tryItOutEnabled={true}
              displayRequestDuration={true}
              filter={true}
              deepLinking={true}
            />
          </CardContent>
        </Card>

        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="text-yellow-600 dark:text-yellow-400">
              ⚠️ Importante - Credenciais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              • <strong>Token de Autenticação:</strong> Cada loja precisa ter uma API Key ativa configurada no sistema
            </p>
            <p>
              • <strong>CNPJ:</strong> Deve estar cadastrado como loja ativa na rede
            </p>
            <p>
              • <strong>Segurança:</strong> Todas as APIs exigem Bearer Token no header Authorization
            </p>
            <p>
              • <strong>Rate Limit:</strong> 100 requisições por minuto por API key
            </p>
          </CardContent>
        </Card>
      </div>

      <style>{`
        .swagger-container .swagger-ui {
          font-family: inherit;
        }
        .swagger-ui .topbar {
          display: none;
        }
        .swagger-ui .info {
          margin: 20px 0;
        }
        .swagger-ui .scheme-container {
          background: transparent;
          box-shadow: none;
          padding: 0;
        }
      `}</style>
    </>
  );
};

export default SwaggerDocs;
