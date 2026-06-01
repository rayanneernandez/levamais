import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ClientSelector } from "./ClientSelector";
import { Bell, Send, Users, MessageSquare } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function NotificationSender() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadNetworkId();
  }, []);

  const loadNetworkId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("store_managers")
      .select("network_id")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setNetworkId(data.network_id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !message.trim()) {
      toast.error("Por favor, preencha o título e a mensagem.");
      return;
    }

    if (selectedClients.length === 0) {
      toast.error("Selecione pelo menos um cliente para enviar a notificação.");
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Criar notificação
      const { data: notification, error: notificationError } = await supabase
        .from("client_notifications")
        .insert({
          title: title.trim(),
          message: message.trim(),
          network_id: networkId,
          created_by: user.id,
          sent_count: selectedClients.length,
        })
        .select()
        .single();

      if (notificationError) throw notificationError;

      // Validar que todos os clientes selecionados têm esta rede como favorita
      const { data: validClients, error: validationError } = await supabase
        .from("clients")
        .select("id")
        .in("id", selectedClients)
        .eq("favorite_network_id", networkId);

      if (validationError) throw validationError;

      const validClientIds = validClients?.map(c => c.id) || [];
      
      if (validClientIds.length !== selectedClients.length) {
        toast.error("Alguns clientes selecionados não pertencem a esta rede.");
        return;
      }

      // Criar recipients
      const recipients = validClientIds.map((clientId) => ({
        notification_id: notification.id,
        client_id: clientId,
      }));

      const { error: recipientsError } = await supabase
        .from("client_notification_recipients")
        .insert(recipients);

      if (recipientsError) throw recipientsError;

      // Enviar push notifications
      try {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            notificationId: notification.id,
            title: title.trim(),
            body: message.trim(),
            clientIds: selectedClients,
          },
        });
      } catch (pushError) {
        console.error("Erro ao enviar push notifications:", pushError);
      }

      toast.success(`Notificação enviada para ${selectedClients.length} cliente(s)!`);

      // Limpar formulário
      setTitle("");
      setMessage("");
      setSelectedClients([]);
    } catch (error) {
      console.error("Erro ao enviar notificação:", error);
      toast.error("Erro ao enviar notificação. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const titleCharsLeft = 50 - title.length;
  const messageCharsLeft = 200 - message.length;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle>Enviar Notificação</CardTitle>
        </div>
        <CardDescription>
          Envie notificações personalizadas para seus clientes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Título da Notificação
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 50))}
              placeholder="Ex: Nova promoção disponível!"
              maxLength={50}
              required
            />
            <p className="text-xs text-muted-foreground text-right">
              {titleCharsLeft} caracteres restantes
            </p>
          </div>

          {/* Mensagem */}
          <div className="space-y-2">
            <Label htmlFor="message" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Mensagem
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 200))}
              placeholder="Digite a mensagem que deseja enviar aos clientes..."
              maxLength={200}
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground text-right">
              {messageCharsLeft} caracteres restantes
            </p>
          </div>

          {/* Preview */}
          {(title || message) && (
            <Alert>
              <Bell className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-semibold text-sm">{title || "Título da notificação"}</p>
                  <p className="text-sm text-muted-foreground">
                    {message || "Mensagem da notificação"}
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Seleção de Clientes */}
          {networkId && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Selecionar Clientes
              </Label>
              <ClientSelector
                networkId={networkId}
                selectedClients={selectedClients}
                onSelectionChange={setSelectedClients}
              />
              <p className="text-sm text-muted-foreground">
                {selectedClients.length === 0 ? (
                  "Nenhum cliente selecionado"
                ) : (
                  <span className="text-primary font-medium">
                    {selectedClients.length} cliente(s) selecionado(s)
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Botão de Envio */}
          <Button
            type="submit"
            disabled={isLoading || selectedClients.length === 0 || !title.trim() || !message.trim()}
            className="w-full"
            size="lg"
          >
            <Send className="h-4 w-4 mr-2" />
            {isLoading ? "Enviando..." : "Enviar Notificação"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
