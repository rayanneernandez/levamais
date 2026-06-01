import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Search, Eye, Power, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { LIMITS, trimmedString, trimmedOptional, cleanText } from "@/lib/input-sanitization";

const formSchema = z.object({
  name: trimmedString(LIMITS.NAME, { min: 2, minMessage: "Nome deve ter no mínimo 2 caracteres" }),
  description: trimmedOptional(LIMITS.MEDIUM_TEXT),
});

type FormData = z.infer<typeof formSchema>;

interface Category {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

const Categorias = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("product_service_categories")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar categorias",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado",
          variant: "destructive",
        });
        return;
      }

      const cleanName = cleanText(data.name, LIMITS.NAME);
      const cleanDescription = cleanText(data.description, LIMITS.MEDIUM_TEXT) || null;

      if (editingCategory) {
        const { error } = await supabase
          .from("product_service_categories")
          .update({
            name: cleanName,
            description: cleanDescription,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingCategory.id);

        if (error) throw error;

        toast({
          title: "Categoria atualizada!",
          description: "A categoria foi atualizada com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from("product_service_categories")
          .insert([{
            name: cleanName,
            description: cleanDescription,
            created_by: session.session.user.id,
          }]);

        if (error) throw error;

        toast({
          title: "Categoria cadastrada!",
          description: "A categoria foi cadastrada com sucesso.",
        });
      }

      setIsDialogOpen(false);
      form.reset();
      setEditingCategory(null);
      loadCategories();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar categoria",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleView = (category: Category) => {
    setEditingCategory(category);
    setIsViewMode(true);
    form.reset({
      name: category.name,
      description: category.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setIsViewMode(false);
    form.reset({
      name: category.name,
      description: category.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleToggleStatus = async (category: Category) => {
    const newStatus = !category.is_active;
    const action = newStatus ? "ativar" : "inativar";
    
    if (!confirm(`Tem certeza que deseja ${action} a categoria ${category.name}?`)) return;

    try {
      const { error } = await supabase
        .from("product_service_categories")
        .update({ 
          is_active: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", category.id);

      if (error) throw error;

      toast({
        title: `Categoria ${newStatus ? "ativada" : "inativada"}!`,
        description: `A categoria foi ${newStatus ? "ativada" : "inativada"} com sucesso.`,
      });

      loadCategories();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;

    try {
      const { error } = await supabase
        .from("product_service_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Categoria excluída!",
        description: "A categoria foi excluída com sucesso.",
      });
      loadCategories();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir categoria",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setIsDialogOpen(false);
      setEditingCategory(null);
      setIsViewMode(false);
      form.reset();
    } else {
      setIsDialogOpen(true);
    }
  };

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categorias</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie as categorias de produtos e serviços</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {isViewMode ? "Visualizar Categoria" : editingCategory ? "Editar Categoria" : "Nova Categoria"}
              </DialogTitle>
              <DialogDescription>
                {isViewMode ? "Informações da categoria" : "Preencha os dados da categoria abaixo"}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nome da categoria" disabled={isViewMode} maxLength={LIMITS.NAME} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Descrição da categoria" disabled={isViewMode} rows={4} maxLength={LIMITS.MEDIUM_TEXT} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!isViewMode && (
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingCategory ? "Atualizar" : "Cadastrar"}
                    </Button>
                  </div>
                )}
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar categorias..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredCategories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  Nenhuma categoria encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredCategories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="max-w-md truncate">
                    {category.description || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={category.is_active ? "default" : "secondary"}>
                      {category.is_active ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleView(category)}
                        title="Visualizar"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(category)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleStatus(category)}
                        title={category.is_active ? "Inativar" : "Ativar"}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(category.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Categorias;
