import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Star, Plus, Pencil, Trash2, Loader2, X, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ManualProductSelector } from "@/components/store/ManualProductSelector";

interface Product {
  code: string;
  name: string;
  quantity: number;
  isReward: boolean;
}

interface Promotion {
  id: string;
  name: string;
  description: string;
  promotion_type: string;
  rules: any;
  max_redemptions: number | null;
  current_redemptions: number;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  max_redemptions_per_client: number | null;
  redemption_period_type: string | null;
  redemption_period_months: number | null;
  buy_quantity: number | null;
  get_quantity: number | null;
  discount_percentage: number | null;
  combo_price: number | null;
  is_active: boolean;
}

export default function LevaOnePromotions() {
  const [isLoading, setIsLoading] = useState(true);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    promotion_type: 'percentage',
    location_type: 'ambos',
    start_date: '',
    end_date: '',
    start_time: '00:00',
    end_time: '23:59',
    max_redemptions: '',
    max_redemptions_per_client: '',
    redemption_period_type: 'per_month',
    redemption_period_months: '1',
    is_active: true,
    // Campos específicos por tipo
    discount_percentage: '',
    buy_quantity: '',
    get_quantity: '',
    combo_price: ''
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [currentProduct, setCurrentProduct] = useState({ code: '', name: '', quantity: '1', isReward: false });
  const [selectedStores, setSelectedStores] = useState<string[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar network_id
      const { data: manager } = await supabase
        .from('store_managers')
        .select('network_id')
        .eq('user_id', user.id)
        .is('store_id', null)
        .single();

      if (!manager) return;

      setNetworkId(manager.network_id);

      // Buscar lojas da rede
      const { data: storesData } = await supabase
        .from('stores')
        .select('id, name')
        .eq('network_id', manager.network_id)
        .order('name');

      setStores(storesData || []);

      // Buscar promoções
      const { data: promos, error } = await supabase
        .from('one_promotions')
        .select('*')
        .eq('network_id', manager.network_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromotions(promos || []);
    } catch (error: any) {
      console.error('Error loading promotions:', error);
      toast({
        title: "Erro ao carregar promoções",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addProduct = () => {
    if (!currentProduct.code.trim()) {
      toast({
        title: "Código obrigatório",
        description: "Informe o código do produto",
        variant: "destructive"
      });
      return;
    }

    setProducts([...products, {
      code: currentProduct.code,
      name: currentProduct.name,
      quantity: parseInt(currentProduct.quantity),
      isReward: currentProduct.isReward
    }]);

    setCurrentProduct({ code: '', name: '', quantity: '1', isReward: false });
  };

  const removeProduct = (index: number) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!networkId) return;

    // Validações
    if (!formData.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe o nome da promoção",
        variant: "destructive"
      });
      return;
    }

    if (products.length === 0) {
      toast({
        title: "Produtos obrigatórios",
        description: "Adicione pelo menos um produto à promoção",
        variant: "destructive"
      });
      return;
    }

    if (selectedStores.length === 0) {
      toast({
        title: "Lojas obrigatórias",
        description: "Selecione pelo menos uma loja participante",
        variant: "destructive"
      });
      return;
    }

    try {
      const promotionData: any = {
        network_id: networkId,
        name: formData.name,
        description: formData.description,
        promotion_type: formData.promotion_type,
        rules: { products },
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        max_redemptions: formData.max_redemptions ? parseInt(formData.max_redemptions) : null,
        max_redemptions_per_client: formData.max_redemptions_per_client ? parseInt(formData.max_redemptions_per_client) : null,
        redemption_period_type: formData.redemption_period_type || null,
        redemption_period_months: formData.redemption_period_type === 'per_custom_months' ? parseInt(formData.redemption_period_months) : null,
        is_active: formData.is_active
      };

      // Campos específicos por tipo
      if (formData.promotion_type === 'percentage') {
        promotionData.discount_percentage = formData.discount_percentage ? parseFloat(formData.discount_percentage) : null;
      } else if (formData.promotion_type === 'buy_x_get_y') {
        promotionData.buy_quantity = formData.buy_quantity ? parseInt(formData.buy_quantity) : null;
        promotionData.get_quantity = formData.get_quantity ? parseInt(formData.get_quantity) : null;
      } else if (formData.promotion_type === 'combo') {
        promotionData.combo_price = formData.combo_price ? parseFloat(formData.combo_price) : null;
      }

      let promotionId: string;

      if (editingPromotion) {
        const { error } = await supabase
          .from('one_promotions')
          .update(promotionData)
          .eq('id', editingPromotion.id);

        if (error) throw error;
        promotionId = editingPromotion.id;

        // Deletar lojas antigas
        await supabase
          .from('one_promotion_stores')
          .delete()
          .eq('promotion_id', promotionId);

        // Deletar produtos antigos
        await supabase
          .from('one_promotion_products')
          .delete()
          .eq('promotion_id', promotionId);

        toast({
          title: "Promoção atualizada!",
          description: "As alterações foram salvas."
        });
      } else {
        const { data, error } = await supabase
          .from('one_promotions')
          .insert(promotionData)
          .select()
          .single();

        if (error) throw error;
        promotionId = data.id;

        toast({
          title: "Promoção criada!",
          description: "A promoção foi cadastrada com sucesso."
        });
      }

      // Inserir produtos
      const productsToInsert = products.map(p => ({
        promotion_id: promotionId,
        product_code: p.code,
        product_name: p.name,
        quantity_required: p.quantity,
        is_reward: p.isReward
      }));

      await supabase
        .from('one_promotion_products')
        .insert(productsToInsert);

      // Inserir lojas participantes
      const storesToInsert = selectedStores.map(storeId => ({
        promotion_id: promotionId,
        store_id: storeId
      }));

      await supabase
        .from('one_promotion_stores')
        .insert(storesToInsert);

      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error saving promotion:', error);
      toast({
        title: "Erro ao salvar promoção",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleEdit = async (promotion: Promotion) => {
    setEditingPromotion(promotion);
    setFormData({
      name: promotion.name,
      description: promotion.description || '',
      promotion_type: promotion.promotion_type,
      location_type: (promotion as any).location_type || 'ambos',
      start_date: promotion.start_date.split('T')[0],
      end_date: promotion.end_date.split('T')[0],
      start_time: promotion.start_time || '00:00',
      end_time: promotion.end_time || '23:59',
      max_redemptions: promotion.max_redemptions?.toString() || '',
      max_redemptions_per_client: promotion.max_redemptions_per_client?.toString() || '',
      redemption_period_type: promotion.redemption_period_type || 'per_month',
      redemption_period_months: promotion.redemption_period_months?.toString() || '1',
      is_active: promotion.is_active,
      discount_percentage: promotion.discount_percentage?.toString() || '',
      buy_quantity: promotion.buy_quantity?.toString() || '',
      get_quantity: promotion.get_quantity?.toString() || '',
      combo_price: promotion.combo_price?.toString() || ''
    });

    // Carregar produtos
    const { data: promoProducts } = await supabase
      .from('one_promotion_products')
      .select('*')
      .eq('promotion_id', promotion.id);

    if (promoProducts) {
      setProducts(promoProducts.map(p => ({
        code: p.product_code,
        name: p.product_name || '',
        quantity: p.quantity_required || 1,
        isReward: p.is_reward || false
      })));
    }

    // Carregar lojas
    const { data: promoStores } = await supabase
      .from('one_promotion_stores')
      .select('store_id')
      .eq('promotion_id', promotion.id);

    if (promoStores) {
      setSelectedStores(promoStores.map(ps => ps.store_id));
    }

    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta promoção?')) return;

    try {
      const { error } = await supabase
        .from('one_promotions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Promoção excluída",
        description: "A promoção foi removida com sucesso."
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setEditingPromotion(null);
    setFormData({
      name: '',
      description: '',
      promotion_type: 'percentage',
      location_type: 'ambos',
      start_date: '',
      end_date: '',
      start_time: '00:00',
      end_time: '23:59',
      max_redemptions: '',
      max_redemptions_per_client: '',
      redemption_period_type: 'per_month',
      redemption_period_months: '1',
      is_active: true,
      discount_percentage: '',
      buy_quantity: '',
      get_quantity: '',
      combo_price: ''
    });
    setProducts([]);
    setSelectedStores([]);
    setCurrentProduct({ code: '', name: '', quantity: '1', isReward: false });
  };

  const getPromotionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      percentage: 'Desconto %',
      buy_x_get_y: 'Compre X Leve Y',
      combo: 'Combo'
    };
    return labels[type] || type;
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
          <div>
            <h1 className="text-3xl font-bold">Promoções Leva+ One</h1>
            <p className="text-muted-foreground">Marketplace de promoções exclusivas para membros ONE</p>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Promoção
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPromotion ? 'Editar Promoção' : 'Nova Promoção'}
              </DialogTitle>
              <DialogDescription>
                Configure promoções exclusivas com regras personalizadas
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Informações Básicas */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Informações Básicas</h3>
                
                <div>
                  <Label htmlFor="name">Nome da Promoção *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Combo Gelado - Coca + Gelo"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descreva os detalhes da promoção"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="type">Tipo de Promoção *</Label>
                  <Select
                    value={formData.promotion_type}
                    onValueChange={(value) => setFormData({ ...formData, promotion_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Desconto Percentual</SelectItem>
                      <SelectItem value="buy_x_get_y">Compre X Leve Y</SelectItem>
                      <SelectItem value="combo">Combo (Preço Fixo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="location">Local de Resgate *</Label>
                  <Select
                    value={formData.location_type}
                    onValueChange={(value) => setFormData({ ...formData, location_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ambos">🚗 Pista e 🏪 Loja</SelectItem>
                      <SelectItem value="pista">🚗 Apenas Pista</SelectItem>
                      <SelectItem value="loja">🏪 Apenas Loja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Regras do Motor de Promoção */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-lg">Regras da Promoção</h3>

                {formData.promotion_type === 'percentage' && (
                  <div>
                    <Label htmlFor="discount_percentage">Percentual de Desconto (%) *</Label>
                    <Input
                      id="discount_percentage"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.discount_percentage}
                      onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                      placeholder="Ex: 15"
                    />
                  </div>
                )}

                {formData.promotion_type === 'buy_x_get_y' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="buy_quantity">Quantidade Comprar *</Label>
                      <Input
                        id="buy_quantity"
                        type="number"
                        min="1"
                        value={formData.buy_quantity}
                        onChange={(e) => setFormData({ ...formData, buy_quantity: e.target.value })}
                        placeholder="Ex: 2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="get_quantity">Quantidade Levar *</Label>
                      <Input
                        id="get_quantity"
                        type="number"
                        min="1"
                        value={formData.get_quantity}
                        onChange={(e) => setFormData({ ...formData, get_quantity: e.target.value })}
                        placeholder="Ex: 3"
                      />
                    </div>
                  </div>
                )}

                {formData.promotion_type === 'combo' && (
                  <div>
                    <Label htmlFor="combo_price">Preço do Combo (R$) *</Label>
                    <Input
                      id="combo_price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.combo_price}
                      onChange={(e) => setFormData({ ...formData, combo_price: e.target.value })}
                      placeholder="Ex: 12.90"
                    />
                  </div>
                )}
              </div>

              {/* Produtos */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-lg">Produtos da Promoção *</h3>
                
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-3">
                    <Label>Código *</Label>
                    <ManualProductSelector
                      networkId={networkId}
                      value={{ code: currentProduct.code, name: currentProduct.name }}
                      onChange={({ code, name }) => setCurrentProduct({ ...currentProduct, code, name })}
                      placeholder="Código"
                    />
                  </div>
                  <div className="col-span-4">
                    <Label>Nome</Label>
                    <Input
                      value={currentProduct.name}
                      onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                      placeholder="Coca Cola Lata"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Qtd</Label>
                    <Input
                      type="number"
                      min="1"
                      value={currentProduct.quantity}
                      onChange={(e) => setCurrentProduct({ ...currentProduct, quantity: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 flex items-end">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isReward"
                        checked={currentProduct.isReward}
                        onCheckedChange={(checked) => 
                          setCurrentProduct({ ...currentProduct, isReward: checked as boolean })
                        }
                      />
                      <Label htmlFor="isReward" className="text-sm">Brinde</Label>
                    </div>
                  </div>
                  <div className="col-span-1 flex items-end">
                    <Button type="button" onClick={addProduct} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {products.length > 0 && (
                  <div className="border rounded-lg p-3 space-y-2">
                    {products.map((product, index) => (
                      <div key={index} className="flex items-center justify-between bg-muted/50 p-2 rounded">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{product.code}</Badge>
                          <span className="text-sm">{product.name || 'Sem nome'}</span>
                          <span className="text-sm text-muted-foreground">Qtd: {product.quantity}</span>
                          {product.isReward && (
                            <Badge variant="secondary">Brinde</Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeProduct(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lojas Participantes */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-lg">Lojas Participantes *</h3>
                <div className="grid grid-cols-2 gap-3 max-h-40 overflow-y-auto border rounded-lg p-3">
                  {stores.map((store) => (
                    <div key={store.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`store-${store.id}`}
                        checked={selectedStores.includes(store.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedStores([...selectedStores, store.id]);
                          } else {
                            setSelectedStores(selectedStores.filter(id => id !== store.id));
                          }
                        }}
                      />
                      <Label htmlFor={`store-${store.id}`} className="text-sm cursor-pointer">
                        {store.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Período e Horário */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-lg">Período e Horário</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_date">Data Início *</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_date">Data Fim *</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_time">Horário Início</Label>
                    <Input
                      id="start_time"
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_time">Horário Fim</Label>
                    <Input
                      id="end_time"
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Limites de Resgate */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-lg">Limites de Resgate</h3>
                
                <div>
                  <Label htmlFor="max_redemptions">Unidades Totais Disponíveis</Label>
                  <Input
                    id="max_redemptions"
                    type="number"
                    min="0"
                    value={formData.max_redemptions}
                    onChange={(e) => setFormData({ ...formData, max_redemptions: e.target.value })}
                    placeholder="Ex: 1000 (deixe vazio para ilimitado)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Quando atingir esse limite, a promoção ficará inativa automaticamente
                  </p>
                </div>

                <div>
                  <Label htmlFor="max_redemptions_per_client">Resgates por Cliente</Label>
                  <Input
                    id="max_redemptions_per_client"
                    type="number"
                    min="0"
                    value={formData.max_redemptions_per_client}
                    onChange={(e) => setFormData({ ...formData, max_redemptions_per_client: e.target.value })}
                    placeholder="Ex: 5 (deixe vazio para ilimitado)"
                  />
                </div>

                {formData.max_redemptions_per_client && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="redemption_period_type">Periodicidade</Label>
                      <Select
                        value={formData.redemption_period_type}
                        onValueChange={(value) => setFormData({ ...formData, redemption_period_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_day">Por Dia</SelectItem>
                          <SelectItem value="per_week">Por Semana</SelectItem>
                          <SelectItem value="per_month">Por Mês</SelectItem>
                          <SelectItem value="per_custom_months">A cada X meses</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.redemption_period_type === 'per_custom_months' && (
                      <div>
                        <Label htmlFor="redemption_period_months">Quantidade de Meses</Label>
                        <Input
                          id="redemption_period_months"
                          type="number"
                          min="1"
                          value={formData.redemption_period_months}
                          onChange={(e) => setFormData({ ...formData, redemption_period_months: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit}>
                {editingPromotion ? 'Atualizar' : 'Criar'} Promoção
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alerta de Elegibilidade */}
      {promotions.filter(p => p.is_active).length < 5 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Atenção: Mínimo de Promoções Não Atingido</AlertTitle>
          <AlertDescription>
            Você possui <strong>{promotions.filter(p => p.is_active).length} de 5 promoções ativas necessárias</strong>. 
            Sua rede precisa ter no mínimo <strong>5 promoções ativas</strong> para ter direito à remuneração mensal do Leva+ One. 
            Crie mais {5 - promotions.filter(p => p.is_active).length} promoções para se qualificar.
          </AlertDescription>
        </Alert>
      )}

      {promotions.filter(p => p.is_active).length >= 5 && promotions.filter(p => p.is_active).length < 10 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>✅ Elegível para Comissão</AlertTitle>
          <AlertDescription>
            Parabéns! Você possui <strong>{promotions.filter(p => p.is_active).length} promoções ativas</strong> e sua rede está qualificada para receber a comissão mensal do Leva+ One.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Resgates</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promotions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhuma promoção cadastrada
                </TableCell>
              </TableRow>
            ) : (
              promotions.map((promo) => (
                <TableRow key={promo.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{promo.name}</p>
                      {promo.description && (
                        <p className="text-sm text-muted-foreground">{promo.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getPromotionTypeLabel(promo.promotion_type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p>{format(new Date(promo.start_date), 'dd/MM/yyyy')}</p>
                      <p className="text-muted-foreground">até {format(new Date(promo.end_date), 'dd/MM/yyyy')}</p>
                      {promo.start_time && promo.end_time && (
                        <p className="text-xs text-muted-foreground">{promo.start_time} - {promo.end_time}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {promo.current_redemptions}
                    {promo.max_redemptions && ` / ${promo.max_redemptions}`}
                  </TableCell>
                  <TableCell>
                    <Badge variant={promo.is_active ? "default" : "secondary"}>
                      {promo.is_active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(promo)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(promo.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
