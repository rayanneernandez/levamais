import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Star, Store, Users, Gift, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PromotionsDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  networkId: string;
  networkName: string;
}

interface Promotion {
  id: string;
  name: string;
  description: string;
  promotion_type: string;
  benefit_value: number | null;
  benefit_type: string | null;
  start_date: string;
  end_date: string;
  max_redemptions: number | null;
  current_redemptions: number;
  is_active: boolean;
  created_at: string;
  one_promotion_stores: Array<{ store_id: string }>;
  one_promotion_products: Array<{ product_name: string }>;
}

export function PromotionsDetailDialog({
  open,
  onOpenChange,
  networkId,
  networkName,
}: PromotionsDetailDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [filteredPromotions, setFilteredPromotions] = useState<Promotion[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    total_redemptions: 0,
    total_stores: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open && networkId) {
      loadPromotions();
    }
  }, [open, networkId]);

  useEffect(() => {
    filterPromotions();
  }, [searchTerm, promotions]);

  const loadPromotions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("one_promotions")
        .select(`
          *,
          one_promotion_stores(store_id),
          one_promotion_products(product_name)
        `)
        .eq("network_id", networkId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setPromotions(data || []);
      setFilteredPromotions(data || []);

      // Calcular estatísticas
      const totalRedemptions = data?.reduce((sum: number, p: Promotion) => sum + p.current_redemptions, 0) || 0;
      const activePromotions = data?.filter((p: Promotion) => p.is_active) || [];
      const storesSet = new Set<string>();
      data?.forEach((p: Promotion) => {
        p.one_promotion_stores.forEach((s) => storesSet.add(s.store_id));
      });

      setStats({
        total: data?.length || 0,
        active: activePromotions.length,
        total_redemptions: totalRedemptions,
        total_stores: storesSet.size,
      });
    } catch (error: any) {
      console.error("Erro ao carregar promoções:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as promoções.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterPromotions = () => {
    if (!searchTerm.trim()) {
      setFilteredPromotions(promotions);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = promotions.filter(
      (promo) =>
        promo.name.toLowerCase().includes(term) ||
        promo.description.toLowerCase().includes(term) ||
        promo.promotion_type.toLowerCase().includes(term)
    );
    setFilteredPromotions(filtered);
  };

  const getPromotionTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      discount: "Desconto",
      cashback: "Cashback",
      bonus_points: "Pontos Bônus",
      free_product: "Produto Grátis",
      special_price: "Preço Especial",
    };
    return types[type] || type;
  };

  const getBenefitText = (promo: Promotion) => {
    if (!promo.benefit_value || !promo.benefit_type) return "Benefício especial";
    
    if (promo.benefit_type === "percentage") {
      return `${promo.benefit_value}% de desconto`;
    } else if (promo.benefit_type === "fixed") {
      return `R$ ${promo.benefit_value.toFixed(2)} de desconto`;
    } else if (promo.benefit_type === "bonus_points") {
      return `${promo.benefit_value} pontos bônus`;
    }
    return "Benefício especial";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            Promoções ONE - {networkName}
          </DialogTitle>
          <DialogDescription>
            Visualização completa e estatísticas de todas as promoções da rede
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cards de Estatísticas */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold">{stats.total}</p>
                    </div>
                    <Gift className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Ativas</p>
                      <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                    </div>
                    <Star className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Resgates</p>
                      <p className="text-2xl font-bold text-blue-600">{stats.total_redemptions}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Lojas</p>
                      <p className="text-2xl font-bold text-purple-600">{stats.total_stores}</p>
                    </div>
                    <Store className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filtro de Busca */}
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Buscar promoções por nome, descrição ou tipo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Tabela de Promoções */}
            {filteredPromotions.length === 0 ? (
              <div className="text-center py-12">
                <Gift className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchTerm ? "Nenhuma promoção encontrada" : "Nenhuma promoção cadastrada"}
                </h3>
                <p className="text-muted-foreground">
                  {searchTerm
                    ? "Tente buscar com outros termos"
                    : "Esta rede ainda não criou promoções ONE"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Benefício</TableHead>
                    <TableHead>Resgates</TableHead>
                    <TableHead>Lojas</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPromotions.map((promo) => (
                    <TableRow key={promo.id}>
                      <TableCell className="font-medium max-w-[200px]">
                        <div>
                          <p className="font-semibold">{promo.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {promo.description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {getPromotionTypeLabel(promo.promotion_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-primary">
                          {getBenefitText(promo)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-bold">{promo.current_redemptions}</span>
                          {promo.max_redemptions && (
                            <span className="text-sm text-muted-foreground">
                              / {promo.max_redemptions}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {promo.one_promotion_stores.length}{" "}
                          {promo.one_promotion_stores.length === 1 ? "loja" : "lojas"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <p>{format(new Date(promo.start_date), "dd/MM/yy", { locale: ptBR })}</p>
                          <p className="text-muted-foreground">
                            {format(new Date(promo.end_date), "dd/MM/yy", { locale: ptBR })}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {promo.is_active ? (
                          <Badge className="bg-green-500">Ativa</Badge>
                        ) : (
                          <Badge variant="secondary">Inativa</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
