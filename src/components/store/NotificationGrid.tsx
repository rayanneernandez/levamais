import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye, Search, Download } from "lucide-react";
import { NotificationDialog } from "@/components/client/NotificationDialog";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface NotificationData {
  id: string;
  title: string;
  message: string;
  sent_count: number;
  read_count: number;
  created_at: string;
  created_by: string;
}

export function NotificationGrid() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [networkId, setNetworkId] = useState<string | null>(null);

  useEffect(() => {
    loadNetworkId();
  }, []);

  useEffect(() => {
    if (networkId) {
      loadNotifications();
      subscribeToNotifications();
    }
  }, [networkId]);

  useEffect(() => {
    filterNotifications();
  }, [searchTerm, notifications]);

  const loadNetworkId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: manager } = await supabase
      .from('store_managers')
      .select('network_id')
      .eq('user_id', user.id)
      .is('store_id', null)
      .single();

    if (manager) {
      setNetworkId(manager.network_id);
    }
  };

  const loadNotifications = async () => {
    if (!networkId) return;

    setLoading(true);

    const { data, error } = await supabase
      .from('client_notifications')
      .select('*')
      .eq('network_id', networkId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar notificações:', error);
      toast.error("Erro ao carregar notificações");
    } else {
      setNotifications(data || []);
    }

    setLoading(false);
  };

  const subscribeToNotifications = () => {
    if (!networkId) return;

    const channel = supabase
      .channel('notification-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_notifications',
          filter: `network_id=eq.${networkId}`
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const filterNotifications = () => {
    if (!searchTerm.trim()) {
      setFilteredNotifications(notifications);
      return;
    }

    const filtered = notifications.filter(n =>
      n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.message.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredNotifications(filtered);
  };

  const handleViewNotification = (notification: NotificationData) => {
    setSelectedNotification({
      id: notification.id,
      notification_id: notification.id,
      is_read: true,
      read_at: new Date().toISOString(),
      created_at: notification.created_at,
      client_notifications: {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        created_at: notification.created_at
      }
    });
    setIsDialogOpen(true);
  };

  const exportToCSV = () => {
    const headers = ['Data/Hora', 'Título', 'Enviado para', 'Lidas', 'Taxa de Leitura'];
    const rows = filteredNotifications.map(n => [
      format(new Date(n.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      n.title,
      n.sent_count,
      n.read_count,
      `${n.sent_count > 0 ? ((n.read_count / n.sent_count) * 100).toFixed(1) : 0}%`
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `notificacoes_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();

    toast.success("Relatório exportado com sucesso!");
  };

  const readPercentage = (sent: number, read: number) => {
    if (sent === 0) return 0;
    return ((read / sent) * 100).toFixed(1);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" text="Carregando notificações..." />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Histórico de Notificações</CardTitle>
              <CardDescription>
                Acompanhe as notificações enviadas e as taxas de leitura
              </CardDescription>
            </div>
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título ou mensagem..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredNotifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "Nenhuma notificação encontrada" : "Nenhuma notificação enviada ainda"}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead className="text-center">Enviado para</TableHead>
                    <TableHead className="text-center">Lidas</TableHead>
                    <TableHead className="text-center">Taxa de Leitura</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNotifications.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(notification.created_at), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR
                        })}
                      </TableCell>
                      <TableCell className="font-medium max-w-xs truncate">
                        {notification.title}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {notification.sent_count} {notification.sent_count === 1 ? 'pessoa' : 'pessoas'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">
                          {notification.read_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={Number(readPercentage(notification.sent_count, notification.read_count)) > 50 ? "default" : "secondary"}
                        >
                          {readPercentage(notification.sent_count, notification.read_count)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewNotification(notification)}
                        >
                          <Eye className="h-4 w-4" />
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

      <NotificationDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        notification={selectedNotification}
      />
    </>
  );
}
