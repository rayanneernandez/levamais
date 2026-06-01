import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, CheckCircle, XCircle } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Commission {
  id: string;
  network_id: string;
  client_id: string;
  commission_month: string;
  monthly_fee: number;
  commission_percentage: number;
  commission_amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  networks: {
    name: string;
  };
  clients: {
    full_name: string;
    cpf: string;
  };
}

interface ResellerExtractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resellerId: string;
  resellerName: string;
}

export const ResellerExtractDialog = ({ 
  open, 
  onOpenChange, 
  resellerId,
  resellerName 
}: ResellerExtractDialogProps) => {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState({ pending: 0, paid: 0, total: 0 });
  const { toast } = useToast();

  useEffect(() => {
    if (open && resellerId) {
      fetchCommissions();
    }
  }, [open, resellerId]);

  const fetchCommissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("reseller_commissions")
        .select(`
          *,
          networks:network_id(name),
          clients:client_id(full_name, cpf)
        `)
        .eq("reseller_id", resellerId)
        .order("commission_month", { ascending: false });

      if (error) throw error;

      setCommissions(data || []);

      // Calcular totais
      const pending = (data || [])
        .filter(c => c.status === 'pending')
        .reduce((sum, c) => sum + Number(c.commission_amount), 0);
      
      const paid = (data || [])
        .filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + Number(c.commission_amount), 0);

      setTotals({
        pending,
        paid,
        total: pending + paid
      });

    } catch (error) {
      console.error("Erro ao buscar comissões:", error);
      toast({
        title: "Erro ao carregar extrato",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (commissionId: string) => {
    try {
      const { error } = await supabase
        .from("reseller_commissions")
        .update({ 
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq("id", commissionId);

      if (error) throw error;

      toast({
        title: "Comissão marcada como paga",
      });

      fetchCommissions();
    } catch (error) {
      console.error("Erro ao marcar comissão:", error);
      toast({
        title: "Erro ao atualizar comissão",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatMonth = (dateString: string) => {
    try {
      const date = new Date(dateString + 'T00:00:00');
      return format(date, 'MMMM/yyyy', { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Extrato de Comissões - {resellerName}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300 mb-2">
              <DollarSign className="h-5 w-5" />
              <span className="font-semibold">Pendente</span>
            </div>
            <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
              {formatCurrency(totals.pending)}
            </p>
          </div>

          <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-semibold">Pago</span>
            </div>
            <p className="text-2xl font-bold text-green-800 dark:text-green-200">
              {formatCurrency(totals.paid)}
            </p>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2">
              <DollarSign className="h-5 w-5" />
              <span className="font-semibold">Total</span>
            </div>
            <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
              {formatCurrency(totals.total)}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : commissions.length === 0 ? (
          <p className="text-center text-muted-foreground p-8">
            Nenhuma comissão registrada
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Mensalidade</TableHead>
                <TableHead>%</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map((commission) => (
                <TableRow key={commission.id}>
                  <TableCell>{formatMonth(commission.commission_month)}</TableCell>
                  <TableCell>{commission.networks?.name}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{commission.clients?.full_name}</p>
                      <p className="text-sm text-muted-foreground">{commission.clients?.cpf}</p>
                    </div>
                  </TableCell>
                  <TableCell>{formatCurrency(commission.monthly_fee)}</TableCell>
                  <TableCell>{commission.commission_percentage}%</TableCell>
                  <TableCell className="font-semibold">
                    {formatCurrency(commission.commission_amount)}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        commission.status === 'paid' ? 'default' : 
                        commission.status === 'cancelled' ? 'destructive' : 
                        'secondary'
                      }
                    >
                      {commission.status === 'paid' ? 'Pago' : 
                       commission.status === 'cancelled' ? 'Cancelado' : 
                       'Pendente'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {commission.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => handleMarkAsPaid(commission.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Marcar como Pago
                      </Button>
                    )}
                    {commission.status === 'paid' && commission.paid_at && (
                      <span className="text-sm text-muted-foreground">
                        Pago em {format(new Date(commission.paid_at), 'dd/MM/yyyy')}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};
