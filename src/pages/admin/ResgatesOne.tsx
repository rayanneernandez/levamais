import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Star, Loader2, Calendar, User, Search, Download, Building2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
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

interface Redemption {
  id: string;
  promotion_id: string;
  client_id: string;
  store_id: string | null;
  redeemed_at: string;
  benefit_value: number;
  metadata: any;
  one_promotions: {
    name: string;
    promotion_type: string;
    location_type: string;
    network_id: string;
    networks: {
      name: string;
    };
  };
  clients: {
    full_name: string;
    email: string;
    phone: string;
  };
  stores: {
    id: string;
    name: string;
    address: string;
  } | null;
}

export default function ResgatesOne() {
  const { toast } = useToast();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [filteredRedemptions, setFilteredRedemptions] = useState<Redemption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [networks, setNetworks] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterRedemptions();
  }, [searchTerm, selectedNetwork, redemptions]);

  const loadData = async () => {
    try {
      // Buscar redes
      const { data: networksData } = await supabase
        .from('networks')
        .select('id, name')
        .order('name');

      setNetworks(networksData || []);

      // Buscar todos os resgates
      const { data, error } = await supabase
        .from('one_promotion_redemptions')
        .select(`
          *,
          one_promotions!inner(
            name,
            promotion_type,
            location_type,
            network_id,
            networks!inner(name)
          ),
          clients!inner(full_name, email, phone),
          stores(id, name, address)
        `)
        .order('redeemed_at', { ascending: false });

      if (error) throw error;

      setRedemptions((data || []) as Redemption[]);
      setFilteredRedemptions((data || []) as Redemption[]);
    } catch (error: any) {
      console.error('Error loading redemptions:', error);
      toast({
        title: "Erro ao carregar resgates",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterRedemptions = () => {
    let filtered = redemptions;

    // Filtro por rede
    if (selectedNetwork !== "all") {
      filtered = filtered.filter(r => r.one_promotions.network_id === selectedNetwork);
    }

    // Filtro por busca
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.clients.full_name.toLowerCase().includes(term) ||
        r.clients.email.toLowerCase().includes(term) ||
        r.one_promotions.name.toLowerCase().includes(term) ||
        r.one_promotions.networks.name.toLowerCase().includes(term) ||
        r.metadata?.card_number?.toLowerCase().includes(term)
      );
    }

    setFilteredRedemptions(filtered);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const getPromotionTypeBadge = (type: string) => {
    const types: { [key: string]: { label: string; color: string } } = {
      'percentage': { label: 'Desconto', color: 'bg-blue-500' },
      'buy_x_get_y': { label: 'Leve + Pague -', color: 'bg-green-500' },
      'combo': { label: 'Combo', color: 'bg-purple-500' }
    };
    const typeInfo = types[type] || { label: type, color: 'bg-gray-500' };
    return (
      <Badge className={`${typeInfo.color} text-white text-xs`}>
        {typeInfo.label}
      </Badge>
    );
  };

  const getLocationBadge = (locationType: string) => {
    const icons: { [key: string]: { icon: string; label: string } } = {
      'pista': { icon: '🚗', label: 'Pista' },
      'loja': { icon: '🏪', label: 'Loja' },
      'ambos': { icon: '🚗🏪', label: 'Ambos' }
    };
    const locationInfo = icons[locationType] || { icon: '📍', label: locationType };
    return (
      <Badge variant="outline" className="text-xs">
        {locationInfo.icon} {locationInfo.label}
      </Badge>
    );
  };

  const exportToCSV = () => {
    const headers = ['Data', 'Rede', 'Cliente', 'Email', 'Promoção', 'Tipo', 'Local', 'Loja', 'Cartão ONE'];
    const rows = filteredRedemptions.map(r => [
      formatDate(r.redeemed_at),
      r.one_promotions.networks.name,
      r.clients.full_name,
      r.clients.email,
      r.one_promotions.name,
      r.one_promotions.promotion_type,
      r.one_promotions.location_type,
      r.stores?.name || 'N/A',
      r.metadata?.card_number || 'N/A'
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `resgates-one-${format(new Date(), 'yyyy-MM-dd')}.csv`;
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
          <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
          <div>
            <h1 className="text-3xl font-bold">Resgates Leva+ One</h1>
            <p className="text-muted-foreground">Histórico completo de resgates em todas as redes</p>
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
              <Star className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Resgates</p>
              <h3 className="text-2xl font-bold">{filteredRedemptions.length}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <User className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Clientes Únicos</p>
              <h3 className="text-2xl font-bold">
                {new Set(filteredRedemptions.map(r => r.client_id)).size}
              </h3>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Redes Participantes</p>
              <h3 className="text-2xl font-bold">
                {new Set(filteredRedemptions.map(r => r.one_promotions.network_id)).size}
              </h3>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Hoje</p>
              <h3 className="text-2xl font-bold">
                {filteredRedemptions.filter(r => 
                  format(new Date(r.redeemed_at), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                ).length}
              </h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, email, promoção, rede ou cartão ONE..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Todas as redes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as redes</SelectItem>
            {networks.map((network) => (
              <SelectItem key={network.id} value={network.id}>
                {network.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela de Resgates */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Rede</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Promoção</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Loja</TableHead>
                <TableHead>Cartão ONE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRedemptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {searchTerm || selectedNetwork !== "all" ? 'Nenhum resgate encontrado com esses filtros' : 'Nenhum resgate realizado ainda'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRedemptions.map((redemption) => (
                  <TableRow key={redemption.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatDate(redemption.redeemed_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {redemption.one_promotions.networks.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{redemption.clients.full_name}</p>
                        <p className="text-xs text-muted-foreground">{redemption.clients.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{redemption.one_promotions.name}</p>
                    </TableCell>
                    <TableCell>
                      {getPromotionTypeBadge(redemption.one_promotions.promotion_type)}
                    </TableCell>
                    <TableCell>
                      {getLocationBadge(redemption.one_promotions.location_type)}
                    </TableCell>
                    <TableCell>
                      {redemption.stores ? (
                        <div className="text-sm">
                          <p className="font-medium">{redemption.stores.name}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {redemption.metadata?.card_number ? (
                        <Badge variant="secondary" className="text-xs">
                          {redemption.metadata.card_number}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">N/A</span>
                      )}
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
