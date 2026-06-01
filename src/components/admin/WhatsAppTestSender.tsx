import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Loader2, Phone, MessageSquare, CheckCircle2, FileText, AlertTriangle, Building2, Copy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface WhatsAppTestSenderProps {
  networkId: string;
}

export function WhatsAppTestSender({ networkId }: WhatsAppTestSenderProps) {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [lastSentId, setLastSentId] = useState<string | null>(null);

  // Buscar configurações da rede (inclui department_id)
  const { data: networkSettings } = useQuery({
    queryKey: ["whatsapp-settings", networkId],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_network_settings")
        .select("*")
        .eq("network_id", networkId)
        .single();
      return data;
    },
  });

  // Buscar templates aprovados
  const { data: templates = [] } = useQuery({
    queryKey: ["whatsapp-templates", networkId],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("network_id", networkId)
        .eq("status", "approved")
        .order("template_name");
      return data || [];
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("ID copiado para a área de transferência!");
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const getCleanPhone = () => {
    const numbers = phone.replace(/\D/g, "");
    if (numbers.length === 11) {
      return `55${numbers}`;
    }
    return numbers;
  };

  const selectedTemplateData = templates?.find(t => t.id === selectedTemplate);

  const handleSendTemplate = async () => {
    if (!phone || !selectedTemplate) {
      toast.error("Preencha o telefone e selecione um template");
      return;
    }

    const cleanPhone = getCleanPhone();
    if (cleanPhone.length < 12) {
      toast.error("Telefone inválido. Use o formato (XX) XXXXX-XXXX");
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_message_queue")
        .insert({
          network_id: networkId,
          phone: cleanPhone,
          message_type: "template",
          template_id: selectedTemplate,
          template_name: selectedTemplateData?.template_name,
          template_params: Object.keys(templateParams).length > 0 ? templateParams : null,
          status: "pending",
          priority: 10,
        })
        .select("id")
        .single();

      if (error) throw error;

      setLastSentId(data.id);
      toast.success("Template adicionado à fila de envio!");
    } catch (error: any) {
      console.error("Erro ao enviar template:", error);
      toast.error("Erro ao enviar", { description: error.message });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendText = async () => {
    if (!phone || !message) {
      toast.error("Preencha o telefone e a mensagem");
      return;
    }

    const cleanPhone = getCleanPhone();
    if (cleanPhone.length < 12) {
      toast.error("Telefone inválido. Use o formato (XX) XXXXX-XXXX");
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_message_queue")
        .insert({
          network_id: networkId,
          phone: cleanPhone,
          message_type: "text",
          message_text: message,
          status: "pending",
          priority: 10,
        })
        .select("id")
        .single();

      if (error) throw error;

      setLastSentId(data.id);
      toast.success("Mensagem adicionada à fila!");
      setMessage("");
    } catch (error: any) {
      console.error("Erro ao enviar texto:", error);
      toast.error("Erro ao enviar", { description: error.message });
    } finally {
      setIsSending(false);
    }
  };

  const triggerQueueProcessing = async () => {
    try {
      toast.info("Disparando processamento da fila...");
      const { error } = await supabase.functions.invoke("process-whatsapp-queue");
      if (error) throw error;
      toast.success("Fila de processamento disparada!");
    } catch (error: any) {
      console.error("Erro ao processar fila:", error);
      toast.error("Erro ao processar fila", { description: error.message });
    }
  };

  // Department ID padrão usado no sistema
  const DEFAULT_DEPARTMENT_ID = "a9355171-0c38-40e3-9f22-4ed123ddaf69";
  const currentDepartmentId = networkSettings?.department_id || DEFAULT_DEPARTMENT_ID;

  return (
    <div className="space-y-6">
      {/* Card de Departamento Configurado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Departamento Configurado
          </CardTitle>
          <CardDescription>
            ID do departamento usado para envios via Zap Responder
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted/50 rounded-md border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium mb-1">Department ID atual:</p>
                <code className="text-xs bg-background px-3 py-2 rounded border font-mono block">
                  {currentDepartmentId}
                </code>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => copyToClipboard(currentDepartmentId)}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copiar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              💡 Para alterar, vá na aba "Configurações" e atualize o campo "Department ID"
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Enviar Mensagem de Teste
          </CardTitle>
          <CardDescription>
            Teste a integração com o Zap Responder
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Campo de telefone comum */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Telefone (com DDD)
            </Label>
            <Input
              id="phone"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={handlePhoneChange}
              maxLength={16}
            />
            <p className="text-xs text-muted-foreground">
              Será enviado para: {getCleanPhone() || "---"}
            </p>
          </div>

          <Tabs defaultValue="template" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="template">
                <FileText className="h-4 w-4 mr-2" />
                Via Template (Recomendado)
              </TabsTrigger>
              <TabsTrigger value="text">
                <MessageSquare className="h-4 w-4 mr-2" />
                Texto Livre
              </TabsTrigger>
            </TabsList>

            <TabsContent value="template" className="space-y-4 mt-4">
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Templates são necessários para iniciar conversas (regra do WhatsApp Business)
                </p>
              </div>

              {templates && templates.length > 0 ? (
                <>
                  <div className="space-y-2">
                    <Label>Selecione um Template Aprovado</Label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha um template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.template_name} ({template.language})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedTemplateData && (
                    <div className="p-3 bg-muted/50 rounded-md border">
                      <p className="text-sm font-medium mb-1">Preview:</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {selectedTemplateData.body_text}
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleSendTemplate}
                    disabled={isSending || !phone || !selectedTemplate}
                    className="w-full"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Enviar Template
                  </Button>
                </>
              ) : (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-md">
                  <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Nenhum template aprovado encontrado. Cadastre templates na aba "Templates WhatsApp".
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="text" className="space-y-4 mt-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
                <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Texto livre só funciona dentro da janela de 24h (após o cliente enviar mensagem)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Mensagem</Label>
                <Textarea
                  id="message"
                  placeholder="Digite sua mensagem..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                onClick={handleSendText}
                disabled={isSending || !phone || !message}
                className="w-full"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Enviar Texto
              </Button>
            </TabsContent>
          </Tabs>

          <div className="border-t pt-4">
            <Button variant="outline" onClick={triggerQueueProcessing} className="w-full">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Processar Fila Agora
            </Button>
          </div>

          {lastSentId && (
            <div className="p-3 bg-muted/50 rounded-md border">
              <p className="text-sm text-muted-foreground">
                ✅ Última mensagem: <code className="text-xs">{lastSentId.substring(0, 8)}...</code>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regras do WhatsApp Business</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Templates:</strong> Necessários para iniciar conversa ou fora da janela de 24h</li>
            <li><strong>Texto livre:</strong> Só permitido dentro de 24h após mensagem do cliente</li>
            <li>Templates precisam ser aprovados pelo Meta/WhatsApp antes de usar</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
