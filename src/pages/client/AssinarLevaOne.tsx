import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Star, 
  Shield, 
  Lock, 
  CreditCard, 
  Check, 
  ArrowLeft,
  Sparkles,
  Gift,
  TrendingUp,
  Users,
  Award,
  Loader2
} from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CreditCardForm, { CreditCardFormData } from "@/components/client/CreditCardForm";
import { SubscriptionSuccessDialog } from "@/components/client/SubscriptionSuccessDialog";

export default function AssinarLevaOne() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clientData, setClientData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [commissionConfig, setCommissionConfig] = useState<any>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);
  const [networkOneEnabled, setNetworkOneEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/levacliente/auth');
        return;
      }

      // Buscar dados do cliente
      const { data: clients } = await supabase
        .from('clients')
        .select('*, favorite_network:networks!clients_favorite_network_id_fkey(id, name, one_enabled)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);

      if (clients && clients.length > 0) {
        const client = clients[0];
        setClientData(client);
        
        // Verificar se a rede tem Leva+ One habilitado
        const oneEnabled = client.favorite_network?.one_enabled ?? false;
        setNetworkOneEnabled(oneEnabled);

        // Buscar configuração de comissão da rede
        if (client.favorite_network_id) {
          const { data: config } = await supabase
            .from('network_one_commission_config')
            .select('*')
            .eq('network_id', client.favorite_network_id)
            .maybeSingle();
          
          setCommissionConfig(config);
        }
      } else {
        setNetworkOneEnabled(false);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar suas informações.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreditCardSubmit = async (cardData: CreditCardFormData) => {
    setIsSubscribing(true);
    try {
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

      const { data, error } = await supabase.functions.invoke('create-one-credit-card-subscription', {
        body: subscriptionData
      });

      if (error) {
        console.error('Erro da edge function:', error);
        throw new Error(error.message || 'Erro ao processar assinatura');
      }
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao processar assinatura');
      }

      // Fechar dialog de pagamento
      setShowPaymentDialog(false);
      
      // Mostrar dialog de sucesso com os dados da assinatura
      setSuccessData({
        monthlyValue: data.subscription?.monthly_value || 9.90,
        startDate: data.subscription?.start_date || new Date().toISOString(),
        cardLastDigits: data.subscription?.card_last_digits || '****',
        nextChargeDate: data.subscription?.next_charge_date,
        paymentStatus: data.subscription?.payment_status || 'PENDING'
      });
      setShowSuccessDialog(true);
    } catch (error: any) {
      console.error('Erro ao assinar:', error);
      
      // Extrair mensagem de erro clara
      const errorMessage = error.message || error.error_description || "Não foi possível processar sua assinatura. Verifique os dados do cartão e tente novamente.";
      
      toast({
        title: "❌ Erro ao processar pagamento",
        description: errorMessage,
        variant: "destructive",
        duration: 7000, // 7 segundos para dar tempo de ler a mensagem
      });
    } finally {
      setIsSubscribing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Verificar se a rede não tem Leva+ One habilitado
  if (networkOneEnabled === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Leva+ One não disponível</CardTitle>
            <CardDescription>
              A rede {clientData?.favorite_network?.name || 'selecionada'} não oferece o programa Leva+ One no momento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/levacliente')} className="w-full">
              Voltar para Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!clientData?.favorite_network_id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Rede não selecionada</CardTitle>
            <CardDescription>
              Você precisa selecionar sua rede favorita antes de assinar o Leva+ One.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/levacliente')} className="w-full">
              Voltar para Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const monthlyValue = commissionConfig?.monthly_value || 9.90;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/levacliente/meu-cartao')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold flex flex-wrap items-center gap-2">
              Assinar Leva+ <span className="text-primary">One</span>
              <Star className="h-6 w-6 sm:h-7 sm:w-7 text-yellow-500 fill-yellow-500" />
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground truncate">
              Experiência premium em {clientData?.favorite_network?.name}
            </p>
          </div>
        </div>

        {/* Hero Card */}
        <Card className="relative overflow-hidden border-primary/50">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
          <CardHeader className="relative">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="space-y-2 flex-1 min-w-0">
                <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
                  <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
                  <span className="break-words">Você é único. Você é One.</span>
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Acesso exclusivo a promoções e benefícios especiais na sua rede favorita
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-base sm:text-lg px-3 sm:px-4 py-1.5 sm:py-2 whitespace-nowrap">
                R$ {monthlyValue.toFixed(2)}/mês
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="relative space-y-6">
            {/* Benefícios */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Gift className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Promoções Exclusivas</h3>
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
                  <h3 className="font-semibold">Mais Economia</h3>
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
                  <h3 className="font-semibold">Status Premium</h3>
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
                  <h3 className="font-semibold">Comunidade Exclusiva</h3>
                  <p className="text-sm text-muted-foreground">
                    Faça parte de um grupo seleto de clientes especiais
                  </p>
                </div>
              </div>
            </div>

            {/* Inclusos */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                O que está incluso:
              </h3>
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
              className="w-full text-base sm:text-lg"
              onClick={() => setShowPaymentDialog(true)}
            >
              <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              Assinar Agora por R$ {monthlyValue.toFixed(2)}/mês
            </Button>
          </CardContent>
        </Card>

        {/* Segurança */}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Alert>
            <Shield className="h-5 w-5 text-green-600" />
            <AlertDescription>
              <strong>Pagamento Seguro</strong>
              <br />
              <span className="text-xs sm:text-sm">Processado pelo gateway Asaas com certificação PCI-DSS</span>
            </AlertDescription>
          </Alert>

          <Alert>
            <Lock className="h-5 w-5 text-blue-600" />
            <AlertDescription>
              <strong>Dados Protegidos</strong>
              <br />
              <span className="text-xs sm:text-sm">Suas informações são criptografadas e nunca compartilhadas</span>
            </AlertDescription>
          </Alert>

          <Alert className="sm:col-span-2 md:col-span-1">
            <CreditCard className="h-5 w-5 text-purple-600" />
            <AlertDescription>
              <strong>Compromisso de 12 Meses</strong>
              <br />
              <span className="text-xs sm:text-sm">Cancele após 12 meses sem complicações ou taxas extras</span>
            </AlertDescription>
          </Alert>
        </div>

        {/* Info Adicional */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informações Importantes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
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
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Pagamento */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto p-0">
          <div className="p-4 sm:p-6 pb-6 sm:pb-8">
            <DialogHeader className="mb-4 sm:mb-6">
              <DialogTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />
                Dados do Cartão de Crédito
              </DialogTitle>
              <DialogDescription className="text-sm sm:text-base">
                Preencha os dados do seu cartão para finalizar a assinatura de <strong>R$ {monthlyValue.toFixed(2)}/mês</strong>
              </DialogDescription>
            </DialogHeader>
            <CreditCardForm
              onSubmit={handleCreditCardSubmit}
              isLoading={isSubscribing}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Sucesso */}
      {successData && (
        <SubscriptionSuccessDialog
          open={showSuccessDialog}
          onOpenChange={(open) => {
            setShowSuccessDialog(open);
            if (!open) {
              // Navegar para promoções quando fechar o dialog
              navigate('/levacliente/promocoes-one');
            }
          }}
          subscriptionData={successData}
        />
      )}
    </div>
  );
}
