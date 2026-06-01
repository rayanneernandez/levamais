import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  AlertTriangle, 
  Shield, 
  User, 
  Ban,
  CheckCircle,
  Clock,
  Search,
  FileText,
  Download,
  Eye,
  XCircle
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function MonitorAnomalias() {
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState<string>("24h");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [actionDialog, setActionDialog] = useState<"resolve" | "false_positive" | "block" | null>(null);
  const [justification, setJustification] = useState("");

  // Buscar anomalias
  const { data: anomalies = [], isLoading } = useQuery({
    queryKey: ['anomalies', selectedPeriod, selectedSeverity, selectedType, selectedStatus],
    queryFn: async () => {
      let query = supabase
        .from('anomalies')
        .select(`
          *,
          client:clients(*),
          network:networks(name),
          store:stores(name, cnpj)
        `)
        .order('detected_at', { ascending: false });

      // Filtros
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
    }
  });

  // Buscar transações de uma anomalia
  const { data: alertTransactions = [] } = useQuery({
    queryKey: ['anomaly-transactions', selectedAlert?.id],
    queryFn: async () => {
      if (!selectedAlert?.id) return [];
      
      const { data, error } = await supabase
        .from('anomaly_transactions')
        .select(`
          *,
          transaction:transactions(*)
        `)
        .eq('anomaly_id', selectedAlert.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedAlert?.id
  });

  // Buscar regras de uma anomalia
  const { data: alertRules = [] } = useQuery({
    queryKey: ['anomaly-rules', selectedAlert?.id],
    queryFn: async () => {
      if (!selectedAlert?.id) return [];
      
      const { data, error } = await supabase
        .from('anomaly_rules')
        .select('*')
        .eq('anomaly_id', selectedAlert.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedAlert?.id
  });

  // Buscar histórico de uma anomalia
  const { data: alertHistory = [] } = useQuery({
    queryKey: ['anomaly-history', selectedAlert?.id],
    queryFn: async () => {
      if (!selectedAlert?.id) return [];
      
      const { data, error } = await supabase
        .from('anomaly_history')
        .select(`
          *,
          user:action_by(id, email)
        `)
        .eq('anomaly_id', selectedAlert.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedAlert?.id
  });

  // Mutation para resolver anomalia
  const resolveMutation = useMutation({
    mutationFn: async ({ anomalyId, status, notes }: { anomalyId: string, status: string, notes: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Atualizar status da anomalia
      const { error: updateError } = await supabase
        .from('anomalies')
        .update({ 
          status: status as any, 
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          resolution_notes: notes
        })
        .eq('id', anomalyId);

      if (updateError) throw updateError;

      // Adicionar ao histórico
      const { error: historyError } = await supabase
        .from('anomaly_history')
        .insert({
          anomaly_id: anomalyId,
          action_type: status,
          action_by: user?.id,
          notes
        });

      if (historyError) throw historyError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anomalies'] });
      queryClient.invalidateQueries({ queryKey: ['anomaly-history'] });
      toast.success("Ação executada com sucesso");
      setActionDialog(null);
      setJustification("");
      setDetailsDialog(false);
    },
    onError: (error) => {
      toast.error("Erro ao executar ação: " + error.message);
    }
  });

  // Mutation para bloquear cliente
  const blockClientMutation = useMutation({
    mutationFn: async ({ clientId, networkId, reason, justification }: any) => {
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

      // Também resolver a anomalia
      await resolveMutation.mutateAsync({
        anomalyId: selectedAlert.id,
        status: 'blocked',
        notes: justification
      });
    },
    onSuccess: () => {
      toast.success("Cliente bloqueado com sucesso");
      setActionDialog(null);
      setJustification("");
      setDetailsDialog(false);
    },
    onError: (error) => {
      toast.error("Erro ao bloquear cliente: " + error.message);
    }
  });

  const handleAction = async () => {
    if (!selectedAlert || !justification.trim()) {
      toast.error("Justificativa é obrigatória");
      return;
    }

    if (actionDialog === 'block') {
      blockClientMutation.mutate({
        clientId: selectedAlert.client_id,
        networkId: selectedAlert.network_id,
        reason: selectedAlert.summary,
        justification
      });
    } else {
      const statusMap = {
        resolve: 'resolved',
        false_positive: 'false_positive'
      };
      
      resolveMutation.mutate({
        anomalyId: selectedAlert.id,
        status: statusMap[actionDialog as keyof typeof statusMap],
        notes: justification
      });
    }
  };

  const handleExport = (format: "pdf" | "csv") => {
    toast.success(`Gerando relatório em ${format.toUpperCase()}...`);
  };

  const getSeverityBadge = (severity: string) => {
    const config: Record<string, any> = {
      critical: { variant: "destructive", label: "Crítica" },
      high: { variant: "destructive", label: "Alta" },
      medium: { variant: "default", label: "Média" },
      low: { variant: "secondary", label: "Baixa" }
    };
    
    const { variant, label } = config[severity] || config.low;
    
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, any> = {
      pending: { icon: Clock, label: "Pendente", variant: "default" },
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

  // Calcular métricas do resumo
  const metrics = {
    total: anomalies.length,
    critical: anomalies.filter((a: any) => a.severity === 'critical').length,
    high: anomalies.filter((a: any) => a.severity === 'high').length,
    medium: anomalies.filter((a: any) => a.severity === 'medium').length,
    low: anomalies.filter((a: any) => a.severity === 'low').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Monitor de Anomalias</h1>
          <p className="text-muted-foreground text-sm mt-1">Painel para monitorar comportamentos suspeitos e fraudes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport("csv")}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport("pdf")}>
            <FileText className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Alertas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total}</div>
            <p className="text-xs text-muted-foreground">Detectados automaticamente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Críticas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{metrics.critical}</div>
            <p className="text-xs text-muted-foreground">Prioridade máxima</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Altas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{metrics.high}</div>
            <p className="text-xs text-muted-foreground">Requer atenção</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Médias</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{metrics.medium}</div>
            <p className="text-xs text-muted-foreground">Monitorar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Baixas</CardTitle>
            <Shield className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.low}</div>
            <p className="text-xs text-muted-foreground">Informativo</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Período</label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Últimas 24h</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Severidade</label>
            <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="critical">Crítica</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
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
                <SelectItem value="time_pattern">Padrão Temporal</SelectItem>
                <SelectItem value="geographic_anomaly">Anomalia Geográfica</SelectItem>
                <SelectItem value="redemption_pattern">Padrão de Resgate</SelectItem>
                <SelectItem value="multiple_stores">Múltiplas Lojas</SelectItem>
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
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="investigating">Em Análise</SelectItem>
                <SelectItem value="resolved">Resolvido</SelectItem>
                <SelectItem value="false_positive">Falso Positivo</SelectItem>
                <SelectItem value="blocked">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="CPF ou Nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Anomalias */}
      <Card>
        <CardHeader>
          <CardTitle>Alertas de Anomalias</CardTitle>
          <CardDescription>
            {metrics.total} alertas detectados automaticamente
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
                <TableHead>Loja/Rede</TableHead>
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
                  <TableRow key={alert.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <code className="text-xs">{alert.alert_id}</code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{alert.client?.full_name || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">{alert.client?.cpf || 'N/A'}</div>
                        </div>
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
                      <div>
                        <div className="font-medium text-sm">{alert.store?.name || 'Rede'}</div>
                        <div className="text-xs text-muted-foreground">{alert.network?.name || 'N/A'}</div>
                      </div>
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
                          setSelectedAlert(alert);
                          setDetailsDialog(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Anomalia</DialogTitle>
            <DialogDescription>
              {selectedAlert?.alert_id}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="resumo" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="transacoes">Transações</TabsTrigger>
              <TabsTrigger value="regras">Regras</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="resumo" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Cliente</h3>
                  <p className="text-sm">{selectedAlert?.client?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedAlert?.client?.cpf}</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Loja/Rede</h3>
                  <p className="text-sm">{selectedAlert?.store?.name || selectedAlert?.network?.name}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Resumo</h3>
                <p className="text-sm">{selectedAlert?.summary}</p>
              </div>

              {selectedAlert?.suggested_actions?.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Ações Sugeridas</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedAlert.suggested_actions.map((action: string, idx: number) => (
                      <li key={idx} className="text-sm">{action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </TabsContent>

            <TabsContent value="transacoes">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alertTransactions.map((at: any) => (
                      <TableRow key={at.id}>
                        <TableCell><code className="text-xs">{at.transaction?.id}</code></TableCell>
                        <TableCell>{format(new Date(at.transaction?.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell>{at.transaction?.points}</TableCell>
                        <TableCell>R$ {at.transaction?.amount?.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="regras">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {alertRules.map((rule: any) => (
                    <Card key={rule.id}>
                      <CardHeader>
                        <CardTitle className="text-sm">{rule.rule_name}</CardTitle>
                        <CardDescription className="text-xs">
                          Código: {rule.rule_code} | Confiança: {rule.confidence}%
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="historico">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {alertHistory.map((hist: any) => (
                    <Card key={hist.id}>
                      <CardHeader>
                        <CardTitle className="text-sm">{hist.action_type}</CardTitle>
                        <CardDescription className="text-xs">
                          {format(new Date(hist.created_at), 'dd/MM/yyyy HH:mm')} por {hist.user?.email}
                        </CardDescription>
                        {hist.notes && <p className="text-sm mt-2">{hist.notes}</p>}
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setActionDialog("false_positive")}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Falso Positivo
            </Button>
            <Button
              variant="default"
              onClick={() => setActionDialog("resolve")}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Resolver
            </Button>
            <Button
              variant="destructive"
              onClick={() => setActionDialog("block")}
            >
              <Ban className="h-4 w-4 mr-2" />
              Bloquear Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Ação */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog === 'block' && 'Bloquear Cliente'}
              {actionDialog === 'resolve' && 'Resolver Anomalia'}
              {actionDialog === 'false_positive' && 'Marcar como Falso Positivo'}
            </DialogTitle>
            <DialogDescription>
              Por favor, justifique esta ação para o histórico
            </DialogDescription>
          </DialogHeader>
          
          <Textarea
            placeholder="Digite a justificativa..."
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