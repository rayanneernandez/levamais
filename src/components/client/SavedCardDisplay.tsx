import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SavedCardDisplayProps {
  lastDigits: string;
  nextChargeDate?: string;
  onChangeCard: () => void;
}

// Identifica a bandeira do cartão pelos primeiros dígitos
const getCardBrand = (lastDigits: string): { name: string; color: string } => {
  // Como só temos os últimos 4 dígitos, não podemos identificar com precisão
  // Mas podemos inferir algumas possibilidades
  const firstDigit = lastDigits[0];
  
  if (firstDigit === '4') {
    return { name: 'Visa', color: 'from-blue-600 to-blue-800' };
  } else if (firstDigit === '5') {
    return { name: 'Mastercard', color: 'from-orange-600 to-red-600' };
  } else if (firstDigit === '3') {
    return { name: 'American Express', color: 'from-blue-400 to-blue-600' };
  } else if (firstDigit === '6') {
    return { name: 'Discover', color: 'from-orange-500 to-orange-700' };
  }
  
  return { name: 'Cartão', color: 'from-gray-600 to-gray-800' };
};

export function SavedCardDisplay({ 
  lastDigits, 
  nextChargeDate,
  onChangeCard 
}: SavedCardDisplayProps) {
  const cardBrand = getCardBrand(lastDigits);

  return (
    <Card className={`relative overflow-hidden bg-gradient-to-br ${cardBrand.color} text-white p-6 shadow-lg`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
      
      <div className="relative z-10 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            <span className="font-semibold">{cardBrand.name}</span>
          </div>
          <div className="text-xs bg-white/20 px-3 py-1 rounded-full">
            ATIVO
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-sm opacity-80">Número do cartão</div>
          <div className="text-2xl font-mono tracking-wider">
            •••• •••• •••• {lastDigits}
          </div>
        </div>

        {nextChargeDate && (
          <div className="space-y-1">
            <div className="text-xs opacity-80">Próxima cobrança</div>
            <div className="text-sm font-medium">
              {format(new Date(nextChargeDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </div>
          </div>
        )}

        <Button
          onClick={onChangeCard}
          variant="outline"
          className="w-full bg-white/10 hover:bg-white/20 border-white/30 text-white"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Trocar Cartão
        </Button>
      </div>
    </Card>
  );
}
