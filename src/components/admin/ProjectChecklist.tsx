import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { CheckCircle2, Circle } from "lucide-react";

interface ProjectChecklistProps {
  projectId: string;
  networkId: string;
}

export const ProjectChecklist = ({ projectId, networkId }: ProjectChecklistProps) => {
  const queryClient = useQueryClient();

  // Buscar templates
  const { data: templates = [] } = useQuery({
    queryKey: ["checklist-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_checklist_templates" as any)
        .select("*, project_checklist_template_items(*)")
        .eq("is_active", true)
        .order("type", { ascending: true });

      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Buscar lojas do network
  const { data: stores = [] } = useQuery({
    queryKey: ["network-stores", networkId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores" as any)
        .select("id, name")
        .eq("network_id", networkId)
        .order("name");

      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Buscar progresso
  const { data: progress = [] } = useQuery({
    queryKey: ["checklist-progress", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_checklist_progress" as any)
        .select("*")
        .eq("project_id", projectId);

      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Mutation para atualizar progresso
  const updateProgress = useMutation({
    mutationFn: async ({
      templateItemId,
      storeId,
      completed,
    }: {
      templateItemId: string;
      storeId: string | null;
      completed: boolean;
    }) => {
      const existing = progress.find(
        (p: any) =>
          p.template_item_id === templateItemId &&
          (storeId ? p.store_id === storeId : !p.store_id)
      );

      if (existing) {
        const { error } = await supabase
          .from("project_checklist_progress" as any)
          .update({
            completed,
            completed_at: completed ? new Date().toISOString() : null,
            completed_by: completed ? (await supabase.auth.getUser()).data.user?.id : null,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const template = templates.find((t: any) =>
          t.project_checklist_template_items?.some((i: any) => i.id === templateItemId)
        );

        const { error } = await supabase
          .from("project_checklist_progress" as any)
          .insert({
            project_id: projectId,
            template_id: template?.id,
            template_item_id: templateItemId,
            store_id: storeId,
            completed,
            completed_at: completed ? new Date().toISOString() : null,
            completed_by: completed ? (await supabase.auth.getUser()).data.user?.id : null,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-progress", projectId] });
      toast.success("Checklist atualizado");
    },
    onError: (error) => {
      console.error("Error updating checklist:", error);
      toast.error("Erro ao atualizar checklist");
    },
  });

  const isItemCompleted = (templateItemId: string, storeId: string | null) => {
    return progress.some(
      (p: any) =>
        p.template_item_id === templateItemId &&
        (storeId ? p.store_id === storeId : !p.store_id) &&
        p.completed
    );
  };

  const getCompletionPercentage = (templateId: string, storeId: string | null) => {
    const template = templates.find((t: any) => t.id === templateId);
    if (!template) return 0;

    const items = template.project_checklist_template_items || [];
    const completed = items.filter((item: any) => isItemCompleted(item.id, storeId)).length;

    return items.length > 0 ? Math.round((completed / items.length) * 100) : 0;
  };

  const managementTemplate = templates.find((t: any) => t.type === "management");
  const storeTemplate = templates.find((t: any) => t.type === "store");

  return (
    <div className="space-y-6">
      {/* Checklist Gerencial */}
      {managementTemplate && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {managementTemplate.name}
                <Badge variant="outline">
                  {getCompletionPercentage(managementTemplate.id, null)}%
                </Badge>
              </CardTitle>
            </div>
            {managementTemplate.description && (
              <p className="text-sm text-muted-foreground">{managementTemplate.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {managementTemplate.project_checklist_template_items
                ?.sort((a: any, b: any) => a.order_index - b.order_index)
                .map((item: any) => {
                  const completed = isItemCompleted(item.id, null);
                  return (
                    <div key={item.id} className="flex items-center space-x-3">
                      <Checkbox
                        id={item.id}
                        checked={completed}
                        onCheckedChange={(checked) =>
                          updateProgress.mutate({
                            templateItemId: item.id,
                            storeId: null,
                            completed: checked as boolean,
                          })
                        }
                      />
                      <label
                        htmlFor={item.id}
                        className={`flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer ${
                          completed ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {item.title}
                      </label>
                      {completed && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Checklists por Loja */}
      {storeTemplate && stores.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Checklist por Loja</h3>
          {stores.map((store: any) => (
            <Card key={store.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {store.name}
                    <Badge variant="outline">
                      {getCompletionPercentage(storeTemplate.id, store.id)}%
                    </Badge>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {storeTemplate.project_checklist_template_items
                    ?.sort((a: any, b: any) => a.order_index - b.order_index)
                    .map((item: any) => {
                      const completed = isItemCompleted(item.id, store.id);
                      return (
                        <div key={item.id} className="flex items-center space-x-3">
                          <Checkbox
                            id={`${store.id}-${item.id}`}
                            checked={completed}
                            onCheckedChange={(checked) =>
                              updateProgress.mutate({
                                templateItemId: item.id,
                                storeId: store.id,
                                completed: checked as boolean,
                              })
                            }
                          />
                          <label
                            htmlFor={`${store.id}-${item.id}`}
                            className={`flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer ${
                              completed ? "line-through text-muted-foreground" : ""
                            }`}
                          >
                            {item.title}
                          </label>
                          {completed && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {stores.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma loja encontrada para este projeto
          </CardContent>
        </Card>
      )}
    </div>
  );
};
