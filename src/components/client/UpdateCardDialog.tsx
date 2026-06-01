import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CreditCardForm, { CreditCardFormData } from "./CreditCardForm";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface UpdateCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionId: string;
  onSuccess: () => void;
}

export function UpdateCardDialog({
  open,
  onOpenChange,
  subscriptionId,
  onSuccess,
}: UpdateCardDialogProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (formData: CreditCardFormData) => {
    setIsUpdating(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "update-one-subscription-card",
        {
          body: {
            subscription_id: subscriptionId,
            card: {
              holderName: formData.holderName,
              number: formData.number,
              expiryMonth: formData.expiryMonth,
              expiryYear: formData.expiryYear,
              ccv: formData.ccv,
            },
            address: {
              postalCode: formData.postalCode,
              addressNumber: formData.addressNumber,
              complement: formData.province,
            },
          },
        }
      );

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: "✅ Cartão atualizado!",
        description: "Seu novo cartão será usado nas próximas cobranças.",
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao atualizar cartão:", error);
      toast({
        title: "Erro ao atualizar cartão",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atualizar Cartão de Crédito</DialogTitle>
          <DialogDescription>
            Informe os dados do novo cartão que será usado nas próximas cobranças
          </DialogDescription>
        </DialogHeader>

        {isUpdating ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Atualizando cartão...
            </p>
          </div>
        ) : (
          <CreditCardForm onSubmit={handleSubmit} isLoading={isUpdating} />
        )}
      </DialogContent>
    </Dialog>
  );
}
