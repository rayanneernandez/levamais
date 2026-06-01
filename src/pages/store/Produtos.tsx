import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Search, MoreVertical, Package, ArrowUpDown, ChevronLeft, ChevronRight, Settings, History, DollarSign, Archive, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ProductImporter } from "@/components/store/ProductImporter";

interface StoreProduct {
  id: string;
  name: string;
  internal_code: string;
  barcode: string | null;
  cost: number;
  price: number;
  stock: number;
  min_stock: number;
  is_active: boolean;
  is_redemption_product: boolean;
  cashback_value: number;
  points_value: number;
  created_at: string;
  updated_at: string;
}

interface StockMovement {
  id: string;
  movement_type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  observation: string | null;
  user_name: string | null;
  created_at: string;
}

interface CostHistory {
  id: string;
  previous_cost: number | null;
  new_cost: number;
  quantity_purchased: number;
  average_cost: number | null;
  user_name: string | null;
  created_at: string;
}

const ITEMS_PER_PAGE = 15;

export default function Produtos() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [loyaltyType, setLoyaltyType] = useState<string>("cashback");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "price" | "stock">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  
  // Dialogs
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [showCostDialog, setShowCostDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showCostHistoryDialog, setShowCostHistoryDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Form states
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Product form
  const [productForm, setProductForm] = useState({
    name: "",
    barcode: "",
    cost: "",
    price: "",
    min_stock: "0",
    is_redemption_product: false,
    cashback_value: "",
    points_value: "",
  });
  
  // Stock form
  const [stockForm, setStockForm] = useState({
    movement_type: "entrada",
    quantity: "",
    observation: "",
  });
  
  // Cost form
  const [costForm, setCostForm] = useState({
    new_cost: "",
    quantity_purchased: "",
  });
  
  // History data
  const [stockHistory, setStockHistory] = useState<StockMovement[]>([]);
  const [costHistory, setCostHistory] = useState<CostHistory[]>([]);
  
  const { toast } = useToast();

  useEffect(() => {
    loadNetworkAndProducts();
  }, []);

  const loadNetworkAndProducts = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: manager } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!manager) throw new Error("Gerente não encontrado");
      
      setNetworkId(manager.network_id);
      
      // Load loyalty type from network
      const { data: networkData } = await supabase
        .from("networks")
        .select("loyalty_type")
        .eq("id", manager.network_id)
        .single();
      
      if (networkData?.loyalty_type) {
        setLoyaltyType(networkData.loyalty_type);
      }
      
      await loadProducts(manager.network_id);
    } catch (error: any) {
      console.error("Erro ao carregar:", error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadProducts = async (netId: string) => {
    const { data, error } = await supabase
      .from("store_products")
      .select("*")
      .eq("network_id", netId)
      .order("name");

    if (error) throw error;
    setProducts(data || []);
  };

  const validateBarcode = (code: string): boolean => {
    if (!code) return true; // Barcode é opcional
    // Validação básica EAN-13 (13 dígitos numéricos)
    const ean13Regex = /^\d{13}$/;
    if (!ean13Regex.test(code)) return false;
    
    // Dígito verificador
    const digits = code.split('').map(Number);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += digits[i] * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === digits[12];
  };

  const handleSaveProduct = async () => {
    if (!networkId) return;
    
    if (!productForm.name.trim()) {
      toast({ title: "Erro", description: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    
    if (!productForm.price || parseFloat(productForm.price) <= 0) {
      toast({ title: "Erro", description: "Preço deve ser maior que zero", variant: "destructive" });
      return;
    }
    
    if (productForm.barcode && !validateBarcode(productForm.barcode)) {
      toast({ title: "Erro", description: "Código de barras inválido (deve ser EAN-13)", variant: "destructive" });
      return;
    }
    
    // Validate redemption values if product is for redemption
    if (productForm.is_redemption_product) {
      if (loyaltyType === "cashback" && (!productForm.cashback_value || parseFloat(productForm.cashback_value) <= 0)) {
        toast({ title: "Erro", description: "Valor em cashback é obrigatório para produtos de resgate", variant: "destructive" });
        return;
      }
      if (loyaltyType === "points" && (!productForm.points_value || parseInt(productForm.points_value) <= 0)) {
        toast({ title: "Erro", description: "Valor em pontos é obrigatório para produtos de resgate", variant: "destructive" });
        return;
      }
    }

    setIsSaving(true);
    try {
      if (editingProduct) {
        const { error } = await supabase
          .from("store_products")
          .update({
            name: productForm.name.trim(),
            barcode: productForm.barcode || null,
            cost: parseFloat(productForm.cost) || 0,
            price: parseFloat(productForm.price),
            min_stock: parseInt(productForm.min_stock) || 0,
            is_redemption_product: productForm.is_redemption_product,
            cashback_value: parseFloat(productForm.cashback_value) || 0,
            points_value: parseInt(productForm.points_value) || 0,
          })
          .eq("id", editingProduct.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Produto atualizado!" });
      } else {
        const { error } = await supabase
          .from("store_products")
          .insert({
            network_id: networkId,
            name: productForm.name.trim(),
            internal_code: "", // Will be auto-generated by trigger
            barcode: productForm.barcode || null,
            cost: parseFloat(productForm.cost) || 0,
            price: parseFloat(productForm.price),
            min_stock: parseInt(productForm.min_stock) || 0,
            is_redemption_product: productForm.is_redemption_product,
            cashback_value: parseFloat(productForm.cashback_value) || 0,
            points_value: parseInt(productForm.points_value) || 0,
          });
        if (error) throw error;
        toast({ title: "Sucesso", description: "Produto cadastrado!" });
      }

      setShowProductDialog(false);
      resetProductForm();
      await loadProducts(networkId);
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStockAdjustment = async () => {
    if (!selectedProduct || !networkId) return;
    
    const quantity = parseInt(stockForm.quantity);
    if (!quantity || quantity <= 0) {
      toast({ title: "Erro", description: "Quantidade deve ser maior que zero", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user?.id)
        .single();

      const previousStock = selectedProduct.stock;
      let newStock = previousStock;
      
      if (stockForm.movement_type === "entrada") {
        newStock = previousStock + quantity;
      } else if (stockForm.movement_type === "saida") {
        newStock = Math.max(0, previousStock - quantity);
      } else {
        newStock = quantity; // ajuste direto
      }

      // Registrar movimentação
      const { error: movementError } = await supabase
        .from("store_product_stock_movements")
        .insert({
          product_id: selectedProduct.id,
          movement_type: stockForm.movement_type,
          quantity: stockForm.movement_type === "saida" ? -quantity : quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          observation: stockForm.observation || null,
          user_id: user?.id,
          user_name: profile?.full_name || null,
        });

      if (movementError) throw movementError;

      // Atualizar estoque do produto
      const { error: updateError } = await supabase
        .from("store_products")
        .update({ stock: newStock })
        .eq("id", selectedProduct.id);

      if (updateError) throw updateError;

      toast({ title: "Sucesso", description: "Estoque ajustado!" });
      setShowStockDialog(false);
      resetStockForm();
      await loadProducts(networkId);
    } catch (error: any) {
      console.error("Erro ao ajustar estoque:", error);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleNewCost = async () => {
    if (!selectedProduct || !networkId) return;
    
    const newCost = parseFloat(costForm.new_cost);
    const quantity = parseInt(costForm.quantity_purchased) || 0;
    
    if (!newCost || newCost < 0) {
      toast({ title: "Erro", description: "Custo deve ser válido", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user?.id)
        .single();

      // Calcular custo médio
      const previousCost = selectedProduct.cost;
      const currentStock = selectedProduct.stock;
      let averageCost = newCost;
      
      if (currentStock > 0 && quantity > 0) {
        const totalCurrentValue = previousCost * currentStock;
        const totalNewValue = newCost * quantity;
        const totalQuantity = currentStock + quantity;
        averageCost = (totalCurrentValue + totalNewValue) / totalQuantity;
      }

      // Registrar histórico de custo
      const { error: historyError } = await supabase
        .from("store_product_cost_history")
        .insert({
          product_id: selectedProduct.id,
          previous_cost: previousCost,
          new_cost: newCost,
          quantity_purchased: quantity,
          average_cost: averageCost,
          user_id: user?.id,
          user_name: profile?.full_name || null,
        });

      if (historyError) throw historyError;

      // Atualizar custo e estoque do produto
      const { error: updateError } = await supabase
        .from("store_products")
        .update({ 
          cost: averageCost,
          stock: currentStock + quantity,
        })
        .eq("id", selectedProduct.id);

      if (updateError) throw updateError;

      toast({ title: "Sucesso", description: "Custo atualizado!" });
      setShowCostDialog(false);
      resetCostForm();
      await loadProducts(networkId);
    } catch (error: any) {
      console.error("Erro ao atualizar custo:", error);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const loadStockHistory = async (productId: string) => {
    const { data, error } = await supabase
      .from("store_product_stock_movements")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Erro ao carregar histórico:", error);
      return;
    }
    setStockHistory(data || []);
    setShowHistoryDialog(true);
  };

  const loadCostHistory = async (productId: string) => {
    const { data, error } = await supabase
      .from("store_product_cost_history")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Erro ao carregar histórico de custo:", error);
      return;
    }
    setCostHistory(data || []);
    setShowCostHistoryDialog(true);
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct || !networkId) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("store_products")
        .delete()
        .eq("id", selectedProduct.id);

      if (error) throw error;

      toast({ title: "Sucesso", description: "Produto excluído!" });
      setShowDeleteDialog(false);
      setSelectedProduct(null);
      await loadProducts(networkId);
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const resetProductForm = () => {
    setProductForm({ 
      name: "", 
      barcode: "", 
      cost: "", 
      price: "", 
      min_stock: "0",
      is_redemption_product: false,
      cashback_value: "",
      points_value: "",
    });
    setEditingProduct(null);
  };

  const resetStockForm = () => {
    setStockForm({ movement_type: "entrada", quantity: "", observation: "" });
    setSelectedProduct(null);
  };

  const resetCostForm = () => {
    setCostForm({ new_cost: "", quantity_purchased: "" });
    setSelectedProduct(null);
  };

  const openEditProduct = (product: StoreProduct) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      barcode: product.barcode || "",
      cost: product.cost.toString(),
      price: product.price.toString(),
      min_stock: product.min_stock.toString(),
      is_redemption_product: product.is_redemption_product || false,
      cashback_value: product.cashback_value?.toString() || "",
      points_value: product.points_value?.toString() || "",
    });
    setShowProductDialog(true);
  };

  const openStockDialog = (product: StoreProduct) => {
    setSelectedProduct(product);
    setShowStockDialog(true);
  };

  const openCostDialog = (product: StoreProduct) => {
    setSelectedProduct(product);
    setCostForm({ new_cost: product.cost.toString(), quantity_purchased: "" });
    setShowCostDialog(true);
  };

  // Filtering and sorting
  const filteredProducts = products
    .filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.internal_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchTerm))
    )
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "price") {
        comparison = a.price - b.price;
      } else if (sortBy === "stock") {
        comparison = a.stock - b.stock;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const toggleSort = (field: "name" | "price" | "stock") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground text-sm">
            Cadastre e gerencie os produtos para lançamentos manuais
          </p>
        </div>
        <div className="flex gap-2">
          {networkId && (
            <ProductImporter networkId={networkId} onImportComplete={() => loadProducts(networkId)} />
          )}
          <Button onClick={() => { resetProductForm(); setShowProductDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, código ou código de barras..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {paginatedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">Nenhum produto cadastrado</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {searchTerm ? "Nenhum produto encontrado para essa busca." : "Comece cadastrando seu primeiro produto."}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Código</TableHead>
                      <TableHead>
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("name")} className="h-auto p-0 font-medium">
                          Nome
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="hidden md:table-cell">Cód. Barras</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("price")} className="h-auto p-0 font-medium">
                          Preço
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-center">
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("stock")} className="h-auto p-0 font-medium">
                          Estoque
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-mono text-sm">{product.internal_code}</TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {product.name}
                            {product.is_redemption_product && (
                              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                                Resgate
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {product.barcode || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={product.stock <= product.min_stock ? "destructive" : "secondary"}
                          >
                            {product.stock}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditProduct(product)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openStockDialog(product)}>
                                <Archive className="h-4 w-4 mr-2" />
                                Ajustar Estoque
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openCostDialog(product)}>
                                <DollarSign className="h-4 w-4 mr-2" />
                                Lançar Custo
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setSelectedProduct(product); loadStockHistory(product.id); }}>
                                <History className="h-4 w-4 mr-2" />
                                Histórico de Estoque
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedProduct(product); loadCostHistory(product.id); }}>
                                <History className="h-4 w-4 mr-2" />
                                Histórico de Custo
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => { setSelectedProduct(product); setShowDeleteDialog(true); }}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} a{" "}
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} de{" "}
                    {filteredProducts.length} produtos
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Novo/Editar Produto */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            <DialogDescription>
              {editingProduct ? "Atualize as informações do produto" : "Preencha os dados do novo produto"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={productForm.name}
                onChange={(e) => setProductForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Nome do produto"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Código de Barras (EAN-13)</Label>
              <Input
                id="barcode"
                value={productForm.barcode}
                onChange={(e) => setProductForm(p => ({ ...p, barcode: e.target.value.replace(/\D/g, '').slice(0, 13) }))}
                placeholder="0000000000000"
                maxLength={13}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost">Custo (R$)</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={productForm.cost}
                  onChange={(e) => setProductForm(p => ({ ...p, cost: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Preço de Venda (R$) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={productForm.price}
                  onChange={(e) => setProductForm(p => ({ ...p, price: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="min_stock">Estoque Mínimo</Label>
              <Input
                id="min_stock"
                type="number"
                min="0"
                value={productForm.min_stock}
                onChange={(e) => setProductForm(p => ({ ...p, min_stock: e.target.value }))}
                placeholder="0"
              />
            </div>
            
            {/* Seção de Resgate */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center space-x-2 mb-4">
                <input
                  type="checkbox"
                  id="is_redemption_product"
                  checked={productForm.is_redemption_product}
                  onChange={(e) => setProductForm(p => ({ ...p, is_redemption_product: e.target.checked }))}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="is_redemption_product" className="text-sm font-medium cursor-pointer">
                  Produto de Resgate
                </Label>
              </div>
              
              {productForm.is_redemption_product && (
                <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="cashback_value">
                      Valor em Cashback (R$) {loyaltyType === "cashback" && "*"}
                    </Label>
                    <Input
                      id="cashback_value"
                      type="number"
                      step="0.01"
                      min="0"
                      value={productForm.cashback_value}
                      onChange={(e) => setProductForm(p => ({ ...p, cashback_value: e.target.value }))}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="points_value">
                      Valor em Pontos {loyaltyType === "points" && "*"}
                    </Label>
                    <Input
                      id="points_value"
                      type="number"
                      min="0"
                      value={productForm.points_value}
                      onChange={(e) => setProductForm(p => ({ ...p, points_value: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <p className="col-span-2 text-xs text-muted-foreground">
                    {loyaltyType === "cashback" 
                      ? "O valor em cashback é obrigatório pois sua rede utiliza o sistema de cashback."
                      : "O valor em pontos é obrigatório pois sua rede utiliza o sistema de pontos."}
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProductDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveProduct} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingProduct ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Ajuste de Estoque */}
      <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuste de Estoque</DialogTitle>
            <DialogDescription>
              {selectedProduct?.name} - Estoque atual: {selectedProduct?.stock}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Movimentação</Label>
              <Select value={stockForm.movement_type} onValueChange={(v) => setStockForm(s => ({ ...s, movement_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="ajuste">Ajuste (definir quantidade exata)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={stockForm.quantity}
                onChange={(e) => setStockForm(s => ({ ...s, quantity: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="observation">Observação</Label>
              <Textarea
                id="observation"
                value={stockForm.observation}
                onChange={(e) => setStockForm(s => ({ ...s, observation: e.target.value }))}
                placeholder="Motivo do ajuste..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowStockDialog(false); resetStockForm(); }}>Cancelar</Button>
            <Button onClick={handleStockAdjustment} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Lançar Custo */}
      <Dialog open={showCostDialog} onOpenChange={setShowCostDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lançar Novo Custo</DialogTitle>
            <DialogDescription>
              {selectedProduct?.name} - Custo atual: {selectedProduct?.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_cost">Novo Custo (R$)</Label>
              <Input
                id="new_cost"
                type="number"
                step="0.01"
                min="0"
                value={costForm.new_cost}
                onChange={(e) => setCostForm(c => ({ ...c, new_cost: e.target.value }))}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity_purchased">Quantidade Comprada</Label>
              <Input
                id="quantity_purchased"
                type="number"
                min="0"
                value={costForm.quantity_purchased}
                onChange={(e) => setCostForm(c => ({ ...c, quantity_purchased: e.target.value }))}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Usado para calcular o custo médio. Deixe em branco ou 0 para apenas atualizar o custo.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCostDialog(false); resetCostForm(); }}>Cancelar</Button>
            <Button onClick={handleNewCost} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Histórico de Estoque */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Movimentações</DialogTitle>
            <DialogDescription>{selectedProduct?.name}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {stockHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma movimentação registrada</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Anterior</TableHead>
                    <TableHead className="text-right">Novo</TableHead>
                    <TableHead>Usuário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockHistory.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell className="text-sm">
                        {format(new Date(mov.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={mov.movement_type === "entrada" ? "default" : mov.movement_type === "saida" ? "destructive" : "secondary"}>
                          {mov.movement_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{mov.quantity}</TableCell>
                      <TableCell className="text-right font-mono">{mov.previous_stock}</TableCell>
                      <TableCell className="text-right font-mono">{mov.new_stock}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{mov.user_name || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Histórico de Custo */}
      <Dialog open={showCostHistoryDialog} onOpenChange={setShowCostHistoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Custo</DialogTitle>
            <DialogDescription>{selectedProduct?.name}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {costHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma alteração de custo registrada</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Custo Ant.</TableHead>
                    <TableHead className="text-right">Novo Custo</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Custo Médio</TableHead>
                    <TableHead>Usuário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costHistory.map((hist) => (
                    <TableRow key={hist.id}>
                      <TableCell className="text-sm">
                        {format(new Date(hist.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {hist.previous_cost?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {hist.new_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                      <TableCell className="text-right font-mono">{hist.quantity_purchased}</TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {hist.average_cost?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{hist.user_name || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Exclusão */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Produto</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o produto "{selectedProduct?.name}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteProduct} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
