import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { Control, UseFormWatch } from "react-hook-form";

interface CashbackConfigurationProps {
  control: Control<any>;
  watch: UseFormWatch<any>;
}

export function CashbackConfiguration({ control, watch }: CashbackConfigurationProps) {
  const cashbackType = watch("cashback_type");
  
  return (
    <div className="space-y-4">
      {/* Configuração Básica */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Configuração de Cashback</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Como funciona:</p>
                    <p className="text-xs">Configure quanto cashback (dinheiro) o cliente receberá de volta a cada compra. Pode ser um valor fixo ou um percentual sobre o valor gasto.</p>
                    <p className="text-xs font-medium mt-2">Como ativar:</p>
                    <p className="text-xs">Escolha o tipo de cálculo (percentual ou fixo), defina o valor e salve as configurações.</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CardDescription>
            Defina como o cashback será calculado e distribuído
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={control}
            name="cashback_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Cálculo</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="percentage" id="percentage" />
                      <label htmlFor="percentage" className="text-sm font-medium cursor-pointer">
                        Percentual
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="fixed" id="fixed" />
                      <label htmlFor="fixed" className="text-sm font-medium cursor-pointer">
                        Valor Fixo
                      </label>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormDescription>
                  Escolha entre percentual sobre o valor gasto ou valor fixo por compra
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {cashbackType === "percentage" && (
            <FormField
              control={control}
              name="cashback_percentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Percentual de Cashback (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="5.00"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Percentual do valor da compra que retorna como cashback
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {cashbackType === "fixed" && (
            <FormField
              control={control}
              name="cashback_fixed_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Fixo do Cashback (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.10"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Valor em reais de cashback por compra
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </CardContent>
      </Card>

      {/* Bônus */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Bônus de Cashback</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Como funciona:</p>
                    <p className="text-xs">Ofereça cashback extra em momentos especiais para incentivar engajamento e fortalecer a relação com clientes.</p>
                    <p className="text-xs font-medium mt-2">Bônus disponíveis:</p>
                    <ul className="text-xs space-y-1 list-disc list-inside">
                      <li>Cadastro: cashback de boas-vindas</li>
                      <li>Aniversário: presente de aniversário</li>
                    </ul>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CardDescription>
            Configure bônus especiais em cashback
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <FormField
              control={control}
              name="signup_bonus_cashback"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bônus de Cadastro (R$)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="signup_bonus_validity_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Validade</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" placeholder="30" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="signup_bonus_validity_unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidade</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "days"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Unidade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="days">Dias</SelectItem>
                      <SelectItem value="weeks">Semanas</SelectItem>
                      <SelectItem value="months">Meses</SelectItem>
                      <SelectItem value="years">Anos</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <FormField
              control={control}
              name="birthday_bonus_cashback"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bônus de Aniversário (R$)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="birthday_bonus_validity_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Validade</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" placeholder="30" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="birthday_bonus_validity_unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidade</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "days"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Unidade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="days">Dias</SelectItem>
                      <SelectItem value="weeks">Semanas</SelectItem>
                      <SelectItem value="months">Meses</SelectItem>
                      <SelectItem value="years">Anos</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Validade */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Validade do Cashback</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">Defina por quantos meses o cashback acumulado permanecerá disponível para uso antes de expirar.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CardDescription>
            Por quanto tempo o cashback fica disponível
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormField
            control={control}
            name="points_validity_days"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Validade (meses)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    max="12"
                    placeholder="12"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {field.value === 0 || field.value === '0' 
                    ? 'O cashback nunca expira' 
                    : 'Após este período, o cashback não resgatado expira'}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Trava de Acúmulo */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Trava de Acúmulo</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">Força o cliente a resgatar quando atingir determinado valor. Útil para evitar acúmulos excessivos e estimular uso regular do benefício.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CardDescription>
            Limite para forçar resgate antes de continuar acumulando
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={control}
            name="enable_cashback_accumulation_block"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel className="text-sm font-medium">Habilitar Trava</FormLabel>
                  <FormDescription className="text-xs">
                    Cliente precisa resgatar para continuar acumulando
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

          {watch("enable_cashback_accumulation_block") && (
            <FormField
              control={control}
              name="block_accumulation_cashback_limit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Limite para Trava (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="500.00"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Ao atingir este valor, novas acumulações serão bloqueadas
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={control}
            name="enable_accumulation_period_limit"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel className="text-sm font-medium">Limitar Acúmulo por Período</FormLabel>
                  <FormDescription className="text-xs">
                    Restringe a quantidade máxima de acúmulo em um período
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

          {watch("enable_accumulation_period_limit") && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <FormField
                control={control}
                name="block_accumulation_duration_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Limite (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="1" placeholder="500" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="block_accumulation_period_quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>A cada</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="3" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="block_accumulation_duration_unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "days"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="days">Dia(s)</SelectItem>
                        <SelectItem value="weeks">Semana(s)</SelectItem>
                        <SelectItem value="months">Mês(es)</SelectItem>
                        <SelectItem value="years">Ano(s)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
