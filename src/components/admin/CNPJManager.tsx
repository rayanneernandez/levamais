import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CNPJItem {
  cnpj: string;
  razao_social: string;
}

interface CNPJManagerProps {
  value: CNPJItem[];
  onChange: (cnpjs: CNPJItem[]) => void;
}

export const CNPJManager = ({ value, onChange }: CNPJManagerProps) => {
  const [inputCnpj, setInputCnpj] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const formatCNPJ = (cnpj: string) => {
    const cleaned = cnpj.replace(/\D/g, '');
    if (cleaned.length !== 14) return cnpj;
    return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  const handleAddCNPJ = async () => {
    if (!inputCnpj.trim()) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('buscar-cnpj', {
        body: { cnpj: inputCnpj }
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: "Erro ao buscar CNPJ",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      const newCNPJ: CNPJItem = {
        cnpj: data.cnpj,
        razao_social: data.razao_social
      };

      // Check if CNPJ already exists
      if (value.some(item => item.cnpj === newCNPJ.cnpj)) {
        toast({
          title: "CNPJ já adicionado",
          variant: "destructive",
        });
        return;
      }

      onChange([...value, newCNPJ]);
      setInputCnpj("");
      
      toast({
        title: "CNPJ adicionado com sucesso",
      });
    } catch (error) {
      console.error('Error fetching CNPJ:', error);
      toast({
        title: "Erro ao buscar CNPJ",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCNPJ = (cnpjToRemove: string) => {
    onChange(value.filter(item => item.cnpj !== cnpjToRemove));
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Digite o CNPJ (opcional)"
          value={inputCnpj}
          onChange={(e) => setInputCnpj(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddCNPJ();
            }
          }}
          disabled={isLoading}
        />
        <Button
          type="button"
          onClick={handleAddCNPJ}
          disabled={isLoading || !inputCnpj.trim()}
          size="icon"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((item) => (
            <Badge
              key={item.cnpj}
              variant="secondary"
              className="flex items-center justify-between w-full px-3 py-2 text-sm"
            >
              <span className="flex-1">
                {formatCNPJ(item.cnpj)} - {item.razao_social}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 ml-2"
                onClick={() => handleRemoveCNPJ(item.cnpj)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
