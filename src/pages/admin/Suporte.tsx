import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageSquare, User, Store, Users, Clock, CheckCircle2, AlertCircle, Plus, AlertTriangle } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NewTicketDialog } from "@/components/admin/NewTicketDialog";

// Função para calcular minutos úteis (considerando horário comercial 8h-18h, seg-sex)
const calculateBusinessMinutes = (startDate: Date, endDate: Date): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let totalMinutes = 0;
  
  const current = new Date(start);
  
  while (current < end) {
    const dayOfWeek = current.getDay();
    const hour = current.getHours();
    
    // Apenas dias úteis (1-5 = seg-sex) e horário comercial (8-18h)
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 8 && hour < 18) {
      totalMinutes++;
    }
    
    current.setMinutes(current.getMinutes() + 1);
    
    // Performance: pular para próximo dia útil se estiver fora do horário
    if (hour >= 18) {
      current.setDate(current.getDate() + 1);
      current.setHours(8, 0, 0, 0);
    } else if (dayOfWeek === 0) { // Domingo
      current.setDate(current.getDate() + 1);
      current.setHours(8, 0, 0, 0);
    } else if (dayOfWeek === 6) { // Sábado
      current.setDate(current.getDate() + 2);
      current.setHours(8, 0, 0, 0);
    }
  }
  
  return totalMinutes;
};

// SLAs em minutos (considerando apenas horário comercial)
const SLA_MINUTES = {
  lojista: 2 * 60,      // 2 horas
  colaborador: 4 * 60,  // 4 horas
  cliente: 8 * 60,      // 8 horas
};

