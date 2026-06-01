import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Send, Building2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Store {
  id: string;
  name: string;
}

interface PromotionalCampaignSenderProps {
  channel: "email" | "whatsapp" | "sms";
}

export function PromotionalCampaignSender({ channel }: PromotionalCampaignSenderProps) {
  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingStores, setIsLoadingStores] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadStores();
    loadPromotionalTemplate();
  }, [channel]);

  const loadStores = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: manager } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!manager) throw new Error("Gerente não encontrado");

      const { data: storesData, error } = await supabase
        .from("stores")
        .select("id, name")
        .eq("network_id", manager.network_id)
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      setStores(storesData || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar lojas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingStores(false);
    }
  };

  const loadPromotionalTemplate = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: manager } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!manager) return;

      const { data: template } = await supabase
        .from("marketing_message_templates")
        .select("*")
        .eq("network_id", manager.network_id)
        .eq("channel", channel)
        .eq("template_type", "promocao")
        .single();

      if (template) {
        setMessage(template.message_content);
        if (template.subject) setSubject(template.subject);
      }
    } catch (error) {
      console.error("Erro ao carregar template:", error);
    }
  };

  const toggleStore = (storeId: string) => {
    setSelectedStores((prev) =>
      prev.includes(storeId)
        ? prev.filter((id) => id !== storeId)
        : [...prev, storeId]
    );
  };

  const selectAllStores = () => {
    if (selectedStores.length === stores.length) {
      setSelectedStores([]);
    } else {
      setSelectedStores(stores.map((s) => s.id));
    }
  };

  const handleSend = async () => {
    if (!campaignName || !message) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome da campanha e a mensagem.",
        variant: "destructive",
      });
      return;
    }

    if (channel === "email" && !subject) {
      toast({
        title: "Assunto obrigatório",
        description: "E-mails precisam ter um assunto.",
        variant: "destructive",
      });
      return;
    }

    if (selectedStores.length === 0) {
      toast({
        title: "Selecione as lojas",
        description: "Selecione pelo menos uma loja para enviar a campanha.",
        variant: "destructive",
      });
      return;
    }

    if (channel === "sms" && message.length > 160) {
      toast({
        title: "Mensagem muito longa",
        description: "SMS está limitado a 160 caracteres.",
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
        .is("store_id", null)
        .single();

      if (!manager) throw new Error("Gerente não encontrado");

      // Buscar clientes das lojas selecionadas
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("id, full_name, phone, email, total_points, registered_at_store_id")
        .eq("network_id", manager.network_id)
        .in("registered_at_store_id", selectedStores);

      if (clientsError) throw clientsError;
      if (!clients || clients.length === 0) {
        toast({
          title: "Nenhum cliente encontrado",
          description: "As lojas selecionadas não possuem clientes cadastrados.",
          variant: "destructive",
        });
        setIsSending(false);
        return;
      }

      const totalRecipients = clients.length;
      const costPerMessage = channel === "sms" ? 0.10 : channel === "whatsapp" ? 0.05 : 0.01;
      const totalCost = totalRecipients * costPerMessage;

      // Registrar campanha primeiro
      const { data: campaignData, error: campaignError } = await supabase
        .from("marketing_campaigns")
        .insert({
          network_id: manager.network_id,
          campaign_name: campaignName,
          campaign_type: channel,
          message_content: message,
          total_recipients: totalRecipients,
          status: "processing",
          sent_count: 0,
          failed_count: 0,
          cost_per_message: costPerMessage,
          total_cost: totalCost,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (campaignError) throw campaignError;

      // Para WhatsApp, enfileirar mensagens na fila de WhatsApp
      if (channel === "whatsapp") {
        const queueEntries = clients
          .filter(client => client.phone)
          .map(client => {
            // Substituir variáveis na mensagem
            const firstName = client.full_name?.split(' ')[0] || 'Cliente';
            const personalizedMessage = message
              .replace(/{{nome}}/g, client.full_name || 'Cliente')
              .replace(/{{primeiro_nome}}/g, firstName)
              .replace(/{{saldo}}/g, String(client.total_points || 0))
              .replace(/{{saldo_pontos}}/g, String(client.total_points || 0))
              .replace(/{{telefone}}/g, client.phone || '')
              .replace(/{{email}}/g, client.email || '');

            return {
              network_id: manager.network_id,
              store_id: client.registered_at_store_id,
              client_id: client.id,
              phone: client.phone,
              message_type: 'text',
              message_text: personalizedMessage,
              original_message_text: personalizedMessage,
              priority: 5,
              status: 'pending',
              is_promotional: true,
              campaign_id: campaignData.id,
              metadata: { campaign_name: campaignName, campaign_type: 'promotional' }
            };
          });

        if (queueEntries.length > 0) {
          const { error: queueError } = await supabase
            .from('whatsapp_message_queue')
            .insert(queueEntries);

          if (queueError) throw queueError;

          // Processar fila automaticamente
          await supabase.functions.invoke('process-whatsapp-queue', {
            body: { network_id: manager.network_id }
          });
        }
      }

      // Atualizar status da campanha
      await supabase
        .from("marketing_campaigns")
        .update({ 
          status: "sent",
          sent_at: new Date().toISOString(),
          sent_count: totalRecipients
        })
        .eq('id', campaignData.id);

      toast({
        title: "Campanha enviada!",
        description: channel === "whatsapp" 
          ? `${totalRecipients} mensagens foram enfileiradas. O sistema enviará primeiro um template de contato e, quando o cliente responder, enviará a mensagem promocional.`
          : `Campanha enviada para ${totalRecipients} clientes.`,
      });

      setCampaignName("");
      setSubject("");
      setMessage("");
      setSelectedStores([]);
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

  const charCount = message.length;
  const isOverLimit = channel === "sms" && charCount > 160;

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-medium">Personalize suas mensagens com variáveis dinâmicas que serão substituídas pelos dados reais de cada cliente.</p>
            <div className="mt-3">
              <p className="text-sm font-semibold mb-2">Variáveis disponíveis para personalização:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <p className="font-medium text-primary">Dados do Cliente:</p>
                  <div className="space-y-0.5 ml-2">
                    <p><code className="bg-background px-1.5 py-0.5 rounded">{"{{nome}}"}</code> - Nome completo</p>
                    <p><code className="bg-background px-1.5 py-0.5 rounded">{"{{primeiro_nome}}"}</code> - Primeiro nome</p>
                    <p><code className="bg-background px-1.5 py-0.5 rounded">{"{{email}}"}</code> - E-mail</p>
                    <p><code className="bg-background px-1.5 py-0.5 rounded">{"{{telefone}}"}</code> - Telefone</p>
                    <p><code className="bg-background px-1.5 py-0.5 rounded">{"{{cpf}}"}</code> - CPF</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-primary">Valores e Pontos:</p>
                  <div className="space-y-0.5 ml-2">
                    <p><code className="bg-background px-1.5 py-0.5 rounded">{"{{valor}}"}</code> - Valor da transação</p>
                    <p><code className="bg-background px-1.5 py-0.5 rounded">{"{{pontos}}"}</code> - Pontos da transação</p>
                    <p><code className="bg-background px-1.5 py-0.5 rounded">{"{{saldo}}"}</code> - Saldo atual</p>
                    <p><code className="bg-background px-1.5 py-0.5 rounded">{"{{saldo_pontos}}"}</code> - Saldo em pontos</p>
                    <p><code className="bg-background px-1.5 py-0.5 rounded">{"{{tipo}}"}</code> - Tipo (pontos/cashback)</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-primary">Loja e Rede:</p>
                  <div className="space-y-0.5 ml-2">
                    <p><code className="bg-background px-1.5 py-0.5 rounded">{"{{loja}}"}</code> - Nome da loja</p>
                    <p><code className="bg-background px-1.5 py-0.5 rounded">{"{{rede}}"}</code> - Nome da rede</p>
                    <p><code className="bg-background px-1.5 py-0.5 rounded">{"{{endereco_loja}}"}</code> - Endereço</p>
                    <p><code className="bg-background px-1.5 py-0.5 rounded">{"{{telefone_loja}}"}</code> - Telefone</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-primary">Datas e Prazos:</p>
                  <div className="space-y-0.5 ml-2">
                    <p><code className="bg-background px-1.5 py-0.5 rounded">{"{{data}}"}</code> - Data atual</p>
                    <p><code className="bg-background px-1.5 py-0.5 rounded">{"{{dias_restantes}}"}</code> - Dias p/ expirar</p>
                    <p><code className="bg-background px-1.5 py-0.5 rounded">{"{{data_expiracao}}"}</code> - Data de expiração</p>
                    <p><code className="bg-background px-1.5 py-0.5 rounded">{"{{plano}}"}</code> - Nome do plano</p>
                    <p><code className="bg-background px-1.5 py-0.5 rounded">{"{{beneficio}}"}</code> - Benefício do plano</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Configure sua Campanha Promocional</CardTitle>
          <CardDescription>
            Envie mensagens personalizadas para clientes das lojas selecionadas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Nome da Campanha *</Label>
            <Input
              id="campaign-name"
              placeholder="Ex: Black Friday 2024"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
          </div>

          {channel === "email" && (
            <div className="space-y-2">
              <Label htmlFor="subject">Assunto *</Label>
              <Input
                id="subject"
                placeholder="Ex: 50% OFF em tudo!"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem *</Label>
            <Textarea
              id="message"
              placeholder="Digite sua mensagem promocional..."
              className="min-h-[150px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={channel === "sms" ? 160 : undefined}
            />
            {channel === "sms" && (
              <p className={`text-xs font-medium ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                {charCount}/160 caracteres
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Selecione as Lojas *</Label>
              <Button variant="outline" size="sm" onClick={selectAllStores}>
                {selectedStores.length === stores.length ? "Desmarcar" : "Selecionar"} Todas
              </Button>
            </div>
            
            {isLoadingStores ? (
              <p className="text-sm text-muted-foreground">Carregando lojas...</p>
            ) : stores.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma loja ativa encontrada</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[200px] overflow-y-auto border rounded-lg p-3">
                {stores.map((store) => (
                  <div key={store.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`store-${store.id}`}
                      checked={selectedStores.includes(store.id)}
                      onCheckedChange={() => toggleStore(store.id)}
                    />
                    <label
                      htmlFor={`store-${store.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      <Building2 className="h-3 w-3 inline mr-1" />
                      {store.name}
                    </label>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {selectedStores.length} loja(s) selecionada(s)
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setCampaignName("");
                setSubject("");
                setMessage("");
                setSelectedStores([]);
              }}
            >
              Limpar
            </Button>
            <Button onClick={handleSend} disabled={isSending || isOverLimit}>
              <Send className="h-4 w-4 mr-2" />
              {isSending ? "Enviando..." : "Enviar Campanha"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
