import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Star, Gift, Clock, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Promotion {
  id: string;
  name: string;
  description: string;
  promotion_type: string;
  benefit_value?: number | null;
  benefit_type?: string | null;
  start_date: string;
  end_date: string;
  max_redemptions: number | null;
  current_redemptions: number;
  is_active: boolean;
  one_promotion_products: Array<{
    product_name: string;
  }>;
  one_promotion_stores: Array<{
    store_id: string;
  }>;
}

export default function OneMarketplace() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [clientData, setClientData] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadClientData();
  }, []);

  const loadClientData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/cliente/login");
        return;
      }

      // Buscar dados do cliente
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select(`
          *,
          profiles(full_name),
          client_subscriptions_one(
            id,
            status,
            subscription_status,
            current_period_end
          )
        `)
        .eq("user_id", user.id)
        .single();

      if (clientError) throw clientError;

      setClientData(client);
      
      const activeSubscription = client.client_subscriptions_one?.find(
        (sub: any) => sub.status === 'active' && sub.subscription_status === 'ACTIVE'
      );
      
      setSubscription(activeSubscription);

      if (activeSubscription) {
        await loadPromotions(client.favorite_network_id);
      } else {
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar seus dados.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const loadPromotions = async (networkId: string) => {
    try {
      const { data, error } = await supabase
        .from("one_promotions")
        .select(`
          *,
          one_promotion_products(product_name),
          one_promotion_stores(store_id)
        `)
        .eq("network_id", networkId)
        .eq("is_active", true)
        .gte("end_date", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Cast explícito para evitar erro de tipo
      setPromotions(data as any || []);
    } catch (error: any) {
      console.error("Erro ao carregar promoções:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as promoções.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedeemClick = (promotion: Promotion) => {
    setSelectedPromotion(promotion);
    setIsDialogOpen(true);
  };

  const handleConfirmRedeem = async () => {
    if (!selectedPromotion || !clientData) return;

    setIsRedeeming(true);
    try {
      // Verificar se já atingiu o limite de resgates
      const { data: redemptions, error: checkError } = await supabase
        .from("one_promotion_redemptions")
        .select("id")
        .eq("promotion_id", selectedPromotion.id)
        .eq("client_id", clientData.id);

      if (checkError) throw checkError;

      if (selectedPromotion.max_redemptions && redemptions.length >= selectedPromotion.max_redemptions) {
        toast({
          title: "Limite atingido",
          description: "Você já resgatou esta promoção o número máximo de vezes.",
          variant: "destructive",
        });
        setIsDialogOpen(false);
        setIsRedeeming(false);
        return;
      }

      // Registrar resgate
      const { error: redeemError } = await supabase
        .from("one_promotion_redemptions")
        .insert({
          promotion_id: selectedPromotion.id,
          client_id: clientData.id,
          benefit_value: selectedPromotion.benefit_value,
          metadata: {
            promotion_name: selectedPromotion.name,
            benefit_type: selectedPromotion.benefit_type,
          },
        });

      if (redeemError) throw redeemError;

      toast({
        title: "Promoção resgatada!",
        description: "Apresente este cupom na loja para aproveitar o benefício.",
      });

      setIsDialogOpen(false);
      await loadPromotions(clientData.favorite_network_id);
    } catch (error: any) {
      console.error("Erro ao resgatar promoção:", error);
      toast({
        title: "Erro",
        description: "Não foi possível resgatar a promoção.",
        variant: "destructive",
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  const getBenefitText = (promotion: Promotion) => {
    if (!promotion.benefit_value || !promotion.benefit_type) {
      return "Benefício especial";
    }
    if (promotion.benefit_type === "percentage") {
      return `${promotion.benefit_value}% de desconto`;
    } else if (promotion.benefit_type === "fixed") {
      return `R$ ${promotion.benefit_value.toFixed(2)} de desconto`;
    } else if (promotion.benefit_type === "bonus_points") {
      return `${promotion.benefit_value} pontos bônus`;
    }
    return "Benefício especial";
  };

  const getPromotionTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      discount: "Desconto",
      cashback: "Cashback",
      bonus_points: "Pontos Bônus",
      free_product: "Produto Grátis",
      special_price: "Preço Especial",
    };
    return types[type] || type;
  };

  const isPromotionAvailable = (promotion: Promotion) => {
    if (!promotion.max_redemptions) return true;
    return promotion.current_redemptions < promotion.max_redemptions;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketplace ONE</h1>
          <p className="text-muted-foreground mt-1">
            Ofertas exclusivas para membros Leva+ One
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketplace ONE</h1>
          <p className="text-muted-foreground mt-1">
            Ofertas exclusivas para membros Leva+ One
          </p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Você precisa ser membro Leva+ One para acessar as promoções exclusivas.
            <Button 
              className="ml-4" 
              onClick={() => navigate("/cliente/meu-cartao-one")}
            >
              Assinar Agora
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-yellow-500" />
            Marketplace ONE
          </h1>
          <p className="text-muted-foreground mt-1">
            Ofertas exclusivas para membros Leva+ One
          </p>
        </div>
        <Badge className="bg-yellow-500 hover:bg-yellow-600">
          <Star className="h-4 w-4 mr-1" />
          Membro Ativo
        </Badge>
      </div>

      {promotions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Gift className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Nenhuma promoção disponível no momento
              </h3>
              <p className="text-muted-foreground">
                Novas ofertas exclusivas estarão disponíveis em breve!
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {promotions.map((promotion) => (
            <Card key={promotion.id} className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-yellow-500/20 to-transparent" />
              
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-xl">{promotion.name}</CardTitle>
                  <Badge variant="secondary">
                    {getPromotionTypeLabel(promotion.promotion_type)}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2">
                  {promotion.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-2xl font-bold text-primary">
                  <Gift className="h-6 w-6" />
                  {getBenefitText(promotion)}
                </div>

                {promotion.one_promotion_products && promotion.one_promotion_products.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Produtos incluídos:</p>
                    <div className="flex flex-wrap gap-1">
                      {promotion.one_promotion_products.map((product, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {product.product_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Válido até {new Date(promotion.end_date).toLocaleDateString("pt-BR")}
                </div>

                {promotion.max_redemptions && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Disponível:</span>
                    <Badge variant={isPromotionAvailable(promotion) ? "default" : "destructive"}>
                      {promotion.max_redemptions - promotion.current_redemptions} restantes
                    </Badge>
                  </div>
                )}
              </CardContent>

              <CardFooter>
                <Button 
                  className="w-full"
                  onClick={() => handleRedeemClick(promotion)}
                  disabled={!isPromotionAvailable(promotion)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {isPromotionAvailable(promotion) ? "Resgatar Oferta" : "Esgotado"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Resgate</DialogTitle>
            <DialogDescription>
              Você está prestes a resgatar esta oferta exclusiva
            </DialogDescription>
          </DialogHeader>

          {selectedPromotion && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{selectedPromotion.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Benefício:</span>
                    <span className="font-bold text-primary">
                      {getBenefitText(selectedPromotion)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tipo:</span>
                    <Badge variant="secondary">
                      {getPromotionTypeLabel(selectedPromotion.promotion_type)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Válido até:</span>
                    <span className="text-sm">
                      {new Date(selectedPromotion.end_date).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Após resgatar, apresente este cupom na loja para aproveitar o benefício.
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isRedeeming}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleConfirmRedeem}
                  disabled={isRedeeming}
                >
                  {isRedeeming ? "Resgatando..." : "Confirmar Resgate"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
