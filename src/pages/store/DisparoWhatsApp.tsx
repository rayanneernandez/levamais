import { MarketingPackageGuard } from "@/components/store/MarketingPackageGuard";
import { PromotionalCampaignSender } from "@/components/store/PromotionalCampaignSender";
import { AutomaticSMSSettings } from "@/components/store/AutomaticSMSSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DisparoWhatsApp() {
  return (
    <MarketingPackageGuard packageType="whatsapp">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campanhas WhatsApp</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure disparos automáticos e envie campanhas promocionais via WhatsApp
          </p>
        </div>

        {/* Alerta sobre regra do WhatsApp */}
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <h3 className="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
            ⚠️ Importante: Regra de Template do WhatsApp
          </h3>
          <div className="text-sm text-amber-700 dark:text-amber-300 mt-2 space-y-2">
            <p>
              <strong>O WhatsApp Business exige que você inicie conversas com um template aprovado pela Meta.</strong>
            </p>
            <p>
              Quando você enviar uma campanha, o sistema irá automaticamente:
            </p>
            <ol className="list-decimal list-inside ml-2 space-y-1">
              <li>Enviar um <strong>template de contato</strong> para clientes sem conversa ativa</li>
              <li>Aguardar a <strong>resposta do cliente</strong> (janela de 24h)</li>
              <li>Somente após a resposta, enviar a <strong>mensagem promocional</strong></li>
            </ol>
            <p className="text-xs mt-2 opacity-80">
              Isso garante conformidade com as políticas do WhatsApp e evita bloqueios da sua conta.
            </p>
          </div>
        </div>

        <Tabs defaultValue="automatico" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="automatico">Disparos Automáticos</TabsTrigger>
            <TabsTrigger value="promocao">Campanha Promocional</TabsTrigger>
          </TabsList>

          <TabsContent value="automatico">
            <AutomaticSMSSettings channel="whatsapp" />
          </TabsContent>

          <TabsContent value="promocao">
            <PromotionalCampaignSender channel="whatsapp" />
          </TabsContent>
        </Tabs>
      </div>
    </MarketingPackageGuard>
  );
}