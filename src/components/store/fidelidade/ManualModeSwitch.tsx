import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Keyboard, AlertTriangle, Package } from "lucide-react";

interface ManualModeSwitchProps {
  networkId: string | null;
}

export function ManualModeSwitch({ networkId }: ManualModeSwitchProps) {
  const [isManualMode, setIsManualMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (networkId) {
      loadManualMode();
    }
  }, [networkId]);

  const loadManualMode = async () => {
    if (!networkId) return;
    
    setIsLoading(true);
    try {
      const { data: store, error } = await supabase
        .from("stores")
        .select("is_manual_mode")
        .eq("network_id", networkId)
        .limit(1)
        .single();

      if (error) throw error;
      setIsManualMode(store?.is_manual_mode || false);
    } catch (error) {
      console.error("Erro ao carregar modo manual:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (checked: boolean) => {
    if (!networkId) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update({ is_manual_mode: checked })
        .eq("network_id", networkId);

      if (error) throw error;

      setIsManualMode(checked);
      toast({
        title: checked ? "Modo Manual Ativado" : "Modo Manual Desativado",
        description: checked 
          ? "Agora você pode fazer lançamentos manuais e cadastrar produtos."
          : "Os lançamentos serão feitos apenas via integração.",
      });
    } catch (error: any) {
      console.error("Erro ao alterar modo:", error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-2 transition-colors ${isManualMode ? 'border-amber-500/50 bg-amber-500/5' : 'border-muted'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isManualMode ? 'bg-amber-500/20' : 'bg-muted'}`}>
              <Keyboard className={`h-5 w-5 ${isManualMode ? 'text-amber-500' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Leva+ Manual
                {isManualMode && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
                    Ativo
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Lançamentos de pontuação e resgate sem integração
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            <Switch
              checked={isManualMode}
              onCheckedChange={handleToggle}
              disabled={isSaving}
            />
          </div>
        </div>
      </CardHeader>
      
      {isManualMode && (
        <CardContent className="pt-0 space-y-3">
          <Alert className="border-amber-500/30 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-sm">
              <strong>Modo Manual ativo:</strong> Os lançamentos serão feitos através do{" "}
              <strong>Portal de Lançamentos</strong> pelos funcionários cadastrados como atendentes.
            </AlertDescription>
          </Alert>
          
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Package className="h-4 w-4" />
              <span>Cadastro de Produtos disponível em Configurações</span>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
