import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { Control, UseFormWatch } from "react-hook-form";

interface RedemptionSettingsProps {
  control: Control<any>;
  watch: UseFormWatch<any>;
  loyaltyType: "points" | "cashback";
}

export function RedemptionSettings({ control, watch, loyaltyType }: RedemptionSettingsProps) {
  const redemptionTimeDelayEnabled = watch("redemption_time_delay_enabled");
  const redemptionTimeDelayUnit = watch("redemption_time_delay_unit");

  return (
    <div className="space-y-4">
      {/* Limites de Resgate */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Limites de Resgate</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Como funciona:</p>
                    <p className="text-xs">Define valores mínimo e máximo que o cliente pode resgatar por transação. Útil para controlar o uso do cashback/pontos.</p>
                    <p className="text-xs font-medium mt-2">Importante:</p>
                    <p className="text-xs">Valores muito baixos podem gerar muitas transações pequenas. Valores muito altos podem desestimular o resgate.</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CardDescription>
            Defina valores mínimos e máximos para resgate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loyaltyType === "cashback" ? (
            <>
              <FormField
                control={control}
                name="min_redeem_cashback"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Mínimo de Resgate (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="5.00"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Valor mínimo de cashback para realizar um resgate
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="max_redeem_cashback"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Máximo de Resgate (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="100.00"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Valor máximo de cashback por resgate
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : (
            <>
              <FormField
                control={control}
                name="min_redeem_points"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade Mínima de Resgate (Pontos)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="100"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Quantidade mínima de pontos para realizar um resgate
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="max_redeem_points"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade Máxima de Resgate (Pontos)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="10000"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Quantidade máxima de pontos por resgate
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
          <FormField
            control={control}
            name="max_redemption_sale_percentage"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center gap-2">
                  <FormLabel>Limite de Resgate por Venda (%)</FormLabel>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          Define o percentual máximo da venda que pode ser pago com {loyaltyType === "cashback" ? "cashback" : "pontos"}. Ex: 50% significa que em uma compra de R$ 10, o cliente pode usar no máximo R$ 5 de saldo.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="100"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormDescription>
                  Deixe vazio para permitir resgate de até 100% da venda
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Limite de Resgates em 24h */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Limite de Resgates (24h)</CardTitle>
          <CardDescription>
            Controle quantos resgates podem ser feitos por dia
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormField
            control={control}
            name="max_redemptions_24h"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Máximo de Resgates em 24h</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    placeholder="1"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Número máximo de resgates que um cliente pode fazer em 24 horas
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Prazo para Resgate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Prazo para Disponibilização</CardTitle>
          <CardDescription>
            Tempo de espera para o saldo ficar disponível para resgate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={control}
            name="redemption_time_delay_enabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel className="text-sm font-medium">Habilitar Prazo</FormLabel>
                  <FormDescription className="text-xs">
                    Adicionar tempo de espera antes do resgate
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {redemptionTimeDelayEnabled && (
            <>
              <FormField
                control={control}
                name="redemption_time_delay_unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade de Tempo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="immediate">Imediato</SelectItem>
                        <SelectItem value="hours">Horas</SelectItem>
                        <SelectItem value="days">Dias</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {redemptionTimeDelayUnit !== "immediate" && (
                <FormField
                  control={control}
                  name="redemption_time_delay_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Quantidade de {redemptionTimeDelayUnit === "hours" ? "Horas" : "Dias"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Tempo de espera para disponibilizar o saldo
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Acúmulo Durante Resgate */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Acúmulo Durante Resgate</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    Defina se o cliente pode acumular {loyaltyType === "cashback" ? "cashback" : "pontos"} ao fazer uma compra enquanto está usando seu saldo. 
                    Opções: não acumular, acumular sobre o total, ou apenas sobre o valor pago (diferença).
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CardDescription>
            Como funciona o acúmulo quando o cliente está usando {loyaltyType === "cashback" ? "cashback" : "pontos"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormField
            control={control}
            name="redemption_accumulation_type"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="space-y-2"
                  >
                    <div className="flex items-start space-x-3 space-y-0 rounded-md border p-3">
                      <RadioGroupItem value="none" id="none" />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="none" className="font-medium cursor-pointer">
                          Sem Acúmulo
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Cliente não acumula durante o resgate
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 space-y-0 rounded-md border p-3">
                      <RadioGroupItem value="full" id="full" />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="full" className="font-medium cursor-pointer">
                          Acúmulo Total
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Acumula normalmente sobre o valor total
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 space-y-0 rounded-md border p-3">
                      <RadioGroupItem value="difference" id="difference" />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="difference" className="font-medium cursor-pointer">
                          Acúmulo sobre Diferença
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Acumula apenas sobre o valor pago (total - resgate)
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
