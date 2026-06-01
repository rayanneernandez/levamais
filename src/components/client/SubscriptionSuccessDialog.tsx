import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CreditCard, Calendar, Sparkles, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SubscriptionSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionData: {
    monthlyValue: number;
    startDate: string;
    cardLastDigits: string;
    nextChargeDate?: string;
    paymentStatus?: string;
  };
}

export function SubscriptionSuccessDialog({
  open,
  onOpenChange,
  subscriptionData,
}: SubscriptionSuccessDialogProps) {
  const isConfirmed = subscriptionData.paymentStatus === 'CONFIRMED' || subscriptionData.paymentStatus === 'RECEIVED';
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center space-y-4 pb-4">
          <div className="mx-auto w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-amber-500" />
          </div>
          <DialogTitle className="text-2xl sm:text-3xl font-bold">
            {isConfirmed ? '✅ Pagamento Aprovado!' : '💳 Pagamento Autorizado!'}
          </DialogTitle>
          <DialogDescription className="text-base sm:text-lg">
            {isConfirmed 
              ? 'Sua assinatura Leva+ One foi ativada com sucesso!'
              : 'Aguardando confirmação do pagamento. Você receberá uma notificação quando sua assinatura for ativada.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 py-4">
          {/* Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className={`p-4 ${isConfirmed ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-3">
                <CheckCircle2 className={`h-5 w-5 ${isConfirmed ? 'text-green-600' : 'text-amber-600'}`} />
                <div>
                  <p className={`text-sm font-medium ${isConfirmed ? 'text-green-900' : 'text-amber-900'}`}>Primeira Cobrança</p>
                  <p className={`text-sm font-bold ${isConfirmed ? 'text-green-600' : 'text-amber-600'}`}>
                    {isConfirmed ? 'APROVADO' : 'PROCESSANDO'}
                  </p>
                  <p className={`text-xs ${isConfirmed ? 'text-green-700' : 'text-amber-700'} mt-1`}>
                    {isConfirmed ? 'Pagamento confirmado' : 'Aguardando aprovação'}
                  </p>
                </div>
              </div>
            </Card>

            <Card className={`p-4 ${isConfirmed ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex items-center gap-3">
                <Sparkles className={`h-5 w-5 ${isConfirmed ? 'text-green-600' : 'text-blue-600'}`} />
                <div>
                  <p className={`text-sm font-medium ${isConfirmed ? 'text-green-900' : 'text-blue-900'}`}>Status da Assinatura</p>
                  <Badge className={isConfirmed ? 'bg-green-600' : 'bg-amber-600'}>
                    {isConfirmed ? 'ATIVA' : 'PENDENTE'}
                  </Badge>
                </div>
              </div>
            </Card>
          </div>

          {/* Detalhes da Assinatura */}
          <Card className="p-4 sm:p-6 space-y-4">
            <h3 className="font-semibold text-base sm:text-lg border-b pb-2">Detalhes da Assinatura</h3>
            
            <div className="grid gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Valor Mensal</p>
                    <p className="font-bold text-lg">R$ {subscriptionData.monthlyValue.toFixed(2)}</p>
                  </div>
                </div>
                <Badge variant="outline" className={`w-fit ${isConfirmed ? 'text-green-600 border-green-600' : 'text-amber-600 border-amber-600'}`}>
                  {isConfirmed ? '✅ Aprovado' : '⏳ Processando'}
                </Badge>
              </div>

              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Cartão Cadastrado</p>
                  <p className="font-medium">•••• •••• •••• {subscriptionData.cardLastDigits}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Início da Assinatura</p>
                  <p className="font-medium">
                    {format(new Date(subscriptionData.startDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>

              {subscriptionData.nextChargeDate && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Próxima Cobrança Automática</p>
                    <p className="font-medium">
                      {format(new Date(subscriptionData.nextChargeDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Garantia/Status Final */}
          <Card className={`p-4 sm:p-6 ${isConfirmed ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-start gap-3">
              <CheckCircle2 className={`h-5 w-5 ${isConfirmed ? 'text-green-600' : 'text-amber-600'} mt-0.5 flex-shrink-0`} />
              <div className="space-y-1 min-w-0">
                <p className={`font-semibold text-sm sm:text-base ${isConfirmed ? 'text-green-900' : 'text-amber-900'}`}>
                  {isConfirmed ? '✅ Pagamento Confirmado!' : '💳 Pagamento em Processamento'}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {isConfirmed 
                    ? 'Seu cartão foi debitado e sua assinatura está ativa! Você já pode aproveitar todos os benefícios exclusivos Leva+ One.'
                    : 'Seu cartão foi autorizado e o pagamento está sendo processado. A confirmação final pode levar alguns minutos. Você receberá uma notificação assim que sua assinatura for ativada.'
                  }
                </p>
              </div>
            </div>
          </Card>

          {/* CTA */}
          <Button 
            size="lg" 
            className="w-full bg-amber-600 hover:bg-amber-700 h-11 sm:h-12 text-sm sm:text-base"
            onClick={() => onOpenChange(false)}
          >
            Entendi, ir para Promoções
            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 ml-2" />
          </Button>

          <p className="text-xs sm:text-sm text-center text-muted-foreground px-2">
            Você receberá um email de confirmação assim que o pagamento for aprovado.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
