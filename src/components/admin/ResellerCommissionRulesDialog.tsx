import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface CommissionRule {
  id: string;
  rule_name: string;
  start_date: string;
  end_date: string;
  first_three_months_percentage: number;
  after_three_months_percentage: number;
  is_active: boolean;
  created_at: string;
}

interface ResellerCommissionRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResellerCommissionRulesDialog({ open, onOpenChange }: ResellerCommissionRulesDialogProps) {
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    rule_name: "",
    start_date: "",
    end_date: "",
    first_three_months_percentage: 50,
    after_three_months_percentage: 15,
    is_active: true,
  });

  useEffect(() => {
    if (open) {
      fetchRules();
    }
  }, [open]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("reseller_commission_rules")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRules(data || []);
    } catch (error: any) {
      console.error("Erro ao buscar regras:", error);
      toast({
        title: "Erro ao carregar regras",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingRule) {
        const { error } = await supabase
          .from("reseller_commission_rules")
          .update(formData)
          .eq("id", editingRule.id);

        if (error) throw error;

        toast({
          title: "Regra atualizada com sucesso",
        });
      } else {
        const { error } = await supabase
          .from("reseller_commission_rules")
          .insert([formData]);

        if (error) throw error;

        toast({
          title: "Regra criada com sucesso",
        });
      }

      resetForm();
      fetchRules();
    } catch (error: any) {
      console.error("Erro ao salvar regra:", error);
      toast({
        title: "Erro ao salvar regra",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (rule: CommissionRule) => {
    setEditingRule(rule);
    setFormData({
      rule_name: rule.rule_name,
      start_date: rule.start_date,
      end_date: rule.end_date,
      first_three_months_percentage: rule.first_three_months_percentage,
      after_three_months_percentage: rule.after_three_months_percentage,
      is_active: rule.is_active,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta regra?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("reseller_commission_rules")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Regra excluída com sucesso",
      });
      fetchRules();
    } catch (error: any) {
      console.error("Erro ao excluir regra:", error);
      toast({
        title: "Erro ao excluir regra",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      rule_name: "",
      start_date: "",
      end_date: "",
      first_three_months_percentage: 50,
      after_three_months_percentage: 15,
      is_active: true,
    });
    setEditingRule(null);
    setShowForm(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tabela de Comissão - Revendedores</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!showForm ? (
            <>
              <div className="flex justify-end">
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Regra
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : rules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma regra cadastrada
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome da Regra</TableHead>
                      <TableHead>Período Promoção</TableHead>
                      <TableHead>Primeiras 3 Mensalidades</TableHead>
                      <TableHead>Após 3 Meses</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.rule_name}</TableCell>
                        <TableCell>
                          {formatDate(rule.start_date)} até{" "}
                          {formatDate(rule.end_date)}
                        </TableCell>
                        <TableCell>
                          {rule.first_three_months_percentage}%
                        </TableCell>
                        <TableCell>{rule.after_three_months_percentage}%</TableCell>
                        <TableCell>
                          {rule.is_active ? (
                            <span className="text-green-600">Ativa</span>
                          ) : (
                            <span className="text-muted-foreground">Inativa</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(rule)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(rule.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rule_name">Nome da Regra*</Label>
                <Input
                  id="rule_name"
                  value={formData.rule_name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, rule_name: e.target.value }))
                  }
                  placeholder="Ex: Promoção Black Friday 2025"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Data Início da Promoção*</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, start_date: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">Data Fim da Promoção*</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, end_date: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_three_months_percentage">Comissão nas 3 Primeiras Mensalidades (%)*</Label>
                  <Input
                    id="first_three_months_percentage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.first_three_months_percentage}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        first_three_months_percentage: parseFloat(e.target.value),
                      }))
                    }
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    Ex: 50 para 50% das 3 primeiras mensalidades
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="after_three_months_percentage">Comissão Após 3 Meses (%)*</Label>
                  <Input
                    id="after_three_months_percentage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.after_three_months_percentage}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        after_three_months_percentage: parseFloat(e.target.value),
                      }))
                    }
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    Ex: 15 para 15% até o contrato estar assinado
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, is_active: checked }))
                  }
                />
                <Label htmlFor="is_active">Regra Ativa</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingRule ? "Atualizar" : "Criar"} Regra
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
