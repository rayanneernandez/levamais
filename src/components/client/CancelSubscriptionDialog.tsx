import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  HeartCrack, 
  AlertTriangle, 
  Gift, 
  Star, 
  TrendingDown,
  Loader2 
} from "lucide-react";

interface CancelSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  subscriptionStartDate: string;
  canCancel: boolean;
  daysUntilCancel?: number;
}

export function CancelSubscriptionDialog({
  open,
  onOpenChange,
  onConfirm,
  subscriptionStartDate,
  canCancel,
  daysUntilCancel
}: CancelSubscriptionDialogProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const isConfirmationValid = confirmationText.toLowerCase().trim() === "estou indo embora";

  const handleConfirm = async () => {
    if (!isConfirmationValid || !canCancel) return;
    
    setIsProcessing(true);
    try {
      await onConfirm();
      onOpenChange(false);
      setConfirmationText("");
    } catch (error) {
      // Erro já tratado no componente pai
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setConfirmationText("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <HeartCrack className="h-6 w-6 text-red-500" />
            Você realmente quer ir embora?
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Sentiremos sua falta... Você está prestes a perder benefícios exclusivos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!canCancel ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Cancelamento não disponível</strong>
                <p className="text-sm mt-1">
                  Você precisa manter a assinatura por no mínimo 12 meses.
                  {daysUntilCancel && (
                    <span className="block mt-1">
                      Faltam <strong>{daysUntilCancel} dias</strong> para poder cancelar.
                    </span>
                  )}
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-red-900 dark:text-red-100 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  O que você vai perder:
                </h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Gift className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <span>Acesso a <strong>promoções exclusivas</strong> que só membros One têm</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Star className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <span>Seu <strong>status premium</strong> em todas as lojas da rede</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Economia mensal</strong> com ofertas especiais</span>
                  </li>
                </ul>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  💙 <strong>Você é especial para nós!</strong> Se está tendo algum problema, 
                  entre em contato com nosso suporte antes de cancelar. Estamos aqui para ajudar.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="confirmation" className="text-base">
                  Para confirmar, digite: <span className="font-mono font-bold">estou indo embora</span>
                </Label>
                <Input
                  id="confirmation"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder="Digite aqui para confirmar..."
                  className="text-center"
                  disabled={isProcessing}
                />
                {confirmationText && !isConfirmationValid && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Texto incorreto. Digite exatamente: estou indo embora
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isProcessing}
            className="w-full sm:w-auto"
          >
            Não, quero ficar! 💚
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmationValid || !canCancel || isProcessing}
            className="w-full sm:w-auto"
          >
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sim, cancelar assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
