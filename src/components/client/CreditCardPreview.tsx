import { CreditCard, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreditCardPreviewProps {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  isFlipped?: boolean;
}

export function CreditCardPreview({ 
  holderName, 
  number, 
  expiryMonth, 
  expiryYear, 
  cvv,
  isFlipped = false 
}: CreditCardPreviewProps) {
  const formatNumber = (num: string) => {
    if (!num) return "•••• •••• •••• ••••";
    const cleaned = num.replace(/\s/g, "");
    const formatted = cleaned.padEnd(16, "•");
    return formatted.match(/.{1,4}/g)?.join(" ") || "•••• •••• •••• ••••";
  };

  const getCardBrand = (num: string) => {
    const cleaned = num.replace(/\s/g, "");
    if (cleaned.startsWith("4")) return "visa";
    if (cleaned.startsWith("5")) return "mastercard";
    if (cleaned.startsWith("6")) return "discover";
    return "generic";
  };

  const brand = getCardBrand(number);

  return (
    <div className="perspective-1000 max-w-md mx-auto">
      <div 
        className={cn(
          "relative w-full aspect-[1.586/1] transition-transform duration-700 transform-style-3d",
          isFlipped && "rotate-y-180"
        )}
        style={{ 
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0)"
        }}
      >
        {/* Frente do Cartão */}
        <div className="absolute inset-0 backface-hidden">
          <div className="relative w-full h-full rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
            {/* Elementos decorativos */}
            <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-32 sm:w-48 h-32 sm:h-48 bg-gradient-to-tr from-purple-500/20 to-transparent rounded-full blur-3xl" />
            
            {/* Conteúdo */}
            <div className="relative z-10 flex flex-col justify-between h-full">
              {/* Topo - Chip e Bandeira */}
              <div className="flex justify-between items-start">
                <div className="w-10 h-8 sm:w-12 sm:h-10 rounded-md bg-gradient-to-br from-yellow-300 to-yellow-500 shadow-lg" />
                {brand === "visa" && (
                  <div className="text-white font-bold text-xl sm:text-2xl tracking-wider">VISA</div>
                )}
                {brand === "mastercard" && (
                  <div className="flex gap-1">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-red-500 opacity-80" />
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-yellow-500 opacity-80 -ml-3 sm:-ml-4" />
                  </div>
                )}
                {brand === "generic" && (
                  <CreditCard className="w-6 h-6 sm:w-8 sm:h-8 text-white/60" />
                )}
              </div>

              {/* Número do Cartão */}
              <div>
                <div className="text-white text-base sm:text-xl md:text-2xl font-mono tracking-wider mb-3 sm:mb-4 drop-shadow-lg">
                  {formatNumber(number)}
                </div>

                {/* Nome e Validade */}
                <div className="flex justify-between items-end">
                  <div className="flex-1 min-w-0 mr-2">
                    <div className="text-white/60 text-[10px] sm:text-xs mb-1">TITULAR</div>
                    <div className="text-white text-xs sm:text-sm font-medium tracking-wide truncate">
                      {holderName || "SEU NOME"}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="text-white/60 text-[10px] sm:text-xs mb-1 text-right">VALIDADE</div>
                    <div className="text-white text-xs sm:text-sm font-medium">
                      {expiryMonth || "MM"}/{expiryYear || "AA"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Verso do Cartão */}
        <div 
          className="absolute inset-0 backface-hidden"
          style={{ transform: "rotateY(180deg)" }}
        >
          <div className="relative w-full h-full rounded-xl sm:rounded-2xl shadow-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
            {/* Tarja magnética */}
            <div className="absolute top-6 sm:top-8 left-0 right-0 h-10 sm:h-12 bg-black" />
            
            {/* CVV */}
            <div className="absolute bottom-16 sm:bottom-20 right-6 sm:right-8 w-16 h-8 sm:w-20 sm:h-10 bg-white rounded flex items-center justify-center">
              <span className="text-black text-base sm:text-lg font-mono">{cvv || "•••"}</span>
            </div>

            {/* Texto CVV */}
            <div className="absolute bottom-10 sm:bottom-12 right-6 sm:right-8 text-white/60 text-[10px] sm:text-xs">
              CVV
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
    </div>
  );
}