import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";

interface AutoReplyRule {
  id: string;
  stars: number;
  auto_reply_message: string;
  is_active: boolean;
  require_comment: boolean;
}

interface NPSAutoReplyConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  networkId: string;
}

export const NPSAutoReplyConfig = ({ open, onOpenChange, networkId }: NPSAutoReplyConfigProps) => {
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStars, setSelectedStars] = useState<number | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [requireComment, setRequireComment] = useState(false);

  useEffect(() => {
    if (open) {
      loadRules();
    }
  }, [open, networkId]);

  const loadRules = async () => {
    try {
      const { data, error } = await supabase
        .from("nps_auto_reply_rules")
        .select("*")
        .eq("network_id", networkId)
        .order("stars", { ascending: true });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error("Erro ao carregar regras:", error);
      toast.error("Erro ao carregar regras de resposta automática");
    }
  };

  const handleSaveRule = async () => {
    if (!selectedStars || !replyMessage.trim()) {
      toast.error("Selecione as estrelas e escreva a mensagem");
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const existingRule = rules.find(r => r.stars === selectedStars);

      if (existingRule) {
        // Atualizar regra existente
        const { error } = await supabase
          .from("nps_auto_reply_rules")
          .update({
            auto_reply_message: replyMessage,
            require_comment: requireComment,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingRule.id);

        if (error) throw error;
        toast.success("Regra atualizada com sucesso");
      } else {
        // Criar nova regra
        const { error } = await supabase
          .from("nps_auto_reply_rules")
          .insert({
            network_id: networkId,
            stars: selectedStars,
            auto_reply_message: replyMessage,
            require_comment: requireComment,
            created_by: user.id
          });

        if (error) throw error;
        toast.success("Regra criada com sucesso");
      }

      setSelectedStars(null);
      setReplyMessage("");
      setRequireComment(false);
      await loadRules();
    } catch (error) {
      console.error("Erro ao salvar regra:", error);
      toast.error("Erro ao salvar regra");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("nps_auto_reply_rules")
        .update({ is_active: isActive })
        .eq("id", ruleId);

      if (error) throw error;
      
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_active: isActive } : r));
      toast.success(isActive ? "Regra ativada" : "Regra desativada");
    } catch (error) {
      console.error("Erro ao alterar status:", error);
      toast.error("Erro ao alterar status da regra");
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from("nps_auto_reply_rules")
        .delete()
        .eq("id", ruleId);

      if (error) throw error;
      
      setRules(prev => prev.filter(r => r.id !== ruleId));
      toast.success("Regra excluída com sucesso");
    } catch (error) {
      console.error("Erro ao excluir regra:", error);
      toast.error("Erro ao excluir regra");
    }
  };

  const handleSelectRule = (rule: AutoReplyRule) => {
    setSelectedStars(rule.stars);
    setReplyMessage(rule.auto_reply_message);
    setRequireComment(rule.require_comment);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Respostas Automáticas por Estrelas</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Formulário para criar/editar regra */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <Label>Selecione a quantidade de estrelas</Label>
                  <div className="flex gap-2 mt-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Button
                        key={star}
                        variant={selectedStars === star ? "default" : "outline"}
                        onClick={() => setSelectedStars(star)}
                        className="flex items-center gap-1"
                      >
                        {star} <Star className="h-4 w-4" />
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="reply-message">Mensagem de resposta automática</Label>
                  <Textarea
                    id="reply-message"
                    placeholder="Digite a mensagem que será enviada automaticamente..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    rows={4}
                    className="mt-2"
                  />
                </div>

                <div className="flex items-center gap-2 p-3 border rounded-md">
                  <Switch
                    id="require-comment"
                    checked={requireComment}
                    onCheckedChange={setRequireComment}
                  />
                  <Label htmlFor="require-comment" className="cursor-pointer">
                    Enviar apenas quando houver comentário junto com a estrela
                  </Label>
                </div>

                <Button 
                  onClick={handleSaveRule} 
                  disabled={loading || !selectedStars || !replyMessage.trim()}
                  className="w-full"
                >
                  {selectedStars && rules.find(r => r.stars === selectedStars) ? "Atualizar Regra" : "Adicionar Regra"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista de regras existentes */}
          <div className="space-y-3">
            <h3 className="font-semibold">Regras Configuradas</h3>
            
            {rules.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhuma regra configurada ainda
              </p>
            ) : (
              rules.map((rule) => (
                <Card key={rule.id} className="bg-card/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {rule.stars} <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.is_active}
                              onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                            />
                            <span className="text-sm text-muted-foreground">
                              {rule.is_active ? "Ativa" : "Inativa"}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{rule.auto_reply_message}</p>
                        {rule.require_comment && (
                          <p className="text-xs text-muted-foreground italic">
                            ⚠️ Envia apenas quando houver comentário
                          </p>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectRule(rule)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
