import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Calendar, Info } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TransferImpact {
  client_name: string;
  from_network_name: string;
  to_network_name: string;
  transferred_at: string;
  monthly_value: number;
  impact_description: string;
}

interface NetworkTransferImpactProps {
  transfers: TransferImpact[];
  currentMonth: string;
}

export function NetworkTransferImpact({ transfers, currentMonth }: NetworkTransferImpactProps) {
  if (transfers.length === 0) return null;

  const totalImpactValue = transfers.reduce((sum, t) => sum + t.monthly_value, 0);

  return (
    <Card className="border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-500" />
          <CardTitle className="text-lg">Impacto de Transferências de Rede</CardTitle>
        </div>
        <CardDescription>
          {transfers.length} transferência{transfers.length > 1 ? 's' : ''} processada{transfers.length > 1 ? 's' : ''} em {currentMonth}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-blue-100/50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700">
          <Calendar className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">Como funciona?</AlertTitle>
          <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
            <ul className="list-disc pl-4 mt-2 space-y-1">
              <li>A rede antiga recebe comissão do mês anterior (fechado)</li>
              <li>A rede nova recebe comissão do mês atual em diante</li>
              <li>Transferências são processadas no dia 1º de cada mês</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          {transfers.map((transfer, index) => (
            <div key={index} className="p-3 bg-background rounded-lg border space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{transfer.client_name}</p>
                  <p className="text-sm text-muted-foreground">
                    R$ {transfer.monthly_value.toFixed(2)}/mês
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {format(new Date(transfer.transferred_at), "dd/MM/yyyy", { locale: ptBR })}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline">{transfer.from_network_name}</Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline">{transfer.to_network_name}</Badge>
              </div>

              <p className="text-xs text-muted-foreground italic">
                {transfer.impact_description}
              </p>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Valor Total Impactado:</span>
            <span className="text-lg font-bold text-blue-600">
              R$ {totalImpactValue.toFixed(2)}/mês
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
