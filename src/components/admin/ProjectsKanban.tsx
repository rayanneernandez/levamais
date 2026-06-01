import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar, Users, TrendingUp, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Project {
  id: string;
  project_number: string;
  name: string;
  client_name: string;
  status: string;
  progress: number;
  start_date: string;
  deadline: string;
  total_stores: number;
  total_licenses: number;
  tasks_completed: number;
  tasks_total: number;
  open_tickets?: number;
}

interface ProjectsKanbanProps {
  projects: Project[];
}

export function ProjectsKanban({ projects }: ProjectsKanbanProps) {
  const navigate = useNavigate();
  
  const columns = [
    { id: "planning", label: "Planejamento", color: "bg-slate-100" },
    { id: "in_progress", label: "Em Andamento", color: "bg-blue-100" },
    { id: "delayed", label: "Atrasado", color: "bg-red-100" },
    { id: "completed", label: "Concluído", color: "bg-green-100" },
  ];

  const getProjectsByStatus = (status: string) => {
    return projects.filter((p) => p.status === status);
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { variant: "default" | "secondary" | "destructive" | "outline" }> = {
      planning: { variant: "outline" },
      in_progress: { variant: "default" },
      delayed: { variant: "destructive" },
      completed: { variant: "secondary" },
    };
    return configs[status] || configs.in_progress;
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      {columns.map((column) => {
        const columnProjects = getProjectsByStatus(column.id);
        
        return (
          <div key={column.id} className="space-y-3">
            <div className={`${column.color} p-3 rounded-lg`}>
              <h3 className="font-semibold text-sm flex items-center justify-between">
                {column.label}
                <Badge variant="secondary" className="ml-2">
                  {columnProjects.length}
                </Badge>
              </h3>
            </div>

            <div className="space-y-3 min-h-[400px]">
              {columnProjects.map((project) => (
                <Card key={project.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <CardTitle className="text-sm font-semibold line-clamp-2">
                          {project.name}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {project.client_name}
                        </CardDescription>
                      </div>
                      <Badge 
                        variant={getStatusBadge(project.status).variant}
                        className="text-xs ml-2"
                      >
                        {project.project_number}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-0 space-y-3">
                    {/* Progress */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-medium">{project.progress}%</span>
                      </div>
                      <Progress value={project.progress} className="h-1.5" />
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(project.deadline), "dd/MM", { locale: ptBR })}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{project.total_stores}/{project.total_licenses}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        <span>{project.tasks_completed}/{project.tasks_total}</span>
                      </div>
                      {project.open_tickets && project.open_tickets > 0 && (
                        <div className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-3 w-3" />
                          <span>{project.open_tickets} ticket(s)</span>
                        </div>
                      )}
                    </div>

                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full text-xs h-7"
                      onClick={() => navigate(`/adm/projetos/${project.id}`)}
                    >
                      Ver Detalhes
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {columnProjects.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum projeto
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
