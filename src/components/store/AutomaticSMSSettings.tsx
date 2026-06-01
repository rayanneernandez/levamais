import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Gift, Zap, Calendar, AlertCircle, Clock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface AutomaticSMSSettingsProps {
  channel: "email" | "whatsapp" | "sms";
}

interface SettingConfig {
  type: "resgate" | "acumulo" | "aniversario" | "expiracao_pontos" | "expiracao_plano";
  title: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
}

export function AutomaticSMSSettings({ channel }: AutomaticSMSSettingsProps) {
  const [settings, setSettings] = useState<SettingConfig[]>([
    {
      type: "resgate",
      title: "Resgate",
      description: "Enviar SMS automaticamente quando o cliente resgatar benefícios",
      icon: <Gift className="h-5 w-5 text-primary" />,
      enabled: false,
    },
    {
      type: "acumulo",
      title: "Acúmulo",
      description: "Enviar SMS automaticamente quando o cliente acumular benefícios",
      icon: <Zap className="h-5 w-5 text-primary" />,
      enabled: false,
    },
    {
      type: "aniversario",
      title: "Aniversário",
      description: "Enviar SMS automaticamente no aniversário do cliente",
      icon: <Calendar className="h-5 w-5 text-primary" />,
      enabled: false,
    },
    {
      type: "expiracao_pontos",
      title: "Expiração de Pontos",
      description: "Alertar quando pontos/cashback estiverem próximos de expirar",
      icon: <AlertCircle className="h-5 w-5 text-primary" />,
      enabled: false,
    },
    {
      type: "expiracao_plano",
      title: "Expiração de Plano",
      description: "Alertar quando o plano de fidelidade estiver próximo de expirar",
      icon: <Clock className="h-5 w-5 text-primary" />,
      enabled: false,
    },
  ]);

  const [networkId, setNetworkId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previewMessage, setPreviewMessage] = useState<{ type: string; message: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, [channel]);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: manager } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!manager) throw new Error("Gerente não encontrado");
      setNetworkId(manager.network_id);

      // Buscar templates existentes
      const { data: templates, error } = await supabase
        .from("marketing_message_templates")
        .select("*")
        .eq("network_id", manager.network_id)
        .eq("channel", channel);

      if (error) throw error;

      // Atualizar estado dos toggles
      setSettings((prev) =>
        prev.map((setting) => {
          const template = templates?.find((t) => t.template_type === setting.type);
          return {
            ...setting,
            enabled: template?.auto_send_enabled || false,
          };
        })
      );
    } catch (error: any) {
      toast({
        title: "Erro ao carregar configurações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSetting = async (type: string, enabled: boolean) => {
    if (!networkId) return;

    try {
      // Atualizar ou criar template com auto_send_enabled
      const { error } = await supabase
        .from("marketing_message_templates")
        .upsert(
          {
            network_id: networkId,
            channel,
            template_type: type,
            auto_send_enabled: enabled,
            is_active: true,
            // Mensagens padrão simples para cada tipo
            message_content: getDefaultMessage(type),
            subject: channel === "email" ? getDefaultSubject(type) : null,
          },
          {
            onConflict: "network_id,channel,template_type",
          }
        );

      if (error) throw error;

      // Atualizar estado local
      setSettings((prev) =>
        prev.map((setting) =>
          setting.type === type ? { ...setting, enabled } : setting
        )
      );

      toast({
        title: enabled ? "Disparo automático ativado" : "Disparo automático desativado",
        description: `${settings.find((s) => s.type === type)?.title} ${
          enabled ? "ativado" : "desativado"
        } com sucesso.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar configuração",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getDefaultMessage = (type: string): string => {
    const messages: Record<string, string> = {
      resgate: "Olá {{nome}}! Você resgatou {{valor}} com sucesso. Saldo atual: {{saldo}}. Obrigado!",
      acumulo: "Olá {{nome}}! Você acumulou {{valor}}. Saldo atual: {{saldo}}. Continue comprando!",
      aniversario: "Parabéns {{nome}}! Hoje é seu dia especial! Preparamos {{valor}} de presente para você! 🎁",
      expiracao_pontos: "Olá {{nome}}! Atenção! Seu saldo de {{valor}} expira em {{dias_restantes}}. Aproveite!",
      expiracao_plano: "Olá {{nome}}! Seu plano {{plano}} expira em {{dias_restantes}}. Renove e continue aproveitando!",
    };
    return messages[type] || "";
  };

  const getDefaultSubject = (type: string): string => {
    const subjects: Record<string, string> = {
      resgate: "Resgate realizado com sucesso!",
      acumulo: "Você acumulou benefícios!",
      aniversario: "Feliz Aniversário! 🎂",
      expiracao_pontos: "⚠️ Seus benefícios estão expirando!",
      expiracao_plano: "⏰ Seu plano está expirando",
    };
    return subjects[type] || "";
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" text="Carregando configurações..." />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Disparos Automáticos</CardTitle>
          <CardDescription>
            Configure quais mensagens devem ser enviadas automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.map((setting) => (
            <div
              key={setting.type}
              className="flex items-start justify-between rounded-lg border p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start gap-3 flex-1">
                <div className="mt-1">{setting.icon}</div>
                <div className="space-y-1 flex-1">
                  <Label className="text-base font-medium">{setting.title}</Label>
                  <p className="text-sm text-muted-foreground">
                    {setting.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPreviewMessage({ type: setting.title, message: getDefaultMessage(setting.type) })}
                  title="Visualizar mensagem"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Switch
                  checked={setting.enabled}
                  onCheckedChange={(checked) => toggleSetting(setting.type, checked)}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!previewMessage} onOpenChange={() => setPreviewMessage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mensagem - {previewMessage?.type}</DialogTitle>
            <DialogDescription>
              Esta é a mensagem padrão que será enviada automaticamente. As variáveis serão substituídas pelos dados reais do cliente.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={previewMessage?.message || ""}
            readOnly
            className="min-h-[120px] resize-none"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
