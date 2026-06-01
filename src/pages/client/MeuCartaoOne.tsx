import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Star, 
  CreditCard, 
  Calendar, 
  Loader2, 
  Info, 
  ArrowLeft, 
  Download,
  Sparkles,
  Gift,
  TrendingUp,
  Users,
  Award,
  Check,
  Shield,
  Lock
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CreditCardForm, { CreditCardFormData } from "@/components/client/CreditCardForm";
import { CancelSubscriptionDialog } from "@/components/client/CancelSubscriptionDialog";
import { InstallPWADialog } from "@/components/client/InstallPWADialog";
import { SavedCardDisplay } from "@/components/client/SavedCardDisplay";
import { UpdateCardDialog } from "@/components/client/UpdateCardDialog";
import { SubscriptionSuccessDialog } from "@/components/client/SubscriptionSuccessDialog";

export default function MeuCartaoOne() {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const [clientData, setClientData] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [subscriptionSuccessData, setSubscriptionSuccessData] = useState<any>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showUpdateCardDialog, setShowUpdateCardDialog] = useState(false);
  const [charges, setCharges] = useState<any[]>([]);
  const [cardRotation, setCardRotation] = useState({ x: 0, y: 0 });
  const [commissionConfig, setCommissionConfig] = useState<any>(null);
  const [networkOneEnabled, setNetworkOneEnabled] = useState<boolean | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    console.log('Client Data:', clientData);
    console.log('Subscription:', subscription);
  }, [clientData, subscription]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar dados do cliente (pegar o primeiro/mais antigo)
      const { data: clients, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);

      console.log('Client query result:', clients, clientError);

      if (clients && clients.length > 0) {
        let clientWithNetwork: any = clients[0];
        
        // Buscar rede favorita separadamente (incluindo one_enabled)
        if (clientWithNetwork.favorite_network_id) {
          const { data: network } = await supabase
            .from('networks')
            .select('id, name, one_enabled')
            .eq('id', clientWithNetwork.favorite_network_id)
            .single();
          
          clientWithNetwork = {
            ...clientWithNetwork,
            favorite_network: network
          };
          
          setNetworkOneEnabled(network?.one_enabled ?? false);
        } else {
          setNetworkOneEnabled(false);
        }

        setClientData(clientWithNetwork);
        console.log('Client with network:', clientWithNetwork);

        // Buscar número do cartão ONE se for membro
        let cardNumber = null;
        if (clientWithNetwork.is_one_member) {
          const { data: cardData } = await supabase
            .from('one_card_numbers')
            .select('card_number')
            .eq('client_id', clientWithNetwork.id)
            .maybeSingle();
          
          if (cardData) {
            cardNumber = cardData.card_number;
          } else {
            // Se não tiver cartão, gerar
            const { data: generatedCard } = await supabase.functions.invoke('generate-one-card-number', {
              body: { clientId: clientWithNetwork.id }
            });
            
            if (generatedCard?.cardNumber) {
              cardNumber = generatedCard.cardNumber;
            }
          }
          
          setClientData({ ...clientWithNetwork, one_card_number: cardNumber });
        }

        // Buscar configuração de comissão da rede
        if (clientWithNetwork.favorite_network_id) {
          const { data: config } = await supabase
            .from('network_one_commission_config')
            .select('*')
            .eq('network_id', clientWithNetwork.favorite_network_id)
            .maybeSingle();
          
          setCommissionConfig(config);
        }

        // Buscar assinatura ONE
        const { data: sub } = await supabase
          .from('client_subscriptions_one')
          .select('*')
          .eq('client_id', clientWithNetwork.id)
          .in('status', ['active', 'pending'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        console.log('Subscription loaded:', sub);
        setSubscription(sub);

        // Buscar cobranças se tiver assinatura
        if (sub) {
          const { data: chargesData } = await supabase
            .from('asaas_charges')
            .select('*')
            .eq('subscription_id', sub.id)
            .order('due_date', { ascending: false });
          
          console.log('Charges loaded:', chargesData);
          setCharges(chargesData || []);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = () => {
    console.log('🎯 handleSubscribe chamado!');
    console.log('Cliente data:', clientData);
    console.log('Rede favorita:', clientData?.favorite_network_id);
    
    if (!clientData?.favorite_network_id) {
      console.log('❌ Rede não selecionada');
      toast({
        title: "Rede não selecionada",
        description: "Por favor, selecione sua rede favorita antes de assinar.",
        variant: "destructive"
      });
      return;
    }

    console.log('✅ Abrindo formulário de pagamento');
    setShowPaymentDialog(true);
  };

  const handleCreditCardSubmit = async (cardData: CreditCardFormData) => {
    setIsSubscribing(true);
    try {
      console.log('📤 Iniciando processo de assinatura...');
      console.log('Cliente ID:', clientData.id);
      console.log('Rede ID:', clientData.favorite_network_id);

      if (!clientData.favorite_network_id) {
        throw new Error('Nenhuma rede favorita selecionada');
      }

      // Estruturar dados no formato que a edge function espera
      const subscriptionData = {
        client_id: clientData.id,
        network_id: clientData.favorite_network_id,
        card: {
          holderName: cardData.holderName,
          number: cardData.number,
          expiryMonth: cardData.expiryMonth,
          expiryYear: cardData.expiryYear,
          ccv: cardData.ccv
        },
        address: {
          postalCode: cardData.postalCode,
          addressNumber: cardData.addressNumber,
          complement: '',
          street: cardData.address,
          province: cardData.province,
          city: cardData.city,
          state: cardData.state
        }
      };

      console.log('📦 Enviando dados estruturados');

      const { data, error } = await supabase.functions.invoke('create-one-credit-card-subscription', {
        body: subscriptionData
      });

      console.log('📥 Resposta da edge function:', { data, error });

      if (error) {
        console.error('❌ Erro ao chamar edge function:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao processar assinatura');
      }

      console.log('✅ Assinatura criada com sucesso:', data);

      // Preparar dados para o dialog de sucesso
      setSubscriptionSuccessData({
        monthlyValue: data.subscription?.monthly_value || 9.90,
        startDate: data.subscription?.start_date || new Date().toISOString(),
        cardLastDigits: data.subscription?.card_last_digits || cardData.number.slice(-4),
        nextChargeDate: data.first_charge?.due_date,
      });

      setShowPaymentDialog(false);
      setShowSuccessDialog(true);
      
      // Recarregar dados após 2 segundos
      setTimeout(() => {
        loadData();
      }, 2000);
    } catch (error: any) {
      console.error('❌ Erro completo ao assinar:', error);
      toast({
        title: "Erro ao processar pagamento",
        description: error.message || "Não foi possível processar sua assinatura. Verifique os dados do cartão e tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;

    try {
      const { error } = await supabase.functions.invoke('cancel-one-subscription', {
        body: { subscription_id: subscription.id }
      });

      if (error) throw error;

      // Atualizar flag is_one_member no registro do cliente
      const { error: updateError } = await supabase
        .from('clients')
        .update({ is_one_member: false })
        .eq('id', clientData.id);

      if (updateError) throw updateError;

      toast({
        title: "😢 Assinatura cancelada",
        description: "Sua assinatura foi cancelada. Você sempre será bem-vindo de volta!"
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao cancelar",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    }
  };

  const getDaysUntilCancel = () => {
    if (!subscription?.start_date) return 0;
    const startDate = new Date(subscription.start_date);
    const twelveMonthsLater = new Date(startDate);
    twelveMonthsLater.setMonth(twelveMonthsLater.getMonth() + 12);
    const now = new Date();
    const daysRemaining = Math.ceil((twelveMonthsLater.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysRemaining > 0 ? daysRemaining : 0;
  };

  const handleExportCard = async () => {
    if (!cardRef.current) return;

    setIsExporting(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        logging: false,
      });

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `cartao-leva-${clientData?.codigo || 'cliente'}.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);

          toast({
            title: "Cartão exportado!",
            description: "Seu cartão foi baixado com sucesso."
          });
        }
      });
    } catch (error) {
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível exportar o cartão.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = (y - centerY) / 20;
    const rotateY = (centerX - x) / 20;
    
    setCardRotation({ x: rotateX, y: rotateY });
  };

  const handleCardMouseLeave = () => {
    setCardRotation({ x: 0, y: 0 });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasActiveSubscription = subscription?.status === 'active';

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
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
          <CreditCard className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">
              {hasActiveSubscription ? 'Meu Cartão Leva+ One' : 'Meu Cartão'}
            </h1>
            <p className="text-muted-foreground">
              {hasActiveSubscription ? 'Seu cartão de membro premium' : 'Seu cartão de fidelidade'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleExportCard}
          disabled={isExporting || !clientData}
          className="mt-1"
          title="Baixar cartão"
        >
          {isExporting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Download className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Cartão Simples (Sem assinatura) */}
      {!hasActiveSubscription && (
        <Card ref={cardRef} className="relative overflow-hidden bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 p-8 shadow-xl animate-fade-in">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xl font-bold text-gray-800">Leva+</p>
              </div>
              <CreditCard className="h-8 w-8 text-gray-600" />
            </div>

            {/* Chip do Cartão */}
            <div className="w-12 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-md opacity-80" />

            {/* Número do Cartão */}
            <div className="font-mono text-xl tracking-widest text-gray-800">
              {clientData?.codigo ? 
                clientData.codigo.replace(/CLI-/g, '').padStart(16, '0').replace(/(.{4})/g, '$1 ').trim() : 
                '0000 0000 0000 0000'
              }
            </div>

            {/* Nome do Cliente */}
            <div>
              <p className="text-xs text-gray-600 mb-1">Nome do Titular</p>
              <p className="text-lg font-bold tracking-wider uppercase text-gray-800">
                {clientData?.full_name || 'CLIENTE'}
              </p>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-gray-600">Membro desde</p>
                <p className="font-semibold text-gray-800">
                  {clientData?.created_at 
                    ? new Date(clientData.created_at).toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' })
                    : '--/--'
                  }
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-600">Rede Favorita</p>
                <p className="font-semibold text-gray-800">{clientData?.favorite_network?.name || 'Não definida'}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Cartão ONE Premium Black (Com assinatura ativa) */}
      {hasActiveSubscription && (
        <div 
          className="perspective-1000"
          onMouseMove={handleCardMouseMove}
          onMouseLeave={handleCardMouseLeave}
        >
          <Card 
            ref={cardRef} 
            key={subscription?.id} 
            className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-black p-8 text-white shadow-2xl animate-scale-in transition-transform duration-300 ease-out"
            style={{
              transform: `rotateX(${cardRotation.x}deg) rotateY(${cardRotation.y}deg)`,
              transformStyle: 'preserve-3d'
            }}
          >
            {/* Efeito de brilho base */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent" />
            
            {/* Efeito de brilho animado - piano preto */}
            <div 
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              style={{
                backgroundSize: '200% 100%',
                animation: 'shine 15s ease-in-out infinite'
              }}
            />
            
            <style>{`
              .perspective-1000 {
                perspective: 1000px;
              }
              @keyframes shine {
                0% {
                  background-position: -200% 0;
                }
                100% {
                  background-position: 200% 0;
                }
              }
            `}</style>
          
          <div className="relative z-10 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-light text-gray-400">Leva+ One</p>
                <p className="text-xs text-yellow-500 italic mt-1">Você é único. Você é One.</p>
              </div>
            </div>

            {/* Chip do Cartão */}
            <div className="w-12 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-md" />

            {/* Número do Cartão */}
            <div className="font-mono text-xl tracking-widest">
              {clientData?.one_card_number ? 
                clientData.one_card_number.replace(/(\d{4})(?=\d)/g, '$1 ').trim() : 
                '0000 0000 0000 0000'
              }
            </div>

            {/* Nome do Cliente */}
            <div>
              <p className="text-xs text-gray-400 mb-1">Nome do Titular</p>
              <p className="text-2xl font-bold tracking-wider uppercase">
                {clientData?.full_name || 'CLIENTE'}
              </p>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-gray-400">Membro ONE desde</p>
                <p className="font-semibold">
                  {subscription && subscription.status === 'active'
                    ? new Date(subscription.start_date).toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' })
                    : '--/--'
                  }
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Rede Favorita</p>
                <p className="font-semibold">{clientData?.favorite_network?.name || 'Não definida'}</p>
              </div>
            </div>

            {/* Status Badge with Star */}
            {subscription && (
              <div className="absolute top-4 right-4 flex flex-col items-center gap-1">
                <Star className="h-8 w-8 text-yellow-500 fill-yellow-500 animate-pulse" />
                <Badge 
                  variant={
                    subscription.status === 'active' ? 'default' : 
                    subscription.status === 'pending' ? 'secondary' : 
                    'outline'
                  }
                  className="text-xs"
                >
                  {subscription.status === 'active' ? 'ATIVO' :
                   subscription.status === 'pending' ? 'PENDENTE' :
                   subscription.status === 'suspended' ? 'SUSPENSO' : 'CANCELADO'}
                </Badge>
              </div>
            )}
          </div>
        </Card>
        </div>
      )}

      {/* Informações de Assinatura */}
      {/* Só mostrar opção de assinatura se a rede tiver one_enabled */}
      {networkOneEnabled && (!subscription || subscription.status === 'cancelled') ? (
        <div className="space-y-6">
          {/* Hero Card */}
          <Card className="relative overflow-hidden border-primary/50">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
            <div className="relative p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-primary" />
                    Assinar Leva+ <span className="text-primary">One</span>
                  </h3>
                  <p className="text-muted-foreground">
                    Ganhe benefícios exclusivos na sua rede favorita
                  </p>
                </div>
                <Badge variant="secondary" className="text-lg px-4 py-2">
                  R$ {(commissionConfig?.monthly_value || 9.90).toFixed(2)}/mês
                </Badge>
              </div>

              {/* Benefícios */}
              <div className="grid md:grid-cols-2 gap-4 pt-4">
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Gift className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Promoções Exclusivas</h4>
                    <p className="text-sm text-muted-foreground">
                      Acesso a ofertas especiais que só membros One têm
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Mais Economia</h4>
                    <p className="text-sm text-muted-foreground">
                      Economize mais a cada compra com benefícios premium
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Award className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Status Premium</h4>
                    <p className="text-sm text-muted-foreground">
                      Seja reconhecido como cliente VIP em todas as lojas
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Comunidade Exclusiva</h4>
                    <p className="text-sm text-muted-foreground">
                      Faça parte de um grupo seleto de clientes especiais
                    </p>
                  </div>
                </div>
              </div>

              {/* Inclusos */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  O que está incluso:
                </h4>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>Acesso ilimitado a todas as promoções exclusivas</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>Notificações prioritárias sobre novas ofertas</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>Suporte preferencial em todas as lojas da rede</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>Sem mensalidades adicionais ou taxas escondidas</span>
                  </li>
                </ul>
              </div>

              {/* CTA */}
              <Button 
                size="lg" 
                className="w-full text-lg"
                onClick={handleSubscribe}
                disabled={isSubscribing}
              >
                <CreditCard className="h-5 w-5 mr-2" />
                Assinar Agora por R$ {(commissionConfig?.monthly_value || 9.90).toFixed(2)}/mês
              </Button>
            </div>
          </Card>

          {/* Segurança */}
          <div className="grid md:grid-cols-3 gap-4">
            <Alert>
              <Shield className="h-5 w-5 text-green-600" />
              <AlertDescription>
                <strong>Pagamento Seguro</strong>
                <br />
                <span className="text-sm">Processado pelo gateway Asaas com certificação PCI-DSS</span>
              </AlertDescription>
            </Alert>

            <Alert>
              <Lock className="h-5 w-5 text-blue-600" />
              <AlertDescription>
                <strong>Dados Protegidos</strong>
                <br />
                <span className="text-sm">Suas informações são criptografadas e nunca compartilhadas</span>
              </AlertDescription>
            </Alert>

            <Alert>
              <CreditCard className="h-5 w-5 text-purple-600" />
              <AlertDescription>
                <strong>Compromisso de 12 Meses</strong>
                <br />
                <span className="text-sm">Cancele após 12 meses sem complicações ou taxas extras</span>
              </AlertDescription>
            </Alert>
          </div>

          {/* Info Adicional */}
          <Card className="p-6">
            <h4 className="text-lg font-bold mb-3">Informações Importantes</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                • A cobrança é realizada mensalmente no cartão de crédito cadastrado
              </p>
              <p>
                • Você pode cancelar sua assinatura após 12 meses através do app
              </p>
              <p>
                • O acesso às promoções exclusivas é ativado imediatamente após a confirmação do pagamento
              </p>
              <p>
                • Todas as transações são processadas de forma segura pela plataforma Asaas
              </p>
            </div>
          </Card>
        </div>
      ) : subscription.status === 'pending' ? (
        <Card className="p-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Assinatura Pendente</strong><br/>
              Aguardando confirmação do pagamento no cartão. Você será notificado quando a assinatura for ativada.
            </AlertDescription>
          </Alert>
        </Card>
      ) : subscription.status === 'active' ? (
        <>
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="default" className="bg-yellow-500">
                  <Star className="h-4 w-4 mr-1" />
                  Membro ONE Ativo
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 inline mr-1" />
                Desde {new Date(subscription.start_date).toLocaleDateString('pt-BR')}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Mensalidade</p>
                <p className="text-lg font-bold">R$ {subscription.monthly_value?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Próximo vencimento</p>
                <p className="text-lg font-bold">
                  {new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </p>
              </div>
            </div>

            {getDaysUntilCancel() <= 0 ? (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setShowCancelDialog(true)}
              >
                Cancelar Assinatura
              </Button>
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  O cancelamento estará disponível após 12 meses de assinatura.
                  Faltam {getDaysUntilCancel()} dias.
                </AlertDescription>
              </Alert>
            )}
          </Card>

          {/* Cartão Salvo */}
          {subscription.card_last_digits && (
            <SavedCardDisplay
              lastDigits={subscription.card_last_digits}
              nextChargeDate={charges.find(c => c.status === 'PENDING')?.due_date}
              onChangeCard={() => setShowUpdateCardDialog(true)}
            />
          )}

          {/* Extrato de Pagamentos */}
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">Extrato de Pagamentos</h3>
            {charges.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma cobrança registrada ainda
              </p>
            ) : (
              <div className="space-y-3">
                {charges.map((charge) => (
                  <div key={charge.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {charge.description || 'Mensalidade Leva+ One'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vencimento: {new Date(charge.due_date).toLocaleDateString('pt-BR')}
                        {charge.payment_date && (
                          <> • Pago em: {new Date(charge.payment_date).toLocaleDateString('pt-BR')}</>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">R$ {charge.amount?.toFixed(2)}</p>
                      <Badge 
                        variant={
                          charge.status === 'CONFIRMED' || charge.status === 'RECEIVED' ? 'default' : 
                          charge.status === 'PENDING' ? 'secondary' : 
                          'destructive'
                        }
                        className="text-xs mt-1"
                      >
                        {charge.status === 'CONFIRMED' || charge.status === 'RECEIVED' ? 'Pago' :
                         charge.status === 'PENDING' ? 'Pendente' :
                         charge.status === 'OVERDUE' ? 'Vencido' : charge.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card className="p-6">
          <Alert variant="destructive">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Sua assinatura está suspensa. Entre em contato com o suporte.
            </AlertDescription>
          </Alert>
        </Card>
      )}

      {/* Benefícios */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">Benefícios Exclusivos</h3>
        <ul className="space-y-2">
          <li className="flex items-start gap-2">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500 mt-0.5" />
            <span className="text-sm">Acesso a promoções exclusivas na sua rede favorita</span>
          </li>
          <li className="flex items-start gap-2">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500 mt-0.5" />
            <span className="text-sm">Descontos especiais em produtos selecionados</span>
          </li>
          <li className="flex items-start gap-2">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500 mt-0.5" />
            <span className="text-sm">Combos e ofertas do tipo "Pague 1 Leve 2"</span>
          </li>
          <li className="flex items-start gap-2">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500 mt-0.5" />
            <span className="text-sm">Atendimento prioritário</span>
          </li>
        </ul>
      </Card>

      {/* Adicionar à Tela Inicial */}
      {hasActiveSubscription && (
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-2">Acesso Rápido</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Adicione seu cartão Leva+ One à tela inicial do seu celular para acesso instantâneo
          </p>
          <InstallPWADialog />
        </Card>
      )}

      {/* Dialog de Pagamento */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto p-0">
          <div className="p-6 pb-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
                Assinar Leva+ One Premium
              </DialogTitle>
              <DialogDescription className="text-base">
                Complete os dados abaixo para finalizar sua assinatura de <strong>R$ 9,90/mês</strong>
              </DialogDescription>
            </DialogHeader>
            <CreditCardForm onSubmit={handleCreditCardSubmit} isLoading={isSubscribing} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Cancelamento */}
      {subscription && (
        <CancelSubscriptionDialog
          open={showCancelDialog}
          onOpenChange={setShowCancelDialog}
          onConfirm={handleCancelSubscription}
          subscriptionStartDate={subscription.start_date}
          canCancel={subscription.can_cancel}
          daysUntilCancel={getDaysUntilCancel()}
        />
      )}

      {/* Dialog de Atualização de Cartão */}
      {subscription && (
        <UpdateCardDialog
          open={showUpdateCardDialog}
          onOpenChange={setShowUpdateCardDialog}
          subscriptionId={subscription.id}
          onSuccess={() => {
            setShowUpdateCardDialog(false);
            loadData();
          }}
        />
      )}

      {/* Dialog de Sucesso */}
      {subscriptionSuccessData && (
        <SubscriptionSuccessDialog
          open={showSuccessDialog}
          onOpenChange={(open) => {
            setShowSuccessDialog(open);
            if (!open) {
              navigate('/levacliente/promocoes-one');
            }
          }}
          subscriptionData={subscriptionSuccessData}
        />
      )}
    </div>
  );
}
