import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Crown, Loader2 } from "lucide-react";

interface LevaOneSwitchProps {
  networkId: string | null;
}

export function LevaOneSwitch({ networkId }: LevaOneSwitchProps) {
  const [oneEnabled, setOneEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (networkId) {
      loadOneStatus();
    }
  }, [networkId]);

  const loadOneStatus = async () => {
    if (!networkId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("networks")
        .select("one_enabled")
        .eq("id", networkId)
        .single();

      if (error) throw error;
      setOneEnabled(data?.one_enabled ?? false);
    } catch (error: any) {
      console.error("Erro ao carregar status Leva+ One:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (enabled: boolean) => {
    if (!networkId) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("networks")
        .update({ one_enabled: enabled })
        .eq("id", networkId);

      if (error) throw error;

      setOneEnabled(enabled);
      toast({
        title: enabled ? "Leva+ One ativado!" : "Leva+ One desativado",
        description: enabled 
          ? "Seus clientes agora podem assinar o Leva+ One."
          : "O programa Leva+ One não será oferecido aos clientes.",
      });
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20">
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <CardTitle className="text-lg">Leva+ One</CardTitle>
            {oneEnabled && (
              <Badge variant="default" className="bg-yellow-500 text-white">
                Ativo
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            <Switch
              checked={oneEnabled}
              onCheckedChange={handleToggle}
              disabled={isSaving}
            />
          </div>
        </div>
        <CardDescription>
          Programa de assinatura premium para seus clientes com benefícios exclusivos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>• Clientes pagam R$ 9,90/mês para participar</p>
          <p>• Acesso a promoções exclusivas "Pague 1, Leve 2"</p>
          <p>• A rede recebe comissão por cada assinatura</p>
          <p>• Cartão digital exclusivo para membros</p>
        </div>
      </CardContent>
    </Card>
  );
}
