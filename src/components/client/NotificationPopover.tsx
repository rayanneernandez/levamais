import { Bell, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface NotificationPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  notifications: Notification[];
  onNotificationClick: (notification: Notification) => void;
  onMarkAllAsRead: () => void;
}

export function NotificationPopover({
  open,
  onOpenChange,
  trigger,
  notifications,
  onNotificationClick,
  onMarkAllAsRead
}: NotificationPopoverProps) {
  const recentNotifications = notifications.slice(0, 5);
  const hasUnread = notifications.some(n => !n.is_read);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <h3 className="font-semibold">Notificações</h3>
          </div>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAllAsRead}
              className="h-8 text-xs"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {recentNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mb-2 opacity-20" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentNotifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => onNotificationClick(notification)}
                  className={`w-full text-left p-4 hover:bg-accent transition-colors ${
                    !notification.is_read ? 'bg-accent/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 h-2 w-2 rounded-full ${
                      !notification.is_read ? 'bg-primary animate-pulse' : 'bg-transparent'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm mb-1 ${
                        !notification.is_read ? 'font-semibold' : 'font-medium'
                      }`}>
                        {notification.client_notifications.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.client_notifications.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 5 && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                className="w-full text-sm"
                onClick={() => onOpenChange(false)}
              >
                Ver todas as notificações ({notifications.length})
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
