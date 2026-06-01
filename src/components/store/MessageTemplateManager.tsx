import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, AlertCircle, Zap, Mail as MailIcon, Calendar, Gift } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface MessageTemplateManagerProps {
  channel: "email" | "whatsapp" | "sms";
  networkId?: string;
}

interface Template {
  id?: string;
  template_type: "resgate" | "acumulo" | "aniversario" | "promocao" | "expiracao_pontos" | "expiracao_plano";
  subject?: string;
  message_content: string;
  auto_send_enabled: boolean;
}

const defaultTemplates = {
  resgate: {
    subject: "Resgate realizado com sucesso!",
    message: "Olá {{nome}}!\n\nVocê resgatou {{valor}} com sucesso na sua última compra. Seu saldo atual é de {{saldo}}.\n\nObrigado por participar do nosso programa de fidelidade! 🎉",
  },
  acumulo: {
    subject: "Você acumulou benefícios!",
    message: "Olá {{nome}}!\n\nVocê acumulou {{valor}} na sua última compra. Seu saldo atual é de {{saldo}}. Continue comprando e acumulando.",
  },
  aniversario: {
    subject: "Feliz Aniversário! 🎂",
    message: "Parabéns {{nome}}! Hoje é um dia especial e preparamos um presente para você: {{valor}} de presente! Aproveite! 🎁🎉",
  },
  promocao: {
    subject: "Promoção Especial para Você!",
    message: "Oi {{nome}}! Temos uma promoção especial só para você! [Descreva sua promoção aqui]",
  },
  expiracao_pontos: {
    subject: "⚠️ Seus {{tipo}} estão prestes a expirar!",
    message: "Olá {{nome}}!\n\nAtenção! Seu saldo de {{valor}} irá expirar em {{dias_restantes}}. Aproveite seus benefícios antes que expire! 🏃‍♂️",
  },
  expiracao_plano: {
    subject: "⏰ Seu plano de fidelidade está expirando",
    message: "Olá {{nome}}!\n\nSeu plano de fidelidade {{plano}} expira em {{dias_restantes}}. Renove agora e continue aproveitando {{beneficio}}! 🎁",
  },
};

