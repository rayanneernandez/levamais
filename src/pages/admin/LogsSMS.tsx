import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function LogsSMS() {
  const [searchPhone, setSearchPhone] = useState("");
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [autoChecking, setAutoChecking] = useState(false);

  // Auto-refresh a cada 30 segundos
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["sms-logs", searchPhone],
    queryFn: async () => {
      let query = supabase
        .from("sms_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (searchPhone) {
        query = query.ilike("phone", `%${searchPhone}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  // Auto-check status dos últimos 20 SMS
  const autoCheckStatus = async () => {
    if (!logs || logs.length === 0 || autoChecking) return;
    
    setAutoChecking(true);
    
    // Pegar apenas os 20 mais recentes que têm código
    const recentLogs = logs.slice(0, 20).filter(log => log.sms_code);
    
    console.log(`🔄 Auto-checking status de ${recentLogs.length} SMS...`);
    
    for (const log of recentLogs) {
      try {
        let result;
        if (log.provider === "mex10") {
          const { data } = await supabase.functions.invoke("check-sms-status-mex10", {
            body: { sms_code: log.sms_code },
          });
          result = data;
        } else if (log.provider === "twilio") {
          const { data } = await supabase.functions.invoke("check-sms-status-twilio", {
            body: { message_sid: log.sms_code },
          });
          result = data;
        }
        
        if (result?.success && result?.status) {
          // Garantir que status seja sempre string
          const statusValue = typeof result.status === 'string' 
            ? result.status 
            : (typeof result.status === 'object' && result.status !== null)
              ? (result.status as any).status || String(result.status)
              : 'unknown';
          setStatusMap((prev) => ({ ...prev, [log.sms_code]: statusValue }));
        }
        
        // Pequeno delay entre requisições
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error("Erro ao verificar status:", error);
      }
    }
    
    setAutoChecking(false);
  };

  // Executar auto-check quando os logs carregarem
  useEffect(() => {
    if (logs && logs.length > 0 && !autoChecking && Object.keys(statusMap).length === 0) {
      autoCheckStatus();
    }
  }, [logs]);

  // Mutation para consultar status individual
  const checkStatusMutation = useMutation({
    mutationFn: async ({ provider, code }: { provider: string; code: string }) => {
      if (provider === "mex10") {
        const { data, error } = await supabase.functions.invoke("check-sms-status-mex10", {
          body: { sms_code: code },
        });
        if (error) throw error;
        return data;
      } else if (provider === "twilio") {
        const { data, error } = await supabase.functions.invoke("check-sms-status-twilio", {
          body: { message_sid: code },
        });
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data, variables) => {
      if (data?.success && data?.status) {
        // Garantir que status seja sempre string
        const statusValue = typeof data.status === 'string' 
          ? data.status 
          : (typeof data.status === 'object' && data.status !== null)
            ? (data.status as any).status || String(data.status)
            : 'unknown';
        setStatusMap((prev) => ({ ...prev, [variables.code]: statusValue }));
      }
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Logs de Envio SMS</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Histórico completo de envios via MEX10 e Twilio
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Histórico de Envios</CardTitle>
              <CardDescription>
                Últimos 100 envios registrados • Status atualizado automaticamente
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => autoCheckStatus()} 
                variant="outline" 
                size="sm"
                disabled={autoChecking}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${autoChecking ? 'animate-spin' : ''}`} />
                Atualizar Status
              </Button>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Recarregar
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por telefone..."
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando logs...
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum log encontrado
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Status Envio</TableHead>
                    <TableHead>Código SMS</TableHead>
                    <TableHead>Status Entrega</TableHead>
                    <TableHead>Resposta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    // Extrair valores corretamente - podem ser string ou objeto
                    let statusFromDB: string = 'unknown';
                    if (typeof log.status === 'string') {
                      statusFromDB = log.status;
                    } else if (typeof log.status === 'object' && log.status !== null) {
                      statusFromDB = (log.status as any).status || 'unknown';
                    }
                    
                    // Garantir que sms_code seja string
                    const smsCode = typeof log.sms_code === 'string' 
                      ? log.sms_code 
                      : (typeof log.sms_code === 'object' && log.sms_code !== null)
                        ? (log.sms_code as any).code || String(log.sms_code)
                        : null;
                    
                    const currentStatus = (smsCode && statusMap[smsCode]) || statusFromDB;
                    
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="uppercase">
                            {log.provider}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">{log.phone}</TableCell>
                        <TableCell className="max-w-xs truncate" title={log.message}>
                          {log.message}
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.success ? "default" : "destructive"}>
                            {log.success ? "✓ Enviado" : "✗ Falhou"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {smsCode ? (
                            <span className="text-primary">{smsCode}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {smsCode ? (
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={
                                  currentStatus === "ENTREGUE" || currentStatus === "delivered" 
                                    ? "default" 
                                    : currentStatus === "failed"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {currentStatus || "VERIFICANDO..."}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  checkStatusMutation.mutate({
                                    provider: log.provider,
                                    code: smsCode,
                                  })
                                }
                                disabled={checkStatusMutation.isPending}
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <details className="cursor-pointer">
                            <summary className="text-xs text-primary hover:underline">
                              Ver detalhes
                            </summary>
                            <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto max-w-md">
                              {typeof log.raw_response === 'string' 
                                ? log.raw_response 
                                : JSON.stringify(log.raw_response, null, 2)}
                            </pre>
                          </details>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
