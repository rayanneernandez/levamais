import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, Package } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface RedemptionHistoryProps {
  attendantId: string;
  networkId: string;
}

export function RedemptionHistory({ attendantId, networkId }: RedemptionHistoryProps) {
  const { data: redemptions, isLoading } = useQuery({
    queryKey: ["redemption-history", attendantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendant_redemptions")
        .select(`
          *,
          attendant_rewards (
            name,
            category,
            points_cost
          )
        `)
        .eq("attendant_id", attendantId)
        .eq("network_id", networkId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!attendantId && !!networkId,
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pendente", icon: Clock, className: "bg-yellow-500" },
      approved: { label: "Aprovado", icon: CheckCircle, className: "bg-green-500" },
      rejected: { label: "Recusado", icon: XCircle, className: "bg-red-500" },
      delivered: { label: "Entregue", icon: Package, className: "bg-blue-500" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" text="Carregando histórico..." />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!redemptions || redemptions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">Nenhum resgate realizado</p>
          <p className="text-sm mt-1">Seus resgates aparecerão aqui</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Resgates</CardTitle>
          <CardDescription>
            Acompanhe todos os seus resgates realizados
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {redemptions.map((redemption) => (
          <Card key={redemption.id}>
            <CardContent className="pt-6">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-lg">
                      {redemption.attendant_rewards?.name || "Prêmio"}
                    </h3>
                    {getStatusBadge(redemption.status)}
                  </div>
                  
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      Resgatado em{" "}
                      {format(new Date(redemption.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                    
                    {redemption.approved_at && (
                      <p>
                        Aprovado em{" "}
                        {format(new Date(redemption.approved_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    )}

                    {redemption.delivered_at && (
                      <p>
                        Entregue em{" "}
                        {format(new Date(redemption.delivered_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    )}

                    {redemption.notes && (
                      <p className="mt-2 p-2 bg-muted rounded text-xs">
                        <strong>Observações:</strong> {redemption.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-destructive">
                    -{redemption.points_spent}
                  </p>
                  <p className="text-xs text-muted-foreground">pontos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
