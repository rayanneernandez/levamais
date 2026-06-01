import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Download, Copy, CheckCircle } from "lucide-react";
import { useState } from "react";
import openApiSpec from "@/config/openapi-portal-cliente.json";

const ApiDocsPortal = () => {
  const [copied, setCopied] = useState(false);

  const handleDownloadSpec = () => {
    const blob = new Blob([JSON.stringify(openApiSpec, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leva-portal-cliente-api-spec.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyBaseUrl = () => {
    navigator.clipboard.writeText("https://auivszkscfcpczrkecoc.supabase.co/functions/v1");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">🚀 API Portal do Cliente</h1>
          <p className="text-muted-foreground">
            Documentação completa para replicar o Portal do Cliente em aplicativos nativos (a0.dev)
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Guia Rápido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs">
                1) Login OTP (email+código) → 2) Buscar perfil e saldos → 3) Transações e extrato → 4) Config de rede, One, Retenção, Notificações
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Base URL</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded block break-all flex-1">
                  https://auivszkscfcpczrkecoc.supabase.co/functions/v1
                </code>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleCopyBaseUrl}>
                  {copied ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Download</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full" onClick={handleDownloadSpec}>
                <Download className="h-4 w-4 mr-2" />
                Baixar OpenAPI Spec (JSON)
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="text-yellow-600 dark:text-yellow-400 text-sm">
              ⚠️ Anon Key (usar no header apikey)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
              eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1aXZzemtzY2ZjcGN6cmtlY29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyOTczMjksImV4cCI6MjA3NTg3MzMyOX0.Gz7wyWsb5NvFau6tJ_I9cce2HJm6s1o_nESHYAf3sPk
            </code>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Endpoints Interativos</CardTitle>
            <CardDescription>
              Clique em "Authorize" e insira o Bearer Token para testar os endpoints diretamente.
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
      </div>

      <style>{`
        .swagger-container .swagger-ui { font-family: inherit; }
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info { margin: 20px 0; }
        .swagger-ui .scheme-container { background: transparent; box-shadow: none; padding: 0; }
      `}</style>
    </>
  );
};

export default ApiDocsPortal;
