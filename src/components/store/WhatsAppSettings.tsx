import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, RefreshCw, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WhatsAppSettingsProps {
  networkId: string;
}

interface NetworkSettings {
  id?: string;
  network_id: string;
  default_template_name: string | null;
  default_template_language: string;
  department_id: string;
  auto_send_template: boolean;
}

interface WhatsAppTemplate {
  name: string;
  status: string;
  category?: string;
  language?: string;
}

export function WhatsAppSettings({ networkId }: WhatsAppSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["whatsapp-settings", networkId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_network_settings")
        .select("*")
        .eq("network_id", networkId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      
      return data as NetworkSettings | null;
    },
  });

  const { data: templates, isLoading: loadingTemplates, refetch: refetchTemplates } = useQuery({
    queryKey: ["whatsapp-templates-for-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('list-whatsapp-templates');
      if (error) throw error;
      return (data?.templates || []).filter((t: WhatsAppTemplate) => 
        t.status === 'APPROVED' || t.status === 'approved'
      ) as WhatsAppTemplate[];
    },
  });

  const [formData, setFormData] = useState<Partial<NetworkSettings>>({
    default_template_name: settings?.default_template_name || null,
    default_template_language: settings?.default_template_language || 'pt_BR',
    department_id: settings?.department_id || 'a9355171-0c38-40e3-9f22-4ed123ddaf69',
    auto_send_template: settings?.auto_send_template ?? true,
  });

  // Atualizar formData quando settings carregar
  useState(() => {
    if (settings) {
      setFormData({
        default_template_name: settings.default_template_name,
        default_template_language: settings.default_template_language,
        department_id: settings.department_id,
        auto_send_template: settings.auto_send_template,
      });
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<NetworkSettings>) => {
      const payload = {
        network_id: networkId,
        ...data,
        updated_at: new Date().toISOString(),
      };

      if (settings?.id) {
        const { error } = await supabase
          .from("whatsapp_network_settings")
          .update(payload)
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("whatsapp_network_settings")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-settings", networkId] });
      toast({ title: "Configurações salvas com sucesso!" });
    },
    onError: (error) => {
      toast({ 
        title: "Erro ao salvar configurações", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  if (loadingSettings) {
    return <div className="text-center py-8 text-muted-foreground">Carregando configurações...</div>;
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Configure o template padrão que será enviado automaticamente quando não houver uma janela de conversa de 24h ativa com o cliente.
          Após o cliente responder, a mensagem original será enviada automaticamente.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Configurações de Template</CardTitle>
          <CardDescription>
            Defina como o sistema deve se comportar com a regra de 24h do WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Envio Automático de Template</Label>
              <p className="text-sm text-muted-foreground">
                Quando ativado, envia template automaticamente se não houver janela de 24h
              </p>
            </div>
            <Switch
              checked={formData.auto_send_template}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, auto_send_template: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Template Padrão</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => refetchTemplates()}
                disabled={loadingTemplates}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loadingTemplates ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
            <Select
              value={formData.default_template_name || ""}
              onValueChange={(value) => 
                setFormData({ ...formData, default_template_name: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um template aprovado" />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((template) => (
                  <SelectItem key={template.name} value={template.name}>
                    {template.name} ({template.category || 'N/A'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Apenas templates aprovados pela Meta aparecem aqui
            </p>
          </div>

          <div className="space-y-2">
            <Label>Idioma do Template</Label>
            <Select
              value={formData.default_template_language}
              onValueChange={(value) => 
                setFormData({ ...formData, default_template_language: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt_BR">Português (Brasil)</SelectItem>
                <SelectItem value="en_US">English (US)</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Department ID (Zap Responder)</Label>
            <Input
              value={formData.department_id}
              onChange={(e) => 
                setFormData({ ...formData, department_id: e.target.value })
              }
              placeholder="a9355171-0c38-40e3-9f22-4ed123ddaf69"
            />
            <p className="text-xs text-muted-foreground">
              ID do departamento configurado no Zap Responder
            </p>
          </div>

          <Button 
            onClick={handleSave} 
            disabled={saveMutation.isPending}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
