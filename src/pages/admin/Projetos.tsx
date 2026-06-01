import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Calendar,
  Users,
  FileText,
  TrendingUp,
  Package,
  Plus,
  LayoutList,
  LayoutGrid,
  HeartHandshake,
  Eye,
  Pencil,
  Zap
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NewProjectDialog } from "@/components/admin/NewProjectDialog";
import { ProjectsKanban } from "@/components/admin/ProjectsKanban";
import { CustomerSuccessDialog } from "@/components/admin/CustomerSuccessDialog";

const Projetos = () => {
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "kanban">(() => {
    const saved = localStorage.getItem("projects-view-mode");
    return (saved as "list" | "kanban") || "kanban";
  });
  const [selectedProjectForCS, setSelectedProjectForCS] = useState<{ id: string; name: string } | null>(null);
  const navigate = useNavigate();

  const handleViewModeChange = (mode: "list" | "kanban") => {
    setViewMode(mode);
    localStorage.setItem("projects-view-mode", mode);
  };

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects" as any)
        .select(`
          *,
          networks!projects_network_id_fkey(name, max_stores, total_licenses),
          project_tasks(id, status)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return ((data as any[]) || []).map((project: any) => {
        const tasks = project.project_tasks || [];
        const tasksCompleted = tasks.filter((t: any) => t.status === "completed").length;
        const tasksTotal = tasks.length;
        
        // Calcular se está atrasado
        const today = new Date();
        const deadline = new Date(project.deadline);
        const isDelayed = deadline < today && project.status !== "completed";
        
        // Contar tickets abertos relacionados
        const openTickets = 0; // TODO: quando implementarmos a relação
        
        return {
          ...project,
          client_name: project.networks?.name || "Sem nome",
          total_stores: project.networks?.max_stores || 0,
          total_licenses: project.networks?.total_licenses || 0,
          tasks_completed: tasksCompleted,
          tasks_total: tasksTotal,
          open_tickets: openTickets,
          status: isDelayed && project.status === "in_progress" ? "delayed" : project.status,
        };
      });
    },
  });

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: JSX.Element }> = {
      planning: { label: "Planejamento", variant: "outline", icon: <FileText className="h-4 w-4" /> },
      in_progress: { label: "Em Andamento", variant: "default", icon: <Clock className="h-4 w-4" /> },
      delayed: { label: "Atrasado", variant: "destructive", icon: <AlertTriangle className="h-4 w-4" /> },
      completed: { label: "Concluído", variant: "secondary", icon: <CheckCircle2 className="h-4 w-4" /> },
    };
    return configs[status] || configs.in_progress;
  };


  const stats = {
    total: projects.length,
    inProgress: projects.filter((p) => p.status === "in_progress").length,
    delayed: projects.filter((p) => p.status === "delayed").length,
    completed: projects.filter((p) => p.status === "completed").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projetos</h1>
          <p className="text-muted-foreground">
            Acompanhe a implantação e gestão de clientes
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewModeChange("list")}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewModeChange("kanban")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setIsNewProjectOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Projeto
          </Button>
        </div>
      </div>

      <NewProjectDialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen} />
      
      {selectedProjectForCS && (
        <CustomerSuccessDialog
          open={!!selectedProjectForCS}
          onOpenChange={(open) => !open && setSelectedProjectForCS(null)}
          projectId={selectedProjectForCS.id}
          projectName={selectedProjectForCS.name}
        />
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
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
            <CardTitle className="text-sm font-medium">Atrasados</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.delayed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Projects View */}
      <Card>
        <CardHeader>
          <CardTitle>Projetos</CardTitle>
          <CardDescription>Visualize e gerencie todos os projetos de implantação</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Carregando projetos...</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum projeto encontrado
            </div>
          ) : viewMode === "kanban" ? (
            <ProjectsKanban projects={projects as any} />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Progresso</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead className="text-center">Lojas</TableHead>
                    <TableHead className="text-center">Licenças</TableHead>
                    <TableHead className="text-center">Tarefas</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => {
                    const statusConfig = getStatusConfig(project.status);
                    
                    return (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">{project.name}</TableCell>
                        <TableCell>{project.client_name}</TableCell>
                        <TableCell>
                          <Badge variant={statusConfig.variant} className="flex items-center gap-1 w-fit">
                            {statusConfig.icon}
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={project.progress} className="h-2 w-20" />
                            <span className="text-sm text-muted-foreground">{project.progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(project.start_date), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(project.deadline), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-center">{project.total_stores}</TableCell>
                        <TableCell className="text-center">{project.total_licenses}</TableCell>
                        <TableCell className="text-center">
                          {project.tasks_completed}/{project.tasks_total}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => navigate(`/adm/projetos/${project.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedProjectForCS({ 
                                id: project.id, 
                                name: project.name 
                              })}
                            >
                              <HeartHandshake className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Projetos;
