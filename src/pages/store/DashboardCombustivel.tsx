import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Fuel, TrendingDown, TrendingUp, Activity, MapPin, AlertCircle, BarChart3 } from "lucide-react";
import { FuelAnalysisGuard } from "@/components/store/FuelAnalysisGuard";
import { LoadingPage } from "@/components/ui/loading-page";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, TooltipProps } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Tooltip customizado para formatar valores com 2 casas decimais
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="font-semibold mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: R$ {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

interface FuelPrice {
  produto: string;
  preco_revenda: number;
  municipio: string;
  estado: string;
  bairro: string;
  data_coleta: string;
  bandeira: string;
  cnpj: string;
  endereco: string;
}

interface NetworkData {
  fuel_analysis_scope: string;
  location_estado?: string;
}

export default function DashboardCombustivel() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [filteredPrices, setFilteredPrices] = useState<FuelPrice[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  
  const [filterOptionsRaw, setFilterOptionsRaw] = useState<Array<{
    estado: string;
    municipio: string;
    bairro: string;
    produto: string;
    data_coleta: string;
  }>>([]);
  
  const [selectedEstado, setSelectedEstado] = useState<string>("all");
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>("all");
  const [selectedBairro, setSelectedBairro] = useState<string>("all");
  const [selectedProduto, setSelectedProduto] = useState<string>("all");
  const [selectedMes, setSelectedMes] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, []);
  
  useEffect(() => {
    // Reset município quando estado mudar
    if (selectedEstado !== "all") {
      setSelectedMunicipio("all");
      setSelectedBairro("all");
    }
  }, [selectedEstado]);
  
  useEffect(() => {
    // Reset bairro quando município mudar
    if (selectedMunicipio !== "all") {
      setSelectedBairro("all");
    }
  }, [selectedMunicipio]);

  useEffect(() => {
    if (!networkData || filterOptionsRaw.length === 0) return;
    applyFilters();
  }, [networkData, filterOptionsRaw, selectedEstado, selectedMunicipio, selectedBairro, selectedProduto, selectedMes]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: managerData } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!managerData) throw new Error("Gestor não encontrado");

      const { data: network } = await supabase
        .from("networks")
        .select("fuel_analysis_scope, location_estado")
        .eq("id", managerData.network_id)
        .single();

      if (!network) throw new Error("Rede não encontrada");

      setNetworkData(network as NetworkData);
      await loadFuelPrices(network as NetworkData);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadFuelPrices = async (network: NetworkData) => {
    try {
      // Carrega opções distintas para os filtros (usando view que já exclui GLP)
      // Aumentado limite para garantir que todos os meses sejam carregados
      let query = supabase.from("fuel_prices_analysis").select("estado, municipio, bairro, produto, data_coleta").order("data_coleta", { ascending: false });

      if (network.fuel_analysis_scope === "estado" && network.location_estado) {
        query = query.eq("estado", network.location_estado);
        setSelectedEstado(network.location_estado);
      }

      if (network.fuel_analysis_scope === "municipio" && network.location_estado) {
        query = query.eq("estado", network.location_estado);
        setSelectedEstado(network.location_estado);
      }

      // Removido o limite para garantir que todos os dados sejam carregados para os filtros
      const { data, error } = await query;

      if (error) throw error;
      
      // Armazena dados brutos para filtros hierárquicos
      setFilterOptionsRaw(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar preços",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const applyFilters = async () => {
    try {
      let query = supabase.from("fuel_prices_analysis").select("*", { count: 'exact' });

      // Aplica filtro de escopo da licença
      if (networkData?.fuel_analysis_scope === "estado" && networkData.location_estado) {
        query = query.eq("estado", networkData.location_estado);
      }

      // Aplica filtros do usuário
      if (selectedEstado !== "all") {
        query = query.eq("estado", selectedEstado);
      }

      if (selectedMunicipio !== "all") {
        query = query.eq("municipio", selectedMunicipio);
      }

      if (selectedBairro !== "all") {
        query = query.eq("bairro", selectedBairro);
      }

      if (selectedProduto !== "all") {
        query = query.eq("produto", selectedProduto);
      }

      if (selectedMes !== "all") {
        // Formato: "2025-01"
        const [year, month] = selectedMes.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-${new Date(parseInt(year), parseInt(month), 0).getDate()}`;
        query = query.gte("data_coleta", startDate).lte("data_coleta", endDate);
      }

      const { data, error, count } = await query
        .order("data_coleta", { ascending: false })
        .limit(10000);

      if (error) throw error;

      setTotalRecords(count || 0);
      setFilteredPrices(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao aplicar filtros",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Filtros hierárquicos
  const estados = Array.from(new Set(filterOptionsRaw.map(p => p.estado).filter(Boolean))).sort();
  
  const municipios = Array.from(new Set(
    filterOptionsRaw
      .filter(p => selectedEstado === "all" || p.estado === selectedEstado)
      .map(p => p.municipio)
      .filter(Boolean)
  )).sort();
  
  const bairros = Array.from(new Set(
    filterOptionsRaw
      .filter(p => 
        (selectedEstado === "all" || p.estado === selectedEstado) &&
        (selectedMunicipio === "all" || p.municipio === selectedMunicipio)
      )
      .map(p => p.bairro)
      .filter(Boolean)
  )).sort();
  
  const produtos = Array.from(new Set(filterOptionsRaw.map(p => p.produto).filter(Boolean))).sort();
  
  const meses = Array.from(new Set(
    filterOptionsRaw
      .map(p => {
        if (!p.data_coleta) return null;
        const date = new Date(p.data_coleta);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      })
      .filter(Boolean)
  )).sort().reverse();

  const avgByProduct = produtos.map(produto => {
    const prices = filteredPrices.filter(p => p.produto === produto);
    if (prices.length === 0) return null;
    
    const avg = prices.reduce((sum, p) => sum + p.preco_revenda, 0) / prices.length;
    const min = Math.min(...prices.map(p => p.preco_revenda));
    const max = Math.max(...prices.map(p => p.preco_revenda));
    
    return { produto, avg, min, max, count: prices.length };
  }).filter(Boolean);

  // Tendência de preços ao longo do tempo (últimos registros por data)
  const pricesByDate = filteredPrices.reduce((acc, p) => {
    const date = p.data_coleta.split('T')[0];
    if (!acc[date]) acc[date] = {};
    if (!acc[date][p.produto]) acc[date][p.produto] = [];
    acc[date][p.produto].push(p.preco_revenda);
    return acc;
  }, {} as Record<string, Record<string, number[]>>);

  const trendData = Object.entries(pricesByDate)
    .map(([date, produtos]) => ({
      data: date.split('-').reverse().join('/'),
      ...Object.fromEntries(
        Object.entries(produtos).map(([produto, precos]) => [
          produto,
          precos.reduce((sum, p) => sum + p, 0) / precos.length
        ])
      )
    }))
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(-10);

  // Top 5 postos mais baratos por produto
  const cheapestStations = produtos.map(produto => {
    const stationPrices = filteredPrices
      .filter(p => p.produto === produto)
      .reduce((acc, p) => {
        const key = `${p.cnpj}-${p.produto}`;
        if (!acc[key] || p.preco_revenda < acc[key].preco) {
          acc[key] = {
            produto: p.produto,
            preco: p.preco_revenda,
            bandeira: p.bandeira,
            endereco: p.endereco,
            bairro: p.bairro
          };
        }
        return acc;
      }, {} as Record<string, any>);

    return {
      produto,
      postos: Object.values(stationPrices)
        .sort((a: any, b: any) => a.preco - b.preco)
        .slice(0, 5)
    };
  });

  // Distribuição de preços por bandeira
  const pricesByBrand = filteredPrices.reduce((acc, p) => {
    if (!acc[p.bandeira]) acc[p.bandeira] = [];
    acc[p.bandeira].push(p.preco_revenda);
    return acc;
  }, {} as Record<string, number[]>);

  const brandStats = Object.entries(pricesByBrand).map(([bandeira, precos]) => ({
    bandeira,
    media: precos.reduce((sum, p) => sum + p, 0) / precos.length,
    count: precos.length
  })).sort((a, b) => b.count - a.count).slice(0, 6);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#82ca9d', '#ffc658', '#ff8042'];

  // Insights automáticos
  const insights = [];
  
  if (avgByProduct.length > 0) {
    const mostExpensive = avgByProduct.reduce((prev: any, curr: any) => 
      curr.avg > prev.avg ? curr : prev
    );
    const cheapest = avgByProduct.reduce((prev: any, curr: any) => 
      curr.avg < prev.avg ? curr : prev
    );
    
    insights.push({
      type: 'info',
      title: 'Produto mais caro',
      description: `${mostExpensive.produto} com média de R$ ${mostExpensive.avg.toFixed(3)}`
    });
    
    insights.push({
      type: 'success',
      title: 'Melhor oportunidade',
      description: `${cheapest.produto} com média de R$ ${cheapest.avg.toFixed(3)}`
    });
  }

  if (brandStats.length > 0) {
    const dominantBrand = brandStats[0];
    insights.push({
      type: 'info',
      title: 'Bandeira dominante',
      description: `${dominantBrand.bandeira} representa ${((dominantBrand.count / filteredPrices.length) * 100).toFixed(0)}% dos postos`
    });
  }

  if (isLoading) {
    return <LoadingPage />;
  }

  return (
    <FuelAnalysisGuard>
      <div className="min-h-screen bg-background p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Fuel className="h-8 w-8" />
              Dashboard de Combustível
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Dados ANP • Escopo: <Badge variant="outline">{networkData?.fuel_analysis_scope}</Badge>
              {totalRecords > 0 && <span> • {totalRecords.toLocaleString()} registros totais</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/levaloja/combustivel/analise")}>
              Ver Análise Detalhada
            </Button>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de Registros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredPrices.length}</div>
              <p className="text-xs text-muted-foreground">preços coletados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Produtos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{produtos.length}</div>
              <p className="text-xs text-muted-foreground">tipos de combustível</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Municípios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{municipios.length}</div>
              <p className="text-xs text-muted-foreground">na análise</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Estados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estados.length}</div>
              <p className="text-xs text-muted-foreground">cobertos</p>
            </CardContent>
          </Card>
        </div>

        {/* Insights Automáticos */}
        {insights.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insights.map((insight, idx) => (
              <Alert key={idx} variant={insight.type === 'success' ? 'default' : 'default'}>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{insight.title}</AlertTitle>
                <AlertDescription>{insight.description}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {networkData?.fuel_analysis_scope === "brasil" && estados.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estado</label>
                  <Select value={selectedEstado} onValueChange={setSelectedEstado}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {estados.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {municipios.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Município</label>
                  <Select value={selectedMunicipio} onValueChange={setSelectedMunicipio}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {municipios.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {bairros.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Bairro</label>
                  <Select value={selectedBairro} onValueChange={setSelectedBairro}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {bairros.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Produto</label>
                <Select value={selectedProduto} onValueChange={setSelectedProduto}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {produtos.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Mês</label>
              <Select value={selectedMes} onValueChange={setSelectedMes}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {meses.map(mes => {
                    const [year, month] = mes.split('-');
                    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                                      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                    return (
                      <SelectItem key={mes} value={mes}>
                        {monthNames[parseInt(month) - 1]} {year}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de Tendência */}
        {trendData.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Tendência de Preços (Últimos 10 Dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="data" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  {produtos.map((produto, idx) => (
                    <Line
                      key={produto}
                      type="monotone"
                      dataKey={produto}
                      stroke={COLORS[idx % COLORS.length]}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Gráfico de Comparação de Preços */}
        <Card>
          <CardHeader>
            <CardTitle>Preços Médios por Combustível</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={avgByProduct}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="produto" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="avg" fill="hsl(var(--primary))" name="Média" />
                <Bar dataKey="min" fill="hsl(var(--success))" name="Mínimo" />
                <Bar dataKey="max" fill="hsl(var(--destructive))" name="Máximo" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição por Bandeira */}
        {brandStats.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Preço Médio por Bandeira</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={brandStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="bandeira" type="category" width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="media" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Participação de Mercado</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={brandStats}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ bandeira, count }) => `${bandeira} (${count})`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {brandStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Top 5 Postos Mais Baratos */}
        {cheapestStations.filter(s => s.postos.length > 0).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Postos Mais Econômicos por Combustível
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {cheapestStations
                  .filter(s => s.postos.length > 0)
                  .map((item) => (
                    <div key={item.produto} className="space-y-3">
                      <h3 className="font-semibold text-lg border-b pb-2">{item.produto}</h3>
                      <div className="space-y-2">
                        {item.postos.map((posto: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{posto.bandeira}</Badge>
                                <span className="text-sm text-muted-foreground">{posto.bairro}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{posto.endereco}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-success">
                                R$ {posto.preco.toFixed(2)}
                              </div>
                              <p className="text-xs text-muted-foreground">#{idx + 1} mais barato</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cards de Combustíveis */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {avgByProduct.map((item: any) => {
            const variance = item.max - item.min;
            const variancePercent = ((variance / item.avg) * 100).toFixed(1);

            return (
              <Card key={item.produto}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    {item.produto}
                    <Activity className="h-5 w-5 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-3xl font-bold">
                      R$ {item.avg.toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">preço médio</p>
                  </div>

                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-1 text-success">
                      <TrendingDown className="h-4 w-4" />
                      <span>R$ {item.min.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-destructive">
                      <TrendingUp className="h-4 w-4" />
                      <span>R$ {item.max.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Variação: </span>
                      <span className="font-semibold">{variancePercent}%</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.count} registros
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </FuelAnalysisGuard>
  );
}
