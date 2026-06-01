import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { toast } from "sonner";
import { trimmedString, trimmedOptional, cleanText, LIMITS } from "@/lib/input-sanitization";

const formSchema = z.object({
  title: trimmedString(LIMITS.SHORT_TEXT, { min: 3, minMessage: "Título deve ter no mínimo 3 caracteres" }),
  description: trimmedOptional(LIMITS.LONG_TEXT),
  meeting_date: z.date({
    required_error: "Data é obrigatória",
  }),
  start_time: z.string().min(1, "Horário de início é obrigatório"),
  end_time: z.string().optional(),
  location: trimmedOptional(LIMITS.ADDRESS),
  meeting_type: z.enum(["presencial", "online", "hibrido"]).default("presencial"),
  meeting_link: trimmedOptional(LIMITS.URL),
  notes: trimmedOptional(LIMITS.MEDIUM_TEXT),
});

interface ProjectMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export const ProjectMeetingDialog = ({
  open,
  onOpenChange,
  projectId,
}: ProjectMeetingDialogProps) => {
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      meeting_type: "presencial",
      notes: "",
    },
  });

  const createMeeting = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("project_meetings" as any).insert({
        project_id: projectId,
        title: cleanText(values.title, LIMITS.SHORT_TEXT),
        description: cleanText(values.description, LIMITS.LONG_TEXT) || null,
        meeting_date: values.meeting_date.toISOString().split('T')[0],
        start_time: values.start_time,
        end_time: values.end_time,
        location: cleanText(values.location, LIMITS.ADDRESS) || null,
        meeting_type: values.meeting_type,
        meeting_link: cleanText(values.meeting_link, LIMITS.URL) || null,
        notes: cleanText(values.notes, LIMITS.MEDIUM_TEXT) || null,
        created_by: userData.user?.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-meetings", projectId] });
      toast.success("Reunião agendada com sucesso");
      form.reset();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error creating meeting:", error);
      toast.error("Erro ao agendar reunião");
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createMeeting.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agendar Reunião</DialogTitle>
          <DialogDescription>
            Agende uma nova reunião para o projeto
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Digite o título da reunião" maxLength={LIMITS.SHORT_TEXT} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Descreva o objetivo da reunião" rows={3} maxLength={LIMITS.LONG_TEXT} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="meeting_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                              <span>Selecione</span>
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
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Início</FormLabel>
                    <FormControl>
                      <Input {...field} type="time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fim</FormLabel>
                    <FormControl>
                      <Input {...field} type="time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="meeting_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Reunião</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="presencial">Presencial</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="hibrido">Híbrido</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Local / Endereço</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Digite o local da reunião" maxLength={LIMITS.ADDRESS} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="meeting_link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link da Reunião</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://meet.google.com/..." maxLength={LIMITS.URL} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Observações adicionais" rows={2} maxLength={LIMITS.MEDIUM_TEXT} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createMeeting.isPending}>
                {createMeeting.isPending ? "Agendando..." : "Agendar Reunião"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
