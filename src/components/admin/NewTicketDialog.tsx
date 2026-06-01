import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "sonner";
import { Upload, X, FileIcon, ImageIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trimmedString, trimmedEmail, trimmedOptional, cleanText, cleanEmail, LIMITS } from "@/lib/input-sanitization";

const formSchema = z.object({
  title: trimmedString(LIMITS.SHORT_TEXT, { min: 5, minMessage: "Título deve ter no mínimo 5 caracteres" }),
  description: trimmedString(LIMITS.LONG_TEXT, { min: 10, minMessage: "Descrição deve ter no mínimo 10 caracteres" }),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  source: z.enum(["lojista", "colaborador", "cliente"]),
  requester_name: trimmedString(LIMITS.NAME, { min: 3, minMessage: "Nome é obrigatório" }),
  requester_email: trimmedEmail(),
  requester_phone: trimmedOptional(LIMITS.PHONE),
  network_id: z.string().uuid("Selecione uma rede"),
});

interface NewTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefilledData?: { rede?: string; portal?: string };
}

export function NewTicketDialog({ open, onOpenChange, prefilledData }: NewTicketDialogProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [authError, setAuthError] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      source: "lojista",
      requester_name: "",
      requester_email: "",
      requester_phone: "",
      network_id: "",
    },
  });

  // Verificar autenticação ao abrir o dialog
  useEffect(() => {
    const checkAuth = async () => {
      if (open) {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setAuthError(true);
          toast.error("Você precisa estar autenticado para abrir um chamado");
          return;
        }
        
        setAuthError(false);
        setCurrentUser(user);
        
        // Tentar buscar nome em diferentes tabelas
        let userName = '';
        let userEmail = user.email || '';
        let userPhone = '';
        
        // Buscar no perfil do usuário
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, phone')
          .eq('id', user.id)
          .maybeSingle();
          
        if (profile) {
          userName = profile.full_name || '';
          userEmail = profile.email || userEmail;
          userPhone = profile.phone || '';
        }
        
        // Se não encontrou, buscar em clients
        if (!userName) {
          const { data: client } = await supabase
            .from('clients')
            .select('full_name, email, phone')
            .eq('user_id', user.id)
            .maybeSingle();
            
          if (client) {
            userName = client.full_name || '';
            userEmail = client.email || userEmail;
            userPhone = client.phone || '';
          }
        }
        
        // Se ainda não encontrou, buscar em store_managers
        if (!userName) {
          const { data: manager } = await supabase
            .from('store_managers')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();
            
          if (manager) {
            // Buscar no profiles usando o user_id
            const { data: managerProfile } = await supabase
              .from('profiles')
              .select('full_name, email, phone')
              .eq('id', manager.user_id)
              .maybeSingle();
              
            if (managerProfile) {
              userName = managerProfile.full_name || '';
              userEmail = managerProfile.email || userEmail;
              userPhone = managerProfile.phone || '';
            }
          }
        }
        
        // Preencher os campos do formulário
        form.setValue('requester_name', userName);
        form.setValue('requester_email', userEmail);
        form.setValue('requester_phone', userPhone);
      }
    };
    
    checkAuth();
  }, [open]);

  // Buscar redes ativas
  const { data: networks = [] } = useQuery({
    queryKey: ["networks-for-ticket"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("networks")
        .select("id, name")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });

  // Preencher dados automaticamente quando vindo de portal externo
  useEffect(() => {
    if (prefilledData?.rede && networks.length > 0) {
      const network = networks.find(n => n.name.toLowerCase() === prefilledData.rede?.toLowerCase());
      if (network) {
        form.setValue('network_id', network.id);
      }
    }
    
    if (prefilledData?.portal) {
      const portalToSource: Record<string, "lojista" | "colaborador" | "cliente"> = {
        'Loja': 'lojista',
        'Cliente': 'cliente',
        'Colaborador': 'colaborador'
      };
      const source = portalToSource[prefilledData.portal];
      if (source) {
        form.setValue('source', source);
      }
    }
  }, [prefilledData, networks, form]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validar tamanho (10MB) e tipo
    const validFiles = files.filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      
      if (file.size > maxSize) {
        toast.error(`${file.name} é muito grande. Máximo 10MB`);
        return false;
      }
      
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name} não é um tipo válido. Use imagens ou PDF`);
        return false;
      }
      
      return true;
    });
    
    setUploadedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (ticketId: string): Promise<string[]> => {
    if (uploadedFiles.length === 0) return [];
    
    setUploadingFiles(true);
    const uploadedPaths: string[] = [];
    
    try {
      for (const file of uploadedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.id}/${ticketId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from('support-attachments')
          .upload(fileName, file);
          
        if (error) throw error;
        
        uploadedPaths.push(data.path);
      }
      
      return uploadedPaths;
    } finally {
      setUploadingFiles(false);
    }
  };

  const createTicket = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!currentUser) {
        throw new Error("Usuário não autenticado");
      }

      // Criar o ticket primeiro
      const { data: ticket, error: ticketError } = await supabase
        .from("support_tickets")
        .insert([{
          ticket_number: '',
          title: cleanText(values.title, LIMITS.SHORT_TEXT),
          description: cleanText(values.description, LIMITS.LONG_TEXT),
          priority: values.priority,
          source: values.source,
          requester_name: cleanText(values.requester_name, LIMITS.NAME),
          requester_email: cleanEmail(values.requester_email),
          requester_phone: cleanText(values.requester_phone, LIMITS.PHONE) || null,
          network_id: values.network_id,
          status: "open",
          created_by_user_id: currentUser.id,
        }])
        .select()
        .single();

      if (ticketError) throw ticketError;
      
      // Fazer upload dos arquivos
      const attachmentPaths = await uploadFiles(ticket.id);
      
      // Atualizar ticket com os anexos
      if (attachmentPaths.length > 0) {
        const { error: updateError } = await supabase
          .from("support_tickets")
          .update({ attachments: attachmentPaths })
          .eq('id', ticket.id);
          
        if (updateError) throw updateError;
      }

      return { ...ticket, attachments: attachmentPaths };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast.success(`Chamado ${data.ticket_number} registrado com sucesso! Em breve entraremos em contato via WhatsApp.`, {
        duration: 6000,
      });
      form.reset();
      setUploadedFiles([]);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Erro ao criar chamado: " + error.message);
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      await createTicket.mutateAsync(values);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Chamado de Suporte</DialogTitle>
          <DialogDescription>
            Registre um novo chamado de suporte
          </DialogDescription>
        </DialogHeader>

        {authError && (
          <Alert variant="destructive">
            <AlertDescription>
              Você precisa estar autenticado para abrir um chamado. Por favor, faça login e tente novamente.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origem (Portal Logado)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Detectado automaticamente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="lojista">Portal Lojista</SelectItem>
                        <SelectItem value="colaborador">Portal Colaborador</SelectItem>
                        <SelectItem value="cliente">Portal Cliente</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Detectado automaticamente pelo portal onde você está logado
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridade</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a prioridade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="network_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rede</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a rede" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {networks.map((network) => (
                        <SelectItem key={network.id} value={network.id}>
                          {network.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Descreva brevemente o problema" maxLength={LIMITS.SHORT_TEXT} {...field} />
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
                    <Textarea
                      placeholder="Descreva detalhadamente o problema ou solicitação"
                      rows={4}
                      maxLength={LIMITS.LONG_TEXT}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Upload de Arquivos */}
            <FormItem>
              <FormLabel>Anexos (Opcional)</FormLabel>
              <FormDescription>
                Adicione prints, imagens ou PDFs (máx. 10MB por arquivo)
              </FormDescription>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="relative"
                    disabled={authError || uploadedFiles.length >= 5}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Selecionar Arquivos
                    <Input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={authError || uploadedFiles.length >= 5}
                    />
                  </Button>
                  {uploadedFiles.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {uploadedFiles.length} arquivo(s) selecionado(s)
                    </span>
                  )}
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50">
                        {file.type.startsWith('image/') ? (
                          <ImageIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="text-sm flex-1 truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FormItem>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-4">Dados do Solicitante</h4>
              
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="requester_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Solicitante</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome completo" {...field} disabled />
                      </FormControl>
                      <FormDescription>
                        Preenchido automaticamente com seu nome de usuário
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="requester_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email para Contato</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="email@exemplo.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="requester_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone (Opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="(00) 00000-0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting || uploadingFiles}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || uploadingFiles || authError}>
                {isSubmitting || uploadingFiles ? "Processando..." : "Criar Chamado"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
