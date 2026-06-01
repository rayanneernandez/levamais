import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Calendar, 
  Users, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  HeartHandshake,
  FileText,
  DollarSign,
  Plus
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CustomerSuccessDialog } from "@/components/admin/CustomerSuccessDialog";
import { ProjectChecklist } from "@/components/admin/ProjectChecklist";
import { ProjectStatusSelector } from "@/components/admin/ProjectStatusSelector";
import { ProjectTaskDialog } from "@/components/admin/ProjectTaskDialog";
import { ProjectMeetingDialog } from "@/components/admin/ProjectMeetingDialog";

const ProjetoDetalhes = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showCSDialog, setShowCSDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);

  const { data: project, isLoading, error: projectError } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects" as any)
        .select(`
          *,
          networks!projects_network_id_fkey(name, max_stores, total_licenses),
          project_tasks(
            id, title, status, description, created_at, 
            due_date, due_time, priority, notes, assigned_to
          )
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const projectData = data as any;
      const tasks = projectData.project_tasks || [];
      const tasksCompleted = tasks.filter((t: any) => t.status === "completed").length;
      const tasksTotal = tasks.length;
      
      return {
        ...projectData,
        client_name: projectData.networks?.name || "Sem nome",
        total_stores: projectData.networks?.max_stores || 0,
        total_licenses: projectData.networks?.total_licenses || 0,
        tasks_completed: tasksCompleted,
        tasks_total: tasksTotal,
      };
    },
  });

  const { data: checkins = [] } = useQuery({
    queryKey: ["project-checkins", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_success_checkins" as any)
        .select("*")
        .eq("project_id", id)
        .order("checkin_date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["project-meetings", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_meetings" as any)
        .select("*")
        .eq("project_id", id)
        .order("meeting_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      return (data || []) as any[];
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

  const getCheckinTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      implantacao: "D1 - Implantação",
      pos_venda: "D45 - Pós-venda",
      avaliacao_desempenho: "D90 - Avaliação",
      monthly: "Mensal",
      custom: "Personalizado",
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando projeto...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Projeto não encontrado</CardTitle>
            <CardDescription>
              O projeto que você está tentando acessar não existe ou você não tem permissão para visualizá-lo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/adm/projetos")} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Projetos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = getStatusConfig(project.status);

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/adm/projetos")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground">
            Cliente: {project.client_name}
            {project.project_number && ` • Projeto ${project.project_number}`}
          </p>
        </div>
        <Button onClick={() => setShowCSDialog(true)}>
          <HeartHandshake className="h-4 w-4 mr-2" />
          Novo Check-in
        </Button>
      </div>

      <CustomerSuccessDialog
        open={showCSDialog}
        onOpenChange={setShowCSDialog}
        projectId={project.id}
        projectName={project.name}
      />

      <ProjectTaskDialog
        open={showTaskDialog}
        onOpenChange={setShowTaskDialog}
        projectId={project.id}
        networkId={project.network_id}
      />

      <ProjectMeetingDialog
        open={showMeetingDialog}
        onOpenChange={setShowMeetingDialog}
        projectId={project.id}
      />

      {/* Visão Geral */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            {statusConfig.icon}
          </CardHeader>
          <CardContent>
            <ProjectStatusSelector projectId={project.id} currentStatus={project.status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progresso</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project.progress}%</div>
            <Progress value={project.progress} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tarefas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {project.tasks_completed}/{project.tasks_total}
            </div>
            <p className="text-xs text-muted-foreground">completas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orçamento</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {project.budget_value ? `R$ ${project.budget_value.toLocaleString()}` : "N/A"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Informações e Histórico */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="checklists">Checklists</TabsTrigger>
          <TabsTrigger value="tasks">Tarefas ({project.tasks_total})</TabsTrigger>
          <TabsTrigger value="agenda">Agenda ({meetings.length})</TabsTrigger>
          <TabsTrigger value="checkins">Check-ins ({checkins.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detalhes do Projeto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Data de Início</p>
                  <p className="font-medium">
                    {format(new Date(project.start_date), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Prazo</p>
                  <p className="font-medium">
                    {format(new Date(project.deadline), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lojas</p>
                  <p className="font-medium">{project.total_stores}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Licenças</p>
                  <p className="font-medium">{project.total_licenses}</p>
                </div>
              </div>
              {project.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Descrição</p>
                  <p className="text-sm">{project.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checklists" className="space-y-4">
          <ProjectChecklist projectId={project.id} networkId={project.network_id} />
        </TabsContent>

        <TabsContent value="checkins" className="space-y-4">
          {checkins.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhum check-in registrado ainda
              </CardContent>
            </Card>
          ) : (
            checkins.map((checkin: any) => (
              <Card key={checkin.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {getCheckinTypeLabel(checkin.checkin_type)}
                      </CardTitle>
                      <CardDescription>
                        {format(new Date(checkin.checkin_date), "dd/MM/yyyy", { locale: ptBR })}
                      </CardDescription>
                    </div>
                    <Badge variant={checkin.status === "completed" ? "secondary" : "outline"}>
                      {checkin.status === "completed" ? "Realizado" : "Agendado"}
                    </Badge>
                  </div>
                </CardHeader>
                {checkin.status === "completed" && (
                  <CardContent className="space-y-4">
                    {checkin.client_satisfaction && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Satisfação</p>
                        <div className="flex gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} className={i < checkin.client_satisfaction ? "text-yellow-400" : "text-gray-300"}>
                              ★
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {checkin.insights && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Insights</p>
                        <p className="text-sm">{checkin.insights}</p>
                      </div>
                    )}
                    {checkin.observations && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Observações</p>
                        <p className="text-sm">{checkin.observations}</p>
                      </div>
                    )}
                    {checkin.action_items && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Ações Necessárias</p>
                        <p className="text-sm">{checkin.action_items}</p>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowTaskDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Tarefa
            </Button>
          </div>
          
          {!project.project_tasks || project.project_tasks.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhuma tarefa cadastrada
              </CardContent>
            </Card>
          ) : (
            project.project_tasks.map((task: any) => (
              <Card key={task.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">{task.title}</CardTitle>
                        {task.priority && (
                          <Badge variant={
                            task.priority === "high" ? "destructive" : 
                            task.priority === "medium" ? "default" : 
                            "outline"
                          }>
                            {task.priority === "high" ? "Alta" : 
                             task.priority === "medium" ? "Média" : 
                             "Baixa"}
                          </Badge>
                        )}
                      </div>
                      {task.description && (
                        <CardDescription className="mb-2">{task.description}</CardDescription>
                      )}
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
                        {task.due_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {format(new Date(task.due_date), "dd/MM/yyyy", { locale: ptBR })}
                              {task.due_time && ` às ${task.due_time}`}
                            </span>
                          </div>
                        )}
                      </div>
                      {task.notes && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Obs: {task.notes}
                        </p>
                      )}
                    </div>
                    <Badge variant={task.status === "completed" ? "secondary" : "default"}>
                      {task.status === "completed" ? "Concluída" : "Pendente"}
                    </Badge>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="agenda" className="space-y-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowMeetingDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Agendar Reunião
            </Button>
          </div>

          {meetings.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhuma reunião agendada
              </CardContent>
            </Card>
          ) : (
            meetings.map((meeting: any) => (
              <Card key={meeting.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">{meeting.title}</CardTitle>
                      {meeting.description && (
                        <CardDescription className="mb-2">{meeting.description}</CardDescription>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {format(new Date(meeting.meeting_date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>
                            {meeting.start_time}
                            {meeting.end_time && ` - ${meeting.end_time}`}
                          </span>
                        </div>
                      </div>
                      {meeting.location && (
                        <p className="text-sm mt-2">
                          <strong>Local:</strong> {meeting.location}
                        </p>
                      )}
                      {meeting.meeting_link && (
                        <p className="text-sm mt-1">
                          <strong>Link:</strong>{" "}
                          <a 
                            href={meeting.meeting_link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {meeting.meeting_link}
                          </a>
                        </p>
                      )}
                      {meeting.notes && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {meeting.notes}
                        </p>
                      )}
                    </div>
                    <Badge variant={
                      meeting.status === "completed" ? "secondary" :
                      meeting.status === "cancelled" ? "destructive" :
                      "default"
                    }>
                      {meeting.status === "completed" ? "Realizada" :
                       meeting.status === "cancelled" ? "Cancelada" :
                       "Agendada"}
                    </Badge>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjetoDetalhes;
