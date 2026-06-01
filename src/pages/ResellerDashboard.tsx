import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LoadingPage } from "@/components/ui/loading-page";
import { DollarSign, Users, Building2, TrendingUp, Calendar, Info, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ResellerHeader } from "@/components/reseller/ResellerHeader";
import { ProductivityChart } from "@/components/reseller/ProductivityChart";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";

interface Commission {
  id: string;
  commission_month: string;
  monthly_fee: number;
  commission_percentage: number;
  commission_amount: number;
  status: string;
  networks: {
    name: string;
  };
  clients: {
    full_name: string;
  };
}

interface MonthlyRevenue {
  month: string;
  total: number;
  paid: number;
  pending: number;
  clientCount: number;
  paymentDate: string;
  status: 'paid' | 'pending' | 'partial';
  details: {
    clientName: string;
    networkName: string;
    commissionAmount: number;
    status: string;
  }[];
}

const ResellerDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [reseller, setReseller] = useState<any>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [monthlyRevenues, setMonthlyRevenues] = useState<MonthlyRevenue[]>([]);
  const [totals, setTotals] = useState({ pending: 0, paid: 0, total: 0, clients: 0 });
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [productivityData, setProductivityData] = useState<any[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Logout automático após 45 minutos de inatividade
  useInactivityTimeout({
    timeoutMinutes: 45,
    warningMinutes: 5,
    redirectPath: '/levarevendedor/auth'
  });

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/levarevendedor/auth");
        return;
      }

      // Carregar dados da revenda
      const { data: resellerData, error: resellerError } = await supabase
        .from("resellers")
        .select("*")
        .eq("email", session.user.email)
        .maybeSingle();

      if (resellerError) {
        console.error("Erro ao buscar revendedor:", resellerError);
        toast({
          title: "Erro ao carregar dados",
          description: resellerError.message,
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/levarevendedor/auth");
        return;
      }

      if (!resellerData) {
        toast({
          title: "Acesso negado",
          description: "Usuário não é um revendedor cadastrado",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/levarevendedor/auth");
        return;
      }

      setReseller(resellerData);

      // Carregar comissões
      const { data: commissionsData, error: commissionsError } = await supabase
        .from("reseller_commissions")
        .select(`
          *,
          networks:network_id(name),
          clients:client_id(full_name)
        `)
        .eq("reseller_id", resellerData.id)
        .order("commission_month", { ascending: false })
        .limit(10);

      if (commissionsError) throw commissionsError;

      setCommissions(commissionsData || []);

      // Calcular totais
      const { data: allCommissions } = await supabase
        .from("reseller_commissions")
        .select(`
          commission_amount, 
          status, 
          client_id, 
          commission_month,
          clients:client_id(full_name),
          networks:network_id(name)
        `)
        .eq("reseller_id", resellerData.id);

      if (allCommissions) {
        const pending = allCommissions
          .filter(c => c.status === 'pending')
          .reduce((sum, c) => sum + Number(c.commission_amount), 0);
        
        const paid = allCommissions
          .filter(c => c.status === 'paid')
          .reduce((sum, c) => sum + Number(c.commission_amount), 0);

        // Contar clientes únicos
        const uniqueClients = new Set(allCommissions.map(c => c.client_id)).size;

        setTotals({
          pending,
          paid,
          total: pending + paid,
          clients: uniqueClients
        });

        // Agrupar por mês para o relatório de faturamento
        const monthlyData = new Map<string, MonthlyRevenue>();
        
        allCommissions.forEach(commission => {
          const month = commission.commission_month;
          
          if (!monthlyData.has(month)) {
            // Calcular data de pagamento (dia 15 do mês seguinte)
            const commissionDate = new Date(month + 'T00:00:00');
            const paymentDate = new Date(commissionDate);
            paymentDate.setMonth(paymentDate.getMonth() + 1);
            paymentDate.setDate(15);
            
            monthlyData.set(month, {
              month,
              total: 0,
              paid: 0,
              pending: 0,
              clientCount: 0,
              paymentDate: paymentDate.toISOString().split('T')[0],
              status: 'pending',
              details: []
            });
          }
          
          const data = monthlyData.get(month)!;
          const amount = Number(commission.commission_amount);
          
          data.total += amount;
          if (commission.status === 'paid') {
            data.paid += amount;
          } else if (commission.status === 'pending') {
            data.pending += amount;
          }
          data.clientCount++;
          
          // Adicionar detalhe do cliente
          data.details.push({
            clientName: commission.clients?.full_name || 'N/A',
            networkName: commission.networks?.name || 'N/A',
            commissionAmount: amount,
            status: commission.status
          });
        });

        // Determinar status de cada mês
        const revenues = Array.from(monthlyData.values()).map(rev => ({
          ...rev,
          status: rev.paid === rev.total ? 'paid' as const : 
                  rev.paid > 0 ? 'partial' as const : 
                  'pending' as const
        })).sort((a, b) => b.month.localeCompare(a.month)); // Mais recente primeiro

        setMonthlyRevenues(revenues);

        // Calcular dados de produtividade (últimos 12 meses)
        const last12Months: string[] = [];
        const now = new Date();
        
        for (let i = 11; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthKey = date.toISOString().slice(0, 7);
          last12Months.push(monthKey);
        }

        // Buscar todas as comissões do revendedor
        const { data: allResellerCommissions } = await supabase
          .from("reseller_commissions")
          .select("commission_month, status, client_id, network_id")
          .eq("reseller_id", resellerData.id)
          .order("commission_month", { ascending: true });

        if (allResellerCommissions && allResellerCommissions.length > 0) {
          // Rastrear primeira aparição de cada cliente e cancelamentos
          const firstAppearance = new Map<string, string>(); // client_id -> primeiro mês
          const cancelledInMonth = new Map<string, Set<string>>(); // mês -> clientes cancelados

          allResellerCommissions.forEach(comm => {
            const month = comm.commission_month;
            const clientId = comm.client_id;
            
            // Registrar primeira aparição do cliente
            if (!firstAppearance.has(clientId) && comm.status !== 'cancelled') {
              firstAppearance.set(clientId, month);
            }
            
            // Registrar cancelamento
            if (comm.status === 'cancelled') {
              if (!cancelledInMonth.has(month)) {
                cancelledInMonth.set(month, new Set());
              }
              cancelledInMonth.get(month)!.add(clientId);
            }
          });

          // Gerar dados para os últimos 12 meses
          const productivity = last12Months.map(month => {
            // Contar novos clientes que entraram neste mês
            const newClients = Array.from(firstAppearance.entries())
              .filter(([_, firstMonth]) => firstMonth === month)
              .length;
            
            // Contar clientes que cancelaram neste mês
            const cancelled = cancelledInMonth.get(month)?.size || 0;
            
            // Crescimento líquido = novos - cancelados
            const net = newClients - cancelled;

            return {
              month: formatMonth(month),
              active: newClients,
              cancelled,
              net
            };
          });

          console.log('📊 Productivity data calculated:', productivity);
          console.log('📊 First appearance map:', Object.fromEntries(firstAppearance));
          console.log('📊 Cancelled by month:', Object.fromEntries(cancelledInMonth));
          setProductivityData(productivity);
        } else {
          // Se não houver comissões, criar dados vazios para mostrar o gráfico
          const emptyProductivity = last12Months.map(month => ({
            month: formatMonth(month),
            active: 0,
            cancelled: 0,
            net: 0
          }));
          setProductivityData(emptyProductivity);
        }
      }

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro ao carregar dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleMonthExpansion = (month: string) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(month)) {
        newSet.delete(month);
      } else {
        newSet.add(month);
      }
      return newSet;
    });
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

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <div className="min-h-screen bg-background">
      <ResellerHeader
        resellerName={reseller?.owner_name || "Revendedor"}
        resellerEmail={reseller?.email || ""}
        companyName={reseller?.company_name || ""}
      />

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Informação de Pagamento */}
        <Alert className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-950">
          <Calendar className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900 dark:text-blue-100">
            <strong>Política de Pagamento:</strong> As comissões do mês são fechadas no último dia útil e pagas no dia 15 do mês seguinte.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.clients}</div>
              <p className="text-xs text-muted-foreground">
                Clientes indicados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comissões Pendentes</CardTitle>
              <DollarSign className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.pending)}</div>
              <p className="text-xs text-muted-foreground">
                A receber
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comissões Pagas</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.paid)}</div>
              <p className="text-xs text-muted-foreground">
                Já recebido
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Gerado</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.total)}</div>
              <p className="text-xs text-muted-foreground">
                Total acumulado
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de Produtividade */}
        <div className="mb-8">
          <ProductivityChart data={productivityData} />
        </div>

        {/* Relatório de Faturamento Mensal */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Faturamento Mensal</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Pagamento realizado dia 15 do mês seguinte</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {monthlyRevenues.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum faturamento registrado ainda
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês de Referência</TableHead>
                    <TableHead>Qtd. Clientes</TableHead>
                    <TableHead>Total do Mês</TableHead>
                    <TableHead>Valor Pago</TableHead>
                    <TableHead>Valor Pendente</TableHead>
                    <TableHead>Data de Pagamento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyRevenues.map((revenue) => (
                    <Collapsible key={revenue.month} asChild>
                      <>
                        <CollapsibleTrigger asChild>
                          <TableRow className="cursor-pointer hover:bg-muted/50">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {expandedMonths.has(revenue.month) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                {formatMonth(revenue.month)}
                              </div>
                            </TableCell>
                            <TableCell>{revenue.clientCount}</TableCell>
                            <TableCell className="font-semibold">
                              {formatCurrency(revenue.total)}
                            </TableCell>
                            <TableCell className="text-green-600">
                              {formatCurrency(revenue.paid)}
                            </TableCell>
                            <TableCell className="text-yellow-600">
                              {formatCurrency(revenue.pending)}
                            </TableCell>
                            <TableCell>
                              {format(new Date(revenue.paymentDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  revenue.status === 'paid' ? 'default' : 
                                  revenue.status === 'partial' ? 'secondary' : 
                                  'outline'
                                }
                              >
                                {revenue.status === 'paid' ? 'Pago' : 
                                 revenue.status === 'partial' ? 'Parcial' : 
                                 'Pendente'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <TableRow>
                            <TableCell colSpan={7} className="bg-muted/30 p-0">
                              <div className="p-4">
                                <h4 className="font-semibold mb-3 text-sm">Detalhes por Cliente/Empresa</h4>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Cliente</TableHead>
                                      <TableHead>Empresa</TableHead>
                                      <TableHead>Comissão</TableHead>
                                      <TableHead>Status</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {revenue.details.map((detail, idx) => (
                                      <TableRow key={idx}>
                                        <TableCell>{detail.clientName}</TableCell>
                                        <TableCell>{detail.networkName}</TableCell>
                                        <TableCell className="font-semibold">
                                          {formatCurrency(detail.commissionAmount)}
                                        </TableCell>
                                        <TableCell>
                                          <Badge 
                                            variant={
                                              detail.status === 'paid' ? 'default' : 
                                              detail.status === 'cancelled' ? 'destructive' : 
                                              'secondary'
                                            }
                                            className="text-xs"
                                          >
                                            {detail.status === 'paid' ? 'Pago' : 
                                             detail.status === 'cancelled' ? 'Cancelado' : 
                                             'Pendente'}
                                          </Badge>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detalhamento das Últimas Comissões */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Detalhamento de Comissões</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4" />
                <span>Últimas 10 comissões registradas</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {commissions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma comissão registrada ainda
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.map((commission) => (
                    <TableRow key={commission.id}>
                      <TableCell>{formatMonth(commission.commission_month)}</TableCell>
                      <TableCell>{commission.networks?.name}</TableCell>
                      <TableCell>{commission.clients?.full_name}</TableCell>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResellerDashboard;
