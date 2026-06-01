import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ticket, Plus, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useSupportTicket } from "@/contexts/SupportTicketContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusColors = {
  open: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  in_progress: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  resolved: "bg-green-500/10 text-green-500 border-green-500/20",
  closed: "bg-gray-500/10 text-gray-500 border-gray-500/20"
};

const statusLabels = {
  open: "Aberto",
  in_progress: "Em Andamento",
  resolved: "Resolvido",
  closed: "Fechado"
};

const statusIcons = {
  open: Clock,
  in_progress: Loader2,
  resolved: CheckCircle2,
  closed: XCircle
};

const priorityColors = {
  low: "bg-blue-500/10 text-blue-500",
  medium: "bg-yellow-500/10 text-yellow-500",
  high: "bg-orange-500/10 text-orange-500",
  urgent: "bg-red-500/10 text-red-500"
};

const priorityLabels = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente"
};

export default function Suporte() {
  const { openSupportDialog } = useSupportTicket();
  const [networkName, setNetworkName] = useState<string>("");

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["support-tickets"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Buscar nome da rede
      const { data: managerData } = await supabase
        .from('store_managers')
        .select('network_id')
        .eq('user_id', user.id)
        .is('store_id', null)
        .maybeSingle();

      if (managerData?.network_id) {
        const { data: networkData } = await supabase
          .from('networks')
          .select('name')
          .eq('id', managerData.network_id)
          .single();
        
        if (networkData) {
          setNetworkName(networkData.name);
        }
      }

      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("created_by_user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meu Suporte</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie seus chamados e solicite ajuda
          </p>
        </div>
        <Button 
          onClick={() => openSupportDialog({ 
            rede: networkName || undefined, 
            portal: 'Loja' 
          })}
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Abrir Ticket
        </Button>
      </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : tickets && tickets.length > 0 ? (
          <div className="grid gap-4">
            {tickets.map((ticket) => {
              const StatusIcon = statusIcons[ticket.status as keyof typeof statusIcons];
              return (
                <Card key={ticket.id} className="hover:bg-accent/50 transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Ticket className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground font-mono">
                            #{ticket.ticket_number}
                          </span>
                        </div>
                        <CardTitle className="text-xl">{ticket.title}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {ticket.description}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge 
                          variant="outline" 
                          className={statusColors[ticket.status as keyof typeof statusColors]}
                        >
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusLabels[ticket.status as keyof typeof statusLabels]}
                        </Badge>
                        <Badge 
                          variant="secondary"
                          className={priorityColors[ticket.priority as keyof typeof priorityColors]}
                        >
                          {priorityLabels[ticket.priority as keyof typeof priorityLabels]}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <span>Origem: {ticket.source}</span>
                        {ticket.network_id && <span>Rede vinculada</span>}
                      </div>
                      <span>
                        {format(new Date(ticket.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Ticket className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum chamado registrado</h3>
              <p className="text-muted-foreground mb-4">
                Você ainda não abriu nenhum ticket de suporte
              </p>
              <Button 
                onClick={() => openSupportDialog({ 
                  rede: networkName || undefined, 
                  portal: 'Loja' 
                })}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Abrir Primeiro Ticket
              </Button>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
