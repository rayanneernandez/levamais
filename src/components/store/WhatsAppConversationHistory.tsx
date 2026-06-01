import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Phone, MessageSquare, ArrowDownCircle, ArrowUpCircle, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ConversationMessage {
  id: string;
  network_id: string;
  client_id: string | null;
  wa_id: string;
  phone: string;
  direction: string;
  message_type: string;
  body_text: string | null;
  media_url: string | null;
  wamid: string | null;
  timestamp: string;
  created_at: string;
  clients?: {
    full_name: string;
    cpf: string;
  } | null;
}

interface WhatsAppConversationHistoryProps {
  networkId: string;
}

export function WhatsAppConversationHistory({ networkId }: WhatsAppConversationHistoryProps) {
  const [phoneFilter, setPhoneFilter] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);

  const { data: conversations, isLoading: loadingConversations } = useQuery({
    queryKey: ["whatsapp-conversations", networkId, phoneFilter],
    queryFn: async () => {
      let query = supabase
        .from("whatsapp_conversation_history")
        .select("phone")
        .eq("network_id", networkId)
        .order("created_at", { ascending: false });

      if (phoneFilter) {
        query = query.ilike("phone", `%${phoneFilter}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Agrupar por telefone e contar mensagens
      const grouped = data.reduce((acc, item) => {
        if (!acc[item.phone]) {
          acc[item.phone] = 0;
        }
        acc[item.phone]++;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(grouped).map(([phone, count]) => ({
        phone,
        count,
      }));
    },
  });

  const { data: messages, isLoading: loadingMessages, refetch } = useQuery({
    queryKey: ["whatsapp-messages", networkId, selectedPhone],
    queryFn: async () => {
      if (!selectedPhone) return [];

      const { data, error } = await supabase
        .from("whatsapp_conversation_history")
        .select(`
          *,
          clients (
            full_name,
            cpf
          )
        `)
        .eq("network_id", networkId)
        .eq("phone", selectedPhone)
        .order("timestamp", { ascending: true });

      if (error) throw error;
      return data as ConversationMessage[];
    },
    enabled: !!selectedPhone,
  });

  const getMessageIcon = (direction: string) => {
    return direction === "in" ? (
      <ArrowDownCircle className="h-4 w-4 text-blue-500" />
    ) : (
      <ArrowUpCircle className="h-4 w-4 text-green-500" />
    );
  };

  const formatPhone = (phone: string) => {
    if (phone.length === 13) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    }
    return phone;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-300px)]">
      {/* Lista de conversas */}
      <Card className="md:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Conversas</CardTitle>
          <CardDescription>Histórico de mensagens WhatsApp</CardDescription>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Buscar telefone..."
              value={phoneFilter}
              onChange={(e) => setPhoneFilter(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-450px)]">
            {loadingConversations ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : !conversations || conversations.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Nenhuma conversa encontrada
              </div>
            ) : (
              <div className="divide-y">
                {conversations.map((conv) => (
                  <button
                    key={conv.phone}
                    onClick={() => setSelectedPhone(conv.phone)}
                    className={cn(
                      "w-full p-4 text-left hover:bg-muted/50 transition-colors",
                      selectedPhone === conv.phone && "bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          <Phone className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {formatPhone(conv.phone)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {conv.count} {conv.count === 1 ? "mensagem" : "mensagens"}
                        </p>
                      </div>
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Visualizador de mensagens */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                {selectedPhone ? formatPhone(selectedPhone) : "Selecione uma conversa"}
              </CardTitle>
              <CardDescription>
                {selectedPhone && messages && messages.length > 0 && messages[0].clients?.full_name
                  ? messages[0].clients.full_name
                  : "Mensagens trocadas"}
              </CardDescription>
            </div>
            {selectedPhone && (
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedPhone ? (
            <div className="flex items-center justify-center h-[calc(100vh-450px)] text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecione uma conversa para visualizar as mensagens</p>
              </div>
            </div>
          ) : loadingMessages ? (
            <div className="flex items-center justify-center h-[calc(100vh-450px)]">
              <div className="text-center text-muted-foreground">
                Carregando mensagens...
              </div>
            </div>
          ) : !messages || messages.length === 0 ? (
            <div className="flex items-center justify-center h-[calc(100vh-450px)] text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma mensagem encontrada</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-450px)]">
              <div className="space-y-4 pr-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.direction === "out" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className={cn(
                        message.direction === "out" 
                          ? "bg-green-100 text-green-700" 
                          : "bg-blue-100 text-blue-700"
                      )}>
                        {message.direction === "out" ? "L" : "C"}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={cn(
                        "flex-1 max-w-[80%] rounded-lg p-3 shadow-sm",
                        message.direction === "out"
                          ? "bg-green-50 border border-green-200"
                          : "bg-blue-50 border border-blue-200"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {getMessageIcon(message.direction)}
                        <Badge variant="outline" className="text-xs">
                          {message.message_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatDistanceToNow(new Date(message.timestamp), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.body_text}</p>
                      {message.media_url && (
                        <div className="mt-2">
                          <Badge variant="secondary" className="text-xs">
                            📎 Mídia anexada
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}