const Suporte = () => {
  const [selectedTab, setSelectedTab] = useState("todos");
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [prefilledData, setPrefilledData] = useState<{ rede?: string; portal?: string }>({});

  // Verificar parâmetros da URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rede = params.get('rede');
    const portal = params.get('portal');
    
    if (rede || portal) {
      setPrefilledData({ rede: rede || undefined, portal: portal || undefined });
      setIsNewTicketOpen(true);
    }
  }, []);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets" as any)
        .select(`
          *,
          networks!support_tickets_network_id_fkey(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return ((data as any[]) || []).map((ticket: any) => ({
        ...ticket,
        network_name: ticket.networks?.name || "Sem rede",
      }));
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      open: { label: "Aberto", variant: "destructive" },
      in_progress: { label: "Em Andamento", variant: "default" },
      resolved: { label: "Resolvido", variant: "secondary" },
      closed: { label: "Fechado", variant: "outline" },
    };
    
    const config = variants[status] || variants.open;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      high: { label: "Alta", variant: "destructive" },
      medium: { label: "Média", variant: "default" },
      low: { label: "Baixa", variant: "secondary" },
    };
    
    const config = variants[priority] || variants.medium;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getSourceIcon = (source: string) => {
    const icons: Record<string, JSX.Element> = {
      lojista: <Store className="h-4 w-4" />,
      colaborador: <Users className="h-4 w-4" />,
      cliente: <User className="h-4 w-4" />,
    };
    return icons[source] || <MessageSquare className="h-4 w-4" />;
  };

  const getSLAProgress = (ticket: any) => {
    if (ticket.status === "resolved" || ticket.status === "closed") {
      return { percentage: 100, color: "bg-green-500", status: "completed" };
    }

    const slaMinutes = SLA_MINUTES[ticket.source as keyof typeof SLA_MINUTES] || SLA_MINUTES.cliente;
    const elapsedMinutes = calculateBusinessMinutes(new Date(ticket.created_at), new Date());
    const percentage = Math.min((elapsedMinutes / slaMinutes) * 100, 100);

    let color = "bg-green-500";
    let status = "ok";

    if (percentage >= 100) {
      color = "bg-red-500";
      status = "exceeded";
    } else if (percentage >= 80) {
      color = "bg-amber-500";
      status = "warning";
    }

    return { percentage, color, status, elapsedMinutes, slaMinutes };
  };

  const formatSLATime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins > 0 ? ` ${mins}m` : ""}`;
  };

  const filteredTickets = tickets.filter((ticket) => {
    if (selectedTab === "todos") return true;
    return ticket.source === selectedTab;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    inProgress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Suporte</h1>
          <p className="text-muted-foreground">
            Gerencie chamados de lojistas, colaboradores e clientes
          </p>
        </div>
        <Button onClick={() => setIsNewTicketOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Chamado
        </Button>
      </div>

      <NewTicketDialog 
        open={isNewTicketOpen} 
        onOpenChange={setIsNewTicketOpen}
        prefilledData={prefilledData}
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abertos</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.open}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolvidos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resolved}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tickets List */}
      <Card>
        <CardHeader>
          <CardTitle>Chamados</CardTitle>
          <CardDescription>Visualize e gerencie todos os chamados de suporte</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="lojista">
                <Store className="h-4 w-4 mr-2" />
                Lojistas
              </TabsTrigger>
              <TabsTrigger value="colaborador">
                <Users className="h-4 w-4 mr-2" />
                Colaboradores
              </TabsTrigger>
              <TabsTrigger value="cliente">
                <User className="h-4 w-4 mr-2" />
                Clientes
              </TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="space-y-4 mt-6">
              {isLoading ? (
                <div className="text-center py-8">Carregando chamados...</div>
              ) : filteredTickets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum chamado encontrado
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Número</TableHead>
                        <TableHead className="w-[120px]">Origem</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead className="w-[150px]">Solicitante</TableHead>
                        <TableHead className="w-[200px]">SLA</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                        <TableHead className="w-[100px]">Prioridade</TableHead>
                        <TableHead className="w-[150px]">Data</TableHead>
                        <TableHead className="w-[100px] text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTickets.map((ticket: any) => {
                        const slaData = getSLAProgress(ticket);
                        
                        return (
                          <TableRow key={ticket.id}>
                            <TableCell className="font-medium">
                              {ticket.ticket_number}
                            </TableCell>
                            
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getSourceIcon(ticket.source)}
                                <span className="capitalize text-sm">{ticket.source}</span>
                              </div>
                            </TableCell>
                            
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium">{ticket.title}</div>
                                <div className="text-sm text-muted-foreground line-clamp-1">
                                  {ticket.description}
                                </div>
                              </div>
                            </TableCell>
                            
                            <TableCell>
                              <div className="text-sm">
                                <div className="font-medium">{ticket.requester_name}</div>
                                <div className="text-muted-foreground">{ticket.network_name}</div>
                              </div>
                            </TableCell>
                            
                            <TableCell>
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">
                                    {slaData.status === "completed" 
                                      ? "Finalizado"
                                      : `${formatSLATime(slaData.elapsedMinutes!)} / ${formatSLATime(slaData.slaMinutes!)}`
                                    }
                                  </span>
                                  {slaData.status === "exceeded" && (
                                    <AlertTriangle className="h-3 w-3 text-red-500 animate-pulse" />
                                  )}
                                  {slaData.status === "warning" && (
                                    <Clock className="h-3 w-3 text-amber-500 animate-pulse" />
                                  )}
                                </div>
                                <div className="relative h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${slaData.color} transition-all duration-500 ease-in-out relative overflow-hidden`}
                                    style={{ width: `${slaData.percentage}%` }}
                                  >
                                    {slaData.status !== "completed" && (
                                      <div 
                                        className="absolute inset-0 animate-[shimmer_2s_infinite]"
                                        style={{
                                          backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                                          backgroundSize: '200% 100%',
                                          animation: 'shimmer 2s infinite linear'
                                        }}
                                      />
                                    )}
                                  </div>
                                  {slaData.status !== "completed" && (
                                    <div 
                                      className="absolute inset-0 opacity-30"
                                      style={{
                                        backgroundImage: `repeating-linear-gradient(
                                          45deg,
                                          transparent,
                                          transparent 10px,
                                          rgba(255,255,255,0.1) 10px,
                                          rgba(255,255,255,0.1) 20px
                                        )`,
                                        animation: 'slide 1s linear infinite',
                                        backgroundSize: '28px 28px'
                                      }}
                                    />
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            
                            <TableCell>
                              {getStatusBadge(ticket.status)}
                            </TableCell>
                            
                            <TableCell>
                              {getPriorityBadge(ticket.priority)}
                            </TableCell>
                            
                            <TableCell>
                              <div className="text-sm text-muted-foreground">
                                {format(new Date(ticket.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                <br />
                                {format(new Date(ticket.created_at), "HH:mm", { locale: ptBR })}
                              </div>
                            </TableCell>
                            
                            <TableCell className="text-right">
                              <Button size="sm" variant="outline">
                                Ver
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Suporte;
