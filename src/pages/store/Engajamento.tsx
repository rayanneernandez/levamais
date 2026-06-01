import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy, TrendingUp, Users, Award, Calendar, Search, Tag } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface StoreEngagement {
  store_id: string;
  store_name: string;
  accumulation_count: number;
  redemption_count: number;
  total_amount: number;
  engagement_score: number;
  nps_score: number | null;
  nps_total_ratings: number;
}

interface AttendantEngagement {
  user_id: string;
  attendant_name: string;
  store_name: string;
  referral_count: number;
}

interface StoreWithAttendants {
  store_id: string;
  store_name: string;
  attendants: AttendantEngagement[];
}

interface UserTag {
  id: string;
  name: string;
  color: string;
}

const Engajamento = () => {
  const { toast } = useToast();
  const [storeEngagement, setStoreEngagement] = useState<StoreEngagement[]>([]);
  const [attendantEngagement, setAttendantEngagement] = useState<AttendantEngagement[]>([]);
  const [storesByAttendants, setStoresByAttendants] = useState<StoreWithAttendants[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [availableTags, setAvailableTags] = useState<UserTag[]>([]);

  useEffect(() => {
    loadNetworkId();
  }, []);

  useEffect(() => {
    if (networkId) {
      loadTags();
      loadEngagementData();
    }
  }, [networkId]);

  const loadNetworkId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('store_managers')
        .select('network_id')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setNetworkId(data.network_id);
    } catch (error) {
      console.error('Error loading network:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados da rede",
        variant: "destructive",
      });
    }
  };

  const loadTags = async () => {
    try {
      const { data, error } = await supabase
        .from('user_tags')
        .select('*')
        .eq('network_id', networkId)
        .order('name');

      if (error) throw error;
      setAvailableTags(data || []);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const loadEngagementData = async () => {
    try {
      setIsLoading(true);

      // Buscar engajamento de lojas com filtro de período
      let transactionsQuery = supabase
        .from('transactions')
        .select('store_id, type, amount, created_at');

      if (startDate) {
        transactionsQuery = transactionsQuery.gte('created_at', new Date(startDate).toISOString());
      }
      if (endDate) {
        transactionsQuery = transactionsQuery.lte('created_at', new Date(endDate + 'T23:59:59').toISOString());
      }

      const { data: transactionsData, error: transactionsError } = await transactionsQuery;

      if (transactionsError) throw transactionsError;

      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select('id, name')
        .eq('network_id', networkId);

      if (storesError) throw storesError;

      // Buscar ratings com filtro de período para calcular NPS
      let ratingsQuery = supabase
        .from('transaction_ratings')
        .select('store_id, rating, created_at');

      if (startDate) {
        ratingsQuery = ratingsQuery.gte('created_at', new Date(startDate).toISOString());
      }
      if (endDate) {
        ratingsQuery = ratingsQuery.lte('created_at', new Date(endDate + 'T23:59:59').toISOString());
      }

      const { data: ratingsData, error: ratingsError } = await ratingsQuery;

      if (ratingsError) throw ratingsError;

      // Calcular métricas de engajamento por loja
      const storeMetrics = storesData.map(store => {
        const storeTransactions = transactionsData?.filter(t => t.store_id === store.id) || [];
        const accumulations = storeTransactions.filter(t => t.type === 'accumulation');
        const redemptions = storeTransactions.filter(t => t.type === 'redemption');
        
        const totalAmount = storeTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const engagementScore = accumulations.length * 2 + redemptions.length * 3;

        // Calcular NPS da loja (escala 1-5)
        const storeRatings = ratingsData?.filter(r => r.store_id === store.id) || [];
        let npsScore: number | null = null;
        
        if (storeRatings.length > 0) {
          const promoters = storeRatings.filter(r => r.rating === 5).length;
          const detractors = storeRatings.filter(r => r.rating <= 2).length;
          npsScore = Math.round(((promoters - detractors) / storeRatings.length) * 100);
        }

        return {
          store_id: store.id,
          store_name: store.name,
          accumulation_count: accumulations.length,
          redemption_count: redemptions.length,
          total_amount: totalAmount,
          engagement_score: engagementScore,
          nps_score: npsScore,
          nps_total_ratings: storeRatings.length,
        };
      }).sort((a, b) => b.engagement_score - a.engagement_score);

      setStoreEngagement(storeMetrics);

      // Buscar engajamento de atendentes (apenas com loja definida)
      let attendantsQuery = supabase
        .from('store_managers')
        .select('user_id, store_id')
        .eq('network_id', networkId)
        .eq('is_attendant', true)
        .not('store_id', 'is', null);

      const { data: attendantsData, error: attendantsError } = await attendantsQuery;

      if (attendantsError) throw attendantsError;

      // Filtrar por tag se selecionada
      let filteredAttendants = attendantsData || [];
      if (selectedTag !== "all") {
        const { data: taggedUsers } = await supabase
          .from('store_manager_tags')
          .select('store_manager_id')
          .eq('tag_id', selectedTag);
        
        const taggedUserIds = new Set(taggedUsers?.map(t => t.store_manager_id) || []);
        filteredAttendants = filteredAttendants.filter(att => taggedUserIds.has(att.user_id));
      }

      // Buscar contagem de referrals por atendente e dados relacionados
      const attendantMetrics = await Promise.all(
        filteredAttendants.map(async (attendant) => {
          // Buscar nome do atendente
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', attendant.user_id)
            .single();

          // Buscar nome da loja
          let storeName = 'Sem loja';
          if (attendant.store_id) {
            const { data: storeData } = await supabase
              .from('stores')
              .select('name')
              .eq('id', attendant.store_id)
              .single();
            storeName = storeData?.name || 'Sem loja';
          }

          // Buscar contagem de referrals com filtro de período
          let referralsQuery = supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
            .eq('referred_by_user_id', attendant.user_id);

          if (startDate) {
            referralsQuery = referralsQuery.gte('created_at', new Date(startDate).toISOString());
          }
          if (endDate) {
            referralsQuery = referralsQuery.lte('created_at', new Date(endDate + 'T23:59:59').toISOString());
          }

          const { count, error } = await referralsQuery;

          if (error) {
            console.error('Error counting referrals:', error);
            return null;
          }

          return {
            user_id: attendant.user_id,
            attendant_name: profileData?.full_name || 'Sem nome',
            store_name: storeName,
            referral_count: count || 0,
          };
        })
      );

      const filteredMetrics = attendantMetrics
        .filter((m): m is AttendantEngagement => m !== null)
        .sort((a, b) => b.referral_count - a.referral_count);

      setAttendantEngagement(filteredMetrics);

      // Agrupar atendentes por loja
      const storeGroups = new Map<string, StoreWithAttendants>();
      
      filteredMetrics.forEach(attendant => {
        const storeId = storesData.find(s => s.name === attendant.store_name)?.id || 'no-store';
        
        if (!storeGroups.has(storeId)) {
          storeGroups.set(storeId, {
            store_id: storeId,
            store_name: attendant.store_name,
            attendants: []
          });
        }
        
        storeGroups.get(storeId)?.attendants.push(attendant);
      });

      const groupedStores = Array.from(storeGroups.values())
        .sort((a, b) => {
          const totalA = a.attendants.reduce((sum, att) => sum + att.referral_count, 0);
          const totalB = b.attendants.reduce((sum, att) => sum + att.referral_count, 0);
          return totalB - totalA;
        });

      setStoresByAttendants(groupedStores);

    } catch (error) {
      console.error('Error loading engagement data:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados de engajamento",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStoresByAttendants = storesByAttendants.map(store => ({
    ...store,
    attendants: store.attendants.filter(att =>
      att.attendant_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(store => store.attendants.length > 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Engajamento</h1>
        <p className="text-muted-foreground text-sm">
          Rankings de lojas e atendentes mais engajados
        </p>
      </div>

      {/* Filtros de Período e Tag */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Data Início</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Data Fim</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <Button onClick={loadEngagementData}>
                Filtrar
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                  setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                  setSelectedTag("all");
                  loadEngagementData();
                }}
              >
                Limpar
              </Button>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                Filtrar por Tag de Atendente
              </label>
              <Select value={selectedTag} onValueChange={setSelectedTag}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as tags</SelectItem>
                  {availableTags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ranking de Lojas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Ranking de Lojas
            </CardTitle>
            <CardDescription>
              Lojas mais engajadas baseado em acúmulos e resgates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead className="text-center">Acúmulos</TableHead>
                  <TableHead className="text-center">Resgates</TableHead>
                  <TableHead className="text-center">NPS</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storeEngagement.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum dado de engajamento disponível
                    </TableCell>
                  </TableRow>
                ) : (
                  storeEngagement.map((store, index) => (
                    <TableRow key={store.store_id}>
                      <TableCell className="font-medium">
                        {index === 0 && <Trophy className="h-4 w-4 text-yellow-500 inline mr-1" />}
                        {index === 1 && <Trophy className="h-4 w-4 text-gray-400 inline mr-1" />}
                        {index === 2 && <Trophy className="h-4 w-4 text-amber-700 inline mr-1" />}
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">{store.store_name}</TableCell>
                      <TableCell className="text-center">{store.accumulation_count}</TableCell>
                      <TableCell className="text-center">{store.redemption_count}</TableCell>
                      <TableCell className="text-center">
                        {store.nps_score !== null ? (
                          <span className={store.nps_score >= 50 ? "text-green-600 font-semibold" : store.nps_score >= 0 ? "text-yellow-600 font-semibold" : "text-red-600 font-semibold"}>
                            {store.nps_score}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({store.nps_total_ratings})
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Sem avaliações</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {store.engagement_score}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Ranking NPS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Ranking NPS
            </CardTitle>
            <CardDescription>
              Lojas ordenadas pela satisfação dos clientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead className="text-center">Avaliações</TableHead>
                  <TableHead className="text-right">NPS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storeEngagement.filter(s => s.nps_score !== null).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhuma avaliação disponível
                    </TableCell>
                  </TableRow>
                ) : (
                  [...storeEngagement]
                    .filter(s => s.nps_score !== null)
                    .sort((a, b) => (b.nps_score || 0) - (a.nps_score || 0))
                    .map((store, index) => (
                      <TableRow key={store.store_id}>
                        <TableCell className="font-medium">
                          {index === 0 && <Trophy className="h-4 w-4 text-yellow-500 inline mr-1" />}
                          {index === 1 && <Trophy className="h-4 w-4 text-gray-400 inline mr-1" />}
                          {index === 2 && <Trophy className="h-4 w-4 text-amber-700 inline mr-1" />}
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-medium">{store.store_name}</TableCell>
                        <TableCell className="text-center">{store.nps_total_ratings}</TableCell>
                        <TableCell className="text-right">
                          <span className={
                            store.nps_score! >= 50 
                              ? "text-green-600 font-bold text-lg" 
                              : store.nps_score! >= 0 
                              ? "text-yellow-600 font-bold text-lg" 
                              : "text-red-600 font-bold text-lg"
                          }>
                            {store.nps_score}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Ranking de Atendentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Ranking de Atendentes
            </CardTitle>
            <CardDescription>
              Atendentes que mais cadastraram clientes via QRCode
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Atendente</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead className="text-right">
                    <Users className="h-4 w-4 inline mr-1" />
                    Cadastros
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendantEngagement.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhum atendente cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  attendantEngagement.map((attendant, index) => (
                    <TableRow key={attendant.user_id}>
                      <TableCell className="font-medium">
                        {index === 0 && <Trophy className="h-4 w-4 text-yellow-500 inline mr-1" />}
                        {index === 1 && <Trophy className="h-4 w-4 text-gray-400 inline mr-1" />}
                        {index === 2 && <Trophy className="h-4 w-4 text-amber-700 inline mr-1" />}
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">{attendant.attendant_name}</TableCell>
                      <TableCell className="text-muted-foreground">{attendant.store_name}</TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {attendant.referral_count}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Atendentes por Posto/Loja */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Atendentes por Posto / Loja
          </CardTitle>
          <CardDescription>
            Distribuição de atendentes e seus cadastros por estabelecimento
          </CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar atendente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredStoresByAttendants.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchTerm ? "Nenhum atendente encontrado" : "Nenhuma loja com atendentes cadastrados"}
            </div>
          ) : (
            <div className="space-y-6">
              {filteredStoresByAttendants.map((store) => {
                const totalReferrals = store.attendants.reduce((sum, att) => sum + att.referral_count, 0);
                
                return (
                  <div key={store.store_id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg">{store.store_name}</h3>
                      <div className="text-sm text-muted-foreground">
                        Total: <span className="font-bold text-primary">{totalReferrals}</span> cadastros
                      </div>
                    </div>
                    
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Atendente</TableHead>
                          <TableHead className="text-right">Cadastros</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {store.attendants
                          .sort((a, b) => b.referral_count - a.referral_count)
                          .map((attendant, index) => (
                            <TableRow key={attendant.user_id}>
                              <TableCell className="font-medium">
                                {index + 1}
                              </TableCell>
                              <TableCell>{attendant.attendant_name}</TableCell>
                              <TableCell className="text-right font-bold text-primary">
                                {attendant.referral_count}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Engajamento;
