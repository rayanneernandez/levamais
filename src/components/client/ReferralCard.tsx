import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Share2, Copy, Users, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface ReferralCardProps {
  clientId: string;
  networkId: string;
}

export function ReferralCard({ clientId, networkId }: ReferralCardProps) {
  const [referralLink, setReferralLink] = useState("");

  // Buscar configuração da rede
  const { data: networkConfig } = useQuery({
    queryKey: ["network-referral-config", networkId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("networks")
        .select("referral_enabled, referral_bonus_type, referral_bonus_referrer, referral_bonus_referred, referral_max_uses")
        .eq("id", networkId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Buscar contagem de indicações
  const { data: referralCount } = useQuery({
    queryKey: ["referral-count", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_referrals")
        .select("id", { count: "exact" })
        .eq("referrer_client_id", clientId);

      if (error) throw error;
      return data?.length || 0;
    },
  });

  // Buscar indicações realizadas
  const { data: referrals } = useQuery({
    queryKey: ["referrals", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_referrals")
        .select(`
          id,
          referred_client_id,
          bonus_applied,
          created_at
        `)
        .eq("referrer_client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Buscar nomes dos clientes indicados separadamente
      if (data && data.length > 0) {
        const referredIds = data.map(r => r.referred_client_id);
        const { data: clientsData } = await supabase
          .from("clients")
          .select("id, full_name")
          .in("id", referredIds);
        
        // Mapear nomes aos registros
        return data.map(ref => ({
          ...ref,
          referred_name: clientsData?.find(c => c.id === ref.referred_client_id)?.full_name || "Amigo"
        }));
      }
      
      return data;
    },
  });

  useEffect(() => {
    const link = `https://portal.levamais.app/cadastro?ref=${clientId}`;
    setReferralLink(link);
  }, [clientId]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success("Link copiado!");
    } catch (error) {
      toast.error("Erro ao copiar link");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Indica+ Leva+",
          text: "Participe do programa de fidelidade Leva+ e ganhe benefícios!",
          url: referralLink,
        });
      } catch (error) {
        // Usuário cancelou o compartilhamento
      }
    } else {
      handleCopyLink();
    }
  };

  if (!networkConfig?.referral_enabled) {
    return null;
  }

  const maxReferrals = (networkConfig as any)?.referral_max_uses || 0;
  const isUnlimited = maxReferrals === 0;
  const remainingReferrals = isUnlimited ? Infinity : maxReferrals - (referralCount || 0);
  const canRefer = remainingReferrals > 0;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Gift className="h-4 w-4 mr-2" />
          Indica+ Leva+
          {referralCount ? (
            <Badge variant="secondary" className="ml-2">
              {isUnlimited ? referralCount : `${referralCount}/${maxReferrals}`}
            </Badge>
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Indica+ Leva+
          </DialogTitle>
          <DialogDescription>
            Indique amigos e ambos ganham bônus no saldo quando o indicado fizer a primeira compra!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {canRefer ? (
            <>
              <div className="space-y-2">
                <div className="text-sm font-medium">Seu link de indicação:</div>
                <div className="flex gap-2">
                  <Input value={referralLink} readOnly className="font-mono text-xs" />
                  <Button size="icon" variant="outline" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" onClick={handleShare}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="font-medium text-sm">Como funciona?</div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Compartilhe seu link {isUnlimited ? "com amigos" : `com até ${remainingReferrals} amigos`}</li>
                  <li>• Quando seu amigo fizer a primeira compra, ambos ganham bônus</li>
                  <li>• Você ganha {networkConfig.referral_bonus_type === "cashback"
                      ? `R$ ${networkConfig.referral_bonus_referrer?.toFixed(2)} em cashback`
                      : networkConfig.referral_bonus_referrer 
                        ? `${networkConfig.referral_bonus_referrer} pontos` 
                        : "bônus"}</li>
                  <li>• Seu amigo ganha {networkConfig.referral_bonus_type === "cashback"
                      ? `R$ ${networkConfig.referral_bonus_referred?.toFixed(2)} em cashback`
                      : networkConfig.referral_bonus_referred 
                        ? `${networkConfig.referral_bonus_referred} pontos` 
                        : "bônus"}</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Você atingiu o limite de {maxReferrals} indicações!
            </div>
          )}

          {referrals && referrals.length > 0 && (
            <div className="space-y-2 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4" />
                Suas indicações ({referrals.length})
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {referrals.map((ref: any) => (
                  <div
                    key={ref.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <span className="text-sm">{ref.referred_name || "Amigo"}</span>
                    <Badge variant={ref.bonus_applied ? "default" : "secondary"}>
                      {ref.bonus_applied ? "Ativo" : "Pendente"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}