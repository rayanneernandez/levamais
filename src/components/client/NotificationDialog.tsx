import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell } from "lucide-react";

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

interface NotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification: Notification | null;
}

export function NotificationDialog({
  open,
  onOpenChange,
  notification
}: NotificationDialogProps) {
  if (!notification) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <DialogTitle className="text-xl">
              {notification.client_notifications.title}
            </DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(notification.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
              locale: ptBR
            })}
          </p>
        </DialogHeader>
        <div className="py-4">
          <p className="whitespace-pre-wrap text-foreground">
            {notification.client_notifications.message}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
