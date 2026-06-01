import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Star, Loader2, Calendar, Package, MapPin, CreditCard, User, Search, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

export default function LevaOneResgates() {
  const { toast } = useToast();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [filteredRedemptions, setFilteredRedemptions] = useState<Redemption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadRedemptions();
  }, []);

  useEffect(() => {
    filterRedemptions();
  }, [searchTerm, redemptions]);

  const loadRedemptions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar network_id do gestor
      const { data: manager } = await supabase
        .from('store_managers')
        .select('network_id')
        .eq('user_id', user.id)
        .is('store_id', null)
        .single();

      if (!manager) {
        toast({
          title: "Erro",
          description: "Usuário não associado a uma rede",
          variant: "destructive"
        });
        return;
      }

      setNetworkId(manager.network_id);

      // Buscar resgates da rede
      const { data, error } = await supabase
        .from('one_promotion_redemptions')
        .select(`
          *,
          one_promotions!inner(name, promotion_type, location_type, network_id),
          clients!inner(full_name, email, phone),
          stores(id, name, address)
        `)
        .eq('one_promotions.network_id', manager.network_id)
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
    if (!searchTerm.trim()) {
      setFilteredRedemptions(redemptions);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = redemptions.filter(r =>
      r.clients.full_name.toLowerCase().includes(term) ||
      r.clients.email.toLowerCase().includes(term) ||
      r.one_promotions.name.toLowerCase().includes(term) ||
      r.metadata?.card_number?.toLowerCase().includes(term)
    );
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
    const headers = ['Data', 'Cliente', 'Email', 'Promoção', 'Tipo', 'Local', 'Loja', 'Cartão ONE'];
    const rows = filteredRedemptions.map(r => [
      formatDate(r.redeemed_at),
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
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
          <div>
            <h1 className="text-3xl font-bold">Resgates Leva+ One</h1>
            <p className="text-muted-foreground">Histórico de promoções resgatadas pelos clientes</p>
          </div>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Card de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Star className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Resgates</p>
              <h3 className="text-2xl font-bold">{redemptions.length}</h3>
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
                {new Set(redemptions.map(r => r.client_id)).size}
              </h3>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <Package className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Promoções Diferentes</p>
              <h3 className="text-2xl font-bold">
                {new Set(redemptions.map(r => r.promotion_id)).size}
              </h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente, email, promoção ou cartão ONE..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabela de Resgates */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
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
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'Nenhum resgate encontrado com esse filtro' : 'Nenhum resgate realizado ainda'}
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
