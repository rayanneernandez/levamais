import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Search, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WebhookEvent {
  id: string;
  event_type: string;
  payment_id: string | null;
  subscription_id: string | null;
  customer_id: string | null;
  payload: any;
  processed: boolean;
  error_message: string | null;
  created_at: string;
}

export default function AsaasWebhookLogs() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPayload, setSelectedPayload] = useState<any>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    filterEvents();
  }, [searchTerm, events]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('asaas_webhook_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setEvents(data || []);
      setFilteredEvents(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar eventos:', error);
      toast.error('Erro ao carregar eventos da webhook');
    } finally {
      setLoading(false);
    }
  };

  const filterEvents = () => {
    if (!searchTerm.trim()) {
      setFilteredEvents(events);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = events.filter(event =>
      event.event_type.toLowerCase().includes(term) ||
      event.payment_id?.toLowerCase().includes(term) ||
      event.subscription_id?.toLowerCase().includes(term) ||
      event.customer_id?.toLowerCase().includes(term)
    );

    setFilteredEvents(filtered);
  };

  const getStatusBadge = (event: WebhookEvent) => {
    if (event.error_message) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Erro
        </Badge>
      );
    }

    if (event.processed) {
      return (
        <Badge variant="default" className="gap-1 bg-green-600">
          <CheckCircle2 className="h-3 w-3" />
          Processado
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        Pendente
      </Badge>
    );
  };

  const getEventTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      'PAYMENT_RECEIVED': 'bg-green-600',
      'PAYMENT_CONFIRMED': 'bg-green-600',
      'PAYMENT_OVERDUE': 'bg-orange-600',
      'PAYMENT_DELETED': 'bg-red-600',
      'PAYMENT_REFUNDED': 'bg-red-600',
    };

    return (
      <Badge className={colors[type] || 'bg-blue-600'}>
        {type}
      </Badge>
    );
  };

  const stats = {
    total: events.length,
    processed: events.filter(e => e.processed).length,
    pending: events.filter(e => !e.processed && !e.error_message).length,
    errors: events.filter(e => e.error_message).length,
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Logs de Webhooks Asaas</h1>
          <p className="text-muted-foreground">Eventos recebidos das webhooks do Asaas</p>
        </div>
        <Button onClick={loadEvents} variant="outline" size="icon" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.processed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Erros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por tipo de evento, payment_id, subscription_id..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              Nenhum evento encontrado
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo de Evento</TableHead>
                    <TableHead>Payment ID</TableHead>
                    <TableHead>Subscription ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        {format(new Date(event.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {getEventTypeBadge(event.event_type)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {event.payment_id || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {event.subscription_id || '-'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(event)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPayload(event)}
                        >
                          Ver Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPayload && (
        <Card className="mt-4">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Detalhes do Evento</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedPayload(null)}>
                Fechar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold">Tipo:</span> {selectedPayload.event_type}
                </div>
                <div>
                  <span className="font-semibold">Status:</span> {getStatusBadge(selectedPayload)}
                </div>
                <div>
                  <span className="font-semibold">Payment ID:</span> {selectedPayload.payment_id || '-'}
                </div>
                <div>
                  <span className="font-semibold">Subscription ID:</span> {selectedPayload.subscription_id || '-'}
                </div>
                <div className="col-span-2">
                  <span className="font-semibold">Data:</span>{' '}
                  {format(new Date(selectedPayload.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                </div>
                {selectedPayload.error_message && (
                  <div className="col-span-2">
                    <span className="font-semibold text-red-600">Erro:</span>{' '}
                    <span className="text-red-600">{selectedPayload.error_message}</span>
                  </div>
                )}
              </div>

              <div>
                <span className="font-semibold text-sm">Payload JSON:</span>
                <div className="mt-2 max-h-96 overflow-auto rounded-md border bg-muted p-4">
                  <pre className="text-xs whitespace-pre-wrap">
                    {JSON.stringify(selectedPayload.payload, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
