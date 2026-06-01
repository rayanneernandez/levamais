import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, FileText, Calendar, User, Database, Activity } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: any;
  new_data: any;
  changed_fields: string[];
  user_id: string;
  user_email: string;
  created_at: string;
  user_agent: string;
  ip_address: string;
}

export default function LogsAuditoria() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTable, setSelectedTable] = useState<string>("all");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data as AuditLog[];
    },
  });

  const filteredLogs = logs?.filter((log) => {
    const matchesSearch = 
      log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.table_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTable = selectedTable === "all" || log.table_name === selectedTable;
    const matchesAction = selectedAction === "all" || log.action === selectedAction;

    return matchesSearch && matchesTable && matchesAction;
  });

  const uniqueTables = Array.from(new Set(logs?.map(log => log.table_name) || []));

  const getActionBadge = (action: string) => {
    switch (action) {
      case "INSERT":
        return <Badge className="bg-green-500">Criação</Badge>;
      case "UPDATE":
        return <Badge className="bg-blue-500">Edição</Badge>;
      case "DELETE":
        return <Badge variant="destructive">Exclusão</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  const getTableLabel = (tableName: string) => {
    const labels: { [key: string]: string } = {
      clients: "Clientes",
      stores: "Lojas",
      networks: "Redes",
      transactions: "Transações",
      profiles: "Perfis",
      user_roles: "Permissões",
      store_managers: "Gerentes",
      products_services: "Produtos/Serviços",
      budgets: "Orçamentos",
      leads: "Leads",
      blocked_clients: "Bloqueios",
      loyalty_campaigns: "Campanhas",
      api_keys: "Chaves API",
    };
    return labels[tableName] || tableName;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Activity className="h-8 w-8" />
          Logs de Auditoria
        </h1>
        <p className="text-muted-foreground">
          Acompanhe todas as ações realizadas no sistema
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros
          </CardTitle>
          <CardDescription>
            Filtre os logs por usuário, tabela ou tipo de ação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Usuário, tabela ou ação..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tabela</Label>
              <Select value={selectedTable} onValueChange={setSelectedTable}>
                <SelectTrigger>
                  <SelectValue />
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
            </div>

            <div className="space-y-2">
              <Label>Ação</Label>
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  <SelectItem value="INSERT">Criação</SelectItem>
                  <SelectItem value="UPDATE">Edição</SelectItem>
                  <SelectItem value="DELETE">Exclusão</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Registro de Atividades ({filteredLogs?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Tabela</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Campos Alterados</TableHead>
                  <TableHead className="text-right">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs && filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{log.user_email || "Sistema"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{getTableLabel(log.table_name)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {log.changed_fields?.slice(0, 3).map((field) => (
                            <Badge key={field} variant="outline" className="text-xs">
                              {field}
                            </Badge>
                          ))}
                          {log.changed_fields && log.changed_fields.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{log.changed_fields.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              Ver detalhes
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[80vh]">
                            <DialogHeader>
                              <DialogTitle>Detalhes do Log</DialogTitle>
                              <DialogDescription>
                                {getActionBadge(log.action)} em {getTableLabel(log.table_name)}
                              </DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="max-h-[60vh]">
                              <div className="space-y-4 pr-4">
                                <div className="grid gap-2">
                                  <Label>Informações Gerais</Label>
                                  <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Usuário:</span>
                                      <span className="font-medium">{log.user_email || "Sistema"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Data:</span>
                                      <span className="font-medium">
                                        {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                                      </span>
                                    </div>
                                    {log.ip_address && (
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">IP:</span>
                                        <span className="font-medium">{log.ip_address}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {log.changed_fields && log.changed_fields.length > 0 && (
                                  <div className="grid gap-2">
                                    <Label>Campos Alterados</Label>
                                    <div className="space-y-2">
                                      {log.changed_fields.map((field) => (
                                        <div key={field} className="rounded-lg border p-3">
                                          <div className="font-medium mb-2">{field}</div>
                                          <div className="grid gap-2 text-sm">
                                            {log.old_data && log.old_data[field] !== undefined && (
                                              <div>
                                                <span className="text-muted-foreground">Valor anterior: </span>
                                                <code className="bg-muted px-2 py-1 rounded">
                                                  {JSON.stringify(log.old_data[field])}
                                                </code>
                                              </div>
                                            )}
                                            {log.new_data && log.new_data[field] !== undefined && (
                                              <div>
                                                <span className="text-muted-foreground">Novo valor: </span>
                                                <code className="bg-muted px-2 py-1 rounded">
                                                  {JSON.stringify(log.new_data[field])}
                                                </code>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {log.action === "INSERT" && log.new_data && (
                                  <div className="grid gap-2">
                                    <Label>Dados Criados</Label>
                                    <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs">
                                      {JSON.stringify(log.new_data, null, 2)}
                                    </pre>
                                  </div>
                                )}

                                {log.action === "DELETE" && log.old_data && (
                                  <div className="grid gap-2">
                                    <Label>Dados Excluídos</Label>
                                    <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs">
                                      {JSON.stringify(log.old_data, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum log encontrado com os filtros aplicados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
