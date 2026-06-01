import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Download, Copy, CheckCircle } from "lucide-react";
import { useState } from "react";
import openApiSpec from "@/config/openapi-portal-cliente.json";

const PublicApiDocs = () => {
  const [copied, setCopied] = useState(false);

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

  const handleCopyBaseUrl = () => {
    navigator.clipboard.writeText("https://auivszkscfcpczrkecoc.supabase.co/functions/v1");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 py-8">
          <h1 className="text-4xl font-bold">🚀 Leva+ Portal do Cliente - API</h1>
          <p className="text-lg text-muted-foreground">
            Documentação completa para replicar o Portal do Cliente em aplicativos nativos
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Anon Key: <code className="bg-muted px-1 rounded text-xs break-all">eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1aXZzemtzY2ZjcGN6cmtlY29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyOTczMjksImV4cCI6MjA3NTg3MzMyOX0.Gz7wyWsb5NvFau6tJ_I9cce2HJm6s1o_nESHYAf3sPk</code>
          </p>
        </div>

        {/* Info Cards */}
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
                1) Login OTP (email+código) → 2) Buscar perfil e saldos → 3) Transações e extrato → 4) Notificações, One, Suporte
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

        {/* Flow */}
        <Card>
          <CardHeader>
            <CardTitle>Fluxo de Integração</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {[
                { n: 1, title: "Login OTP", desc: "Enviar código por email + verificar código → JWT token" },
                { n: 2, title: "Perfil e Saldos", desc: "Buscar dados do cliente, saldos por rede, lojas" },
                { n: 3, title: "Transações", desc: "Extrato, histórico, avaliações NPS" },
                { n: 4, title: "Recursos", desc: "One, Retenção, Indicação, Notificações, Suporte" },
              ].map((step) => (
                <div key={step.n} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${step.n === 4 ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                      {step.n}
                    </div>
                    <h3 className="font-semibold text-sm">{step.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Swagger UI */}
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

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4">
          © {new Date().getFullYear()} Leva+ Fidelidade — Documentação da API
        </div>
      </div>

      <style>{`
        .swagger-container .swagger-ui { font-family: inherit; }
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info { margin: 20px 0; }
        .swagger-ui .scheme-container { background: transparent; box-shadow: none; padding: 0; }
      `}</style>
    </div>
  );
};

export default PublicApiDocs;
