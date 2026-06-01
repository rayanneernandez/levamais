import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  isPushNotificationSupported, 
  isPushNotificationPermissionGranted,
  isPushNotificationSubscribed,
  subscribeToPushNotifications,
  sendTestPushNotification
} from "@/utils/pushNotifications";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function PushNotificationPrompt() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    // Verificar se é iOS antes de fazer qualquer coisa
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (isIOS) {
      console.log('📱 iOS detectado - Push notifications não suportadas');
      setIsSupported(false);
      setIsVisible(false);
      return;
    }
    
    checkSupport();
    loadClientId();
  }, []);

  const checkSupport = async () => {
    const supported = isPushNotificationSupported();
    setIsSupported(supported);

    if (supported) {
      const hasPermission = isPushNotificationPermissionGranted();
      const subscribed = await isPushNotificationSubscribed();
      setIsSubscribed(subscribed);
      
      // Mostrar prompt se suportado mas não inscrito e não negado
      if (!subscribed && Notification.permission !== 'denied') {
        // Esperar 3 segundos antes de mostrar
        setTimeout(() => setIsVisible(true), 3000);
      }
    }
  };

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

  const handleSubscribe = async () => {
    if (!clientId) {
      toast.error("Erro ao identificar cliente");
      return;
    }

    setIsLoading(true);

    try {
      // Verificar se já foi negada
      if (Notification.permission === 'denied') {
        toast.error("Permissão negada. Por favor, habilite notificações nas configurações do navegador.");
        setIsLoading(false);
        return;
      }
      
      // Deixar subscribeToPushNotifications lidar com tudo
      const success = await subscribeToPushNotifications(clientId);

      if (success) {
        setIsSubscribed(true);
        setIsVisible(false);
        toast.success("Notificações ativadas com sucesso! 🔔");
        
        // Enviar notificação de teste após 2 segundos
        setTimeout(() => {
          sendTestPushNotification();
        }, 2000);
      } else {
        toast.error("Erro ao ativar notificações. Verifique o console para mais detalhes.");
      }
    } catch (error) {
      console.error('Erro ao ativar notificações:', error);
      toast.error("Erro ao ativar notificações");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Salvar no localStorage para não mostrar novamente nesta sessão
    localStorage.setItem('push-notification-prompt-dismissed', 'true');
  };

  // Não mostrar se não for suportado, já inscrito, ou já foi dispensado
  if (!isSupported || isSubscribed || !isVisible) {
    return null;
  }

  // Verificar se já foi dispensado nesta sessão
  if (localStorage.getItem('push-notification-prompt-dismissed') === 'true') {
    return null;
  }

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-lg">
      <CardHeader className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-6 w-6"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Ative as Notificações</CardTitle>
            <CardDescription>
              Receba alertas mesmo com o app fechado
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ative as notificações push para receber alertas instantâneos de promoções, 
          ofertas exclusivas e informações importantes, mesmo quando o app estiver fechado.
        </p>
        <div className="flex gap-2">
          <Button 
            onClick={handleSubscribe} 
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? "Ativando..." : "Ativar Notificações"}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleDismiss}
          >
            Agora não
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Você pode desativar a qualquer momento nas configurações
        </p>
      </CardContent>
    </Card>
  );
}
