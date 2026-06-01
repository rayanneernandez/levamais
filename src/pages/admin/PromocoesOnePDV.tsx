import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingCart, Loader2, Calendar, Search, Download, DollarSign, Package, Store, TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PDVPromotion {
  id: string;
  sale_code: string;
  sale_date: string;
  sale_time: string;
  total_value: number;
  discount_value: number;
  client_name: string;
  client_cpf: string;
  card_number: string;
  promotion_name: string;
  promotion_type: string;
  product_code: string;
  product_name: string;
  store_name: string;
  network_name: string;
  created_at: string;
}

export default function PromocoesOnePDV() {
  const { toast } = useToast();
  const [promotions, setPromotions] = useState<PDVPromotion[]>([]);
  const [filteredPromotions, setFilteredPromotions] = useState<PDVPromotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  useEffect(() => {
    filterPromotions();
  }, [searchTerm, selectedStore, promotions]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Buscar lojas
      const { data: storesData } = await supabase
        .from('stores')
        .select('id, name')
        .order('name');

      setStores(storesData || []);

      // Buscar transações com promoções ONE aplicadas
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('webposto_transactions')
        .select(`
          *,
          stores!inner(
            name,
            network_id,
            networks!inner(name)
          )
        `)
        .not('metadata->promocao_one', 'is', null)
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .order('created_at', { ascending: false });

      if (transactionsError) throw transactionsError;

      // Transformar dados para o formato esperado
      const formattedData: PDVPromotion[] = (transactionsData || []).map((t: any) => ({
        id: t.id,
        sale_code: t.sale_code,
        sale_date: t.sale_date,
        sale_time: t.sale_time,
        total_value: t.total_value,
        discount_value: t.metadata?.promocao_one?.desconto || 0,
        client_name: t.metadata?.promocao_one?.cliente_nome || 'N/A',
        client_cpf: t.client_cpf || 'N/A',
        card_number: t.metadata?.promocao_one?.cartao_numero || 'N/A',
        promotion_name: t.metadata?.promocao_one?.promocao_nome || 'N/A',
        promotion_type: t.metadata?.promocao_one?.tipo || 'N/A',
        product_code: t.metadata?.promocao_one?.produto_codigo || 'N/A',
        product_name: t.metadata?.promocao_one?.produto_nome || 'N/A',
        store_name: t.stores?.name || 'N/A',
        network_name: t.stores?.networks?.name || 'N/A',
        created_at: t.created_at
      }));

      setPromotions(formattedData);
      setFilteredPromotions(formattedData);
    } catch (error: any) {
      console.error('Error loading PDV promotions:', error);
      toast({
        title: "Erro ao carregar promoções",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterPromotions = () => {
    let filtered = promotions;

    // Filtro por loja
    if (selectedStore !== "all") {
      filtered = filtered.filter(p => p.store_name === stores.find(s => s.id === selectedStore)?.name);
    }

    // Filtro por busca (produto, cliente, código de venda)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.product_name.toLowerCase().includes(term) ||
        p.product_code.toLowerCase().includes(term) ||
        p.client_name.toLowerCase().includes(term) ||
        p.sale_code.toLowerCase().includes(term) ||
        p.promotion_name.toLowerCase().includes(term)
      );
    }

    setFilteredPromotions(filtered);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getTotalDiscount = () => {
    return filteredPromotions.reduce((sum, p) => sum + p.discount_value, 0);
  };

  const getTotalValue = () => {
    return filteredPromotions.reduce((sum, p) => sum + p.total_value, 0);
  };

  const exportToCSV = () => {
    const headers = [
      'Data', 'Hora', 'Código Venda', 'Rede', 'Loja', 'Cliente', 
      'CPF', 'Cartão ONE', 'Promoção', 'Produto Código', 'Produto Nome', 
      'Valor Total', 'Desconto'
    ];
    
    const rows = filteredPromotions.map(p => [
      formatDate(p.sale_date),
      p.sale_time,
      p.sale_code,
      p.network_name,
      p.store_name,
      p.client_name,
      p.client_cpf,
      p.card_number,
      p.promotion_name,
      p.product_code,
      p.product_name,
      formatCurrency(p.total_value),
      formatCurrency(p.discount_value)
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `promocoes-one-pdv-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Promoções ONE - PDV</h1>
            <p className="text-muted-foreground">Promoções aplicadas no ponto de venda</p>
          </div>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Card de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Vendas</p>
              <h3 className="text-2xl font-bold">{filteredPromotions.length}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor Total</p>
              <h3 className="text-xl font-bold">{formatCurrency(getTotalValue())}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-red-100 dark:bg-red-900 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Descontos</p>
              <h3 className="text-xl font-bold">{formatCurrency(getTotalDiscount())}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <Store className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lojas Participantes</p>
              <h3 className="text-2xl font-bold">
                {new Set(filteredPromotions.map(p => p.store_name)).size}
              </h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Data Inicial</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Data Final</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Loja</Label>
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as lojas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as lojas</SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Produto, cliente, código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Tabela de Promoções */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Cód. Venda</TableHead>
                <TableHead>Rede/Loja</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Promoção</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Desconto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPromotions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {searchTerm || selectedStore !== "all" 
                      ? 'Nenhuma promoção encontrada com esses filtros' 
                      : 'Nenhuma promoção aplicada no período'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredPromotions.map((promo) => (
                  <TableRow key={promo.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(promo.sale_date)}
                        </div>
                        <span className="text-xs text-muted-foreground">{promo.sale_time}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{promo.sale_code}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{promo.network_name}</span>
                        <span className="text-xs text-muted-foreground">{promo.store_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{promo.client_name}</span>
                        <Badge variant="secondary" className="text-xs mt-1 w-fit">
                          {promo.card_number}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{promo.promotion_name}</span>
                        <Badge className="mt-1 w-fit bg-green-500 text-white text-xs">
                          Leve + Pague -
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{promo.product_name}</span>
                        <span className="text-xs text-muted-foreground">Cód: {promo.product_code}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(promo.total_value)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className="bg-red-500 text-white">
                        -{formatCurrency(promo.discount_value)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
