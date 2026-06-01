import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface UserTag {
  id: string;
  name: string;
  color: string;
}

export function UserTagsManager() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [tags, setTags] = useState<UserTag[]>([]);
  const [networkId, setNetworkId] = useState<string>("");
  const [showDialog, setShowDialog] = useState(false);
  const [newTag, setNewTag] = useState({
    name: "",
    color: "#3b82f6",
  });

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: managerData } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!managerData) throw new Error("Gerente não encontrado");
      setNetworkId(managerData.network_id);

      const { data, error } = await supabase
        .from("user_tags")
        .select("*")
        .eq("network_id", managerData.network_id)
        .order("name");

      if (error) throw error;
      setTags(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar tags",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTag.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe um nome para a tag",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("user_tags")
        .insert({
          network_id: networkId,
          name: newTag.name.trim(),
          color: newTag.color,
        });

      if (error) throw error;

      toast({
        title: "Tag criada",
        description: `Tag "${newTag.name}" criada com sucesso`,
      });

      setShowDialog(false);
      setNewTag({ name: "", color: "#3b82f6" });
      loadTags();
    } catch (error: any) {
      toast({
        title: "Erro ao criar tag",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteTag = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from("user_tags")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Tag removida",
        description: `Tag "${name}" removida`,
      });

      loadTags();
    } catch (error: any) {
      toast({
        title: "Erro ao remover tag",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Tags de Usuários
            </CardTitle>
            <CardDescription>
              Organize usuários com tags para facilitar relatórios e filtros
            </CardDescription>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nova Tag
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Tag</DialogTitle>
                <DialogDescription>
                  Crie uma tag para organizar seus usuários
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="tag-name">Nome da Tag</Label>
                  <Input
                    id="tag-name"
                    placeholder="Ex: Pista, Loja, Gerente..."
                    value={newTag.name}
                    onChange={(e) =>
                      setNewTag({ ...newTag, name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="tag-color">Cor</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="tag-color"
                      type="color"
                      value={newTag.color}
                      onChange={(e) =>
                        setNewTag({ ...newTag, color: e.target.value })
                      }
                      className="w-20 h-10"
                    />
                    <Badge
                      style={{
                        backgroundColor: newTag.color,
                        color: "#fff",
                      }}
                    >
                      {newTag.name || "Preview"}
                    </Badge>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateTag}>Criar Tag</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {tags.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Nenhuma tag cadastrada
            </p>
            <Button variant="outline" onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeira tag
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-2 border rounded-lg p-2 hover:bg-accent/50 transition-colors"
              >
                <Badge
                  style={{
                    backgroundColor: tag.color,
                    color: "#fff",
                  }}
                >
                  {tag.name}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteTag(tag.id, tag.name)}
                  className="h-6 w-6 p-0"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}