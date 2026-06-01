import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Package, 
  MapPin
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ProductAnalysis {
  product_name: string;
  normalized_name: string;
  total_quantity: number;
  total_revenue: number;
  avg_price: number;
  min_price: number;
  max_price: number;
  sales_count: number;
}

interface RegionAnalysis {
  state: string;
  city: string;
  neighborhood: string;
  store_name: string;
  product_name: string;
  avg_price: number;
  total_quantity: number;
  sales_count: number;
}

export default function Vendas() {
  const [selectedNetwork, setSelectedNetwork] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>(
    format(new Date(new Date().setMonth(new Date().getMonth() - 1)), "yyyy-MM-dd")
  );
  const [dateTo, setDateTo] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  
  // Paginação
  const [productsPage, setProductsPage] = useState(1);
  const [regionsPage, setRegionsPage] = useState(1);
  const [rankingRevenuePage, setRankingRevenuePage] = useState(1);
  const [rankingVolumePage, setRankingVolumePage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Query para buscar redes
  const { data: networks } = useQuery({
    queryKey: ["networks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("networks")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  // Query para buscar transações e fazer análise
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions-analysis", selectedNetwork, selectedState, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("webposto_transactions")
        .select(`
          *,
          clients(address_state, address_city, address_neighborhood),
          stores(name, address),
          networks(name)
        `)
        .eq("status", "confirmed")
        .gte("data_venda", dateFrom)
        .lte("data_venda", dateTo);

      if (selectedNetwork !== "all") {
        query = query.eq("network_id", selectedNetwork);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Processar dados para análise de produtos
  const productAnalysis: ProductAnalysis[] = transactions
    ? Object.values(
        transactions.reduce((acc: any, tx: any) => {
          const produtos = Array.isArray(tx.produtos) ? tx.produtos : [];
          
          produtos.forEach((p: any) => {
            const normalized = (p.nomeProduto || "").toUpperCase().trim();
            if (!acc[normalized]) {
              acc[normalized] = {
                product_name: p.nomeProduto,
                normalized_name: normalized,
                total_quantity: 0,
                total_revenue: 0,
                prices: [],
                sales_count: 0,
              };
            }
            
            const qty = parseFloat(p.quantidade || 0);
            const price = parseFloat(p.valorUnitario || 0);
            
            acc[normalized].total_quantity += qty;
            acc[normalized].total_revenue += parseFloat(p.valorTotal || 0);
            acc[normalized].prices.push(price);
            acc[normalized].sales_count += 1;
          });
          
          return acc;
        }, {})
      ).map((item: any) => ({
        product_name: item.product_name,
        normalized_name: item.normalized_name,
        total_quantity: item.total_quantity,
        total_revenue: item.total_revenue,
        avg_price: item.prices.reduce((a: number, b: number) => a + b, 0) / item.prices.length,
        min_price: Math.min(...item.prices),
        max_price: Math.max(...item.prices),
        sales_count: item.sales_count,
      }))
    : [];

  // Processar dados para análise por região
  const regionAnalysis: RegionAnalysis[] = transactions
    ? transactions.flatMap((tx: any) => {
        const produtos = Array.isArray(tx.produtos) ? tx.produtos : [];
        const state = tx.clients?.address_state || "N/D";
        const city = tx.clients?.address_city || "N/D";
        const neighborhood = tx.clients?.address_neighborhood || "N/D";
        const storeName = tx.stores?.name || "N/D";
        
        return produtos.map((p: any) => ({
          state,
          city,
          neighborhood,
          store_name: storeName,
          product_name: p.nomeProduto,
          avg_price: parseFloat(p.valorUnitario || 0),
          total_quantity: parseFloat(p.quantidade || 0),
          sales_count: 1,
        }));
      })
    : [];

  // Estados únicos
  const states = Array.from(
    new Set(
      regionAnalysis
        .map((r) => r.state)
        .filter((s) => s !== "N/D")
    )
  ).sort();

  // Filtrar por estado
  const filteredRegionAnalysis = selectedState === "all" 
    ? regionAnalysis 
    : regionAnalysis.filter((r) => r.state === selectedState);

  // Agregar dados por região e produto
  const regionProductAgg = Object.values(
    filteredRegionAnalysis.reduce((acc: any, item) => {
      const key = `${item.state}-${item.city}-${item.neighborhood}-${item.store_name}-${item.product_name}`;
      if (!acc[key]) {
        acc[key] = {
          ...item,
          total_quantity: 0,
          sales_count: 0,
          prices: [],
        };
      }
      acc[key].total_quantity += item.total_quantity;
      acc[key].sales_count += 1;
      acc[key].prices.push(item.avg_price);
      return acc;
    }, {})
  ).map((item: any) => ({
    ...item,
    avg_price: item.prices.reduce((a: number, b: number) => a + b, 0) / item.prices.length,
  }));

  // Métricas gerais
  const totalRevenue = productAnalysis.reduce((sum, p) => sum + p.total_revenue, 0);
  const totalProducts = productAnalysis.length;
  const totalSales = transactions?.length || 0;
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

  // Dados ordenados e paginados
  const sortedProducts = productAnalysis.sort((a, b) => b.total_revenue - a.total_revenue);
  const totalProductsPages = Math.ceil(sortedProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = sortedProducts.slice(
    (productsPage - 1) * ITEMS_PER_PAGE,
    productsPage * ITEMS_PER_PAGE
  );

  const sortedRegions = regionProductAgg.sort((a: any, b: any) => b.total_quantity - a.total_quantity);
  const totalRegionsPages = Math.ceil(sortedRegions.length / ITEMS_PER_PAGE);
  const paginatedRegions = sortedRegions.slice(
    (regionsPage - 1) * ITEMS_PER_PAGE,
    regionsPage * ITEMS_PER_PAGE
  );

  const sortedByRevenue = productAnalysis.sort((a, b) => b.total_revenue - a.total_revenue);
  const totalRevenuePages = Math.ceil(sortedByRevenue.length / ITEMS_PER_PAGE);
  const paginatedRevenue = sortedByRevenue.slice(
    (rankingRevenuePage - 1) * ITEMS_PER_PAGE,
    rankingRevenuePage * ITEMS_PER_PAGE
  );

  const sortedByVolume = productAnalysis.sort((a, b) => b.total_quantity - a.total_quantity);
  const totalVolumePages = Math.ceil(sortedByVolume.length / ITEMS_PER_PAGE);
  const paginatedVolume = sortedByVolume.slice(
    (rankingVolumePage - 1) * ITEMS_PER_PAGE,
    rankingVolumePage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Análise de Vendas</h1>
          <p className="text-muted-foreground text-sm mt-1">Análise detalhada de produtos e regiões</p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Rede</label>
            <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as redes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as redes</SelectItem>
                {networks?.map((network) => (
                  <SelectItem key={network.id} value={network.id}>
                    {network.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Estado</label>
            <Select value={selectedState} onValueChange={setSelectedState}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                {states.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Data Inicial</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Data Final</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Métricas Principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalRevenue.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSales}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgTicket.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produtos Únicos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Análise */}
      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products">Análise de Produtos</TabsTrigger>
          <TabsTrigger value="regions">Análise por Região</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Produtos - Preços e Volumes</CardTitle>
              <CardDescription>
                Análise de preços médios, mínimos e máximos por produto
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center py-8 text-muted-foreground">Carregando...</p>
              ) : productAnalysis.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Nenhum dado disponível para o período selecionado
                </p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd. Total</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                        <TableHead className="text-right">Preço Médio</TableHead>
                        <TableHead className="text-right">Mín</TableHead>
                        <TableHead className="text-right">Máx</TableHead>
                        <TableHead className="text-right">Vendas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedProducts.map((product, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium max-w-[300px] truncate">
                            {product.product_name}
                          </TableCell>
                          <TableCell className="text-right">
                            {product.total_quantity.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {product.total_revenue.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            {product.avg_price.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            {product.min_price.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            {product.max_price.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{product.sales_count}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {totalProductsPages > 1 && (
                    <Pagination className="mt-4">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setProductsPage(Math.max(1, productsPage - 1))}
                            className={productsPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {Array.from({ length: Math.min(5, totalProductsPages) }, (_, i) => {
                          const page = i + 1;
                          return (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => setProductsPage(page)}
                                isActive={productsPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        {totalProductsPages > 5 && <span className="px-2">...</span>}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setProductsPage(Math.min(totalProductsPages, productsPage + 1))}
                            className={productsPage === totalProductsPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análise por Região</CardTitle>
              <CardDescription>
                Preços médios e volumes por estado, cidade, bairro e loja
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center py-8 text-muted-foreground">Carregando...</p>
              ) : regionProductAgg.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Nenhum dado disponível para o período selecionado
                </p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Estado</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>Bairro</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Preço Médio</TableHead>
                        <TableHead className="text-right">Qtd. Total</TableHead>
                        <TableHead className="text-right">Vendas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRegions.map((item: any, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              {item.state}
                            </div>
                          </TableCell>
                          <TableCell>{item.city}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.neighborhood}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {item.store_name}
                          </TableCell>
                          <TableCell className="font-medium max-w-[250px] truncate">
                            {item.product_name}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.avg_price.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.total_quantity.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{item.sales_count}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {totalRegionsPages > 1 && (
                    <Pagination className="mt-4">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setRegionsPage(Math.max(1, regionsPage - 1))}
                            className={regionsPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {Array.from({ length: Math.min(5, totalRegionsPages) }, (_, i) => {
                          const page = i + 1;
                          return (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => setRegionsPage(page)}
                                isActive={regionsPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        {totalRegionsPages > 5 && <span className="px-2">...</span>}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setRegionsPage(Math.min(totalRegionsPages, regionsPage + 1))}
                            className={regionsPage === totalRegionsPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ranking" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top - Maior Receita</CardTitle>
                <CardDescription>Produtos que mais geraram receita</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {paginatedRevenue.map((product, idx) => {
                    const overallRank = (rankingRevenuePage - 1) * ITEMS_PER_PAGE + idx + 1;
                    return (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{overallRank}</Badge>
                          <span className="font-medium truncate max-w-[200px]">
                            {product.product_name}
                          </span>
                        </div>
                        <span className="font-bold">
                          {product.total_revenue.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
                {totalRevenuePages > 1 && (
                  <Pagination className="mt-4">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setRankingRevenuePage(Math.max(1, rankingRevenuePage - 1))}
                          className={rankingRevenuePage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, totalRevenuePages) }, (_, i) => {
                        const page = i + 1;
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setRankingRevenuePage(page)}
                              isActive={rankingRevenuePage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      {totalRevenuePages > 5 && <span className="px-2">...</span>}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setRankingRevenuePage(Math.min(totalRevenuePages, rankingRevenuePage + 1))}
                          className={rankingRevenuePage === totalRevenuePages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top - Maior Volume</CardTitle>
                <CardDescription>Produtos mais vendidos em quantidade</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {paginatedVolume.map((product, idx) => {
                    const overallRank = (rankingVolumePage - 1) * ITEMS_PER_PAGE + idx + 1;
                    return (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{overallRank}</Badge>
                          <span className="font-medium truncate max-w-[200px]">
                            {product.product_name}
                          </span>
                        </div>
                        <span className="font-bold">
                          {product.total_quantity.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
                {totalVolumePages > 1 && (
                  <Pagination className="mt-4">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setRankingVolumePage(Math.max(1, rankingVolumePage - 1))}
                          className={rankingVolumePage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, totalVolumePages) }, (_, i) => {
                        const page = i + 1;
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setRankingVolumePage(page)}
                              isActive={rankingVolumePage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      {totalVolumePages > 5 && <span className="px-2">...</span>}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setRankingVolumePage(Math.min(totalVolumePages, rankingVolumePage + 1))}
                          className={rankingVolumePage === totalVolumePages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
