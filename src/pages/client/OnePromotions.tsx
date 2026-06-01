import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Star, ArrowLeft, Loader2, Calendar, Tag, MapPin, Info, Gift, Clock, Package, History, CreditCard } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function OnePromotions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [promotions, setPromotions] = useState<any[]>([]);
  const [filteredPromotions, setFilteredPromotions] = useState<any[]>([]);
  const [clientData, setClientData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<any>(null);
  const [isRedeemDialogOpen, setIsRedeemDialogOpen] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [locationFilter, setLocationFilter] = useState<'todos' | 'pista' | 'loja'>('todos');
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [networkOneEnabled, setNetworkOneEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Filtrar promoções quando o filtro de local mudar
  useEffect(() => {
    if (locationFilter === 'todos') {
      setFilteredPromotions(promotions);
    } else {
      setFilteredPromotions(
        promotions.filter(promo => 
          promo.location_type === locationFilter || promo.location_type === 'ambos'
        )
      );
    }
  }, [locationFilter, promotions]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('🔍 [OnePromotions] User ID:', user.id);

      // Buscar dados do cliente
      console.log('📞 [OnePromotions] Fetching clients...');
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*, networks!favorite_network_id(id, name, one_enabled)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);

      console.log('👤 [OnePromotions] Client data:', clients);
      console.log('❌ [OnePromotions] Client error:', clientsError);

      if (clients && clients.length > 0) {
        const client = clients[0];
        setClientData(client);
        
        // Verificar se a rede tem Leva+ One habilitado
        const oneEnabled = (client.networks as any)?.one_enabled ?? false;
        setNetworkOneEnabled(oneEnabled);

        // Carregar histórico de resgates
        const { data: redemptionsData } = await supabase
          .from('one_promotion_redemptions')
          .select(`
            *,
            one_promotions!inner(name, promotion_type, location_type),
            stores(id, name, address)
          `)
          .eq('client_id', client.id)
          .order('redeemed_at', { ascending: false });

        setRedemptions(redemptionsData || []);

        // Verificar se é membro ONE
        const { data: subscriptions } = await supabase
          .from('client_subscriptions_one')
          .select('*')
          .eq('client_id', client.id)
          .eq('status', 'active')
          .limit(1);

        const subscription = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null;

        console.log('⭐ [OnePromotions] Subscription:', subscription);
        console.log('🏢 [OnePromotions] Favorite network ID:', client.favorite_network_id);

        setIsMember(!!subscription);

        // Buscar promoções ONE
        let query = supabase
          .from('one_promotions')
          .select(`
            *,
            networks(id, name),
            one_promotion_stores(
              stores(id, name)
            ),
            one_promotion_products(
              product_code,
              product_name,
              quantity_required,
              is_reward
            )
          `)
          .eq('is_active', true)
          .gte('end_date', new Date().toISOString())
          .order('created_at', { ascending: false });

        // Se for membro, filtrar pela rede favorita
        if (subscription && client.favorite_network_id) {
          query = query.eq('network_id', client.favorite_network_id);
          console.log('🎯 [OnePromotions] Filtering by network:', client.favorite_network_id);
        }

        const { data: promos, error: promosError } = await query;
        
        console.log('🎁 [OnePromotions] Promotions query result:', { promos, promosError });
        console.log('🎁 [OnePromotions] Number of promotions:', promos?.length || 0);

        setPromotions(promos || []);
        setFilteredPromotions(promos || []);
      }
    } catch (error) {
      console.error('❌ [OnePromotions] Error loading promotions:', error);
      toast({
        title: "Erro ao carregar promoções",
        description: "Não foi possível carregar as promoções ONE.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handleRedeemClick = (promo: any) => {
    setSelectedPromotion(promo);
    setIsRedeemDialogOpen(true);
  };

  const handleRedeem = async () => {
    if (!selectedPromotion || !clientData) return;

    setIsRedeeming(true);
    try {
      // Validar se atingiu limite por cliente NO PERÍODO
      if (selectedPromotion.max_redemptions_per_client && selectedPromotion.redemption_period_type) {
        const now = new Date();
        let periodStart: Date;
        let periodEnd: Date;

        // Calcular o período baseado no tipo
        switch (selectedPromotion.redemption_period_type) {
          case 'per_day':
            periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            break;
          
          case 'per_week':
            const dayOfWeek = now.getDay();
            periodStart = new Date(now);
            periodStart.setDate(now.getDate() - dayOfWeek);
            periodStart.setHours(0, 0, 0, 0);
            periodEnd = new Date(periodStart);
            periodEnd.setDate(periodStart.getDate() + 6);
            periodEnd.setHours(23, 59, 59, 999);
            break;
          
          case 'per_month':
            periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
            periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            break;
          
          case 'per_custom_months':
            const months = selectedPromotion.redemption_period_months || 1;
            periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
            periodEnd = new Date(now.getFullYear(), now.getMonth() + months, 0, 23, 59, 59);
            break;
          
          default:
            periodStart = now;
            periodEnd = now;
        }

        // Buscar resgates do cliente nesta promoção NO PERÍODO ATUAL
        const { data: clientRedemptions } = await supabase
          .from('one_promotion_redemptions')
          .select('id')
          .eq('promotion_id', selectedPromotion.id)
          .eq('client_id', clientData.id)
          .gte('redeemed_at', periodStart.toISOString())
          .lte('redeemed_at', periodEnd.toISOString());

        if (clientRedemptions && clientRedemptions.length >= selectedPromotion.max_redemptions_per_client) {
          let periodLabel = '';
          switch (selectedPromotion.redemption_period_type) {
            case 'per_day':
              periodLabel = 'hoje';
              break;
            case 'per_week':
              periodLabel = 'esta semana';
              break;
            case 'per_month':
              periodLabel = 'este mês';
              break;
            case 'per_custom_months':
              periodLabel = `neste período de ${selectedPromotion.redemption_period_months} meses`;
              break;
          }

          toast({
            title: "Limite atingido",
            description: `Você já atingiu o limite de ${selectedPromotion.max_redemptions_per_client} resgates ${periodLabel}.`,
            variant: "destructive"
          });
          setIsRedeeming(false);
          return;
        }
      }

      // Validar se há unidades disponíveis
      if (selectedPromotion.max_redemptions && 
          selectedPromotion.current_redemptions >= selectedPromotion.max_redemptions) {
        toast({
          title: "Promoção esgotada",
          description: "Todas as unidades desta promoção já foram resgatadas.",
          variant: "destructive"
        });
        setIsRedeeming(false);
        return;
      }

      // Buscar o cartão ONE do cliente
      const { data: subscription } = await supabase
        .from('client_subscriptions_one')
        .select('id')
        .eq('client_id', clientData.id)
        .eq('status', 'active')
        .maybeSingle();

      // Gerar número do cartão ONE (formato: ONE-XXXXXX)
      const cardNumber = subscription ? `ONE-${clientData.codigo?.replace('CLI-', '') || clientData.id.slice(0, 6).toUpperCase()}` : 'N/A';
      
      // Pegar primeiro nome do cliente
      const firstName = clientData.full_name.split(' ')[0];

      // Pegar a primeira loja participante da promoção
      const firstStore = selectedPromotion.one_promotion_stores?.[0]?.stores?.id;
      
      // Calcular benefício real baseado no tipo de promoção
      let benefitValue = 0;
      
      if (selectedPromotion.promotion_type === 'buy_x_get_y') {
        // Para "Pague X Leve Y", o benefício é o valor dos produtos grátis
        const products = selectedPromotion.one_promotion_products || [];
        const quantity_to_get = selectedPromotion.quantity_to_get || 0;
        
        // Somar valor dos produtos que o cliente ganha de graça
        products.slice(0, quantity_to_get).forEach((product: any) => {
          benefitValue += parseFloat(product.product_value || 0);
        });
      } else if (selectedPromotion.promotion_type === 'discount_percentage') {
        // Para desconto percentual, calcular baseado no valor do produto
        const products = selectedPromotion.one_promotion_products || [];
        const discountPercentage = selectedPromotion.discount_percentage || 0;
        
        products.forEach((product: any) => {
          const productValue = parseFloat(product.product_value || 0);
          benefitValue += (productValue * discountPercentage / 100);
        });
      } else if (selectedPromotion.promotion_type === 'combo_price') {
        // Para combo, o benefício é a diferença entre preço normal e combo
        const products = selectedPromotion.one_promotion_products || [];
        const comboPrice = selectedPromotion.combo_price || 0;
        
        const totalOriginalPrice = products.reduce((sum: number, product: any) => {
          return sum + parseFloat(product.product_value || 0);
        }, 0);
        
        benefitValue = totalOriginalPrice - comboPrice;
      }
      
      // Preparar metadata com informações completas
      const redemptionMetadata = {
        promotion_type: selectedPromotion.promotion_type,
        promotion_name: selectedPromotion.name,
        products: selectedPromotion.one_promotion_products,
        client_name: clientData.full_name,
        client_first_name: firstName,
        card_number: cardNumber,
        redemption_instructions: 'Responsável da venda: Solicitar ao cliente que mostre o cartão para check do nome + número do cartão.'
      };

      // Criar descrição formatada para o extrato
      const description = `🎁 Promoção ${selectedPromotion.name} - Resgatado com sucesso Sr(a). ${firstName} - Cartão: ${cardNumber}`;
      
      // Registrar resgate
      const { error } = await supabase
        .from('one_promotion_redemptions')
        .insert({
          promotion_id: selectedPromotion.id,
          client_id: clientData.id,
          store_id: firstStore || null,
          benefit_value: benefitValue,
          metadata: redemptionMetadata,
          status: 'solicitado'
        });

      if (error) throw error;

      toast({
        title: `Promoção ${selectedPromotion.name}`,
        description: `Resgatado com sucesso Sr(a). ${firstName}!\nCartão: ${cardNumber}\n\nApresente este código na loja.`
      });

      setIsRedeemDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error redeeming promotion:', error);
      toast({
        title: "Erro ao resgatar",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { label: string; variant: any } } = {
      'solicitado': { label: 'Solicitado', variant: 'outline' },
      'resgatado': { label: 'Resgatado', variant: 'default' },
      'cancelado': { label: 'Cancelado', variant: 'destructive' }
    };
    const config = statusConfig[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatHistoryDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  // Verificar se a rede não tem Leva+ One habilitado
  if (networkOneEnabled === false) {
    return (
      <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/levacliente')}
            className="mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold">Promoções Exclusivas</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Leva+ One</p>
            </div>
          </div>
        </div>
        <Card className="p-6">
          <div className="text-center space-y-4">
            <Info className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="text-xl font-bold">Leva+ One não disponível</h3>
            <p className="text-muted-foreground">
              A rede {(clientData?.networks as any)?.name || 'selecionada'} não oferece o programa Leva+ One no momento.
            </p>
            <Button onClick={() => navigate('/levacliente')}>Voltar para Início</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/levacliente')}
          className="mt-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold">Promoções Exclusivas</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Leva+ One</p>
          </div>
          {isMember && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsHistoryDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </Button>
          )}
        </div>
      </div>

      {!isMember && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <Info className="h-4 w-4 text-yellow-600 flex-shrink-0" />
          <AlertDescription className="text-yellow-800">
            <div className="space-y-2">
              <p className="text-sm">
                <strong>Assine o Leva+ One</strong> para ter acesso exclusivo a essas promoções especiais!
              </p>
              <Button 
                variant="outline" 
                size="sm"
                className="text-yellow-700 border-yellow-500 hover:bg-yellow-500/20 w-full sm:w-auto"
                onClick={() => navigate('/levacliente/meu-cartao')}
              >
                Assinar agora
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {isMember && promotions.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Não há promoções disponíveis no momento, mas em breve teremos novidades para você!
          </AlertDescription>
        </Alert>
      )}

      {/* Filtros de Localização */}
      {isMember && promotions.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Badge 
            variant={locationFilter === 'todos' ? 'default' : 'outline'} 
            className="cursor-pointer"
            onClick={() => setLocationFilter('todos')}
          >
            Todas
          </Badge>
          <Badge 
            variant={locationFilter === 'pista' ? 'default' : 'outline'} 
            className="cursor-pointer"
            onClick={() => setLocationFilter('pista')}
          >
            🚗 Pista
          </Badge>
          <Badge 
            variant={locationFilter === 'loja' ? 'default' : 'outline'} 
            className="cursor-pointer"
            onClick={() => setLocationFilter('loja')}
          >
            🏪 Loja
          </Badge>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPromotions.map((promo) => (
          <Card key={promo.id} className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 p-3 sm:p-4 text-white">
              <div className="flex items-center justify-between mb-1">
                <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                  {promo.promotion_type === 'percentage' ? 'Desconto' : 
                   promo.promotion_type === 'buy_x_get_y' ? 'Leve + Pague -' : 
                   'Combo'}
                </Badge>
                <Star className="h-4 w-4 fill-white" />
              </div>
              <h3 className="text-base sm:text-lg font-bold line-clamp-2">{promo.name}</h3>
            </div>

            <div className="p-3 sm:p-4 space-y-2 flex-1 flex flex-col">
              {promo.description && (
                <p className="text-xs text-muted-foreground">{promo.description}</p>
              )}

              <div className="space-y-2">
                {promo.promotion_type === 'percentage' && promo.discount_percentage && (
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" />
                    <span className="text-xl font-bold text-primary">
                      {promo.discount_percentage}% OFF
                    </span>
                  </div>
                )}

                {promo.promotion_type === 'combo' && promo.combo_price && (
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" />
                    <span className="text-base font-bold text-primary">
                      Por R$ {promo.combo_price.toFixed(2)}
                    </span>
                  </div>
                )}

                {promo.one_promotion_products && promo.one_promotion_products.length > 0 && (
                  <div className="border rounded-lg p-2 bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="h-3 w-3 text-primary" />
                      <span className="text-xs font-medium">Produtos:</span>
                    </div>
                    <ul className="space-y-0.5 text-xs">
                      {promo.one_promotion_products.slice(0, 3).map((product: any, idx: number) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span>{product.product_name || 'Produto'}</span>
                          {product.is_reward && <Badge variant="secondary" className="text-xs py-0">Brinde</Badge>}
                        </li>
                      ))}
                      {promo.one_promotion_products.length > 3 && (
                        <li className="text-primary">+ {promo.one_promotion_products.length - 3} produtos</li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>Válido até {formatDate(promo.end_date)}</span>
                      {promo.start_time && promo.end_time && (
                        <>
                          <span>•</span>
                          <Clock className="h-3 w-3" />
                          <span>{promo.start_time} - {promo.end_time}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground italic">
                  * Enquanto durarem os estoques
                </p>
              </div>

              {isMember && (
                <Button 
                  className="w-full mt-auto"
                  onClick={() => handleRedeemClick(promo)}
                  size="sm"
                >
                  Resgatar
                </Button>
              )}

              {!isMember && (
                <div className="pt-2 border-t">
                  <Badge variant="outline" className="text-yellow-600 border-yellow-500 text-xs">
                    Exclusivo Membros ONE
                  </Badge>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Dialog de Resgate */}
      <Dialog open={isRedeemDialogOpen} onOpenChange={setIsRedeemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resgatar Promoção</DialogTitle>
            <DialogDescription>
              Confirme o resgate desta promoção exclusiva
            </DialogDescription>
          </DialogHeader>

          {selectedPromotion && (
            <div className="space-y-4 py-4">
              <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 p-4 rounded-lg text-white">
                <h3 className="text-xl font-bold mb-2">{selectedPromotion.name}</h3>
                <p className="text-sm opacity-90">{selectedPromotion.description}</p>
              </div>

              <div className="space-y-2 text-sm">
                <p><strong>Válido até:</strong> {formatDate(selectedPromotion.end_date)}</p>
                {selectedPromotion.start_time && (
                  <p><strong>Horário:</strong> {selectedPromotion.start_time} - {selectedPromotion.end_time}</p>
                )}
                {selectedPromotion.max_redemptions_per_client && (
                  <p><strong>Limite por cliente:</strong> {selectedPromotion.max_redemptions_per_client} resgates</p>
                )}
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Após resgatar, apresente esta promoção na sua loja favorita para aproveitar o benefício.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRedeemDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRedeem} disabled={isRedeeming}>
              {isRedeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar Resgate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Histórico */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-yellow-500" />
              Histórico de Resgates
            </DialogTitle>
            <DialogDescription>
              Acompanhe todos os seus resgates de promoções ONE
            </DialogDescription>
          </DialogHeader>

          {redemptions.length === 0 ? (
            <div className="py-8 text-center">
              <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">Nenhum resgate ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {redemptions.map((redemption) => (
                <Card key={redemption.id} className="overflow-hidden">
                  <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 p-3 text-white">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm sm:text-base truncate">
                          {redemption.metadata?.promotion_name || redemption.one_promotions?.name}
                        </h4>
                        <p className="text-xs opacity-90 mt-1">
                          {formatHistoryDate(redemption.redeemed_at)}
                        </p>
                      </div>
                      {getStatusBadge(redemption.status)}
                    </div>
                  </div>

                  <div className="p-3 space-y-2 text-sm">
                    {redemption.metadata?.card_number && (
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span className="font-medium">Cartão:</span>
                        <Badge variant="secondary" className="text-xs">{redemption.metadata.card_number}</Badge>
                      </div>
                    )}

                    {redemption.stores && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium text-xs">{redemption.stores.name}</span>
                          {redemption.stores.address && (
                            <p className="text-muted-foreground text-xs truncate">{redemption.stores.address}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {redemption.metadata?.products && redemption.metadata.products.length > 0 && (
                      <div className="border rounded p-2 bg-muted/30">
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="h-3 w-3 text-primary" />
                          <span className="text-xs font-medium">Produtos:</span>
                        </div>
                        <ul className="space-y-1 text-xs">
                          {redemption.metadata.products.slice(0, 2).map((product: any, idx: number) => (
                            <li key={idx} className="flex items-center gap-2">
                              <span className="truncate">• {product.product_name}</span>
                              {product.is_reward && <Badge variant="secondary" className="text-[10px] py-0">Brinde</Badge>}
                            </li>
                          ))}
                          {redemption.metadata.products.length > 2 && (
                            <li className="text-primary text-xs">+ {redemption.metadata.products.length - 2} produtos</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {isMember && promotions.length > 0 && (
        <Alert className="bg-primary/5 border-primary/20">
          <Star className="h-4 w-4 text-primary fill-primary" />
          <AlertDescription>
            Como membro Leva+ One, você tem acesso exclusivo a essas promoções!
            Apresente seu cartão ONE na loja para aproveitar.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
