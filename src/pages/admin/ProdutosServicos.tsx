import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Search, Eye, Power, ArrowLeft, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { LIMITS, trimmedString, trimmedOptional, cleanText } from "@/lib/input-sanitization";

const formSchema = z.object({
  code: trimmedOptional(LIMITS.SHORT_CODE),
  name: trimmedString(LIMITS.SHORT_TEXT, { min: 2, minMessage: "Nome deve ter no mínimo 2 caracteres" }),
  type: z.enum(["product", "service"], { required_error: "Tipo é obrigatório" }),
  category_id: z.string().optional(),
  unit_of_measure: trimmedString(20, { min: 1, minMessage: "Unidade de medida é obrigatória" }),
  cost_value: z.string().optional(),
  sale_value: z.string().min(1, "Valor de venda é obrigatório"),
  is_recurring: z.boolean().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ProductService {
  id: string;
  code: string;
  name: string;
  type: string;
  category_id: string | null;
  unit_of_measure: string;
  cost_value: number | null;
  sale_value: number;
  is_active: boolean;
  is_recurring?: boolean;
  created_at: string;
  product_service_categories?: {
    name: string;
  };
}

interface Category {
  id: string;
  name: string;
}

const ProdutosServicos = () => {
  const [items, setItems] = useState<ProductService[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductService | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      name: "",
      type: "product",
      category_id: "",
      unit_of_measure: "",
      cost_value: "",
      sale_value: "",
      is_recurring: false,
    },
  });

  useEffect(() => {
    loadItems();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("product_service_categories")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar categorias",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from("products_services")
        .select(`
          *,
          product_service_categories (
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar itens",
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

      const itemData = {
        name: cleanText(data.name, LIMITS.SHORT_TEXT),
        type: data.type,
        category_id: data.category_id || null,
        unit_of_measure: cleanText(data.unit_of_measure, 20),
        cost_value: data.cost_value ? parseFloat(data.cost_value) : null,
        sale_value: parseFloat(data.sale_value),
        is_recurring: data.type === 'service' ? (data.is_recurring || false) : false,
        ...(data.code && { code: cleanText(data.code, LIMITS.SHORT_CODE) }),
      };

      if (editingItem) {
        const { error } = await supabase
          .from("products_services")
          .update({
            ...itemData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingItem.id);

        if (error) throw error;

        toast({
          title: `${data.type === 'product' ? 'Produto' : 'Serviço'} atualizado!`,
          description: "O item foi atualizado com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from("products_services")
          .insert([{
            ...itemData,
            created_by: session.session.user.id,
          }]);

        if (error) throw error;

        toast({
          title: `${data.type === 'product' ? 'Produto' : 'Serviço'} cadastrado!`,
          description: "O item foi cadastrado com sucesso.",
        });
      }

      setIsDialogOpen(false);
      form.reset();
      setEditingItem(null);
      loadItems();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar item",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleView = (item: ProductService) => {
    setEditingItem(item);
    setIsViewMode(true);
    form.reset({
      code: item.code,
      name: item.name,
      type: item.type as "product" | "service",
      category_id: item.category_id || "",
      unit_of_measure: item.unit_of_measure,
      cost_value: item.cost_value?.toString() || "",
      sale_value: item.sale_value.toString(),
      is_recurring: item.is_recurring || false,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (item: ProductService) => {
    setEditingItem(item);
    setIsViewMode(false);
    form.reset({
      code: item.code,
      name: item.name,
      type: item.type as "product" | "service",
      category_id: item.category_id || "",
      unit_of_measure: item.unit_of_measure,
      cost_value: item.cost_value?.toString() || "",
      sale_value: item.sale_value.toString(),
      is_recurring: item.is_recurring || false,
    });
    setIsDialogOpen(true);
  };

  const handleToggleStatus = async (item: ProductService) => {
    const newStatus = !item.is_active;
    const action = newStatus ? "ativar" : "inativar";
    
    if (!confirm(`Tem certeza que deseja ${action} ${item.name}?`)) return;

    try {
      const { error } = await supabase
        .from("products_services")
        .update({ 
          is_active: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", item.id);

      if (error) throw error;

      toast({
        title: `Item ${newStatus ? "ativado" : "inativado"}!`,
        description: `O item foi ${newStatus ? "ativado" : "inativado"} com sucesso.`,
      });

      loadItems();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este item?")) return;

    try {
      const { error } = await supabase
        .from("products_services")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Item excluído!",
        description: "O item foi excluído com sucesso.",
      });
      loadItems();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir item",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setIsDialogOpen(false);
      setEditingItem(null);
      setIsViewMode(false);
      form.reset();
    } else {
      setIsDialogOpen(true);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos e Serviços</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie o catálogo comercial</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isViewMode ? "Visualizar Item" : editingItem ? "Editar Item" : "Novo Item"}
              </DialogTitle>
              <DialogDescription>
                {isViewMode ? "Informações do item" : "Preencha os dados do item abaixo"}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo *</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value} 
                          disabled={isViewMode || !!editingItem}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="product">Produto</SelectItem>
                            <SelectItem value="service">Serviço</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código {editingItem && "(gerado automaticamente)"}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: #P001" disabled={true} maxLength={LIMITS.SHORT_CODE} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nome do produto/serviço" disabled={isViewMode} maxLength={LIMITS.SHORT_TEXT} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isViewMode}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma categoria" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unit_of_measure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidade de Medida *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: UN, KG, L, M" disabled={isViewMode} maxLength={20} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cost_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor de Custo</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            step="0.01"
                            placeholder="0.00" 
                            disabled={isViewMode} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sale_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor de Venda *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            step="0.01"
                            placeholder="0.00" 
                            disabled={isViewMode} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {form.watch("type") === "service" && (
                  <FormField
                    control={form.control}
                    name="is_recurring"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isViewMode}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Serviço Recorrente (Mensalidade)
                          </FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Marque se este serviço é recorrente/mensalidade
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                )}

                {!isViewMode && (
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingItem ? "Atualizar" : "Cadastrar"}
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
            placeholder="Buscar por nome ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="product">Produtos</SelectItem>
            <SelectItem value="service">Serviços</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>UN</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Venda</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center">
                  Nenhum item encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-sm">{item.code}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant={item.type === 'product' ? 'default' : 'outline'}>
                      <Package className="h-3 w-3 mr-1" />
                      {item.type === 'product' ? 'Produto' : 'Serviço'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.product_service_categories?.name || "-"}
                  </TableCell>
                  <TableCell>{item.unit_of_measure}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.cost_value)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.sale_value)}</TableCell>
                  <TableCell>
                    <Badge variant={item.is_active ? "default" : "secondary"}>
                      {item.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleView(item)}
                        title="Visualizar"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(item)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleStatus(item)}
                        title={item.is_active ? "Inativar" : "Ativar"}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
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

export default ProdutosServicos;
