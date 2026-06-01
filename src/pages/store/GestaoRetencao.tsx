import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, TrendingUp, AlertCircle, DollarSign, Users, Clock, CalendarClock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";

interface RetentionMetrics {
  total_6_months: number;
  total_9_months: number;
  total_12_months: number;
  expiring_soon: Array<{
    client_name: string;
    commitment_months: number;
    expires_at: string;
    days_remaining: number;
  }>;
  renewal_rate: number;
  average_bonus: number;
  total_bonus_distributed: number;
}

const GestaoRetencao = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<RetentionMetrics | null>(null);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [loyaltyType, setLoyaltyType] = useState<string>('cashback');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar network_id do usuário
      const { data: managerData } = await supabase
        .from('store_managers')
        .select('network_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!managerData?.network_id) {
        toast({
          title: "Erro",
          description: "Não foi possível identificar sua rede.",
          variant: "destructive",
        });
        return;
      }

      setNetworkId(managerData.network_id);

      // Buscar loyalty_type da rede
      const { data: networkData } = await supabase
        .from('networks')
        .select('loyalty_type')
        .eq('id', managerData.network_id)
        .single();

      if (networkData) {
        setLoyaltyType(networkData.loyalty_type);
      }

      // Buscar compromissos ativos
      const { data: commitments } = await supabase
        .from('client_retention_commitments')
        .select(`
          id,
          client_id,
          commitment_months,
          multiplier_applied,
          expires_at,
          status,
          clients!inner (
            full_name,
            cpf
          )
        `)
        .eq('network_id', managerData.network_id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: true });

      if (!commitments) {
        setMetrics({
          total_6_months: 0,
          total_9_months: 0,
          total_12_months: 0,
          expiring_soon: [],
          renewal_rate: 0,
          average_bonus: 0,
          total_bonus_distributed: 0,
        });
        setIsLoading(false);
        return;
      }

      // Calcular métricas
      const total_6 = commitments.filter(c => c.commitment_months === 6).length;
      const total_9 = commitments.filter(c => c.commitment_months === 9).length;
      const total_12 = commitments.filter(c => c.commitment_months === 12).length;

      // Compromissos expirando em 30 dias
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const expiring = commitments
        .filter(c => {
          const expiresAt = new Date(c.expires_at);
          return expiresAt <= thirtyDaysFromNow;
        })
        .map(c => ({
          client_name: (c.clients as any)?.full_name || 'Cliente',
          commitment_months: c.commitment_months,
          expires_at: c.expires_at,
          days_remaining: differenceInDays(new Date(c.expires_at), new Date()),
        }));

      // Calcular bônus médio
      const totalBonus = commitments.reduce((sum, c) => sum + Number(c.multiplier_applied), 0);
      const avgBonus = commitments.length > 0 ? totalBonus / commitments.length : 0;

      // Buscar compromissos expirados para calcular taxa de renovação
      const { data: expiredCommitments } = await supabase
        .from('client_retention_commitments')
        .select('id, client_id, status')
        .eq('network_id', managerData.network_id)
        .lt('expires_at', new Date().toISOString())
        .gte('expires_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()); // Últimos 90 dias

      const totalExpired = expiredCommitments?.length || 0;
      
      // Clientes que renovaram (têm novo compromisso ativo)
      const clientsWithExpired = new Set(expiredCommitments?.map(c => c.client_id) || []);
      const clientsWithActive = new Set(commitments.map(c => c.client_id));
      
      const renewed = [...clientsWithExpired].filter(id => clientsWithActive.has(id)).length;
      const renewalRate = totalExpired > 0 ? (renewed / totalExpired) * 100 : 0;

      setMetrics({
        total_6_months: total_6,
        total_9_months: total_9,
        total_12_months: total_12,
        expiring_soon: expiring,
        renewal_rate: renewalRate,
        average_bonus: avgBonus,
        total_bonus_distributed: totalBonus,
      });
    } catch (error: any) {
      console.error('Erro ao carregar métricas:', error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Não foi possível carregar as métricas.</p>
      </div>
    );
  }

  const totalCommitments = metrics.total_6_months + metrics.total_9_months + metrics.total_12_months;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestão de Retenção</h1>
        <p className="text-muted-foreground text-sm">
          Acompanhe as adesões e métricas do programa de benefícios
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fidelizados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCommitments}</div>
            <p className="text-xs text-muted-foreground">
              Clientes com compromisso ativo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Renovação</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.renewal_rate.toFixed(1)}%</div>
            <Progress value={metrics.renewal_rate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Últimos 90 dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bônus Médio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{metrics.average_bonus.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Por cliente fidelizado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expirando em 30 dias</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.expiring_soon.length}</div>
            <p className="text-xs text-muted-foreground">
              Requer atenção
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição por período */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Período de Compromisso</CardTitle>
          <CardDescription>
            Quantidade de clientes por plano de fidelização
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium">6 meses</p>
                  <p className="text-xs text-muted-foreground">Plano básico</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{metrics.total_6_months}</p>
                <p className="text-xs text-muted-foreground">
                  {totalCommitments > 0 ? ((metrics.total_6_months / totalCommitments) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="font-medium">9 meses</p>
                  <p className="text-xs text-muted-foreground">Plano intermediário</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{metrics.total_9_months}</p>
                <p className="text-xs text-muted-foreground">
                  {totalCommitments > 0 ? ((metrics.total_9_months / totalCommitments) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="font-medium">12 meses</p>
                  <p className="text-xs text-muted-foreground">Plano premium</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{metrics.total_12_months}</p>
                <p className="text-xs text-muted-foreground">
                  {totalCommitments > 0 ? ((metrics.total_12_months / totalCommitments) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compromissos próximos a expirar */}
      {metrics.expiring_soon.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Compromissos Expirando em Breve
            </CardTitle>
            <CardDescription>
              Clientes que precisam de atenção para renovação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead>Data de Expiração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.expiring_soon.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.client_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.commitment_months} meses</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <span className={item.days_remaining <= 7 ? 'text-red-500 font-medium' : ''}>
                          {item.days_remaining} {item.days_remaining === 1 ? 'dia' : 'dias'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(item.expires_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Card informativo quando não há compromissos expirando */}
      {metrics.expiring_soon.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <CalendarClock className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">
                Nenhum compromisso expirando nos próximos 30 dias
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GestaoRetencao;