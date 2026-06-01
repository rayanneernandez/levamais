import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gift, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RewardConfig {
  id: string;
  is_active: boolean;
  reward_type: 'points_fixed' | 'points_percentage' | 'cashback_fixed' | 'cashback_percentage';
  reward_value: number;
  min_stars: number | null;
  require_comment?: boolean;
}

interface NPSRatingRewardsConfigProps {
  networkId: string;
  loyaltyType: 'points' | 'cashback';
}

export const NPSRatingRewardsConfig = ({ networkId, loyaltyType }: NPSRatingRewardsConfigProps) => {
  const [config, setConfig] = useState<RewardConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [rewardType, setRewardType] = useState<'points_fixed' | 'points_percentage' | 'cashback_fixed' | 'cashback_percentage'>(
    loyaltyType === 'points' ? 'points_fixed' : 'cashback_fixed'
  );
  const [rewardValue, setRewardValue] = useState<string>("");
  const [minStars, setMinStars] = useState<string>("0");

  useEffect(() => {
    loadConfig();
  }, [networkId]);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("nps_rating_rewards_config")
        .select("*")
        .eq("network_id", networkId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setConfig(data as RewardConfig);
        setIsActive(data.is_active);
        // Only set if it matches the current loyalty type
        const type = data.reward_type;
        if (type.startsWith(loyaltyType)) {
          setRewardType(type as any);
          setRewardValue(data.reward_value.toString());
          setMinStars(data.min_stars?.toString() || "0");
        }
      }
    } catch (error) {
      console.error("Erro ao carregar configuração:", error);
    }
  };

  const handleSave = async () => {
    if (!rewardValue || parseFloat(rewardValue) <= 0) {
      toast.error("Valor da recompensa deve ser maior que zero");
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const configData = {
        network_id: networkId,
        is_active: isActive,
        reward_type: rewardType,
        reward_value: parseFloat(rewardValue),
        min_stars: minStars && minStars !== "0" ? parseInt(minStars) : null,
        created_by: user.id
      };

      if (config) {
        // Atualizar configuração existente
        const { error } = await supabase
          .from("nps_rating_rewards_config")
          .update(configData)
          .eq("id", config.id);

        if (error) throw error;
      } else {
        // Criar nova configuração
        const { error } = await supabase
          .from("nps_rating_rewards_config")
          .insert(configData);

        if (error) throw error;
      }

      toast.success("Configuração salva com sucesso!");
      await loadConfig();
    } catch (error) {
      console.error("Erro ao salvar configuração:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setLoading(false);
    }
  };

  const getRewardTypeLabel = (type: string) => {
    switch (type) {
      case 'points_fixed':
        return 'Pontos Fixos';
      case 'points_percentage':
        return 'Pontos Percentuais';
      case 'cashback_fixed':
        return 'Cashback Fixo (R$)';
      case 'cashback_percentage':
        return 'Cashback Percentual (%)';
      default:
        return type;
    }
  };

  const getRewardValueDisplay = () => {
    if (!rewardValue) return "";
    
    switch (rewardType) {
      case 'points_fixed':
        return `${rewardValue} pontos`;
      case 'points_percentage':
        return `${rewardValue}% do valor da compra convertido em pontos`;
      case 'cashback_fixed':
        return `R$ ${parseFloat(rewardValue).toFixed(2)} de cashback`;
      case 'cashback_percentage':
        return `${rewardValue}% do valor da compra em cashback`;
      default:
        return rewardValue;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Bonificação por Avaliação</CardTitle>
            <CardDescription>
              Recompense seus clientes por deixarem avaliações
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
          <div>
            <Label className="text-base font-semibold">Ativar Bonificação</Label>
            <p className="text-sm text-muted-foreground mt-1">
              {isActive ? "Sistema de bonificação ativo" : "Sistema de bonificação desativado"}
            </p>
          </div>
          <Switch
            checked={isActive}
            onCheckedChange={setIsActive}
          />
        </div>

        {/* Tipo de Recompensa */}
        <div className="space-y-2">
          <Label>Modo de Cálculo</Label>
          <Select value={rewardType} onValueChange={(value: any) => setRewardType(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {loyaltyType === 'points' ? (
                <>
                  <SelectItem value="points_fixed">Pontos - Valor Fixo</SelectItem>
                  <SelectItem value="points_percentage">Pontos - Percentual da Compra</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="cashback_fixed">Cashback - Valor Fixo</SelectItem>
                  <SelectItem value="cashback_percentage">Cashback - Percentual da Compra</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Valor da Recompensa */}
        <div className="space-y-2">
          <Label htmlFor="reward-value">
            {rewardType === 'points_fixed' && 'Quantidade de Pontos'}
            {rewardType === 'points_percentage' && 'Percentual do Valor da Compra (%)'}
            {rewardType === 'cashback_fixed' && 'Valor do Cashback (R$)'}
            {rewardType === 'cashback_percentage' && 'Percentual do Valor da Compra (%)'}
          </Label>
          <Input
            id="reward-value"
            type="number"
            step={rewardType.includes('percentage') ? '0.1' : '0.01'}
            min="0"
            value={rewardValue}
            onChange={(e) => setRewardValue(e.target.value)}
            placeholder={
              rewardType === 'points_fixed' ? 'Ex: 50' :
              rewardType === 'points_percentage' ? 'Ex: 5' :
              rewardType === 'cashback_fixed' ? 'Ex: 5.00' :
              'Ex: 2.5'
            }
          />
          {rewardValue && (
            <p className="text-sm text-muted-foreground">
              Cliente receberá: <strong>{getRewardValueDisplay()}</strong>
            </p>
          )}
        </div>

        {/* Estrelas Mínimas */}
        <div className="space-y-2">
          <Label htmlFor="min-stars">Estrelas Mínimas (Opcional)</Label>
          <Select value={minStars} onValueChange={setMinStars}>
            <SelectTrigger id="min-stars">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Qualquer avaliação</SelectItem>
              <SelectItem value="1">1 estrela ou mais</SelectItem>
              <SelectItem value="2">2 estrelas ou mais</SelectItem>
              <SelectItem value="3">3 estrelas ou mais</SelectItem>
              <SelectItem value="4">4 estrelas ou mais</SelectItem>
              <SelectItem value="5">Apenas 5 estrelas</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {minStars && minStars !== "0" ? (
              <>
                Bonificação será aplicada apenas para avaliações com {minStars} <Star className="h-3 w-3 inline fill-yellow-400 text-yellow-400" /> ou mais
              </>
            ) : (
              "Bonificação será aplicada para qualquer avaliação, independente das estrelas"
            )}
          </p>
        </div>

        {/* Preview */}
        {isActive && rewardValue && (
          <div className="p-4 border rounded-lg bg-primary/5 border-primary/20">
            <p className="text-sm font-semibold mb-2">Preview da Bonificação:</p>
            <p className="text-sm">
              Cliente {minStars && minStars !== "0" ? `com avaliação de ${minStars}★ ou mais` : 'com qualquer avaliação'} receberá:{' '}
              <strong className="text-primary">{getRewardValueDisplay()}</strong>
            </p>
          </div>
        )}

        {/* Botão Salvar */}
        <Button 
          onClick={handleSave} 
          disabled={loading || !rewardValue}
        >
          {loading ? "Salvando..." : "Salvar Configuração"}
        </Button>
      </CardContent>
    </Card>
  );
};
