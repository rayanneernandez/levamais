import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Control } from "react-hook-form";

interface LoyaltyTypeSelectorProps {
  control: Control<any>;
}

export function LoyaltyTypeSelector({ control }: LoyaltyTypeSelectorProps) {
  return (
    <FormField
      control={control}
      name="loyalty_type"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <RadioGroup
              onValueChange={field.onChange}
              value={field.value}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem
                  value="cashback"
                  id="cashback"
                  className="peer sr-only"
                />
                <label
                  htmlFor="cashback"
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                >
                  <span className="text-2xl mb-1">💰</span>
                  <span className="text-base font-semibold">Cashback</span>
                  <span className="text-xs text-muted-foreground text-center mt-0.5">
                    Dinheiro de volta
                  </span>
                </label>
              </div>
              <div>
                <RadioGroupItem
                  value="points"
                  id="points"
                  className="peer sr-only"
                />
                <label
                  htmlFor="points"
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                >
                  <span className="text-2xl mb-1">⭐</span>
                  <span className="text-base font-semibold">Pontuação</span>
                  <span className="text-xs text-muted-foreground text-center mt-0.5">
                    Sistema de pontos
                  </span>
                </label>
              </div>
            </RadioGroup>
          </FormControl>
        </FormItem>
      )}
    />
  );
}
