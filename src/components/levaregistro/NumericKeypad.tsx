import { Button } from "@/components/ui/button";
import { Delete, Check } from "lucide-react";

interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm?: () => void;
  maxLength?: number;
  isPassword?: boolean;
}

export function NumericKeypad({ 
  value, 
  onChange, 
  onConfirm, 
  maxLength = 11,
  isPassword = false 
}: NumericKeypadProps) {
  const handleKeyPress = (key: string) => {
    if (value.length < maxLength) {
      onChange(value + key);
    }
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    onChange("");
  };

  const keys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["C", "0", "⌫"],
  ];

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Display */}
      <div className="bg-slate-700/50 rounded-lg p-3 sm:p-4 text-center">
        <p className="text-2xl sm:text-3xl font-mono text-white tracking-wider">
          {isPassword 
            ? "•".repeat(value.length) || "----"
            : value || "___.___.___-__"
          }
        </p>
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {keys.flat().map((key, index) => (
          <Button
            key={index}
            variant="outline"
            className={`h-11 sm:h-14 text-lg sm:text-xl font-semibold transition-all active:scale-95
              ${key === "C" ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30" : ""}
              ${key === "⌫" ? "bg-slate-700 text-slate-300 hover:bg-slate-600 border-slate-600" : ""}
              ${!["C", "⌫"].includes(key) ? "bg-slate-800 text-white hover:bg-slate-700 border-slate-600" : ""}
            `}
            onClick={() => {
              if (key === "C") handleClear();
              else if (key === "⌫") handleBackspace();
              else handleKeyPress(key);
            }}
          >
            {key === "⌫" ? <Delete className="h-5 w-5 sm:h-6 sm:w-6" /> : key}
          </Button>
        ))}
      </div>

      {/* Confirm button */}
      {onConfirm && (
        <Button
          onClick={onConfirm}
          disabled={value.length === 0}
          className="w-full h-11 sm:h-14 text-base sm:text-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 active:scale-[0.98]"
        >
          <Check className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
          Confirmar
        </Button>
      )}
    </div>
  );
}
