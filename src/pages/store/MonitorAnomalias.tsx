import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Shield, Ban, CheckCircle, Clock, Eye, XCircle, HelpCircle } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MonitorAnomalias() {
  const queryClient = useQueryClient();
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedAnomaly, setSelectedAnomaly] = useState<any>(null);
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [actionDialog, setActionDialog] = useState<"block" | "review" | "resolve" | null>(null);
  const [justification, setJustification] = useState("");

  // Buscar network_id do usuário logado
  const { data: networkId } = useQuery({
    queryKey: ['user-network'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data } = await supabase
        .from('store_managers')
        .select('network_id')
        .eq('user_id', user.id)
        .single();

      return data?.network_id;
    }
  });

  // Buscar anomalias da rede
  const { data: anomalies = [], isLoading } = useQuery({
    queryKey: ['store-anomalies', networkId, selectedSeverity, selectedType, selectedStatus],
    queryFn: async () => {
      if (!networkId) return [];

      let query = supabase
        .from('anomalies')
        .select(`
          *,
          client:clients(full_name, cpf),
          store:stores(name, cnpj)
        `)
        .eq('network_id', networkId)
        .order('detected_at', { ascending: false });

      if (selectedSeverity !== 'all') {
        query = query.eq('severity', selectedSeverity as any);
      }
      if (selectedType !== 'all') {
        query = query.eq('anomaly_type', selectedType as any);
      }
      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!networkId
  });

  // Mutation para bloquear cliente
  const blockClientMutation = useMutation({
    mutationFn: async ({ clientId, reason }: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('blocked_clients')
        .insert({
          client_id: clientId,
          network_id: networkId,
          blocked_by: user?.id,
          reason,
          justification
        });

      if (error) throw error;

      // Atualizar anomalia
      await supabase
        .from('anomalies')
        .update({ 
          status: 'blocked' as any,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          resolution_notes: justification
        })
        .eq('id', selectedAnomaly.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-anomalies'] });
      toast.success("Cliente bloqueado com sucesso");
      setActionDialog(null);
      setJustification("");
      setDetailsDialog(false);
    },
    onError: (error) => {
      toast.error("Erro ao bloquear cliente: " + error.message);
    }
  });

  // Mutation para solicitar revisão
  const requestReviewMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase
        .from('anomalies')
        .update({ 
          status: 'investigating' as any,
          resolution_notes: justification
        })
        .eq('id', selectedAnomaly.id);

      await supabase
        .from('anomaly_history')
        .insert({
          anomaly_id: selectedAnomaly.id,
          action_type: 'review_requested',
          action_by: user?.id,
          notes: justification
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-anomalies'] });
      toast.success("Revisão solicitada com sucesso");
      setActionDialog(null);
      setJustification("");
      setDetailsDialog(false);
    },
    onError: (error) => {
      toast.error("Erro ao solicitar revisão: " + error.message);
    }
  });

  // Mutation para marcar como resolvido
  const resolveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase
        .from('anomalies')
        .update({ 
          status: 'resolved' as any,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          resolution_notes: justification
        })
        .eq('id', selectedAnomaly.id);

      await supabase
        .from('anomaly_history')
        .insert({
          anomaly_id: selectedAnomaly.id,
          action_type: 'resolved',
          action_by: user?.id,
          notes: justification
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-anomalies'] });
      toast.success("Anomalia marcada como resolvida");
      setActionDialog(null);
      setJustification("");
      setDetailsDialog(false);
    },
    onError: (error) => {
      toast.error("Erro ao resolver anomalia: " + error.message);
    }
  });

  const handleAction = () => {
    if (!justification.trim()) {
      toast.error("Justificativa é obrigatória");
      return;
    }

    if (actionDialog === 'block') {
      blockClientMutation.mutate({
        clientId: selectedAnomaly.client_id,
        reason: selectedAnomaly.summary
      });
    } else if (actionDialog === 'review') {
      requestReviewMutation.mutate();
    } else if (actionDialog === 'resolve') {
      resolveMutation.mutate();
    }
  };

  const getSeverityBadge = (severity: string) => {
    const config: Record<string, any> = {
      critical: { variant: "destructive", label: "Crítica", icon: "🔴" },
      high: { variant: "destructive", label: "Alta", icon: "🟠" },
      medium: { variant: "default", label: "Média", icon: "🟡" },
      low: { variant: "secondary", label: "Baixa", icon: "🟢" }
    };
    
    const { variant, label, icon } = config[severity] || config.low;
    
    return <Badge variant={variant}>{icon} {label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, any> = {
      pending: { icon: Clock, label: "Novo", variant: "default" },
      investigating: { icon: Eye, label: "Em Análise", variant: "default" },
      resolved: { icon: CheckCircle, label: "Resolvido", variant: "secondary" },
      false_positive: { icon: XCircle, label: "Falso Positivo", variant: "outline" },
      blocked: { icon: Ban, label: "Bloqueado", variant: "destructive" }
    };
    
    const { icon: Icon, label, variant } = config[status] || config.pending;
    
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      frequency_spike: "Pico de Frequência",
      unusual_amount: "Valor Anômalo",
      velocity_pattern: "Padrão de Velocidade",
      time_pattern: "Padrão Temporal",
      geographic_anomaly: "Anomalia Geográfica",
      redemption_pattern: "Padrão de Resgate",
      multiple_stores: "Múltiplas Lojas",
      suspicious_behavior: "Comportamento Suspeito"
    };
    return labels[type] || type;
  };

  const maskCPF = (cpf: string) => {
    if (!cpf) return 'N/A';
    const cleaned = cpf.replace(/\D/g, '');
    return `***.***.***-${cleaned.slice(-2)}`;
  };

  const metrics = {
    total: anomalies.length,
    critical: anomalies.filter((a: any) => a.severity === 'critical').length,
    high: anomalies.filter((a: any) => a.severity === 'high').length,
    medium: anomalies.filter((a: any) => a.severity === 'medium').length,
    low: anomalies.filter((a: any) => a.severity === 'low').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Monitor de Anomalias</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Visualize e trate comportamentos fora do padrão nas lojas da sua rede
        </p>
      </div>

      <Alert>
        <HelpCircle className="h-4 w-4" />
        <AlertDescription>
          Use este monitor para revisar alertas, bloquear temporariamente CPFs suspeitos e solicitar suporte. 
          Em caso de dúvida, marque como "Solicitar Revisão".
        </AlertDescription>
      </Alert>

      {/* Métricas */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="p-4 hover:shadow-lg transition-shadow border-l-4 border-l-primary">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Total de Alertas</p>
              <h3 className="text-2xl font-bold">{metrics.total}</h3>
              <p className="text-xs text-muted-foreground">detectados</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-4 hover:shadow-lg transition-shadow border-l-4 border-l-destructive">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Críticas</p>
              <h3 className="text-2xl font-bold text-destructive">{metrics.critical}</h3>
              <p className="text-xs text-muted-foreground">ação imediata</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          </div>
        </Card>

        <Card className="p-4 hover:shadow-lg transition-shadow border-l-4 border-l-orange-500">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Altas</p>
              <h3 className="text-2xl font-bold text-orange-500">{metrics.high}</h3>
              <p className="text-xs text-muted-foreground">requer atenção</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            </div>
          </div>
        </Card>

        <Card className="p-4 hover:shadow-lg transition-shadow border-l-4 border-l-yellow-500">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Médias</p>
              <h3 className="text-2xl font-bold text-yellow-600">{metrics.medium}</h3>
              <p className="text-xs text-muted-foreground">monitorar</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4 hover:shadow-lg transition-shadow border-l-4 border-l-secondary">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Baixas</p>
              <h3 className="text-2xl font-bold">{metrics.low}</h3>
              <p className="text-xs text-muted-foreground">informativo</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-secondary" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Severidade</label>
            <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="critical">🔴 Crítica</SelectItem>
                <SelectItem value="high">🟠 Alta</SelectItem>
                <SelectItem value="medium">🟡 Média</SelectItem>
                <SelectItem value="low">🟢 Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo</label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="frequency_spike">Pico de Frequência</SelectItem>
                <SelectItem value="unusual_amount">Valor Anômalo</SelectItem>
                <SelectItem value="velocity_pattern">Padrão de Velocidade</SelectItem>
                <SelectItem value="suspicious_behavior">Comportamento Suspeito</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Novo</SelectItem>
                <SelectItem value="investigating">Em Análise</SelectItem>
                <SelectItem value="resolved">Resolvido</SelectItem>
                <SelectItem value="blocked">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Anomalias */}
      <Card>
        <CardHeader>
          <CardTitle>Alertas de Anomalias</CardTitle>
          <CardDescription>
            {metrics.total} alertas das suas lojas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Loja</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detectado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : anomalies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Nenhuma anomalia detectada
                  </TableCell>
                </TableRow>
              ) : (
                anomalies.map((alert: any) => (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <code className="text-xs">{alert.alert_id}</code>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{alert.client?.full_name?.split(' ')[0] || 'N/A'} {alert.client?.full_name?.split(' ').pop()?.charAt(0) || ''}.</div>
                        <div className="text-sm text-muted-foreground">{maskCPF(alert.client?.cpf)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getTypeLabel(alert.anomaly_type)}</Badge>
                    </TableCell>
                    <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-bold text-destructive">{alert.fraud_score}</div>
                        <div className="text-xs text-muted-foreground">/100</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{alert.store?.name || 'N/A'}</div>
                    </TableCell>
                    <TableCell>{getStatusBadge(alert.status)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(alert.detected_at), 'dd/MM/yyyy HH:mm')}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedAnomaly(alert);
                          setDetailsDialog(true);
                        }}
                      >
                        Ver Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Detalhes */}
      <Dialog open={detailsDialog} onOpenChange={setDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Anomalia</DialogTitle>
            <DialogDescription>
              {selectedAnomaly?.alert_id}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Cliente</h3>
                <p className="text-sm">{selectedAnomaly?.client?.full_name}</p>
                <p className="text-xs text-muted-foreground">{maskCPF(selectedAnomaly?.client?.cpf)}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Loja</h3>
                <p className="text-sm">{selectedAnomaly?.store?.name}</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Resumo</h3>
              <p className="text-sm">{selectedAnomaly?.summary}</p>
            </div>

            {selectedAnomaly?.suggested_actions?.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Recomendações</h3>
                <ul className="list-disc list-inside space-y-1">
                  {selectedAnomaly.suggested_actions.map((action: string, idx: number) => (
                    <li key={idx} className="text-sm">{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setActionDialog("review")}
            >
              <HelpCircle className="h-4 w-4 mr-2" />
              Solicitar Revisão
            </Button>
            <Button
              variant="default"
              onClick={() => setActionDialog("resolve")}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Marcar como Resolvido
            </Button>
            <Button
              variant="destructive"
              onClick={() => setActionDialog("block")}
            >
              <Ban className="h-4 w-4 mr-2" />
              Bloquear CPF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Ação */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog === 'block' && 'Bloquear CPF Temporariamente'}
              {actionDialog === 'review' && 'Solicitar Revisão ao Suporte'}
              {actionDialog === 'resolve' && 'Marcar como Resolvido'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog === 'block' && 'Tem certeza que deseja bloquear este CPF temporariamente?'}
              {actionDialog === 'review' && 'Descreva a situação para que o suporte possa analisar.'}
              {actionDialog === 'resolve' && 'Confirme que a situação já foi verificada e não há problema.'}
            </DialogDescription>
          </DialogHeader>
          
          <Textarea
            placeholder="Digite a justificativa (obrigatório)..."
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            rows={4}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleAction}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}