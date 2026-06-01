import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MessageSquare, Save } from "lucide-react";
import { useState } from "react";

interface MessageTemplate {
  id: string;
  message_key: string;
  message_title: string;
  message_template: string;
  description: string | null;
  available_tags: string[] | null;
  is_active: boolean;
}

const MensagensAPI = () => {
  const queryClient = useQueryClient();
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});

  const { data: templates, isLoading } = useQuery({
    queryKey: ["api-message-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_message_templates")
        .select("*")
        .eq("is_active", true)
        .order("message_title");

      if (error) throw error;
      return data as MessageTemplate[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, template }: { id: string; template: string }) => {
      const { error } = await supabase
        .from("api_message_templates")
        .update({ message_template: template })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-message-templates"] });
      toast.success("Mensagem atualizada com sucesso!");
      setEditedMessages({});
    },
    onError: () => {
      toast.error("Erro ao atualizar mensagem");
    },
  });

  const handleSave = (id: string) => {
    const template = editedMessages[id];
    if (template) {
      updateMutation.mutate({ id, template });
    }
  };

  const handleChange = (id: string, value: string) => {
    setEditedMessages(prev => ({
      ...prev,
      [id]: value
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mensagens da API</h1>
          <p className="text-muted-foreground mt-2">
            Configure as mensagens retornadas pela API de validação de vendas
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Templates de Mensagens
          </CardTitle>
          <CardDescription>
            Use as tags disponíveis para personalizar as mensagens. As tags serão substituídas automaticamente pelos valores reais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {templates?.map((template) => {
            const currentValue = editedMessages[template.id] ?? template.message_template;
            const hasChanges = editedMessages[template.id] !== undefined && 
                              editedMessages[template.id] !== template.message_template;

            return (
              <div key={template.id} className="border rounded-lg p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <Label className="text-lg font-semibold">{template.message_title}</Label>
                    {template.description && (
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    )}
                  </div>
                  {hasChanges && (
                    <Badge variant="secondary">Não salvo</Badge>
                  )}
                </div>

                {template.available_tags && template.available_tags.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Tags Disponíveis:</Label>
                    <div className="flex flex-wrap gap-2">
                      {template.available_tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="font-mono">
                          {`{${tag}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor={`template-${template.id}`}>Mensagem</Label>
                  <Textarea
                    id={`template-${template.id}`}
                    value={currentValue}
                    onChange={(e) => handleChange(template.id, e.target.value)}
                    rows={3}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => handleSave(template.id)}
                    disabled={!hasChanges || updateMutation.isPending}
                    size="sm"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Alterações
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-sm">Como usar as tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• <strong>{`{saldo}`}</strong>: Será substituído pelo saldo formatado do cliente (ex: "R$ 10,50" ou "100 pontos")</p>
          <p>• <strong>{`{nome}`}</strong>: Será substituído pelo nome completo do cliente</p>
          <p>• <strong>{`{cpf}`}</strong>: Será substituído pelo CPF do cliente</p>
          <p className="mt-4 text-xs">
            As mensagens configuradas aqui serão retornadas automaticamente pela API nos campos <code className="bg-background px-1 py-0.5 rounded">mensagem</code> e <code className="bg-background px-1 py-0.5 rounded">mensagemFrentista</code>
          </p>
          <p className="mt-2 text-xs text-orange-600 dark:text-orange-400">
            ⚠️ <strong>Atenção:</strong> As mensagens são cacheadas por 5 minutos. Após salvar uma alteração, pode levar até 5 minutos para que a mudança seja refletida nas requisições da API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MensagensAPI;