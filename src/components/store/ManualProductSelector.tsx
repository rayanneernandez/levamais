import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Package, Check } from "lucide-react";

interface StoreProduct {
  id: string;
  name: string;
  internal_code: string;
  price: number;
}

interface ManualProductSelectorProps {
  networkId: string | null;
  value: { code: string; name: string };
  onChange: (value: { code: string; name: string }) => void;
  placeholder?: string;
}

export function ManualProductSelector({
  networkId,
  value,
  onChange,
  placeholder = "Código do produto"
}: ManualProductSelectorProps) {
  const [open, setOpen] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (networkId) {
      checkManualModeAndLoadProducts();
    }
  }, [networkId]);

  const checkManualModeAndLoadProducts = async () => {
    if (!networkId) return;
    
    setLoading(true);
    try {
      // Verificar se alguma loja está em modo manual
      const { data: storeData } = await supabase
        .from("stores")
        .select("is_manual_mode")
        .eq("network_id", networkId)
        .eq("is_manual_mode", true)
        .limit(1);

      const manualModeEnabled = storeData && storeData.length > 0;
      setIsManualMode(manualModeEnabled);

      if (manualModeEnabled) {
        // Carregar produtos cadastrados
        const { data: productsData } = await supabase
          .from("store_products")
          .select("id, name, internal_code, price")
          .eq("network_id", networkId)
          .eq("is_active", true)
          .order("name");

        setProducts(productsData || []);
      }
    } catch (error) {
      console.error("Error loading manual products:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProduct = (product: StoreProduct) => {
    onChange({ code: product.internal_code, name: product.name });
    setOpen(false);
  };

  // Se não está em modo manual ou não há produtos, mostra input normal
  if (!isManualMode || products.length === 0) {
    return (
      <Input
        value={value.code}
        onChange={(e) => onChange({ code: e.target.value, name: value.name })}
        placeholder={placeholder}
      />
    );
  }

  // Modo manual ativo: mostra autocomplete
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value.code ? (
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span>{value.code}</span>
              {value.name && (
                <Badge variant="secondary" className="ml-1 truncate max-w-[120px]">
                  {value.name}
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar produto..." />
          <CommandList>
            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            <CommandGroup heading="Produtos Cadastrados">
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={`${product.internal_code} ${product.name}`}
                  onSelect={() => handleSelectProduct(product)}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col flex-1">
                      <span className="font-medium">{product.name}</span>
                      <span className="text-xs text-muted-foreground">
                        Código: {product.internal_code} • R$ {product.price.toFixed(2)}
                      </span>
                    </div>
                    {value.code === product.internal_code && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="border-t p-2">
          <Input
            value={value.code}
            onChange={(e) => onChange({ code: e.target.value, name: value.name })}
            placeholder="Ou digite um código manualmente..."
            className="text-sm"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
