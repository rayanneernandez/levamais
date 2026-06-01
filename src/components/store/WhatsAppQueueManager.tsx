import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WhatsAppQueueItem {
  id: string;
  phone: string;
  message_type: string;
  template_name: string | null;
  message_text: string | null;
  status: string;
  priority: number;
  scheduled_for: string;
  sent_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  clients?: {
    full_name: string;
  };
}

interface WhatsAppQueueManagerProps {
  networkId: string;
}

export function WhatsAppQueueManager({ networkId }: WhatsAppQueueManagerProps) {
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { data: queueItems, isLoading, refetch } = useQuery({
    queryKey: ["whatsapp-queue", networkId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_message_queue")
        .select(`
          *,
          clients (
            full_name
          )
        `)
        .eq("network_id", networkId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as WhatsAppQueueItem[];
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const { data: stats } = useQuery({
    queryKey: ["whatsapp-queue-stats", networkId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_message_queue")
        .select("status")
        .eq("network_id", networkId);

      if (error) throw error;

      const pending = data.filter((item) => item.status === "pending").length;
      const processing = data.filter((item) => item.status === "processing").length;
      const sent = data.filter((item) => item.status === "sent").length;
      const failed = data.filter((item) => item.status === "failed").length;
      const waiting = data.filter((item) => item.status === "waiting_reply").length;

      return { pending, processing, sent, failed, waiting, total: data.length };
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: any; className?: string }> = {
      pending: { variant: "secondary", label: "Pendente", icon: Clock },
      processing: { variant: "default", label: "Processando", icon: Loader2 },
      sent: { variant: "outline", label: "Enviado", icon: CheckCircle2 },
      failed: { variant: "destructive", label: "Falhou", icon: XCircle },
      cancelled: { variant: "outline", label: "Cancelado", icon: XCircle },
      waiting_reply: { variant: "outline", label: "Aguardando Resposta", icon: Clock, className: "bg-amber-100 text-amber-800 border-amber-300" },
    };

    const config = variants[status] || { variant: "outline" as const, label: status, icon: Clock };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={`gap-1 ${config.className || ''}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Processando</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.processing || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-amber-800">Aguardando Resposta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats?.waiting || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Enviados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.sent || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Falharam</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.failed || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fila de Mensagens WhatsApp</CardTitle>
              <CardDescription>
                Mensagens programadas e em processamento
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : !queueItems || queueItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma mensagem na fila
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Agendado</TableHead>
                    <TableHead>Tentativas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.clients?.full_name || "N/A"}
                      </TableCell>
                      <TableCell>{item.phone}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {item.message_type === "template" ? "Template" : "Texto"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {item.message_type === "template" 
                          ? item.template_name 
                          : item.message_text}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell>
                        <Badge variant={item.priority <= 3 ? "default" : "secondary"}>
                          P{item.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(item.scheduled_for), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        {item.retry_count > 0 && (
                          <Badge variant="outline">{item.retry_count}x</Badge>
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
    </div>
  );
}