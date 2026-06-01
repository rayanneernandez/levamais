import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Lock, Calendar, ArrowRight, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface NetworkTransferManagerProps {
  clientId: string;
  currentNetworkId: string;
  currentNetworkName: string;
  targetNetworkId: string;
  targetNetworkName: string;
}

interface ActiveCommitment {
  id: string;
  commitment_months: number;
  expires_at: string;
  network_id: string;
}

interface PendingTransfer {
  id: string;
  from_network_id: string;
  to_network_id: string;
  scheduled_for: string;
  status: string;
  to_network: {
    name: string;
  };
}

export function NetworkTransferManager({
  clientId,
  currentNetworkId,
  currentNetworkName,
  targetNetworkId,
  targetNetworkName,
}: NetworkTransferManagerProps) {
  const { toast } = useToast();
  const [activeCommitment, setActiveCommitment] = useState<ActiveCommitment | null>(null);
  const [pendingTransfer, setPendingTransfer] = useState<PendingTransfer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  useEffect(() => {
    loadData();
  }, [clientId, currentNetworkId]);

  const loadData = async () => {
    try {
      // Carregar compromisso ativo
      const { data: commitmentData } = await supabase
        .from("client_retention_commitments")
        .select("*")
        .eq("client_id", clientId)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (commitmentData) {
        setActiveCommitment(commitmentData);
      }

      // Carregar transferência pendente
      const { data: transferData } = await supabase
        .from("pending_network_transfers")
        .select("*, to_network:networks!pending_network_transfers_to_network_id_fkey(name)")
        .eq("client_id", clientId)
        .eq("status", "pending")
        .maybeSingle();

      if (transferData) {
        setPendingTransfer(transferData as PendingTransfer);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestTransfer = async () => {
    setIsSubmitting(true);
    try {
      // Calcular primeiro dia do próximo mês
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);

      const { error } = await supabase
        .from("pending_network_transfers")
        .insert({
          client_id: clientId,
          from_network_id: currentNetworkId,
          to_network_id: targetNetworkId,
          scheduled_for: nextMonth.toISOString().split('T')[0],
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "✅ Transferência agendada!",
        description: `Você será transferido para ${targetNetworkName} em ${format(nextMonth, "dd/MM/yyyy", { locale: ptBR })} às 00:00. Novo compromisso de 90 dias será iniciado automaticamente.`,
      });

      await loadData();
      setShowConfirmDialog(false);
    } catch (error: any) {
      toast({
        title: "Erro ao agendar transferência",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelTransfer = async () => {
    if (!pendingTransfer) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("pending_network_transfers")
        .update({ status: 'cancelled' })
        .eq("id", pendingTransfer.id);

      if (error) throw error;

      toast({
        title: "Transferência cancelada",
        description: "Você continuará na sua rede atual.",
      });

      setPendingTransfer(null);
      setShowCancelDialog(false);
    } catch (error: any) {
      toast({
        title: "Erro ao cancelar transferência",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return null;
  }

  // Se está na mesma rede, não mostrar
  if (currentNetworkId === targetNetworkId) {
    return null;
  }

  // Se tem compromisso ativo, mostrar bloqueio
  if (activeCommitment && activeCommitment.network_id === currentNetworkId) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-destructive" />
            <CardTitle className="text-lg">Troca de Rede Bloqueada</CardTitle>
          </div>
          <CardDescription>
            Você possui um compromisso ativo com {currentNetworkName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-background rounded-lg">
              <div>
                <p className="text-sm font-medium">Compromisso de {activeCommitment.commitment_months} meses</p>
                <p className="text-xs text-muted-foreground">
                  Válido até {format(new Date(activeCommitment.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              <Badge variant="destructive">
                <Lock className="h-3 w-3 mr-1" />
                Bloqueado
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Aguarde o término do seu compromisso para poder trocar de rede favorita. Após esse período, você poderá solicitar a transferência.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Se tem transferência pendente, mostrar info
  if (pendingTransfer) {
    return (
      <>
        <Alert>
          <Calendar className="h-4 w-4" />
          <AlertTitle>Transferência Agendada</AlertTitle>
          <AlertDescription>
            <div className="space-y-3 mt-2">
              <p>
                Você será transferido para <strong>{pendingTransfer.to_network.name}</strong> em{" "}
                <strong>{format(new Date(pendingTransfer.scheduled_for), "dd/MM/yyyy", { locale: ptBR })}</strong>.
              </p>
              <p className="text-xs text-muted-foreground">
                Um novo compromisso de 90 dias será iniciado automaticamente na nova rede.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelDialog(true)}
                className="w-full"
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar Transferência
              </Button>
            </div>
          </AlertDescription>
        </Alert>

        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar Transferência?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja cancelar a transferência para {pendingTransfer.to_network.name}? 
                Você continuará em {currentNetworkName}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancelTransfer}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Cancelando..." : "Confirmar Cancelamento"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Se não tem bloqueio nem transferência pendente, permitir solicitar
  return (
    <>
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Trocar Rede Favorita</CardTitle>
          </div>
          <CardDescription>
            Você pode solicitar transferência para {targetNetworkName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-muted/50 p-3 rounded-lg space-y-2">
              <p className="text-sm font-medium">Como funciona:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• A transferência será processada no dia 1º do próximo mês</li>
                <li>• Um novo compromisso de 90 dias será iniciado automaticamente</li>
                <li>• Sua assinatura Leva+ One será transferida junto</li>
                <li>• A rede antiga recebe comissão do mês anterior</li>
                <li>• A rede nova recebe comissão do mês vigente em diante</li>
              </ul>
            </div>
            <Button
              onClick={() => setShowConfirmDialog(true)}
              className="w-full"
            >
              Solicitar Transferência
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Transferência</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a solicitar transferência de <strong>{currentNetworkName}</strong> para{" "}
                <strong>{targetNetworkName}</strong>.
              </p>
              <div className="bg-primary/10 p-4 rounded-lg space-y-2">
                <p className="font-medium text-foreground">O que acontecerá:</p>
                <p className="text-sm">
                  ✅ Transferência será processada no dia 1º do próximo mês às 00:00
                </p>
                <p className="text-sm">
                  ✅ Novo compromisso de 90 dias será iniciado automaticamente
                </p>
                <p className="text-sm">
                  ✅ Sua assinatura Leva+ One será transferida junto
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Você pode cancelar a transferência a qualquer momento antes do dia 1º.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRequestTransfer}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Agendando..." : "Confirmar Transferência"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
