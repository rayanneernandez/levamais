import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Send, Calendar, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface BirthdayCampaignSenderProps {
  channel: "email" | "whatsapp" | "sms";
}

export function BirthdayCampaignSender({ channel }: BirthdayCampaignSenderProps) {
  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [birthdayCount, setBirthdayCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingCount, setIsLoadingCount] = useState(false);
  const { toast } = useToast();

  const months = [
    { value: "01", label: "Janeiro" },
    { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Maio" },
    { value: "06", label: "Junho" },
    { value: "07", label: "Julho" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

  useEffect(() => {
    loadBirthdayTemplate();
  }, [channel]);

  useEffect(() => {
    if (selectedMonth) {
      loadBirthdayCount();
    }
  }, [selectedMonth]);

  const loadBirthdayTemplate = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: manager } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!manager) return;

      const { data: template } = await supabase
        .from("marketing_message_templates")
        .select("*")
        .eq("network_id", manager.network_id)
        .eq("channel", channel)
        .eq("template_type", "aniversario")
        .single();

      if (template) {
        setMessage(template.message_content);
        if (template.subject) setSubject(template.subject);
      }
    } catch (error) {
      console.error("Erro ao carregar template:", error);
    }
  };

  const loadBirthdayCount = async () => {
    setIsLoadingCount(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: manager } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!manager) return;

      // Buscar clientes que fazem aniversário no mês selecionado
      const { count, error } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("network_id", manager.network_id)
        .like("birth_date", `%-${selectedMonth}-%`);

      if (error) throw error;
      setBirthdayCount(count || 0);
    } catch (error: any) {
      toast({
        title: "Erro ao contar aniversariantes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingCount(false);
    }
  };

  const handleSend = async () => {
    if (!campaignName || !message || !selectedMonth) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos e selecione o mês.",
        variant: "destructive",
      });
      return;
    }

    if (channel === "email" && !subject) {
      toast({
        title: "Assunto obrigatório",
        description: "E-mails precisam ter um assunto.",
        variant: "destructive",
      });
      return;
    }

    if (channel === "sms" && message.length > 160) {
      toast({
        title: "Mensagem muito longa",
        description: "SMS está limitado a 160 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (birthdayCount === 0) {
      toast({
        title: "Nenhum aniversariante",
        description: `Não há clientes fazendo aniversário em ${months.find(m => m.value === selectedMonth)?.label}.`,
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: manager } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!manager) throw new Error("Gerente não encontrado");

      // Calcular custo estimado
      const costPerMessage = channel === "sms" ? 0.10 : channel === "whatsapp" ? 0.05 : 0.01;
      const totalCost = birthdayCount * costPerMessage;

      // Registrar campanha
      const { error: campaignError } = await supabase
        .from("marketing_campaigns")
        .insert({
          network_id: manager.network_id,
          campaign_name: campaignName,
          campaign_type: channel, // Apenas o canal: sms, email ou whatsapp
          message_content: message,
          total_recipients: birthdayCount,
          status: "sent",
          sent_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          sent_count: birthdayCount,
          failed_count: 0,
          cost_per_message: costPerMessage,
          total_cost: totalCost,
          created_by: user.id,
        });

      if (campaignError) throw campaignError;

      toast({
        title: "Campanha registrada",
        description: `Campanha de aniversário via ${channel} registrada com sucesso!`,
      });

      setCampaignName("");
      setSubject("");
      setMessage("");
      setSelectedMonth("");
    } catch (error: any) {
      toast({
        title: "Erro ao registrar campanha",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const charCount = message.length;
  const isOverLimit = channel === "sms" && charCount > 160;

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>
          Use <code className="bg-muted px-2 py-1 rounded">{"{{nome}}"}</code> na mensagem para personalizar com o nome do cliente
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Enviar para Aniversariantes do Mês
          </CardTitle>
          <CardDescription>
            Envie mensagens personalizadas para todos os clientes que fazem aniversário no mês selecionado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Nome da Campanha *</Label>
            <Input
              id="campaign-name"
              placeholder="Ex: Aniversariantes Maio 2024"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="month">Mês de Aniversário *</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedMonth && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" />
                {isLoadingCount ? (
                  <span className="text-muted-foreground">Contando...</span>
                ) : (
                  <Badge variant="secondary">
                    {birthdayCount} aniversariante(s) em {months.find(m => m.value === selectedMonth)?.label}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {channel === "email" && (
            <div className="space-y-2">
              <Label htmlFor="subject">Assunto *</Label>
              <Input
                id="subject"
                placeholder="Ex: Feliz Aniversário! 🎂"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem *</Label>
            <Textarea
              id="message"
              placeholder="Digite sua mensagem de aniversário..."
              className="min-h-[150px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={channel === "sms" ? 160 : undefined}
            />
            {channel === "sms" && (
              <p className={`text-xs font-medium ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                {charCount}/160 caracteres
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setCampaignName("");
                setSubject("");
                setMessage("");
                setSelectedMonth("");
              }}
            >
              Limpar
            </Button>
            <Button onClick={handleSend} disabled={isSending || isOverLimit}>
              <Send className="h-4 w-4 mr-2" />
              {isSending ? "Enviando..." : `Enviar para ${birthdayCount} cliente(s)`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
