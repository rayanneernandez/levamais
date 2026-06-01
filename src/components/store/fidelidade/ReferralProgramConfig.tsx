import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Gift, HelpCircle } from "lucide-react";

interface ReferralProgramConfigProps {
  loyaltyType: "points" | "cashback";
  referralConfig: {
    referral_enabled: boolean;
    referral_bonus_type: string;
    referral_bonus_referrer: number;
    referral_bonus_referred: number;
    referral_max_uses: number;
  };
  setReferralConfig: React.Dispatch<React.SetStateAction<any>>;
}

export function ReferralProgramConfig({ 
  loyaltyType, 
  referralConfig, 
  setReferralConfig 
}: ReferralProgramConfigProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Gift className="h-5 w-5" />
                Programa de Indicação
              </CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Como funciona:</p>
                      <ul className="text-xs space-y-1 list-disc list-inside">
                        <li>Cliente indicador compartilha código/link com amigos</li>
                        <li>Quando indicado faz primeira compra, ambos ganham bônus</li>
                        <li>Estimula crescimento orgânico da base de clientes</li>
                      </ul>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <CardDescription>
              Recompense clientes que indicarem novos usuários
            </CardDescription>
          </div>
          <Switch
            checked={referralConfig.referral_enabled}
            onCheckedChange={(checked) => 
              setReferralConfig((prev: any) => ({ ...prev, referral_enabled: checked }))
            }
          />
        </div>
      </CardHeader>
      
      {referralConfig.referral_enabled && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ref-referrer" className="text-sm">
                Bônus Indicador {loyaltyType === "cashback" ? "(R$)" : "(Pontos)"}
              </Label>
              <Input
                id="ref-referrer"
                type="number"
                step={loyaltyType === "cashback" ? "0.01" : "1"}
                min="0"
                value={referralConfig.referral_bonus_referrer}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  setReferralConfig((prev: any) => ({
                    ...prev,
                    referral_bonus_referrer: value
                  }));
                }}
              />
              <p className="text-xs text-muted-foreground">
                Quem indica recebe
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ref-referred" className="text-sm">
                Bônus Indicado {loyaltyType === "cashback" ? "(R$)" : "(Pontos)"}
              </Label>
              <Input
                id="ref-referred"
                type="number"
                step={loyaltyType === "cashback" ? "0.01" : "1"}
                min="0"
                value={referralConfig.referral_bonus_referred}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  setReferralConfig((prev: any) => ({
                    ...prev,
                    referral_bonus_referred: value
                  }));
                }}
              />
              <p className="text-xs text-muted-foreground">
                Quem foi indicado recebe
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="ref-max-uses" className="text-sm">
                Limite de Indicações
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">
                      Quantidade máxima de indicações que cada cliente pode fazer. Use 0 para indicações ilimitadas.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              id="ref-max-uses"
              type="number"
              min="0"
              value={referralConfig.referral_max_uses}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0;
                setReferralConfig((prev: any) => ({
                  ...prev,
                  referral_max_uses: value
                }));
              }}
            />
            <p className="text-xs text-muted-foreground">
              0 = ilimitado
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
