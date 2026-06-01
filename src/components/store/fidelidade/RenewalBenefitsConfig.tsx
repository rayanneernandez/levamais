import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface RenewalBenefitsConfigProps {
  loyaltyType: "points" | "cashback";
  renewalConfig: {
    renewal_6_months: number;
    renewal_9_months: number;
    renewal_12_months: number;
  };
  setRenewalConfig: React.Dispatch<React.SetStateAction<any>>;
}

export function RenewalBenefitsConfig({ 
  loyaltyType, 
  renewalConfig, 
  setRenewalConfig 
}: RenewalBenefitsConfigProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            🔄 Benefícios de Renovação
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
                        <li>Ao final do período de retenção, cliente pode renovar</li>
                        <li>Recebe bônus em {loyaltyType === "cashback" ? "cashback" : "pontos"} pela renovação</li>
                        <li>Bônus é proporcional ao período renovado</li>
                      </ul>
                      <p className="text-xs font-medium mt-2">Estratégia:</p>
                      <p className="text-xs">Ofereça bônus atrativos para estimular renovações e manter o cliente fidelizado por mais tempo.</p>
                    </div>
                  </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>
          Bônus para clientes que renovarem o compromisso de retenção
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Bônus de Renovação em {loyaltyType === "cashback" ? "R$" : "Pontos"}
          </Label>
          
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="renewal-6" className="text-xs font-normal">6 meses</Label>
              <Input
                id="renewal-6"
                type="number"
                step={loyaltyType === "cashback" ? "0.01" : "1"}
                min="0"
                value={renewalConfig.renewal_6_months}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  setRenewalConfig((prev: any) => ({
                    ...prev,
                    renewal_6_months: value
                  }));
                }}
              />
              <p className="text-xs text-muted-foreground">
                {loyaltyType === "cashback" 
                  ? `R$ ${renewalConfig.renewal_6_months.toFixed(2)}`
                  : `${renewalConfig.renewal_6_months} pts`
                }
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="renewal-9" className="text-xs font-normal">9 meses</Label>
              <Input
                id="renewal-9"
                type="number"
                step={loyaltyType === "cashback" ? "0.01" : "1"}
                min="0"
                value={renewalConfig.renewal_9_months}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  setRenewalConfig((prev: any) => ({
                    ...prev,
                    renewal_9_months: value
                  }));
                }}
              />
              <p className="text-xs text-muted-foreground">
                {loyaltyType === "cashback" 
                  ? `R$ ${renewalConfig.renewal_9_months.toFixed(2)}`
                  : `${renewalConfig.renewal_9_months} pts`
                }
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="renewal-12" className="text-xs font-normal">12 meses</Label>
              <Input
                id="renewal-12"
                type="number"
                step={loyaltyType === "cashback" ? "0.01" : "1"}
                min="0"
                value={renewalConfig.renewal_12_months}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  setRenewalConfig((prev: any) => ({
                    ...prev,
                    renewal_12_months: value
                  }));
                }}
              />
              <p className="text-xs text-muted-foreground">
                {loyaltyType === "cashback" 
                  ? `R$ ${renewalConfig.renewal_12_months.toFixed(2)}`
                  : `${renewalConfig.renewal_12_months} pts`
                }
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
