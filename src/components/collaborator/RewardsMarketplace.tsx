import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Gift, ShoppingCart, Package, Award } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface RewardsMarketplaceProps {
  networkId: string;
  attendantId: string;
  currentPoints: number;
  onRedemption?: () => void;
}

export function RewardsMarketplace({ networkId, attendantId, currentPoints, onRedemption }: RewardsMarketplaceProps) {
  const [selectedReward, setSelectedReward] = useState<any>(null);
  const [redeemDialog, setRedeemDialog] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  // Load rewards
  const { data: rewards, isLoading } = useQuery({
    queryKey: ["marketplace-rewards", networkId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendant_rewards")
        .select("*")
        .eq("network_id", networkId)
        .eq("is_active", true)
        .order("points_cost", { ascending: true });

      if (error) throw error;
      
      console.log("🎁 Total de recompensas:", data?.length);
      console.log("🎁 Recompensas com imagem:", data?.filter(r => r.image_url).map(r => ({
        name: r.name,
        url: r.image_url
      })));
      
      return data;
    },
    enabled: !!networkId,
  });

  const handleRedeemClick = (reward: any) => {
    if (currentPoints < reward.points_cost) {
      toast.error("Você não tem pontos suficientes para este prêmio");
      return;
    }
    setSelectedReward(reward);
    setRedeemDialog(true);
  };

  const handleConfirmRedeem = async () => {
    if (!selectedReward) return;

    setIsRedeeming(true);
    try {
      // Buscar dados do colaborador e da rede
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", attendantId)
        .single();

      const { data: manager } = await supabase
        .from("store_managers")
        .select("attendant_code, network_id")
        .eq("user_id", attendantId)
        .eq("is_attendant", true)
        .eq("store_id", null)
        .single();

      const { data: network } = await supabase
        .from("networks")
        .select("name")
        .eq("id", networkId)
        .single();

      const { data: rules } = await supabase
        .from("attendant_points_rules")
        .select("redemption_notification_email")
        .eq("network_id", networkId)
        .single();

      // Create redemption
      const { error: redemptionError } = await supabase
        .from("attendant_redemptions")
        .insert({
          attendant_id: attendantId,
          reward_id: selectedReward.id,
          network_id: networkId,
          points_spent: selectedReward.points_cost,
          status: "pending",
        });

      if (redemptionError) throw redemptionError;

      // Create points transaction
      const { error: transactionError } = await supabase
        .from("attendant_points_transactions")
        .insert({
          attendant_id: attendantId,
          network_id: networkId,
          points_earned: -selectedReward.points_cost,
          multiplier_applied: 1,
          transaction_type: "redemption",
          description: `Resgate: ${selectedReward.name}`,
        });

      if (transactionError) throw transactionError;

      // Update total points
      const newBalance = currentPoints - selectedReward.points_cost;
      const { error: updateError } = await supabase
        .from("attendant_points")
        .update({
          total_points: newBalance,
        })
        .eq("attendant_id", attendantId)
        .eq("network_id", networkId);

      if (updateError) throw updateError;

      // Enviar notificações por e-mail
      try {
        await supabase.functions.invoke("send-redemption-notification", {
          body: {
            attendantName: profile?.full_name || "Colaborador",
            attendantEmail: user.email || "",
            attendantCode: manager?.attendant_code || "",
            rewardName: selectedReward.name,
            pointsSpent: selectedReward.points_cost,
            newBalance: newBalance,
            managerEmail: rules?.redemption_notification_email || "",
            networkName: network?.name || "",
          },
        });
      } catch (emailError) {
        console.error("Erro ao enviar e-mails:", emailError);
        // Não bloquear o resgate se o e-mail falhar
      }

      toast.success("Resgate realizado com sucesso! Aguarde aprovação.");
      setRedeemDialog(false);
      setSelectedReward(null);
      
      if (onRedemption) onRedemption();
    } catch (error: any) {
      toast.error("Erro ao realizar resgate: " + error.message);
    } finally {
      setIsRedeeming(false);
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      product: "Produto",
      bonus: "Bônus",
      service: "Serviço",
    };
    return labels[category as keyof typeof labels] || category;
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      product: Package,
      bonus: Award,
      service: Gift,
    };
    const Icon = icons[category as keyof typeof icons] || Gift;
    return <Icon className="h-4 w-4" />;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      product: "bg-blue-500",
      bonus: "bg-green-500",
      service: "bg-purple-500",
    };
    return colors[category as keyof typeof colors] || "bg-gray-500";
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="lg" text="Carregando prêmios..." />
        </div>
      </div>
    );
  }

  if (!rewards || rewards.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">Nenhum prêmio disponível</p>
          <p className="text-sm mt-1">Em breve novos prêmios serão adicionados!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rewards.map((reward) => {
          const canAfford = currentPoints >= reward.points_cost;
          const hasStock = !reward.stock_quantity || reward.stock_quantity > 0;

          console.log(`Renderizando reward ${reward.name}:`, {
            hasImage: !!reward.image_url,
            imageUrl: reward.image_url
          });

          return (
            <Card key={reward.id} className={!canAfford || !hasStock ? "opacity-60" : ""}>
              {reward.image_url && (
                <div className="w-full h-48 overflow-hidden rounded-t-lg">
                  <img 
                    src={reward.image_url} 
                    alt={reward.name}
                    className="w-full h-full object-cover"
                    onLoad={() => console.log(`✅ Imagem carregada: ${reward.name}`)}
                    onError={(e) => console.error(`❌ Erro ao carregar imagem: ${reward.name}`, e)}
                  />
                </div>
              )}
              <CardHeader>
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-lg line-clamp-2">{reward.name}</CardTitle>
                    <Badge className={getCategoryColor(reward.category)}>
                      <span className="flex items-center gap-1">
                        {getCategoryIcon(reward.category)}
                        {getCategoryLabel(reward.category)}
                      </span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                  {reward.description || "Sem descrição"}
                </p>

                <div className="flex justify-between items-end pt-2 border-t">
                  <div>
                    <p className="text-2xl font-bold text-primary">
                      {reward.points_cost}
                    </p>
                    <p className="text-xs text-muted-foreground">pontos</p>
                  </div>

                  <Button
                    onClick={() => handleRedeemClick(reward)}
                    disabled={!canAfford || !hasStock}
                    size="sm"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Resgatar
                  </Button>
                </div>

                {reward.stock_quantity && (
                  <p className="text-xs text-muted-foreground text-center">
                    {hasStock ? `${reward.stock_quantity} disponíveis` : "Sem estoque"}
                  </p>
                )}

                {!canAfford && (
                  <p className="text-xs text-destructive text-center">
                    Faltam {reward.points_cost - currentPoints} pontos
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={redeemDialog} onOpenChange={setRedeemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Resgate</DialogTitle>
            <DialogDescription>
              Você está prestes a resgatar este prêmio
            </DialogDescription>
          </DialogHeader>

          {selectedReward && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h3 className="font-semibold">{selectedReward.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedReward.description}
                </p>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm">Custo:</span>
                  <span className="text-lg font-bold text-primary">
                    {selectedReward.points_cost} pontos
                  </span>
                </div>
              </div>

              <div className="p-4 bg-accent/50 rounded-lg">
                <div className="flex justify-between text-sm mb-1">
                  <span>Seus pontos atuais:</span>
                  <span className="font-semibold">{currentPoints}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Custo do prêmio:</span>
                  <span className="font-semibold text-destructive">
                    -{selectedReward.points_cost}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold pt-2 border-t mt-2">
                  <span>Saldo após resgate:</span>
                  <span className="text-primary">
                    {currentPoints - selectedReward.points_cost}
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                * O resgate ficará pendente de aprovação pelo gestor da rede
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRedeemDialog(false)} disabled={isRedeeming}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmRedeem} disabled={isRedeeming}>
              {isRedeeming ? "Processando..." : "Confirmar Resgate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