export function MessageTemplateManager({ channel, networkId: propNetworkId }: MessageTemplateManagerProps) {
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [networkId, setNetworkId] = useState<string | null>(propNetworkId || null);
  const { toast } = useToast();

  useEffect(() => {
    loadTemplates();
  }, [channel, propNetworkId]);

  const loadTemplates = async () => {
    try {
      let currentNetworkId = propNetworkId;

      // Se não foi passado networkId via prop, buscar do store_managers
      if (!currentNetworkId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data: manager } = await supabase
          .from("store_managers")
          .select("network_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!manager) throw new Error("Gerente não encontrado");
        currentNetworkId = manager.network_id;
      }

      setNetworkId(currentNetworkId);

      // Buscar templates existentes
      const { data: existingTemplates, error } = await supabase
        .from("marketing_message_templates")
        .select("*")
        .eq("network_id", currentNetworkId)
        .eq("channel", channel);

      if (error) throw error;

      // Organizar templates por tipo
      const templatesMap: Record<string, Template> = {};
      const templateTypes: Array<"resgate" | "acumulo" | "aniversario" | "promocao" | "expiracao_pontos" | "expiracao_plano"> = 
        ["resgate", "acumulo", "aniversario", "promocao", "expiracao_pontos", "expiracao_plano"];

      templateTypes.forEach((type) => {
        const existing = existingTemplates?.find((t) => t.template_type === type);
        if (existing) {
          templatesMap[type] = {
            id: existing.id,
            template_type: type,
            subject: existing.subject || "",
            message_content: existing.message_content,
            auto_send_enabled: existing.auto_send_enabled,
          };
        } else {
          // Usar template padrão
          templatesMap[type] = {
            template_type: type,
            subject: channel === "email" ? defaultTemplates[type].subject : "",
            message_content: defaultTemplates[type].message,
            auto_send_enabled: false,
          };
        }
      });

      setTemplates(templatesMap);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar templates",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveTemplate = async (type: keyof typeof templates) => {
    if (!networkId) return;

    setIsSaving(true);
    try {
      const template = templates[type];
      
      const { error } = await supabase
        .from("marketing_message_templates")
        .upsert({
          id: template.id,
          network_id: networkId,
          channel,
          template_type: type,
          subject: channel === "email" ? template.subject : null,
          message_content: template.message_content,
          auto_send_enabled: template.auto_send_enabled,
          is_active: true,
        }, {
          onConflict: "network_id,channel,template_type",
        });

      if (error) throw error;

      toast({
        title: "Template salvo!",
        description: "As configurações foram atualizadas com sucesso.",
      });

      // Recarregar para pegar o ID se foi criado
      await loadTemplates();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar template",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateTemplate = (type: keyof typeof templates, field: keyof Template, value: any) => {
    setTemplates((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value,
      },
    }));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "resgate":
        return <Gift className="h-5 w-5" />;
      case "acumulo":
        return <Zap className="h-5 w-5" />;
      case "aniversario":
        return <Calendar className="h-5 w-5" />;
      case "promocao":
        return <MailIcon className="h-5 w-5" />;
      case "expiracao_pontos":
        return <AlertCircle className="h-5 w-5" />;
      case "expiracao_plano":
        return <AlertCircle className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const getTitle = (type: string) => {
    switch (type) {
      case "resgate":
        return "Mensagem de Resgate";
      case "acumulo":
        return "Mensagem de Acúmulo";
      case "aniversario":
        return "Mensagem de Aniversário";
      case "promocao":
        return "Mensagem Promocional";
      case "expiracao_pontos":
        return "Expiração de Pontos/Cashback";
      case "expiracao_plano":
        return "Expiração do Plano de Fidelidade";
      default:
        return "";
    }
  };

  const getDescription = (type: string) => {
    switch (type) {
      case "resgate":
        return "Enviada automaticamente quando o cliente resgata benefícios";
      case "acumulo":
        return "Enviada automaticamente quando o cliente acumula benefícios";
      case "aniversario":
        return "Enviada no aniversário do cliente (automático ou manual)";
      case "promocao":
        return "Para campanhas promocionais (apenas envio manual)";
      case "expiracao_pontos":
        return "Alerta quando pontos/cashback estão próximos de expirar (automático ou manual)";
      case "expiracao_plano":
        return "Alerta quando o plano de fidelidade está acabando (automático ou manual)";
      default:
        return "";
    }
  };

  const isEditable = (type: string) => 
    type === "aniversario" || type === "promocao" || type === "expiracao_pontos" || type === "expiracao_plano";
  const canAutoSend = (type: string) => type !== "promocao";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="lg" text="Carregando templates..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Variáveis Disponíveis</AlertTitle>
        <AlertDescription>
          Use estas variáveis nas mensagens para personalização:
          <div className="mt-2 space-y-1 font-mono text-xs">
            <div><code className="bg-muted px-2 py-1 rounded">{"{{nome}}"}</code> - Nome do cliente</div>
            <div><code className="bg-muted px-2 py-1 rounded">{"{{valor}}"}</code> - Valor acumulado/resgatado</div>
            <div><code className="bg-muted px-2 py-1 rounded">{"{{saldo}}"}</code> - Saldo atual do cliente</div>
          </div>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="resgate" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="resgate">Resgate</TabsTrigger>
          <TabsTrigger value="acumulo">Acúmulo</TabsTrigger>
          <TabsTrigger value="aniversario">Aniversário</TabsTrigger>
          <TabsTrigger value="promocao">Promoção</TabsTrigger>
          <TabsTrigger value="expiracao_pontos">Exp. Pontos</TabsTrigger>
          <TabsTrigger value="expiracao_plano">Exp. Plano</TabsTrigger>
        </TabsList>

        {(["resgate", "acumulo", "aniversario", "promocao", "expiracao_pontos", "expiracao_plano"] as const).map((type) => (
          <TabsContent key={type} value={type}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getIcon(type)}
                  {getTitle(type)}
                  {templates[type]?.auto_send_enabled && canAutoSend(type) && (
                    <Badge variant="default">Automático</Badge>
                  )}
                  {!isEditable(type) && (
                    <Badge variant="secondary">Fixo</Badge>
                  )}
                </CardTitle>
                <CardDescription>{getDescription(type)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {channel === "email" && (
                  <div className="space-y-2">
                    <Label>Assunto do E-mail</Label>
                    <Input
                      value={templates[type]?.subject || ""}
                      onChange={(e) => updateTemplate(type, "subject", e.target.value)}
                      disabled={!isEditable(type)}
                      placeholder="Digite o assunto do e-mail"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <Textarea
                    value={templates[type]?.message_content || ""}
                    onChange={(e) => updateTemplate(type, "message_content", e.target.value)}
                    disabled={!isEditable(type)}
                    className="min-h-[150px]"
                    placeholder="Digite a mensagem..."
                    maxLength={channel === "sms" && type === "promocao" ? 160 : undefined}
                  />
                  {channel === "sms" && type === "promocao" && (
                    <p className="text-xs text-muted-foreground">
                      {templates[type]?.message_content?.length || 0}/160 caracteres
                    </p>
                  )}
                  {!isEditable(type) && (
                    <p className="text-xs text-muted-foreground">
                      Esta mensagem não pode ser editada
                    </p>
                  )}
                </div>

                {canAutoSend(type) && (
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">Envio Automático</Label>
                      <p className="text-sm text-muted-foreground">
                        {type === "aniversario" 
                          ? "Enviar automaticamente no aniversário do cliente"
                          : "Enviar automaticamente quando o evento ocorrer"
                        }
                      </p>
                    </div>
                    <Switch
                      checked={templates[type]?.auto_send_enabled || false}
                      onCheckedChange={(checked) => updateTemplate(type, "auto_send_enabled", checked)}
                    />
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={() => saveTemplate(type)} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? "Salvando..." : "Salvar Template"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
