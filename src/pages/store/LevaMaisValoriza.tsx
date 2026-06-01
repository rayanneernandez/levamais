import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Gift, Settings, Plus, Edit2, Trash2, Save, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function LevaMaisValoriza() {
  const [networkId, setNetworkId] = useState<string>("");
  const [editingReward, setEditingReward] = useState<any>(null);
  const [rewardDialog, setRewardDialog] = useState(false);

  // Form states
  const [rewardName, setRewardName] = useState("");
  const [rewardDescription, setRewardDescription] = useState("");
  const [rewardPoints, setRewardPoints] = useState("");
  const [rewardCategory, setRewardCategory] = useState<"product" | "bonus" | "service">("product");
  const [rewardStock, setRewardStock] = useState("");
  const [rewardImage, setRewardImage] = useState<File | null>(null);
  const [rewardImageUrl, setRewardImageUrl] = useState<string>("");

  const [pointsPerClient, setPointsPerClient] = useState("10");
  const [multiplier7, setMultiplier7] = useState("1.5");
  const [multiplier15, setMultiplier15] = useState("2.0");
  const [multiplier30, setMultiplier30] = useState("3.0");
  const [redemptionEmail, setRedemptionEmail] = useState("");

  // Load network ID
  useEffect(() => {
    const loadNetwork = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: manager } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (manager) setNetworkId(manager.network_id);
    };
    loadNetwork();
  }, []);

  // Load rewards
  const { data: rewards, refetch: refetchRewards } = useQuery({
    queryKey: ["attendant-rewards", networkId],
    queryFn: async () => {
      if (!networkId) return [];
      const { data, error } = await supabase
        .from("attendant_rewards")
        .select("*")
        .eq("network_id", networkId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!networkId,
  });

  // Load points rules
  const { data: pointsRules, refetch: refetchRules } = useQuery({
    queryKey: ["attendant-points-rules", networkId],
    queryFn: async () => {
      if (!networkId) return null;
      const { data, error } = await supabase
        .from("attendant_points_rules")
        .select("*")
        .eq("network_id", networkId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        setPointsPerClient(data.points_per_client.toString());
        setMultiplier7(data.multiplier_7_days.toString());
        setMultiplier15(data.multiplier_15_days.toString());
        setMultiplier30(data.multiplier_30_days.toString());
        setRedemptionEmail(data.redemption_notification_email || "");
      }
      
      return data;
    },
    enabled: !!networkId,
  });

  const handleSaveRules = async () => {
    if (!networkId) return;

    try {
      const rules = {
        network_id: networkId,
        points_per_client: parseFloat(pointsPerClient),
        multiplier_7_days: parseFloat(multiplier7),
        multiplier_15_days: parseFloat(multiplier15),
        multiplier_30_days: parseFloat(multiplier30),
        redemption_notification_email: redemptionEmail || null,
        is_active: true,
      };

      const { error } = await supabase
        .from("attendant_points_rules")
        .upsert(rules, { onConflict: "network_id" });

      if (error) throw error;

      toast.success("Regras de pontuação salvas!");
      refetchRules();
    } catch (error: any) {
      toast.error("Erro ao salvar regras: " + error.message);
    }
  };

  const handleSaveReward = async () => {
    if (!networkId || !rewardName || !rewardPoints) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      let imageUrl = rewardImageUrl;

      // Upload da imagem se houver
      if (rewardImage) {
        const fileExt = rewardImage.name.split('.').pop();
        const fileName = `${networkId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('reward-images')
          .upload(fileName, rewardImage);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('reward-images')
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      const reward = {
        network_id: networkId,
        name: rewardName,
        description: rewardDescription,
        points_cost: parseFloat(rewardPoints),
        category: rewardCategory,
        stock_quantity: rewardStock ? parseInt(rewardStock) : null,
        image_url: imageUrl || null,
        is_active: true,
      };

      if (editingReward) {
        // Se tem imagem antiga e está sendo substituída, deletar a antiga
        if (editingReward.image_url && rewardImage) {
          const oldPath = editingReward.image_url.split('/reward-images/')[1];
          if (oldPath) {
            await supabase.storage.from('reward-images').remove([oldPath]);
          }
        }

        const { error } = await supabase
          .from("attendant_rewards")
          .update(reward)
          .eq("id", editingReward.id);

        if (error) throw error;
        toast.success("Prêmio atualizado!");
      } else {
        const { error } = await supabase
          .from("attendant_rewards")
          .insert(reward);

        if (error) throw error;
        toast.success("Prêmio cadastrado!");
      }

      refetchRewards();
      setRewardDialog(false);
      resetRewardForm();
    } catch (error: any) {
      toast.error("Erro ao salvar prêmio: " + error.message);
    }
  };

  const handleDeleteReward = async (id: string) => {
    if (!confirm("Deseja realmente excluir este prêmio?")) return;

    try {
      const { error } = await supabase
        .from("attendant_rewards")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Prêmio excluído!");
      refetchRewards();
    } catch (error: any) {
      toast.error("Erro ao excluir prêmio: " + error.message);
    }
  };

  const resetRewardForm = () => {
    setEditingReward(null);
    setRewardName("");
    setRewardDescription("");
    setRewardPoints("");
    setRewardCategory("product");
    setRewardStock("");
    setRewardImage(null);
    setRewardImageUrl("");
  };

  const openEditReward = (reward: any) => {
    setEditingReward(reward);
    setRewardName(reward.name);
    setRewardDescription(reward.description || "");
    setRewardPoints(reward.points_cost.toString());
    setRewardCategory(reward.category);
    setRewardStock(reward.stock_quantity?.toString() || "");
    setRewardImageUrl(reward.image_url || "");
    setRewardImage(null);
    setRewardDialog(true);
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      product: "Produto",
      bonus: "Bônus",
      service: "Serviço",
    };
    return labels[category as keyof typeof labels] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      product: "bg-blue-500",
      bonus: "bg-green-500",
      service: "bg-purple-500",
    };
    return colors[category as keyof typeof colors] || "bg-gray-500";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leva+ Valoriza</h1>
        <p className="text-muted-foreground text-sm">
          Configure prêmios e regras de pontuação para seus colaboradores
        </p>
      </div>

      <Tabs defaultValue="rewards" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rewards">
            <Gift className="h-4 w-4 mr-2" />
            Prêmios
          </TabsTrigger>
          <TabsTrigger value="rules">
            <Settings className="h-4 w-4 mr-2" />
            Regras de Pontuação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rewards" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Gerencie os prêmios disponíveis para resgate
            </p>
            <Dialog open={rewardDialog} onOpenChange={setRewardDialog}>
              <DialogTrigger asChild>
                <Button onClick={resetRewardForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Prêmio
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingReward ? "Editar Prêmio" : "Novo Prêmio"}
                  </DialogTitle>
                  <DialogDescription>
                    Cadastre produtos, bônus ou serviços para seus colaboradores
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nome do Prêmio *</Label>
                    <Input
                      id="name"
                      value={rewardName}
                      onChange={(e) => setRewardName(e.target.value)}
                      placeholder="Ex: Vale Presente R$ 50"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={rewardDescription}
                      onChange={(e) => setRewardDescription(e.target.value)}
                      placeholder="Descreva o prêmio..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="points">Custo em Pontos *</Label>
                      <Input
                        id="points"
                        type="number"
                        value={rewardPoints}
                        onChange={(e) => setRewardPoints(e.target.value)}
                        placeholder="100"
                      />
                    </div>

                    <div>
                      <Label htmlFor="category">Categoria *</Label>
                      <Select value={rewardCategory} onValueChange={(v: any) => setRewardCategory(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="product">Produto</SelectItem>
                          <SelectItem value="bonus">Bônus</SelectItem>
                          <SelectItem value="service">Serviço</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="stock">Estoque (opcional)</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={rewardStock}
                      onChange={(e) => setRewardStock(e.target.value)}
                      placeholder="Deixe vazio para ilimitado"
                    />
                  </div>
                </div>

                <div>
                  <Label>Imagem do Prêmio</Label>
                  <p className="text-xs text-muted-foreground mt-1">Tamanho recomendado: 800x600px (proporção 4:3)</p>
                  <div className="mt-2 space-y-4">
                    {(rewardImageUrl || rewardImage) && (
                      <div className="relative w-full h-48 border rounded-lg overflow-hidden bg-muted">
                        <img
                          src={rewardImage ? URL.createObjectURL(rewardImage) : rewardImageUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          className="absolute top-2 right-2"
                          onClick={() => {
                            setRewardImage(null);
                            setRewardImageUrl("");
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setRewardImage(file);
                        }}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('image')?.click()}
                        className="w-full"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {rewardImage || rewardImageUrl ? "Trocar Imagem" : "Adicionar Imagem"}
                      </Button>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setRewardDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveReward}>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewards?.map((reward) => (
              <Card key={reward.id}>
                {reward.image_url && (
                  <div className="w-full h-48 overflow-hidden">
                    <img
                      src={reward.image_url}
                      alt={reward.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{reward.name}</CardTitle>
                      <Badge className={getCategoryColor(reward.category)}>
                        {getCategoryLabel(reward.category)}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditReward(reward)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteReward(reward.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {reward.description || "Sem descrição"}
                  </p>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        {reward.points_cost}
                      </p>
                      <p className="text-xs text-muted-foreground">pontos</p>
                    </div>
                    {reward.stock_quantity && (
                      <div className="text-right">
                        <p className="text-sm font-medium">{reward.stock_quantity}</p>
                        <p className="text-xs text-muted-foreground">em estoque</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {(!rewards || rewards.length === 0) && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum prêmio cadastrado ainda</p>
                <p className="text-sm">Clique em "Novo Prêmio" para começar</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuração de Pontuação</CardTitle>
              <CardDescription>
                Defina quantos pontos cada colaborador ganha por cliente cadastrado e os multiplicadores de retorno
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="pointsPerClient">Pontos por Cliente Cadastrado</Label>
                <Input
                  id="pointsPerClient"
                  type="number"
                  value={pointsPerClient}
                  onChange={(e) => setPointsPerClient(e.target.value)}
                  placeholder="10"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Quantos pontos o colaborador ganha ao cadastrar um novo cliente
                </p>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4">Notificações de Resgate</h3>
                <div>
                  <Label htmlFor="redemptionEmail">E-mail para Notificações</Label>
                  <Input
                    id="redemptionEmail"
                    type="email"
                    value={redemptionEmail}
                    onChange={(e) => setRedemptionEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Este e-mail receberá notificações quando colaboradores resgatarem prêmios
                  </p>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4">Multiplicadores de Retorno</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Quando um cliente retorna após o cadastro, os pontos são multiplicados
                </p>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="mult7">Retorno em até 7 dias</Label>
                    <Input
                      id="mult7"
                      type="number"
                      step="0.1"
                      value={multiplier7}
                      onChange={(e) => setMultiplier7(e.target.value)}
                      placeholder="1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Multiplicador: {multiplier7}x os pontos base
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="mult15">Retorno em até 15 dias</Label>
                    <Input
                      id="mult15"
                      type="number"
                      step="0.1"
                      value={multiplier15}
                      onChange={(e) => setMultiplier15(e.target.value)}
                      placeholder="2.0"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Multiplicador: {multiplier15}x os pontos base
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="mult30">Retorno em até 30 dias</Label>
                    <Input
                      id="mult30"
                      type="number"
                      step="0.1"
                      value={multiplier30}
                      onChange={(e) => setMultiplier30(e.target.value)}
                      placeholder="3.0"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Multiplicador: {multiplier30}x os pontos base
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveRules} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                Salvar Regras de Pontuação
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
