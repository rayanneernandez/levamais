import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Send, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ClientSelector } from "./ClientSelector";

interface ExpirationCampaignSenderProps {
  channel: "email" | "whatsapp" | "sms";
  type: "points" | "plan";
}

export function ExpirationCampaignSender({ channel, type }: ExpirationCampaignSenderProps) {
  const [campaignName, setCampaignName] = useState("");
  const [daysThreshold, setDaysThreshold] = useState(7);
  const [isSending, setIsSending] = useState(false);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadNetworkId();
  }, []);

  const loadNetworkId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: manager } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (manager) {
        setNetworkId(manager.network_id);
      }
    } catch (error) {
      console.error("Erro ao carregar network:", error);
    }
  };

  const getTitle = () => {
    if (type === "points") {
      return "Campanha de Expiração de Pontos/Cashback";
    }
    return "Campanha de Expiração de Plano";
  };

  const getDescription = () => {
    if (type === "points") {
      return "Envie alertas para clientes com pontos/cashback próximos de expirar";
    }
    return "Envie lembretes de renovação para clientes com plano expirando";
  };

  const handleSend = async () => {
    if (!campaignName) {
      toast({
        title: "Nome obrigatório",
        description: "Preencha o nome da campanha.",
        variant: "destructive",
      });
      return;
    }

    if (selectedClients.length === 0) {
      toast({
        title: "Selecione clientes",
        description: "Selecione pelo menos um cliente para enviar a campanha.",
        variant: "destructive",
      });
      return;
    }

    if (daysThreshold < 1 || daysThreshold > 30) {
      toast({
        title: "Dias inválido",
        description: "Selecione entre 1 e 30 dias.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: manager } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!manager) throw new Error("Gerente não encontrado");

      // Buscar template da mensagem
      const templateType = type === "points" ? "expiracao_pontos" : "expiracao_plano";
      const { data: template } = await supabase
        .from("marketing_message_templates")
        .select("message_content, subject")
        .eq("network_id", manager.network_id)
        .eq("channel", channel)
        .eq("template_type", templateType)
        .single();

      if (!template) {
        toast({
          title: "Template não encontrado",
          description: "Configure o template antes de enviar a campanha.",
          variant: "destructive",
        });
        return;
      }

      // Usar apenas os clientes selecionados
      const totalRecipients = selectedClients.length;

      // Calcular custo
      const costPerMessage = channel === "sms" ? 0.10 : channel === "whatsapp" ? 0.05 : 0.01;
      const totalCost = totalRecipients * costPerMessage;

      // Registrar campanha
      const { error: campaignError } = await supabase
        .from("marketing_campaigns")
        .insert({
          network_id: manager.network_id,
          campaign_name: campaignName,
          campaign_type: channel,
          message_content: template.message_content,
          total_recipients: totalRecipients,
          status: "sent",
          sent_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          sent_count: totalRecipients,
          failed_count: 0,
          cost_per_message: costPerMessage,
          total_cost: totalCost,
          created_by: user.id,
        });

      if (campaignError) throw campaignError;

      toast({
        title: "Campanha registrada",
        description: `Alertas de expiração enviados para ${totalRecipients} clientes selecionados!`,
      });

      setCampaignName("");
      setSelectedClients([]);
    } catch (error: any) {
      toast({
        title: "Erro ao enviar campanha",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {type === "points" 
            ? "Configure o template em 'Templates' antes de enviar. Variáveis: {{nome}}, {{tipo}}, {{valor}}, {{dias_restantes}}"
            : "Configure o template em 'Templates' antes de enviar. Variáveis: {{nome}}, {{plano}}, {{dias_restantes}}, {{beneficio}}"
          }
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>{getTitle()}</CardTitle>
          <CardDescription>{getDescription()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Nome da Campanha *</Label>
            <Input
              id="campaign-name"
              placeholder={type === "points" ? "Ex: Alerta Expiração Pontos" : "Ex: Renovação de Plano"}
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="days-threshold">
              {type === "points" ? "Alertar clientes com expiração em até (dias)" : "Alertar planos expirando em até (dias)"}
            </Label>
            <Input
              id="days-threshold"
              type="number"
              min="1"
              max="30"
              value={daysThreshold}
              onChange={(e) => {
                setDaysThreshold(parseInt(e.target.value) || 7);
                setSelectedClients([]); // Reset seleção ao mudar threshold
              }}
            />
            <p className="text-xs text-muted-foreground">
              Filtrar clientes que expiram nos próximos {daysThreshold} dias
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Seletor de Clientes */}
      {networkId && (
        <ClientSelector
          networkId={networkId}
          selectedClients={selectedClients}
          onSelectionChange={setSelectedClients}
          filterType={type === "points" ? "expiring_points" : "expiring_plan"}
          daysThreshold={daysThreshold}
        />
      )}

      {/* Botões de Ação */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setCampaignName("");
                setDaysThreshold(7);
                setSelectedClients([]);
              }}
            >
              Limpar Tudo
            </Button>
            <Button onClick={handleSend} disabled={isSending || selectedClients.length === 0}>
              <Send className="h-4 w-4 mr-2" />
              {isSending ? "Enviando..." : `Enviar para ${selectedClients.length} Cliente(s)`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}