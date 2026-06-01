import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Save, Trash2 } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FuelConfig {
  id: string;
  product_code: string;
  product_name: string;
  differential_percentage: number;
  is_active: boolean;
}

const DEFAULT_FUEL_PRODUCTS = [
  "GASOLINA A COMUM",
  "GASOLINA A PREMIUM",
  "GASOLINA C COMUM",
  "GASOLINA C ADITIVADA",
  "GASOLINA C PREMIUM",
  "ETANOL HIDRATADO COMUM",
  "ETANOL HIDRATADO ADITIVADO",
  "ETANOL ANIDRO",
  "DIESEL B15",
  "DIESEL B20 S500 - ADITIVADO",
  "ÓLEO DIESEL B S10 - COMUM",
  "ÓLEO DIESEL B S10 - ADITIVADO",
  "ÓLEO DIESEL B S1800 - COMUM",
  "GASOLINA AUTOMOTIVA PADRÃO",
  "GASOLINA DE AVIAÇÃO",
  "OUTRAS GASOLINAS",
  "ÓLEO DIESEL S10 B20 AUTORIZATIVO",
  "ÓLEO DIESEL S500 B20 AUTORIZATIVO",
  "GÁS NATURAL VEICULAR",
  "GÁS NATURAL VEICULAR PADRÃO",
];

export function FuelDifferentialConfig({ loyaltyType }: { loyaltyType: "points" | "cashback" }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [configs, setConfigs] = useState<FuelConfig[]>([]);
  const [networkId, setNetworkId] = useState<string>("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newConfig, setNewConfig] = useState({
    product_name: "",
    product_code: "",
    differential_percentage: 0,
  });

  useEffect(() => {
    loadNetworkAndConfigs();
  }, []);

  const loadNetworkAndConfigs = async () => {
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

      const { data, error } = await supabase
        .from("fuel_differential_config")
        .select("*")
        .eq("network_id", managerData.network_id)
        .order("product_name");

      if (error) throw error;
      setConfigs(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar configurações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddConfig = async () => {
    if (!newConfig.product_name || !newConfig.product_code) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome e código do produto",
        variant: "destructive",
      });
      return;
    }

    // Verificar duplicidade
    const exists = configs.find(c => c.product_code === newConfig.product_code);
    if (exists) {
      toast({
        title: "Código duplicado",
        description: "Já existe uma configuração com este código de produto",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("fuel_differential_config")
        .insert({
          network_id: networkId,
          product_code: newConfig.product_code,
          product_name: newConfig.product_name,
          differential_percentage: newConfig.differential_percentage,
          is_active: false, // Inicia como inativo
        });

      if (error) throw error;

      toast({
        title: "Combustível adicionado",
        description: `${newConfig.product_name} adicionado. Ative-o para configurar o percentual.`,
      });

      setShowAddDialog(false);
      setNewConfig({ product_name: "", product_code: "", differential_percentage: 0 });
      loadNetworkAndConfigs();
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateConfig = async (config: FuelConfig) => {
    try {
      const { error } = await supabase
        .from("fuel_differential_config")
        .update({
          differential_percentage: config.differential_percentage,
          is_active: config.is_active,
        })
        .eq("id", config.id);

      if (error) throw error;

      toast({
        title: "Configuração atualizada",
        description: `${config.product_name} salvo com sucesso`,
      });

      loadNetworkAndConfigs();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteConfig = async (config: FuelConfig) => {
    try {
      const { error } = await supabase
        .from("fuel_differential_config")
        .delete()
        .eq("id", config.id);

      if (error) throw error;

      toast({
        title: "Configuração removida",
        description: `${config.product_name} removido`,
      });

      loadNetworkAndConfigs();
    } catch (error: any) {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateLocalConfig = (id: string, field: keyof FuelConfig, value: any) => {
    setConfigs(configs.map(c => c.id === id ? { ...c, [field]: value } : c));
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
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>⛽ Acúmulo Diferenciado por Combustível</CardTitle>
              <CardDescription>
                Configure percentuais diferenciados de {loyaltyType === "cashback" ? "cashback" : "pontos"} para cada tipo de combustível
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {configs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma configuração cadastrada. Clique em "Adicionar" para começar.
            </p>
          ) : (
            configs.map((config) => (
              <Card key={config.id} className="border">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{config.product_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Código do Produto: {config.product_code}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={config.is_active}
                          onCheckedChange={(checked) => {
                            updateLocalConfig(config.id, "is_active", checked);
                            handleUpdateConfig({ ...config, is_active: checked });
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteConfig(config)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <Label htmlFor={`percentage-${config.id}`}>
                          Percentual de {loyaltyType === "cashback" ? "Cashback" : "Pontos"} (%)
                        </Label>
                        <Input
                          id={`percentage-${config.id}`}
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={config.differential_percentage}
                          onChange={(e) =>
                            updateLocalConfig(
                              config.id,
                              "differential_percentage",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          disabled={!config.is_active}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {loyaltyType === "cashback" 
                            ? "Ex: 2.0 = 2% de cashback neste combustível"
                            : "Ex: 2.0 = 2% mais pontos neste combustível"}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleUpdateConfig(config)}
                        disabled={!config.is_active}
                        size="sm"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Salvar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Adicionar Configuração de Combustível</AlertDialogTitle>
            <AlertDialogDescription>
              Selecione o combustível e configure o código do produto no WebPosto
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="product-name">Nome do Combustível</Label>
              <select
                id="product-name"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={newConfig.product_name}
                onChange={(e) =>
                  setNewConfig({ ...newConfig, product_name: e.target.value })
                }
              >
                <option value="">Selecione um combustível...</option>
                {DEFAULT_FUEL_PRODUCTS.map((fuel) => (
                  <option key={fuel} value={fuel}>
                    {fuel}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="product-code">Código do Produto (WebPosto)</Label>
              <Input
                id="product-code"
                placeholder="Ex: 001, GAC, etc"
                value={newConfig.product_code}
                onChange={(e) =>
                  setNewConfig({ ...newConfig, product_code: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Código que vem no campo "codigoProduto" do WebPosto
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              O combustível será adicionado como <strong>inativo</strong>. Depois de adicionar, você pode ativá-lo e configurar o percentual diferenciado.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddConfig}>
              Adicionar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
