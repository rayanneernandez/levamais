import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Plan {
  id: string;
  name: string;
  description: string;
  plan_type: string;
  monthly_value: number;
  quantity: number;
  is_active: boolean;
  benefits: any;
}

export default function Planos() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    plan_type: "sms",
    monthly_value: "",
    quantity_included: "",
    is_active: true,
    benefits: "",
  });

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("upgrade_plans")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPlans(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar planos",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const planData = {
        name: formData.name,
        description: formData.description,
        plan_type: formData.plan_type,
        monthly_value: parseFloat(formData.monthly_value),
        quantity: parseInt(formData.quantity_included),
        is_active: formData.is_active,
        benefits: formData.benefits.split("\n").filter(b => b.trim()),
      };

      if (editingPlan) {
        const { error } = await supabase
          .from("upgrade_plans")
          .update(planData)
          .eq("id", editingPlan.id);

        if (error) throw error;

        toast({
          title: "Plano atualizado",
          description: "O plano foi atualizado com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from("upgrade_plans")
          .insert(planData);

        if (error) throw error;

        toast({
          title: "Plano criado",
          description: "O plano foi criado com sucesso.",
        });
      }

      setDialogOpen(false);
      resetForm();
      loadPlans();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar plano",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description,
      plan_type: plan.plan_type,
      monthly_value: plan.monthly_value.toString(),
      quantity_included: plan.quantity.toString(),
      is_active: plan.is_active,
      benefits: Array.isArray(plan.benefits) ? plan.benefits.join("\n") : "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este plano?")) return;

    try {
      const { error } = await supabase
        .from("upgrade_plans")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Plano excluído",
        description: "O plano foi excluído com sucesso.",
      });

      loadPlans();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir plano",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingPlan(null);
    setFormData({
      name: "",
      description: "",
      plan_type: "sms",
      monthly_value: "",
      quantity_included: "",
      is_active: true,
      benefits: "",
    });
  };

  const getPlanTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      sms: "SMS",
      email: "E-mail",
      whatsapp: "WhatsApp",
      ai_credits: "IA Credits",
      fuel_analysis: "Análise Combustível",
    };
    return types[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Planos de Upgrade</h1>
          <p className="text-muted-foreground">
            Gerencie os planos disponíveis para os clientes
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Plano
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingPlan ? "Editar Plano" : "Novo Plano"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Plano</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan_type">Tipo</Label>
                  <Select
                    value={formData.plan_type}
                    onValueChange={(value) => setFormData({ ...formData, plan_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="ai_credits">IA Credits</SelectItem>
                      <SelectItem value="fuel_analysis">Análise Combustível</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="monthly_value">Valor Mensal (R$)</Label>
                  <Input
                    id="monthly_value"
                    type="number"
                    step="0.01"
                    value={formData.monthly_value}
                    onChange={(e) => setFormData({ ...formData, monthly_value: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity_included">Quantidade Incluída</Label>
                  <Input
                    id="quantity_included"
                    type="number"
                    value={formData.quantity_included}
                    onChange={(e) => setFormData({ ...formData, quantity_included: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="benefits">Benefícios (um por linha)</Label>
                <Textarea
                  id="benefits"
                  value={formData.benefits}
                  onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                  placeholder="Benefício 1&#10;Benefício 2&#10;Benefício 3"
                  rows={5}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Plano Ativo</Label>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingPlan ? "Atualizar" : "Criar"}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planos Cadastrados</CardTitle>
          <CardDescription>
            Lista de todos os planos de upgrade disponíveis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor Mensal</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>{getPlanTypeLabel(plan.plan_type)}</TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(plan.monthly_value)}
                  </TableCell>
                  <TableCell>{plan.quantity.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={plan.is_active ? "default" : "secondary"}>
                      {plan.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(plan)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(plan.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
