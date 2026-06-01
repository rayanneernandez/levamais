import { WhatsAppConversationHistory } from "@/components/store/WhatsAppConversationHistory";
import { WhatsAppQueueManager } from "@/components/store/WhatsAppQueueManager";
import { WhatsAppTemplateManager } from "@/components/store/WhatsAppTemplateManager";
import { MessageTemplateManager } from "@/components/store/MessageTemplateManager";
import { WhatsAppTestSender } from "@/components/admin/WhatsAppTestSender";
import { WhatsAppSettings } from "@/components/store/WhatsAppSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function DisparoWhatsApp() {
  // Pegar o primeiro network_id disponível (admin tem acesso a todos)
  const { data: networkData, isLoading } = useQuery({
    queryKey: ["admin-networks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("networks")
        .select("id")
        .eq("status", "active")
        .limit(1)
        .single();
      
      return data;
    },
  });

  if (isLoading || !networkData?.id) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestão WhatsApp</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie toda a infraestrutura de mensagens WhatsApp
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Centro de Controle Zap Responder</CardTitle>
          <CardDescription>
            Monitore conversas, fila de envio, templates aprovados e mensagens personalizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="test" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="test">Teste de Envio</TabsTrigger>
              <TabsTrigger value="history">Conversas</TabsTrigger>
              <TabsTrigger value="queue">Fila de Envio</TabsTrigger>
              <TabsTrigger value="templates-wpp">Templates WhatsApp</TabsTrigger>
              <TabsTrigger value="settings">Configurações</TabsTrigger>
              <TabsTrigger value="templates">Mensagens</TabsTrigger>
            </TabsList>

            <TabsContent value="test" className="mt-6">
              <WhatsAppTestSender networkId={networkData.id} />
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <WhatsAppConversationHistory networkId={networkData.id} />
            </TabsContent>

            <TabsContent value="queue" className="mt-6">
              <WhatsAppQueueManager networkId={networkData.id} />
            </TabsContent>

            <TabsContent value="templates-wpp" className="mt-6">
              <WhatsAppTemplateManager networkId={networkData.id} />
            </TabsContent>

            <TabsContent value="settings" className="mt-6">
              <WhatsAppSettings networkId={networkData.id} />
            </TabsContent>

            <TabsContent value="templates" className="mt-6">
              <MessageTemplateManager channel="whatsapp" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
