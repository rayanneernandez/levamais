import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Building2, Plus, QrCode, Pencil, Eye, Download, Copy, Check, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { QRCodeSVG } from "qrcode.react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { PrintableQRCode } from "@/components/store/PrintableQRCode";
import { LIMITS, cleanEmail, cleanText, trimmedString } from "@/lib/input-sanitization";

const formSchema = z.object({
  apelido: trimmedString(LIMITS.NAME, { min: 2, minMessage: "Apelido da loja é obrigatório" }),
  nome_fantasia: z.string().trim().max(LIMITS.NAME, `Máximo de ${LIMITS.NAME} caracteres`).optional().or(z.literal("")),
  logradouro: z.string().trim().max(LIMITS.ADDRESS, `Máximo de ${LIMITS.ADDRESS} caracteres`).optional().or(z.literal("")),
  numero: z.string().trim().max(LIMITS.SHORT_CODE, `Máximo de ${LIMITS.SHORT_CODE} caracteres`).optional().or(z.literal("")),
  complemento: z.string().trim().max(LIMITS.SHORT_TEXT, `Máximo de ${LIMITS.SHORT_TEXT} caracteres`).optional().or(z.literal("")),
  bairro: z.string().trim().max(LIMITS.CITY, `Máximo de ${LIMITS.CITY} caracteres`).optional().or(z.literal("")),
  municipio: z.string().trim().max(LIMITS.CITY, `Máximo de ${LIMITS.CITY} caracteres`).optional().or(z.literal("")),
  uf: z.string().trim().max(2, "UF deve ter no máximo 2 caracteres").optional().or(z.literal("")),
  cep: z.string().trim().max(LIMITS.CEP, `Máximo de ${LIMITS.CEP} caracteres`).optional().or(z.literal("")),
  contact_name: z.string().trim().max(LIMITS.NAME, `Máximo de ${LIMITS.NAME} caracteres`).optional().or(z.literal("")),
  contact_phone: z.string().trim().max(LIMITS.PHONE, `Máximo de ${LIMITS.PHONE} caracteres`).optional().or(z.literal("")),
  contact_email: z.string().trim().toLowerCase().max(LIMITS.EMAIL, `E-mail deve ter no máximo ${LIMITS.EMAIL} caracteres`).email("Email inválido").optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
  flag: z.enum(['ipiranga', 'shell', 'vibra', 'ale', 'branca', 'none']).optional(),
  services: z.array(z.string()).default([]),
});

type FormData = z.infer<typeof formSchema>;

interface Store {
  id: string;
  name: string;
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  loyalty_type: string;
  points_per_real: number;
  cashback_percentage: number;
  status: string;
}

