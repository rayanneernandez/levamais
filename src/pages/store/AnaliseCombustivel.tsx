import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MapPin, TrendingDown, TrendingUp, ArrowLeft } from "lucide-react";
import { FuelAnalysisGuard } from "@/components/store/FuelAnalysisGuard";
import { LoadingPage } from "@/components/ui/loading-page";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface FuelPrice {
  id: string;
  produto: string;
  preco_revenda: number;
  data_coleta: string;
  municipio: string;
  estado: string;
  bandeira: string;
  bairro: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  endereco: string;
  numero: string;
  complemento: string | null;
}

interface NetworkData {
  fuel_analysis_scope: string;
  location_estado?: string;
}

export default function AnaliseCombustivel() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [filteredPrices, setFilteredPrices] = useState<FuelPrice[]>([]);
  
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
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [statsData, setStatsData] = useState<FuelPrice[]>([]);
  const RECORDS_PER_PAGE = 100;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    applyFilters();
  }, [selectedEstado, selectedMunicipio, selectedBairro, selectedProduto, selectedMes]);

  useEffect(() => {
    applyFilters();
  }, [currentPage]);

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
      let query = supabase.from("fuel_prices_analysis").select("estado, municipio, bairro, produto, data_coleta").order("data_coleta", { ascending: false });

      if (network.fuel_analysis_scope === "estado" && network.location_estado) {
        query = query.eq("estado", network.location_estado);
        setSelectedEstado(network.location_estado);
      }

      if (network.fuel_analysis_scope === "municipio" && network.location_estado) {
        query = query.eq("estado", network.location_estado);
        setSelectedEstado(network.location_estado);
      }

      const { data, error } = await query.limit(10000);

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
        const [year, month] = selectedMes.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-${new Date(parseInt(year), parseInt(month), 0).getDate()}`;
        query = query.gte("data_coleta", startDate).lte("data_coleta", endDate);
      }

      // Busca estatísticas (sem paginação, apenas para calcular médias)
      const { data: statsResult, error: statsError } = await query
        .order("data_coleta", { ascending: false })
        .limit(10000);
        
      if (statsError) throw statsError;
      setStatsData(statsResult || []);

      // Paginação para exibição dos postos
      const offset = (currentPage - 1) * RECORDS_PER_PAGE;
      const { data, error, count } = await query
        .order("data_coleta", { ascending: false })
        .range(offset, offset + RECORDS_PER_PAGE - 1);

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
    const prices = statsData.filter(p => p.produto === produto);
    if (prices.length === 0) return null;
    
    const avg = prices.reduce((sum, p) => sum + p.preco_revenda, 0) / prices.length;
    const min = Math.min(...prices.map(p => p.preco_revenda));
    const max = Math.max(...prices.map(p => p.preco_revenda));
    
    return { produto, media: avg, minimo: min, maximo: max, quantidade: prices.length };
  }).filter(Boolean) as Array<{ produto: string; media: number; minimo: number; maximo: number; quantidade: number }>;

  // Agrupa por CNPJ para mostrar cada posto único
  const postosByKey = new Map<string, {
    cnpj: string;
    bandeira: string;
    endereco: string;
    data_coleta: string;
    produtos: Array<{ produto: string; preco: number }>;
  }>();

  filteredPrices.forEach(p => {
    if (!postosByKey.has(p.cnpj)) {
      postosByKey.set(p.cnpj, {
        cnpj: p.cnpj,
        bandeira: p.bandeira,
        endereco: p.endereco,
        data_coleta: p.data_coleta,
        produtos: []
      });
    }
    const posto = postosByKey.get(p.cnpj)!;
    const produtoExiste = posto.produtos.find(prod => prod.produto === p.produto);
    if (!produtoExiste) {
      posto.produtos.push({
        produto: p.produto,
        preco: p.preco_revenda
      });
    }
  });

  const postos = Array.from(postosByKey.values()).map((posto, index) => ({
    id: posto.cnpj,
    numero: index + 1,
    bandeira: posto.bandeira,
    endereco: posto.endereco,
    data: posto.data_coleta.split('T')[0].split('-').reverse().join('/'),
    produtos: posto.produtos
  }));

  // Só esconde filtro de estado se licença não for Brasil
  const canFilterEstado = networkData?.fuel_analysis_scope === "brasil";
  // Município e Bairro sempre disponíveis
  const canFilterMunicipio = true;
  const canFilterBairro = true;

  if (isLoading) {
    return <LoadingPage />;
  }

  return (
    <FuelAnalysisGuard>
      <div className="min-h-screen bg-background p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Análise Detalhada de Combustível</h1>
            <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <span>Dados ANP • Escopo:</span>
              <Badge variant="outline">{networkData?.fuel_analysis_scope}</Badge>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/levaloja/combustivel/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {canFilterEstado && estados.length > 0 && (
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

        {/* Resumo Estatístico */}
        <Card>
          <CardHeader>
            <CardTitle>Resumo Estatístico por Produto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {avgByProduct.map(item => (
                <div key={item.produto} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-lg">{item.produto}</h3>
                    <Badge variant="outline">{item.quantidade} registros</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Preço Médio</p>
                      <p className="text-2xl font-bold">R$ {item.media.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-success" />
                      <div>
                        <p className="text-xs text-muted-foreground">Mínimo</p>
                        <p className="text-lg font-semibold">R$ {item.minimo.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-destructive" />
                      <div>
                        <p className="text-xs text-muted-foreground">Máximo</p>
                        <p className="text-lg font-semibold">R$ {item.maximo.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Postos Anonimizados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Postos na Região (Anonimizados)
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Dados dos postos pesquisados pela ANP, sem identificação de CNPJ, razão social ou endereço completo
            </p>
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Total: {totalRecords} registros • Página {currentPage} de {Math.ceil(totalRecords / RECORDS_PER_PAGE)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={currentPage >= Math.ceil(totalRecords / RECORDS_PER_PAGE)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {postos.map(posto => (
                <div key={posto.id} className="border rounded-lg p-4">
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-lg">Posto {posto.numero} • {posto.bandeira}</h3>
                      <Badge variant="outline">Coleta: {posto.data}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{posto.endereco}</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {posto.produtos.map((prod, idx) => (
                      <div key={idx} className="bg-muted/50 rounded p-3">
                        <p className="text-xs text-muted-foreground mb-1">{prod.produto}</p>
                        <p className="text-lg font-bold">R$ {prod.preco.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </FuelAnalysisGuard>
  );
}
