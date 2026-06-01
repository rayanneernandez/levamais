import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Star } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { trimmedString, trimmedOptional, cleanText, LIMITS } from "@/lib/input-sanitization";

const formSchema = z.object({
  checkin_date: z.date({
    required_error: "Data é obrigatória",
  }),
  checkin_type: z.enum(["implantacao", "pos_venda", "avaliacao_desempenho", "monthly", "custom"]),
  active_stores: z.string().optional(),
  active_clients: z.string().optional(),
  total_transactions: z.string().optional(),
  transaction_volume: z.string().optional(),
  client_satisfaction: z.string().optional(),
  observations: trimmedOptional(LIMITS.LONG_TEXT),
  insights: trimmedString(LIMITS.LONG_TEXT, { min: 10, minMessage: "Insights devem ter no mínimo 10 caracteres" }),
  action_items: trimmedOptional(LIMITS.LONG_TEXT),
});

interface CustomerSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}

export function CustomerSuccessDialog({ 
  open, 
  onOpenChange, 
  projectId, 
  projectName 
}: CustomerSuccessDialogProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [satisfactionHover, setSatisfactionHover] = useState(0);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      checkin_date: new Date(),
      checkin_type: "monthly",
      active_stores: "",
      active_clients: "",
      total_transactions: "",
      transaction_volume: "",
      client_satisfaction: "",
      observations: "",
      insights: "",
      action_items: "",
    },
  });

  const createCheckin = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("customer_success_checkins" as any)
        .insert({
          project_id: projectId,
          checkin_date: format(values.checkin_date, "yyyy-MM-dd"),
          checkin_type: values.checkin_type,
          performed_by: userData.user.id,
          active_stores: values.active_stores ? parseInt(values.active_stores) : null,
          active_clients: values.active_clients ? parseInt(values.active_clients) : null,
          total_transactions: values.total_transactions ? parseInt(values.total_transactions) : null,
          transaction_volume: values.transaction_volume ? parseFloat(values.transaction_volume) : null,
          client_satisfaction: values.client_satisfaction ? parseInt(values.client_satisfaction) : null,
          observations: cleanText(values.observations, LIMITS.LONG_TEXT) || null,
          insights: cleanText(values.insights, LIMITS.LONG_TEXT),
          action_items: cleanText(values.action_items, LIMITS.LONG_TEXT) || null,
          status: "completed",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-success-checkins"] });
      toast.success("Check-in registrado com sucesso!");
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Erro ao registrar check-in: " + error.message);
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      await createCheckin.mutateAsync(values);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = (value: string) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              "h-6 w-6 cursor-pointer transition-colors",
              star <= (satisfactionHover || parseInt(value || "0"))
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            )}
            onMouseEnter={() => setSatisfactionHover(star)}
            onMouseLeave={() => setSatisfactionHover(0)}
            onClick={() => form.setValue("client_satisfaction", star.toString())}
          />
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Check-in de Sucesso do Cliente</DialogTitle>
          <DialogDescription>
            Registre o acompanhamento do projeto: {projectName}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="checkin_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data do Check-in</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                              <span>Selecione a data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          locale={ptBR}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="checkin_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Check-in</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="implantacao">D1 - Implantação</SelectItem>
                        <SelectItem value="pos_venda">D45 - Pós-venda</SelectItem>
                        <SelectItem value="avaliacao_desempenho">D90 - Avaliação de Desempenho</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="custom">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-4">Métricas de Uso</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="active_stores"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lojas Ativas</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} />
                      </FormControl>
                      <FormDescription>Quantas lojas estão usando</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="active_clients"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clientes Ativos</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} />
                      </FormControl>
                      <FormDescription>Clientes finais cadastrados</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="total_transactions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total de Transações</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} />
                      </FormControl>
                      <FormDescription>Transações no período</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="transaction_volume"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Volume Transacionado (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormDescription>Valor total movimentado</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="client_satisfaction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Satisfação do Cliente</FormLabel>
              <FormControl>
                <div className="space-y-2">
                  {renderStars(field.value || "0")}
                  <FormDescription>
                    Avalie de 1 a 5 estrelas a satisfação do cliente
                  </FormDescription>
                </div>
              </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações gerais sobre o uso e comportamento"
                      rows={3}
                      maxLength={LIMITS.LONG_TEXT}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="insights"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Insights *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Insights e análises importantes para o cliente"
                      rows={4}
                      maxLength={LIMITS.LONG_TEXT}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Informações valiosas que o cliente pode não estar vendo
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="action_items"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ações Necessárias</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Liste as ações que precisam ser tomadas"
                      rows={3}
                      maxLength={LIMITS.LONG_TEXT}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar Check-in"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
