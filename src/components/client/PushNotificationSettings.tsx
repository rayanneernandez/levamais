import { useState, useEffect } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { 
  isPushNotificationSupported, 
  isPushNotificationPermissionGranted,
  isPushNotificationSubscribed,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  sendTestPushNotification
} from "@/utils/pushNotifications";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PushNotificationSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PushNotificationSettings({ open, onOpenChange }: PushNotificationSettingsProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      checkStatus();
      loadClientId();
    }
  }, [open]);

  const checkStatus = async () => {
    const supported = isPushNotificationSupported();
    setIsSupported(supported);

    if (supported) {
      const subscribed = await isPushNotificationSubscribed();
      setIsSubscribed(subscribed);
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

  const handleToggle = async (enabled: boolean) => {
    if (!clientId) {
      toast.error("Erro ao identificar cliente");
      return;
    }

    setIsLoading(true);

    try {
      if (enabled) {
        // Verificar se permissão já foi negada
        if (Notification.permission === 'denied') {
          toast.error("Por favor, habilite notificações nas configurações do navegador");
          setIsLoading(false);
          return;
        }
        
        // Deixar subscribeToPushNotifications lidar com tudo
        try {
          const success = await subscribeToPushNotifications(clientId);
          if (success) {
            setIsSubscribed(true);
            toast.success("Notificações push ativadas!");
            
            // Enviar notificação de teste
            setTimeout(() => {
              sendTestPushNotification();
            }, 1000);
          } else {
            toast.error("Erro ao ativar notificações. Verifique o console para mais detalhes.");
          }
        } catch (subscribeError: any) {
          console.error('Erro detalhado ao inscrever:', subscribeError);
          toast.error(subscribeError.message || "Erro ao ativar notificações");
        }
      } else {
        const success = await unsubscribeFromPushNotifications(clientId);
        if (success) {
          setIsSubscribed(false);
          toast.success("Notificações push desativadas");
        } else {
          toast.error("Erro ao desativar notificações");
        }
      }
    } catch (error: any) {
      console.error('Erro ao alterar notificações:', error);
      toast.error(error.message || "Erro ao alterar configuração");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = () => {
    sendTestPushNotification();
    toast.info("Notificação de teste enviada!");
  };

  if (!isSupported) {
    // Verificar se é iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notificações Push</DialogTitle>
            <DialogDescription>
              {isIOS ? "Não suportado no iOS/Safari" : "Navegador não suportado"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {isIOS ? (
              <>
                <p className="text-sm text-muted-foreground">
                  O Safari no iPhone e iPad ainda não suporta notificações push através da web.
                </p>
                <Card className="bg-muted/50">
                  <CardContent className="pt-4 space-y-2 text-sm">
                    <p className="font-medium">Alternativas:</p>
                    <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                      <li>Use o aplicativo no Chrome ou Firefox (Android)</li>
                      <li>As notificações dentro do app continuam funcionando</li>
                      <li>Aguarde futuras atualizações do iOS</li>
                    </ul>
                  </CardContent>
                </Card>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    💡 <strong>Sobre o ícone do app:</strong> Para atualizar o ícone, remova o app da tela inicial e adicione novamente.
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Para receber notificações push, use um navegador moderno como Chrome, Firefox ou Edge.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <DialogTitle>Notificações Push</DialogTitle>
          </div>
          <DialogDescription>
            Receba alertas mesmo com o app fechado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Card className={isSubscribed ? "border-primary/50 bg-primary/5" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="push-enabled" className="text-base font-medium flex items-center gap-2">
                    {isSubscribed ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <BellOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    Notificações Push
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {isSubscribed 
                      ? "Você receberá notificações mesmo com o app fechado" 
                      : "Ative para receber alertas instantâneos"
                    }
                  </p>
                </div>
                <Switch
                  id="push-enabled"
                  checked={isSubscribed}
                  onCheckedChange={handleToggle}
                  disabled={isLoading}
                />
              </div>
            </CardContent>
          </Card>

          {isSubscribed && (
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleTestNotification}
              >
                <Bell className="mr-2 h-4 w-4" />
                Enviar Notificação de Teste
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Uma notificação de teste será enviada para verificar o funcionamento
              </p>
            </div>
          )}

          <Card className="bg-muted/50">
            <CardContent className="pt-4 space-y-2 text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                Funciona mesmo com app fechado
              </p>
              <p className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                Alertas sonoros e visuais do sistema
              </p>
              <p className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                Você pode desativar a qualquer momento
              </p>
            </CardContent>
          </Card>

          {Notification.permission === 'denied' && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="pt-4">
                <p className="text-sm text-destructive">
                  ⚠️ As notificações foram bloqueadas pelo navegador. 
                  Para ativá-las, acesse as configurações do navegador e permita notificações para este site.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
