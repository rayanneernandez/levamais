import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { Control, UseFormWatch } from "react-hook-form";

interface PointsConfigurationProps {
  control: Control<any>;
  watch: UseFormWatch<any>;
}

export function PointsConfiguration({ control, watch }: PointsConfigurationProps) {
  return (
    <div className="space-y-4">
      {/* Configuração Básica */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Configuração de Pontos</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Como funciona:</p>
                    <p className="text-xs">Configure quantos pontos o cliente ganha por real gasto e qual o valor de cada ponto na hora do resgate. Por exemplo: 1 ponto por R$ 1,00 gasto.</p>
                    <p className="text-xs font-medium mt-2">Como ativar:</p>
                    <p className="text-xs">Defina os pontos por real e o valor de conversão, depois salve.</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CardDescription>
            Defina como os pontos serão acumulados e utilizados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={control}
            name="points_per_real"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pontos por Real Gasto</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="1.00"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Quantos pontos o cliente ganha a cada R$ 1,00 gasto
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="real_per_point"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor em Real por Ponto</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.001"
                    min="0.001"
                    placeholder="0.01"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Quanto vale cada ponto em reais na hora de trocar
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Bônus */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Bônus de Pontos</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Como funciona:</p>
                    <p className="text-xs">Ofereça pontos extras em momentos especiais para incentivar engajamento e fortalecer a relação com clientes.</p>
                    <p className="text-xs font-medium mt-2">Bônus disponíveis:</p>
                    <ul className="text-xs space-y-1 list-disc list-inside">
                      <li>Cadastro: pontos de boas-vindas</li>
                      <li>Aniversário: presente de aniversário</li>
                    </ul>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CardDescription>
            Configure bônus especiais em pontos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <FormField
              control={control}
              name="signup_bonus_points"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bônus de Cadastro (Pontos)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" placeholder="0" {...field} />
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
              name="birthday_bonus_points"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bônus de Aniversário (Pontos)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" placeholder="0" {...field} />
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
            <CardTitle className="text-lg">Validade dos Pontos</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">Defina por quantos meses os pontos acumulados permanecerão disponíveis para uso antes de expirar.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CardDescription>
            Por quanto tempo os pontos ficam disponíveis
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
                    ? 'Os pontos nunca expiram' 
                    : 'Após este período, os pontos não resgatados expiram'}
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
            name="enable_points_accumulation_block"
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

          {watch("enable_points_accumulation_block") && (
            <FormField
              control={control}
              name="block_accumulation_points_limit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Limite para Trava (Pontos)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      placeholder="50000"
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
            name="enable_points_accumulation_period_limit"
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

          {watch("enable_points_accumulation_period_limit") && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <FormField
                control={control}
                name="block_accumulation_points_duration_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Limite (Pontos)</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="5000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="block_accumulation_points_period_quantity"
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
                name="block_accumulation_points_duration_unit"
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