interface Attendant {
  user_id: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

export default function StoreLojas() {
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [selectedAttendant, setSelectedAttendant] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      apelido: "",
      nome_fantasia: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      municipio: "",
      uf: "",
      cep: "",
      contact_name: "",
      contact_phone: "",
      contact_email: "",
      status: "active",
    },
  });

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: managerData } = await supabase
      .from('store_managers')
      .select('network_id')
      .eq('user_id', user.id)
      .is('store_id', null)
      .maybeSingle();

    if (!managerData?.network_id) return;

    const { data: storesData } = await supabase
      .from('stores')
      .select('*')
      .eq('network_id', managerData.network_id)
      .eq('status', 'active');

    setStores(storesData || []);
    setIsLoading(false);
  };

  const handleView = (store: Store) => {
    setEditingStore(store);
    setIsViewMode(true);
    const addressParts = store.address?.split(", ") || [];
    form.reset({
      apelido: store.name,
      nome_fantasia: store.nome_fantasia || "",
      logradouro: addressParts[0] || "",
      numero: addressParts[1] || "",
      complemento: addressParts[2] || "",
      bairro: addressParts[3] || "",
      municipio: addressParts[4] || "",
      uf: addressParts[5] || "",
      cep: addressParts[6] || "",
      contact_name: store.contact_name || "",
      contact_phone: store.contact_phone || "",
      contact_email: store.contact_email || "",
      status: store.status as "active" | "inactive",
      flag: (store as any).flag || "none",
      services: (store as any).services || [],
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (store: Store) => {
    setEditingStore(store);
    setIsViewMode(false);
    const addressParts = store.address?.split(", ") || [];
    form.reset({
      apelido: store.name,
      nome_fantasia: store.nome_fantasia || "",
      logradouro: addressParts[0] || "",
      numero: addressParts[1] || "",
      complemento: addressParts[2] || "",
      bairro: addressParts[3] || "",
      municipio: addressParts[4] || "",
      uf: addressParts[5] || "",
      cep: addressParts[6] || "",
      contact_name: store.contact_name || "",
      contact_phone: store.contact_phone || "",
      contact_email: store.contact_email || "",
      status: store.status as "active" | "inactive",
      flag: (store as any).flag || "none",
      services: (store as any).services || [],
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: FormData) => {
    if (!editingStore) return;

    try {
      const sanitizedData = {
        ...data,
        apelido: cleanText(data.apelido, LIMITS.NAME),
        nome_fantasia: cleanText(data.nome_fantasia, LIMITS.NAME),
        logradouro: cleanText(data.logradouro, LIMITS.ADDRESS),
        numero: cleanText(data.numero, LIMITS.SHORT_CODE),
        complemento: cleanText(data.complemento, LIMITS.SHORT_TEXT),
        bairro: cleanText(data.bairro, LIMITS.CITY),
        municipio: cleanText(data.municipio, LIMITS.CITY),
        uf: cleanText(data.uf, 2).toUpperCase(),
        cep: cleanText(data.cep, LIMITS.CEP),
        contact_name: cleanText(data.contact_name, LIMITS.NAME),
        contact_phone: cleanText(data.contact_phone, LIMITS.PHONE),
        contact_email: cleanEmail(data.contact_email, LIMITS.EMAIL),
      };

      // Manter todos os campos, mesmo vazios, para preservar a ordem
      const endereco = [
        sanitizedData.logradouro || "",
        sanitizedData.numero || "",
        sanitizedData.complemento || "",
        sanitizedData.bairro || "",
        sanitizedData.municipio || "",
        sanitizedData.uf || "",
        sanitizedData.cep || ""
      ].join(", ");

      const { error } = await supabase
        .from("stores")
        .update({
          name: sanitizedData.apelido,
          nome_fantasia: sanitizedData.nome_fantasia || null,
          contact_name: sanitizedData.contact_name || null,
          contact_phone: sanitizedData.contact_phone || null,
          contact_email: sanitizedData.contact_email || null,
          address: endereco || null,
          status: sanitizedData.status,
          flag: sanitizedData.flag === 'none' ? null : sanitizedData.flag,
          services: sanitizedData.services || [],
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingStore.id);

      if (error) throw error;

      toast({
        title: "Loja atualizada!",
        description: "A loja foi atualizada com sucesso.",
      });

      setIsDialogOpen(false);
      setEditingStore(null);
      setIsViewMode(false);
      form.reset();
      loadStores();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar loja",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleOpenQRDialog = async (store: Store) => {
    setSelectedStore(store);
    setIsQRDialogOpen(true);
    setSelectedAttendant("");
    setQrCodeUrl("");
    
    // Buscar atendentes da loja
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: managerData } = await supabase
        .from('store_managers')
        .select('network_id')
        .eq('user_id', user.id)
        .is('store_id', null)
        .single();

      if (!managerData?.network_id) return;

      // Buscar atendentes que têm acesso à loja específica
      const { data: storeManagersData } = await supabase
        .from('store_managers')
        .select('user_id')
        .eq('network_id', managerData.network_id)
        .eq('store_id', store.id)
        .eq('is_attendant', true);

      if (storeManagersData && storeManagersData.length > 0) {
        const userIds = storeManagersData.map(sm => sm.user_id);
        
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        const attendantsData = profilesData?.map(profile => ({
          user_id: profile.id,
          profiles: {
            full_name: profile.full_name,
            email: profile.email
          }
        })) || [];

        setAttendants(attendantsData);
      } else {
        setAttendants([]);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar atendentes",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleGenerateQRCode = () => {
    if (!selectedAttendant || !selectedStore) return;
    
    const url = `https://portal.levamais.app/levacliente/cadastro?attendant=${selectedAttendant}&store=${selectedStore.id}`;
    setQrCodeUrl(url);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(qrCodeUrl);
    setCopied(true);
    toast({
      title: "Link copiado!",
      description: "O link foi copiado para a área de transferência.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = async () => {
    const element = document.getElementById('printable-qr-code');
    if (!element) return;
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      
      const canvas = await html2canvas(element, {
        scale: 3,
        backgroundColor: '#ffffff',
        logging: false,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgWidth = 150;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const x = (pdf.internal.pageSize.getWidth() - imgWidth) / 2;
      const y = 20;
      
      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
      
      const attendantName = attendants.find(a => a.user_id === selectedAttendant)?.profiles.full_name || 'atendente';
      pdf.save(`qrcode-${selectedStore?.name}-${attendantName}.pdf`);
      
      toast({
        title: "QR Code baixado!",
        description: "O PDF foi salvo e está pronto para impressão.",
      });
    } catch (error) {
      toast({
        title: "Erro ao baixar",
        description: "Não foi possível gerar o PDF.",
        variant: "destructive",
      });
    }
  };

  const handlePrintQR = () => {
    const element = document.getElementById('printable-qr-code');
    if (!element) return;
    
    const printWindow = window.open('', '', 'width=600,height=800');
    if (!printWindow) return;
    
    const printContent = element.innerHTML;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${selectedStore?.name}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              padding: 20px;
            }
            @media print {
              body { padding: 0; }
              @page { margin: 0; }
            }
          </style>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body>
          <div id="print-content">${printContent}</div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Minhas Lojas</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie suas lojas e regras de fidelidade
        </p>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {isViewMode ? "Visualizar Loja" : "Editar Loja"}
            </DialogTitle>
            <DialogDescription>
              {isViewMode 
                ? "Visualize os dados da loja."
                : "Atualize os dados da loja. CNPJ e Razão Social não podem ser alterados."
              }
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4 bg-muted/30 p-4 rounded-lg">
                <h3 className="font-medium text-sm">Dados Fiscais (não editáveis)</h3>
                <div className="grid gap-4">
                  <FormItem>
                    <FormLabel>CNPJ</FormLabel>
                    <Input value={editingStore?.cnpj || ""} disabled />
                  </FormItem>
                  <FormItem>
                    <FormLabel>Razão Social</FormLabel>
                    <Input value={editingStore?.razao_social || ""} disabled />
                  </FormItem>
                </div>
              </div>

              <FormField
                control={form.control}
                name="apelido"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Loja (Apelido) *</FormLabel>
                    <FormControl>
                        <Input {...field} maxLength={LIMITS.NAME} placeholder="Nome como aparece no sistema" disabled={isViewMode} />
                    </FormControl>
                    <FormDescription>
                      Nome pelo qual a loja será identificada no sistema
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nome_fantasia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Fantasia</FormLabel>
                    <FormControl>
                        <Input {...field} maxLength={LIMITS.NAME} placeholder="Nome fantasia" disabled={isViewMode} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <h3 className="font-medium text-sm">Endereço</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="logradouro"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Logradouro</FormLabel>
                        <FormControl>
                          <Input {...field} maxLength={LIMITS.ADDRESS} placeholder="Rua, Avenida..." disabled={isViewMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="numero"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número</FormLabel>
                        <FormControl>
                          <Input {...field} maxLength={LIMITS.SHORT_CODE} placeholder="123" disabled={isViewMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="complemento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complemento</FormLabel>
                        <FormControl>
                          <Input {...field} maxLength={LIMITS.SHORT_TEXT} placeholder="Sala, Bloco..." disabled={isViewMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bairro"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl>
                          <Input {...field} maxLength={LIMITS.CITY} placeholder="Bairro" disabled={isViewMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="municipio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Município</FormLabel>
                        <FormControl>
                          <Input {...field} maxLength={LIMITS.CITY} placeholder="Cidade" disabled={isViewMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="uf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UF</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="SP" maxLength={2} disabled={isViewMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cep"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP</FormLabel>
                        <FormControl>
                          <Input {...field} maxLength={LIMITS.CEP} placeholder="00000-000" disabled={isViewMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-sm">Contato</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="contact_name"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Nome do Responsável</FormLabel>
                        <FormControl>
                          <Input {...field} maxLength={LIMITS.NAME} placeholder="Nome completo" disabled={isViewMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contact_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input {...field} maxLength={LIMITS.PHONE} placeholder="(00) 00000-0000" disabled={isViewMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contact_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" maxLength={LIMITS.EMAIL} placeholder="email@exemplo.com" disabled={isViewMode} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-sm">Identificação do Posto</h3>
                
                <FormField
                  control={form.control}
                  name="flag"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bandeira do Posto</FormLabel>
                      <Select
                        disabled={isViewMode}
                        onValueChange={field.onChange}
                        value={field.value || 'none'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a bandeira" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          <SelectItem value="ipiranga">Ipiranga</SelectItem>
                          <SelectItem value="shell">Shell</SelectItem>
                          <SelectItem value="vibra">Vibra</SelectItem>
                          <SelectItem value="ale">Ale</SelectItem>
                          <SelectItem value="branca">Branca</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="services"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel>Serviços Disponíveis</FormLabel>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { id: 'conveniencia', label: 'Conveniência' },
                          { id: 'totem_eletrico', label: 'Totem de Carro Elétrico' },
                          { id: 'caixa_24h', label: 'Caixa 24 Horas' },
                          { id: 'troca_oleo', label: 'Troca de Óleo' },
                          { id: 'banheiro', label: 'Banheiro' },
                          { id: 'chuveiro', label: 'Chuveiro' },
                          { id: 'estacionamento', label: 'Estacionamento' },
                          { id: 'lava_jato', label: 'Lava Jato' },
                        ].map((service) => (
                          <FormField
                            key={service.id}
                            control={form.control}
                            name="services"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={service.id}
                                  className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      disabled={isViewMode}
                                      checked={field.value?.includes(service.id)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, service.id])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== service.id
                                              )
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal cursor-pointer">
                                    {service.label}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isViewMode}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Ativa</SelectItem>
                        <SelectItem value="inactive">Inativa</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingStore(null);
                    setIsViewMode(false);
                    form.reset();
                  }}
                >
                  {isViewMode ? "Fechar" : "Cancelar"}
                </Button>
                {!isViewMode && (
                  <Button type="submit">
                    Salvar Alterações
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog de QR Code */}
      <Dialog open={isQRDialogOpen} onOpenChange={setIsQRDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Gerar QR Code de Cadastro - {selectedStore?.name}
            </DialogTitle>
            <DialogDescription>
              Selecione o atendente responsável para gerar o QR Code de cadastro. Os clientes que usarem este QR Code serão vinculados a esse atendente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {attendants.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Nenhum atendente encontrado para esta loja.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Cadastre atendentes na seção de Usuários e Acessos.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <Label>Selecione o Atendente:</Label>
                  <RadioGroup value={selectedAttendant} onValueChange={setSelectedAttendant}>
                    {attendants.map((attendant) => (
                      <div key={attendant.user_id} className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value={attendant.user_id} id={attendant.user_id} />
                        <Label htmlFor={attendant.user_id} className="flex-1 cursor-pointer">
                          <div className="font-medium">{attendant.profiles.full_name}</div>
                          <div className="text-xs text-muted-foreground">{attendant.profiles.email}</div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <Button 
                  onClick={handleGenerateQRCode} 
                  disabled={!selectedAttendant}
                  className="w-full"
                >
                  Gerar QR Code
                </Button>

                {qrCodeUrl && (
                  <div className="space-y-4 pt-4 border-t">
                    {/* QR Code Bonito para Impressão */}
                    <div className="flex justify-center">
                      <PrintableQRCode
                        qrCodeUrl={qrCodeUrl}
                        storeName={selectedStore?.name || ""}
                        attendantName={attendants.find(a => a.user_id === selectedAttendant)?.profiles.full_name || ""}
                        loyaltyType={selectedStore?.loyalty_type}
                      />
                    </div>

                    {/* Link para copiar */}
                    <div className="w-full space-y-2">
                      <Label>Link de Cadastro:</Label>
                      <div className="flex gap-2">
                        <Input 
                          value={qrCodeUrl} 
                          readOnly 
                          className="font-mono text-xs"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleCopyUrl}
                        >
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Botões de Download e Impressão */}
                    <div className="flex gap-2 w-full">
                      <Button
                        variant="outline"
                        onClick={handleDownloadQR}
                        className="flex-1"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Baixar PDF
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handlePrintQR}
                        className="flex-1"
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        Imprimir
                      </Button>
                    </div>

                    <div className="text-xs text-muted-foreground text-center bg-muted/50 p-3 rounded-lg">
                      <p className="font-semibold">✨ QR Code Personalizado</p>
                      <p className="mt-1">Este QR Code está vinculado ao atendente selecionado e será usado para rastreamento e relatórios de desempenho.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3">
        {stores.length === 0 ? (
          <Card className="p-8 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
            <h3 className="text-base font-semibold mb-2">Nenhuma loja cadastrada</h3>
            <p className="text-muted-foreground text-sm mb-3">Adicione sua primeira loja para começar</p>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Loja
            </Button>
          </Card>
        ) : (
          stores.map((store) => (
            <Card key={store.id} className="p-4 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold">{store.name}</h3>
                    <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>CNPJ: {store.cnpj}</span>
                      <span>•</span>
                      <span className="text-primary">
                        {store.loyalty_type === 'points' ? 'Pontos' : 'Cashback'}
                      </span>
                      <span>•</span>
                      <span>
                        {store.loyalty_type === 'points' 
                          ? `${store.points_per_real} ponto = R$ 1,00`
                          : `${store.cashback_percentage}% de volta`
                        }
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleView(store)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleEdit(store)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleOpenQRDialog(store)}
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
