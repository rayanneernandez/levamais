import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface RetentionProgramConfigProps {
  loyaltyType: "points" | "cashback";
  retentionConfig: {
    is_active: boolean;
    cashback_multiplier_6_months: number;
    cashback_multiplier_9_months: number;
    cashback_multiplier_12_months: number;
    points_multiplier_6_months: number;
    points_multiplier_9_months: number;
    points_multiplier_12_months: number;
  };
  setRetentionConfig: React.Dispatch<React.SetStateAction<any>>;
}

export function RetentionProgramConfig({ 
  loyaltyType, 
  retentionConfig, 
  setRetentionConfig 
}: RetentionProgramConfigProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                🎯 Programa de Retenção
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
                        <li>Cliente escolhe comprometer-se por 6, 9 ou 12 meses</li>
                        <li>Recebe multiplicador no {loyaltyType === "cashback" ? "cashback" : "acúmulo de pontos"}</li>
                        <li>Não pode trocar de rede favorita durante o período</li>
                        <li>Pode fazer upgrade do plano (ex: 6→12 meses)</li>
                      </ul>
                      <p className="text-xs font-medium mt-2">Benefícios:</p>
                      <p className="text-xs">Aumenta fidelização, gera receita previsível e reduz perda de clientes.</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <CardDescription>
              Ofereça multiplicadores de {loyaltyType === "cashback" ? "cashback" : "pontos"} para clientes que se comprometerem com sua rede
            </CardDescription>
          </div>
          <Switch
            checked={retentionConfig.is_active}
            onCheckedChange={(checked) => 
              setRetentionConfig((prev: any) => ({ ...prev, is_active: checked }))
            }
          />
        </div>
      </CardHeader>
      
      {retentionConfig.is_active && (
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Multiplicadores de {loyaltyType === "cashback" ? "Cashback" : "Pontos"} (%)</Label>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mult-6" className="text-xs font-normal">6 meses</Label>
                <Input
                  id="mult-6"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={loyaltyType === "cashback" 
                    ? retentionConfig.cashback_multiplier_6_months 
                    : retentionConfig.points_multiplier_6_months
                  }
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    setRetentionConfig((prev: any) => ({
                      ...prev,
                      [loyaltyType === "cashback" 
                        ? "cashback_multiplier_6_months" 
                        : "points_multiplier_6_months"
                      ]: value
                    }));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  +{loyaltyType === "cashback" 
                    ? retentionConfig.cashback_multiplier_6_months 
                    : retentionConfig.points_multiplier_6_months
                  }% de bônus
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mult-9" className="text-xs font-normal">9 meses</Label>
                <Input
                  id="mult-9"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={loyaltyType === "cashback" 
                    ? retentionConfig.cashback_multiplier_9_months 
                    : retentionConfig.points_multiplier_9_months
                  }
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    setRetentionConfig((prev: any) => ({
                      ...prev,
                      [loyaltyType === "cashback" 
                        ? "cashback_multiplier_9_months" 
                        : "points_multiplier_9_months"
                      ]: value
                    }));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  +{loyaltyType === "cashback" 
                    ? retentionConfig.cashback_multiplier_9_months 
                    : retentionConfig.points_multiplier_9_months
                  }% de bônus
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mult-12" className="text-xs font-normal">12 meses</Label>
                <Input
                  id="mult-12"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={loyaltyType === "cashback" 
                    ? retentionConfig.cashback_multiplier_12_months 
                    : retentionConfig.points_multiplier_12_months
                  }
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    setRetentionConfig((prev: any) => ({
                      ...prev,
                      [loyaltyType === "cashback" 
                        ? "cashback_multiplier_12_months" 
                        : "points_multiplier_12_months"
                      ]: value
                    }));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  +{loyaltyType === "cashback" 
                    ? retentionConfig.cashback_multiplier_12_months 
                    : retentionConfig.points_multiplier_12_months
                  }% de bônus
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
