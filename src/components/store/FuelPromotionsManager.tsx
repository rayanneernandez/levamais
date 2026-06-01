import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Calendar, TrendingUp } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FuelConfig {
  id: string;
  product_name: string;
  product_code: string;
  differential_percentage: number;
}

interface FuelPromotion {
  id: string;
  promotion_name: string;
  start_date: string;
  end_date: string;
  promotion_percentage: number;
  is_active: boolean;
  fuel_config_id: string;
  fuel_differential_config?: FuelConfig;
}

export function FuelPromotionsManager({ loyaltyType }: { loyaltyType: "points" | "cashback" }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [promotions, setPromotions] = useState<FuelPromotion[]>([]);
  const [fuelConfigs, setFuelConfigs] = useState<FuelConfig[]>([]);
  const [networkId, setNetworkId] = useState<string>("");
  const [showDialog, setShowDialog] = useState(false);
  const [newPromotion, setNewPromotion] = useState({
    fuel_config_id: "",
    promotion_name: "",
    start_date: "",
    start_time: "00:00",
    end_date: "",
    end_time: "23:59",
    promotion_percentage: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: managerData } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!managerData) throw new Error("Gerente não encontrado");
      setNetworkId(managerData.network_id);

      // Carregar combustíveis configurados
      const { data: configs, error: configsError } = await supabase
        .from("fuel_differential_config")
        .select("*")
        .eq("network_id", managerData.network_id)
        .order("product_name");

      if (configsError) throw configsError;
      setFuelConfigs(configs || []);

      // Carregar promoções
      const { data: promos, error: promosError } = await supabase
        .from("fuel_promotions")
        .select("*, fuel_differential_config(*)")
        .eq("network_id", managerData.network_id)
        .order("start_date", { ascending: false });

      if (promosError) throw promosError;
      setPromotions(promos || []);
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

  const handleCreatePromotion = async () => {
    if (!newPromotion.fuel_config_id || !newPromotion.promotion_name) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    try {
      const selectedFuel = fuelConfigs.find((c) => c.id === newPromotion.fuel_config_id);
      if (!selectedFuel) throw new Error("Combustível não encontrado");

      const startDateTime = `${newPromotion.start_date}T${newPromotion.start_time}:00`;
      const endDateTime = `${newPromotion.end_date}T${newPromotion.end_time}:59`;

      const { error } = await supabase
        .from("fuel_promotions")
        .insert({
          network_id: networkId,
          fuel_config_id: newPromotion.fuel_config_id,
          promotion_name: newPromotion.promotion_name,
          start_date: startDateTime,
          end_date: endDateTime,
          original_percentage: selectedFuel.differential_percentage,
          promotion_percentage: newPromotion.promotion_percentage,
          is_active: false,
        });

      if (error) throw error;

      toast({
        title: "Promoção criada",
        description: "A promoção será ativada automaticamente no horário programado",
      });

      setShowDialog(false);
      setNewPromotion({
        fuel_config_id: "",
        promotion_name: "",
        start_date: "",
        start_time: "00:00",
        end_date: "",
        end_time: "23:59",
        promotion_percentage: 0,
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao criar promoção",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeletePromotion = async (id: string) => {
    try {
      const { error } = await supabase
        .from("fuel_promotions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Promoção removida",
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao remover promoção",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <LoadingSpinner size="lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Promoções de Combustível
            </CardTitle>
            <CardDescription>
              {loyaltyType === "cashback" ? "Cashback" : "Pontos"} diferenciado por tipo de combustível em períodos específicos
            </CardDescription>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nova Promoção
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nova Promoção de Combustível</DialogTitle>
                <DialogDescription>
                  Ativa e desativa automaticamente no período configurado
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="promo-name">Nome da Promoção</Label>
                  <Input
                    id="promo-name"
                    placeholder="Ex: Black Friday Diesel"
                    value={newPromotion.promotion_name}
                    onChange={(e) =>
                      setNewPromotion({ ...newPromotion, promotion_name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="fuel-select">Combustível</Label>
                  <Select
                    value={newPromotion.fuel_config_id}
                    onValueChange={(value) =>
                      setNewPromotion({ ...newPromotion, fuel_config_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um combustível" />
                    </SelectTrigger>
                    <SelectContent>
                      {fuelConfigs.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          {config.product_name} ({config.product_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-date">Data Inicial</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={newPromotion.start_date}
                      onChange={(e) =>
                        setNewPromotion({ ...newPromotion, start_date: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="start-time">Hora Inicial</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={newPromotion.start_time}
                      onChange={(e) =>
                        setNewPromotion({ ...newPromotion, start_time: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="end-date">Data Final</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={newPromotion.end_date}
                      onChange={(e) =>
                        setNewPromotion({ ...newPromotion, end_date: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-time">Hora Final</Label>
                    <Input
                      id="end-time"
                      type="time"
                      value={newPromotion.end_time}
                      onChange={(e) =>
                        setNewPromotion({ ...newPromotion, end_time: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="percentage">
                    Percentual Promocional de {loyaltyType === "cashback" ? "Cashback" : "Pontos"} (%)
                  </Label>
                  <Input
                    id="percentage"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="5.0"
                    value={newPromotion.promotion_percentage}
                    onChange={(e) =>
                      setNewPromotion({
                        ...newPromotion,
                        promotion_percentage: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Substitui temporariamente o valor padrão configurado
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreatePromotion}>Criar Promoção</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {promotions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Nenhuma promoção cadastrada
            </p>
            <Button variant="outline" onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Promoção
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {promotions.map((promo) => (
              <div key={promo.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{promo.promotion_name}</h3>
                    {promo.is_active ? (
                      <Badge variant="default" className="bg-green-500">Ativa</Badge>
                    ) : (
                      <Badge variant="secondary">Agendada</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{promo.fuel_differential_config?.product_name}</span>
                    <span>{promo.promotion_percentage}%</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(promo.start_date).toLocaleDateString('pt-BR')} - {new Date(promo.end_date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeletePromotion(promo.id)}
                  disabled={promo.is_active}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}