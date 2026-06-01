import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { NotificationPopover } from "./NotificationPopover";
import { NotificationDialog } from "./NotificationDialog";
import { toast } from "sonner";
import { playNotificationSound } from "@/utils/notificationSound";

interface Notification {
  id: string;
  notification_id: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  client_notifications: {
    id: string;
    title: string;
    message: string;
    created_at: string;
  };
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    loadClientId();
  }, []);

  useEffect(() => {
    if (clientId) {
      loadNotifications();
      subscribeToNotifications();
    }
  }, [clientId]);

  const loadClientId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (client) {
      setClientId(client.id);
    }
  };

  const loadNotifications = async () => {
    if (!clientId) return;

    const { data, error } = await supabase
      .from('client_notification_recipients')
      .select(`
        id,
        notification_id,
        is_read,
        read_at,
        created_at,
        client_notifications!inner (
          id,
          title,
          message,
          created_at
        )
      `)
      .eq('client_id', clientId)
      .order('is_read', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Erro ao carregar notificações:', error);
      return;
    }

    if (data) {
      setNotifications(data as any);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  const subscribeToNotifications = () => {
    if (!clientId) return;

    const channel = supabase
      .channel('notification-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'client_notification_recipients',
          filter: `client_id=eq.${clientId}`
        },
        () => {
          toast.info("Nova notificação recebida!");
          playNotificationSound();
          loadNotifications();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'client_notification_recipients',
          filter: `client_id=eq.${clientId}`
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

  const handleNotificationClick = async (notification: Notification) => {
    setSelectedNotification(notification);
    setIsDialogOpen(true);
    setIsPopoverOpen(false);

    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
  };

  const markAsRead = async (recipientId: string) => {
    const { error } = await supabase
      .from('client_notification_recipients')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('id', recipientId);

    if (error) {
      console.error('Erro ao marcar como lida:', error);
      return;
    }

    loadNotifications();
  };

  const markAllAsRead = async () => {
    if (!clientId) return;

    const unreadIds = notifications
      .filter(n => !n.is_read)
      .map(n => n.id);

    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from('client_notification_recipients')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .in('id', unreadIds);

    if (error) {
      toast.error("Erro ao marcar todas como lidas");
      return;
    }

    toast.success("Todas as notificações foram marcadas como lidas");
    loadNotifications();
  };

  return (
    <>
      <NotificationPopover
        open={isPopoverOpen}
        onOpenChange={setIsPopoverOpen}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => setIsPopoverOpen(!isPopoverOpen)}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs animate-pulse"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        }
        notifications={notifications}
        onNotificationClick={handleNotificationClick}
        onMarkAllAsRead={markAllAsRead}
      />

      <NotificationDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        notification={selectedNotification}
      />
    </>
  );
}
