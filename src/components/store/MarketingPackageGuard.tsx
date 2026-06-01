import { useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, MessageSquare, MessageCircle, Phone } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";

interface MarketingPackageGuardProps {
  packageType: "email" | "whatsapp" | "sms";
  children: ReactNode;
}

export function MarketingPackageGuard({ packageType, children }: MarketingPackageGuardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [limit, setLimit] = useState(0);
  const [used, setUsed] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    loadPackageData();
  }, [packageType]);

  const loadPackageData = async () => {
    try {
      // Buscar usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar store_manager para pegar network_id
      const { data: managerData, error: managerError } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (managerError) throw managerError;

      // Buscar dados da network
      const limitField = `${packageType}_marketing_limit`;
      const usedField = `${packageType}_marketing_used`;

      const { data: networkData, error: networkError } = await supabase
        .from("networks")
        .select(`${limitField}, ${usedField}`)
        .eq("id", managerData.network_id)
        .single();

      if (networkError) throw networkError;

      setLimit(networkData?.[limitField] || 0);
      setUsed(networkData?.[usedField] || 0);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados do pacote",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = () => {
    switch (packageType) {
      case "email":
        return Mail;
      case "whatsapp":
        return MessageSquare;
      case "sms":
        return MessageCircle;
    }
  };

  const getTypeName = () => {
    switch (packageType) {
      case "email":
        return "E-mail";
      case "whatsapp":
        return "WhatsApp";
      case "sms":
        return "SMS";
    }
  };

  const Icon = getIcon();
  const typeName = getTypeName();
  const percentage = limit > 0 ? (used / limit) * 100 : 0;
  const remaining = limit - used;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Se não tem pacote contratado, exibir tela de bloqueio
  if (limit === 0) {
    return (
      <Card className="max-w-2xl mx-auto mt-8">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle>Pacote de {typeName} não contratado</CardTitle>
          <CardDescription>
            Para utilizar esta funcionalidade, é necessário contratar um pacote de marketing
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Entre em contato com seu gerente de vendas para adicionar um pacote de {typeName} à sua licença.
          </p>
          <Button variant="outline">
            <Phone className="h-4 w-4 mr-2" />
            Falar com gerente
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Se tem pacote, exibir banner de consumo + conteúdo
  return (
    <div className="space-y-6">
      <Alert>
        <Icon className="h-4 w-4" />
        <AlertTitle className="flex items-center justify-between">
          <span>Pacote de {typeName}</span>
          <Badge variant={percentage >= 90 ? "destructive" : percentage >= 70 ? "secondary" : "default"}>
            {used} / {limit} usados
          </Badge>
        </AlertTitle>
        <AlertDescription className="space-y-2">
          <Progress value={percentage} className="h-2 mt-2" />
          <p className="text-xs mt-2">
            {remaining > 0 ? `${remaining} créditos disponíveis` : "Limite de créditos atingido"}
          </p>
        </AlertDescription>
      </Alert>
      {children}
    </div>
  );
}
