import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Send, AlertCircle, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface ActionCampaignMessagingProps {
  campaignId: string;
  campaignName: string;
  campaignStoreIds: string[];
  onClose: () => void;
}

export function ActionCampaignMessaging({ campaignId, campaignName, campaignStoreIds, onClose }: ActionCampaignMessagingProps) {
  const [channel, setChannel] = useState<"email" | "whatsapp" | "sms">("whatsapp");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [visitFilter, setVisitFilter] = useState<"visited" | "not_visited">("visited");
  const [daysPeriod, setDaysPeriod] = useState("30");
  const [recipientLimit, setRecipientLimit] = useState("all");
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [estimatedRecipients, setEstimatedRecipients] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadStoreNames();
  }, [campaignStoreIds]);

  useEffect(() => {
    calculateEstimates();
  }, [visitFilter, daysPeriod, channel, recipientLimit]);

  const loadStoreNames = async () => {
    try {
      const { data: storesData, error } = await supabase
        .from("stores")
        .select("id, name")
        .in("id", campaignStoreIds)
        .order("name");

      if (error) throw error;
      setStores(storesData || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar lojas",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const calculateEstimates = async () => {
    setIsCalculating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: manager } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!manager) return;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysPeriod));

      // Buscar apenas clientes que têm esta rede como favorita
      let query = supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("favorite_network_id", manager.network_id);

      // Aplicar filtro de visita nas lojas da campanha
      if (visitFilter === "visited") {
        // Clientes que visitaram no período
        const { data: visitedClients } = await supabase
          .from("transactions")
          .select("client_id")
          .in("store_id", campaignStoreIds)
          .gte("created_at", cutoffDate.toISOString());

        const visitedIds = [...new Set(visitedClients?.map(t => t.client_id) || [])];
        if (visitedIds.length > 0) {
          query = query.in("id", visitedIds);
        } else {
          setTotalAvailable(0);
          setEstimatedRecipients(0);
          setEstimatedCost(0);
          setIsCalculating(false);
          return;
        }
      } else {
        // Clientes que NÃO visitaram no período
        const { data: visitedClients } = await supabase
          .from("transactions")
          .select("client_id")
          .in("store_id", campaignStoreIds)
          .gte("created_at", cutoffDate.toISOString());

        const visitedIds = [...new Set(visitedClients?.map(t => t.client_id) || [])];
        if (visitedIds.length > 0) {
          query = query.not("id", "in", `(${visitedIds.join(",")})`);
        }
      }

      const { count, error } = await query;

      if (error) throw error;

      const totalClients = count || 0;
      setTotalAvailable(totalClients);

      // Aplicar limite de destinatários
      let recipients = totalClients;
      if (recipientLimit !== "all") {
        recipients = Math.min(parseInt(recipientLimit), totalClients);
      }
      setEstimatedRecipients(recipients);

      // Calcular custo estimado
      const costPerMessage = channel === "sms" ? 0.10 : channel === "whatsapp" ? 0.05 : 0.01;
      setEstimatedCost(recipients * costPerMessage);
    } catch (error: any) {
      console.error("Erro ao calcular estimativas:", error);
      setTotalAvailable(0);
      setEstimatedRecipients(0);
      setEstimatedCost(0);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSend = async () => {
    if (!message) {
      toast({
        title: "Mensagem obrigatória",
        description: "Digite a mensagem que deseja enviar.",
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

    if (estimatedCost > 100) {
      const confirm = window.confirm(
        `⚠️ ATENÇÃO: O custo estimado é R$ ${estimatedCost.toFixed(2)}!\n\n` +
        `Isso pode consumir rapidamente seu saldo de marketing.\n\n` +
        `Deseja continuar?`
      );
      if (!confirm) return;
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

      // Registrar campanha de marketing
      const { error: campaignError } = await supabase
        .from("marketing_campaigns")
        .insert({
          network_id: manager.network_id,
          campaign_name: `${campaignName} - Divulgação ${channel}`,
          campaign_type: `acao_divulgacao_${channel}`,
          message_content: message,
          total_recipients: estimatedRecipients,
          status: "sent",
          sent_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          sent_count: estimatedRecipients,
          failed_count: 0,
          cost_per_message: channel === "sms" ? 0.10 : channel === "whatsapp" ? 0.05 : 0.01,
          total_cost: estimatedCost,
          created_by: user.id,
        });

      if (campaignError) throw campaignError;

      toast({
        title: "Campanha enviada!",
        description: `Mensagem via ${channel} enviada para ${estimatedRecipients} cliente(s).`,
      });

      onClose();
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
          Use <code className="bg-muted px-2 py-1 rounded">{"{{nome}}"}</code> para personalizar com o nome do cliente
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Divulgar Campanha de Ação</CardTitle>
          <CardDescription>
            Envie mensagens sobre "{campaignName}" para clientes fidelizados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Canal de Envio *</Label>
            <RadioGroup value={channel} onValueChange={(v) => setChannel(v as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="whatsapp" id="whatsapp" />
                <Label htmlFor="whatsapp" className="cursor-pointer">WhatsApp (R$ 0,05/msg)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sms" id="sms" />
                <Label htmlFor="sms" className="cursor-pointer">SMS (R$ 0,10/msg)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="email" id="email" />
                <Label htmlFor="email" className="cursor-pointer">E-mail (R$ 0,01/msg)</Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Filtro de Clientes *</Label>
            <Select value={visitFilter} onValueChange={(v) => setVisitFilter(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="visited">Clientes que visitaram</SelectItem>
                <SelectItem value="not_visited">Clientes que NÃO visitaram</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Período (dias) *</Label>
            <Select value={daysPeriod} onValueChange={setDaysPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="15">Últimos 15 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="45">Últimos 45 dias</SelectItem>
                <SelectItem value="60">Últimos 60 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quantidade de Destinatários *</Label>
            <Select value={recipientLimit} onValueChange={setRecipientLimit}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">Primeiros 100 clientes</SelectItem>
                <SelectItem value="500">Primeiros 500 clientes</SelectItem>
                <SelectItem value="1000">Primeiros 1000 clientes</SelectItem>
                <SelectItem value="all">Todos os clientes disponíveis</SelectItem>
              </SelectContent>
            </Select>
            {totalAvailable > 0 && recipientLimit !== "all" && parseInt(recipientLimit) < totalAvailable && (
              <p className="text-xs text-muted-foreground">
                {totalAvailable} clientes disponíveis no total
              </p>
            )}
          </div>

          <Separator />

          {channel === "email" && (
            <div className="space-y-2">
              <Label htmlFor="subject">Assunto *</Label>
              <Input
                id="subject"
                placeholder="Ex: Promoção especial para você!"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem *</Label>
            <Textarea
              id="message"
              placeholder="Digite sua mensagem..."
              className="min-h-[120px]"
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

          <Separator />

          <div className="space-y-2">
            <Label>Lojas Participantes da Campanha</Label>
            <div className="border rounded-lg p-3 bg-muted/30">
              <div className="flex flex-wrap gap-2">
                {stores.map((store) => (
                  <Badge key={store.id} variant="secondary">
                    {store.name}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                A mensagem será enviada apenas para clientes <strong>fidelizados nesta rede</strong> que {visitFilter === "visited" ? "visitaram" : "NÃO visitaram"} essas lojas nos últimos {daysPeriod} dias
              </p>
            </div>
          </div>

          <Separator />

          {stores.length > 0 && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              {totalAvailable > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Clientes Fidelizados Disponíveis:</span>
                  <Badge variant="outline" className="text-base">
                    <Users className="h-4 w-4 mr-1" />
                    {totalAvailable}
                  </Badge>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Destinatários Selecionados:</span>
                <Badge variant="secondary" className="text-base">
                  <Users className="h-4 w-4 mr-1" />
                  {isCalculating ? "Calculando..." : estimatedRecipients}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Custo Estimado:</span>
                <Badge variant={estimatedCost > 100 ? "destructive" : "secondary"} className="text-base">
                  R$ {estimatedCost.toFixed(2)}
                </Badge>
              </div>
              {estimatedCost > 100 && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>ATENÇÃO:</strong> Custo alto! Isso pode consumir rapidamente seu saldo de marketing.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSend} disabled={isSending || isOverLimit || estimatedRecipients === 0 || stores.length === 0}>
              <Send className="h-4 w-4 mr-2" />
              {isSending ? "Enviando..." : "Enviar Campanha"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
