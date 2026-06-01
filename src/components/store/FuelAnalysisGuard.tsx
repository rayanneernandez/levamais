import { useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Fuel, Phone } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";

interface FuelAnalysisGuardProps {
  children: ReactNode;
}

export function FuelAnalysisGuard({ children }: FuelAnalysisGuardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadFuelAnalysisData();
  }, []);

  const loadFuelAnalysisData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: managerData, error: managerError } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (managerError) throw managerError;

      const { data: networkData, error: networkError } = await supabase
        .from("networks")
        .select("fuel_analysis_enabled")
        .eq("id", managerData.network_id)
        .single();

      if (networkError) throw networkError;

      setIsEnabled(networkData?.fuel_analysis_enabled || false);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados do módulo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isEnabled) {
    return (
      <Card className="max-w-2xl mx-auto mt-8">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Fuel className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle>Módulo de Análise de Combustível não contratado</CardTitle>
          <CardDescription>
            Para utilizar esta funcionalidade, é necessário contratar o módulo de análise de combustível
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Entre em contato com seu gerente de vendas para adicionar o módulo de Análise de Combustível à sua licença.
          </p>
          <p className="text-sm text-muted-foreground">
            Com este módulo você terá acesso a dados da ANP sobre preços de combustível na sua região, permitindo análises estratégicas de mercado.
          </p>
          <Button variant="outline">
            <Phone className="h-4 w-4 mr-2" />
            Falar com gerente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
