import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Calendar, User, Database, Search, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  old_data: any;
  new_data: any;
  changed_fields: string[] | null;
  user_id: string | null;
  user_email: string | null;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

const AuditLogs = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTable, setSelectedTable] = useState("all");
  const [selectedAction, setSelectedAction] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, selectedTable, selectedAction, startDate, endDate, logs]);

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      const { data, error } = await query;

      if (error) throw error;

      setLogs(data || []);
    } catch (error) {
      console.error('Error loading logs:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os logs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...logs];

    // Filtro de busca (email ou tabela)
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.table_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro de tabela
    if (selectedTable !== 'all') {
      filtered = filtered.filter(log => log.table_name === selectedTable);
    }

    // Filtro de ação
    if (selectedAction !== 'all') {
      filtered = filtered.filter(log => log.action === selectedAction);
    }

    // Filtro de data
    if (startDate) {
      filtered = filtered.filter(log => 
        new Date(log.created_at) >= new Date(startDate + 'T00:00:00')
      );
    }

    if (endDate) {
      filtered = filtered.filter(log => 
        new Date(log.created_at) <= new Date(endDate + 'T23:59:59')
      );
    }

    setFilteredLogs(filtered);
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary"> = {
      INSERT: "default",
      UPDATE: "secondary",
      DELETE: "destructive",
    };
    
    const labels: Record<string, string> = {
      INSERT: "Criado",
      UPDATE: "Editado",
      DELETE: "Excluído",
    };

    return (
      <Badge variant={variants[action] || "default"}>
        {labels[action] || action}
      </Badge>
    );
  };

  const getTableLabel = (tableName: string) => {
    const labels: Record<string, string> = {
      clients: "Clientes",
      stores: "Lojas",
      transactions: "Transações",
      networks: "Redes",
      store_managers: "Gerentes",
      store_access_profiles: "Perfis de Acesso",
      balance_adjustments: "Ajustes de Saldo",
      loyalty_campaigns: "Campanhas",
    };
    return labels[tableName] || tableName;
  };

  const uniqueTables = Array.from(new Set(logs.map(log => log.table_name)));

  const openDetailDialog = (log: AuditLog) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Logs de Auditoria</h1>
        <p className="text-muted-foreground text-sm">
          Histórico completo de todas as alterações na plataforma
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
          <CardDescription>Refine sua busca nos logs de auditoria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por email ou tabela..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as tabelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as tabelas</SelectItem>
                {uniqueTables.map((table) => (
                  <SelectItem key={table} value={table}>
                    {getTableLabel(table)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as ações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                <SelectItem value="INSERT">Criado</SelectItem>
                <SelectItem value="UPDATE">Editado</SelectItem>
                <SelectItem value="DELETE">Excluído</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              placeholder="Data início"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />

            <Input
              type="date"
              placeholder="Data fim"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="flex justify-between items-center mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setSelectedTable("all");
                setSelectedAction("all");
                setStartDate("");
                setEndDate("");
              }}
            >
              Limpar Filtros
            </Button>
            
            <Button onClick={loadLogs} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Registros ({filteredLogs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Tabela</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Campos Alterados</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Carregando logs...
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum log encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => openDetailDialog(log)}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {log.user_email || 'Sistema'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-muted-foreground" />
                          {getTableLabel(log.table_name)}
                        </div>
                      </TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell>
                        {log.changed_fields && log.changed_fields.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {log.changed_fields.slice(0, 3).map((field) => (
                              <Badge key={field} variant="outline" className="text-xs">
                                {field}
                              </Badge>
                            ))}
                            {log.changed_fields.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{log.changed_fields.length - 3}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          Ver mais
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Dialog de Detalhes */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Log</DialogTitle>
            <DialogDescription>
              Informações completas sobre a operação realizada
            </DialogDescription>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Data/Hora</label>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedLog.created_at), 'dd/MM/yyyy HH:mm:ss')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Usuário</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedLog.user_email || 'Sistema'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Tabela</label>
                  <p className="text-sm text-muted-foreground">
                    {getTableLabel(selectedLog.table_name)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Ação</label>
                  <div className="mt-1">
                    {getActionBadge(selectedLog.action)}
                  </div>
                </div>
              </div>

              {selectedLog.changed_fields && selectedLog.changed_fields.length > 0 && (
                <div>
                  <label className="text-sm font-medium">Campos Alterados</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedLog.changed_fields.map((field) => (
                      <Badge key={field} variant="outline">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedLog.action === 'UPDATE' && (
                <>
                  <div>
                    <label className="text-sm font-medium">Dados Anteriores</label>
                    <ScrollArea className="h-[200px] mt-2">
                      <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                        {JSON.stringify(selectedLog.old_data, null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Novos Dados</label>
                    <ScrollArea className="h-[200px] mt-2">
                      <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                        {JSON.stringify(selectedLog.new_data, null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>
                </>
              )}

              {selectedLog.action === 'INSERT' && selectedLog.new_data && (
                <div>
                  <label className="text-sm font-medium">Dados Criados</label>
                  <ScrollArea className="h-[200px] mt-2">
                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                      {JSON.stringify(selectedLog.new_data, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}

              {selectedLog.action === 'DELETE' && selectedLog.old_data && (
                <div>
                  <label className="text-sm font-medium">Dados Excluídos</label>
                  <ScrollArea className="h-[200px] mt-2">
                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                      {JSON.stringify(selectedLog.old_data, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditLogs;
