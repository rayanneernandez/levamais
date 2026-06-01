import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationSender } from "@/components/store/NotificationSender";
import { NotificationGrid } from "@/components/store/NotificationGrid";
import { Bell, Send, History } from "lucide-react";

export default function Notificacoes() {
  const [activeTab, setActiveTab] = useState("send");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notificações In-App</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Envie notificações diretamente para o app dos seus clientes
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="send" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Enviar Notificação
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send">
          <NotificationSender />
        </TabsContent>

        <TabsContent value="history">
          <NotificationGrid />
        </TabsContent>
      </Tabs>
    </div>
  );
}
