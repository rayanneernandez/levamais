import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

interface ProjectStatusSelectorProps {
  projectId: string;
  currentStatus: string;
}

export const ProjectStatusSelector = ({ projectId, currentStatus }: ProjectStatusSelectorProps) => {
  const queryClient = useQueryClient();

  const statusOptions = [
    { value: "planning", label: "Planejamento", icon: FileText, variant: "outline" as const },
    { value: "in_progress", label: "Em Andamento", icon: Clock, variant: "default" as const },
    { value: "delayed", label: "Atrasado", icon: AlertTriangle, variant: "destructive" as const },
    { value: "completed", label: "Concluído", icon: CheckCircle2, variant: "secondary" as const },
  ];

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from("projects" as any)
        .update({ status: newStatus })
        .eq("id", projectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Status atualizado com sucesso");
    },
    onError: (error) => {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
    },
  });

  const currentOption = statusOptions.find((opt) => opt.value === currentStatus);
  const Icon = currentOption?.icon || FileText;

  return (
    <Select
      value={currentStatus}
      onValueChange={(value) => updateStatus.mutate(value)}
    >
      <SelectTrigger className="w-full">
        <SelectValue>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="truncate">{currentOption?.label}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map((option) => {
          const OptionIcon = option.icon;
          return (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <OptionIcon className="h-4 w-4" />
                <span>{option.label}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};
