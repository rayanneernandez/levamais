import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, MessageSquare } from "lucide-react";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TransactionRatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  clientId: string;
  storeId: string;
  networkId: string;
  attendantName?: string | null;
  storeName?: string;
  existingRating?: {
    rating: number;
    comment: string | null;
    store_reply?: string | null;
    reply_at?: string | null;
  };
}

export const TransactionRatingDialog = ({
  open,
  onOpenChange,
  transactionId,
  clientId,
  storeId,
  networkId,
  attendantName,
  storeName,
  existingRating,
}: TransactionRatingDialogProps) => {
  const [rating, setRating] = useState(existingRating?.rating || 0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState(existingRating?.comment || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Por favor, selecione uma avaliação");
      return;
    }

    // Prevent editing existing ratings
    if (existingRating) {
      toast.error("Avaliação já enviada e não pode ser alterada");
      return;
    }

    setLoading(true);
    try {
      // Create new rating
      const { error } = await supabase
        .from("transaction_ratings")
        .insert({
          transaction_id: transactionId,
          client_id: clientId,
          store_id: storeId,
          network_id: networkId,
          rating,
          comment: comment || null,
        });

      if (error) throw error;
      toast.success("Avaliação enviada com sucesso!");

      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting rating:", error);
      toast.error("Erro ao enviar avaliação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {existingRating ? "Avaliação Enviada" : "Avaliar Atendimento"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1">
          {existingRating && (
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Sua avaliação já foi enviada e não pode ser alterada.
              </p>
            </div>
          )}
          
          {(storeName || attendantName) && (
            <div className="bg-muted/50 p-3 rounded-lg space-y-1">
              {storeName && (
                <p className="text-sm">
                  <span className="font-medium">Loja:</span> {storeName}
                </p>
              )}
              {attendantName && (
                <p className="text-sm">
                  <span className="font-medium">Atendente:</span> {attendantName}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {existingRating ? "Sua avaliação:" : "Como foi seu atendimento?"}
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => !existingRating && setRating(star)}
                  onMouseEnter={() => !existingRating && setHoveredRating(star)}
                  onMouseLeave={() => !existingRating && setHoveredRating(0)}
                  className={existingRating ? "cursor-default" : "transition-transform hover:scale-110"}
                  disabled={!!existingRating}
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= (hoveredRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm font-medium">
                {rating === 1 && "Muito Ruim"}
                {rating === 2 && "Ruim"}
                {rating === 3 && "Regular"}
                {rating === 4 && "Bom"}
                {rating === 5 && "Excelente"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Comentário {existingRating ? "" : "(opcional)"}
            </label>
            <Textarea
              placeholder="Deixe um comentário sobre seu atendimento..."
              value={comment}
              onChange={(e) => !existingRating && setComment(e.target.value)}
              rows={4}
              disabled={!!existingRating}
              className={existingRating ? "opacity-70" : ""}
            />
          </div>

          {existingRating?.store_reply && (
            <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">Resposta da Loja</Label>
              </div>
              <p className="text-sm whitespace-pre-wrap">{existingRating.store_reply}</p>
              {existingRating.reply_at && (
                <p className="text-xs text-muted-foreground">
                  Respondido em: {new Date(existingRating.reply_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {existingRating ? "Fechar" : "Cancelar"}
          </Button>
          {!existingRating && (
            <Button onClick={handleSubmit} disabled={loading || rating === 0}>
              {loading ? "Enviando..." : "Enviar Avaliação"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
