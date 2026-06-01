import { MarketingPackageGuard } from "@/components/store/MarketingPackageGuard";
import { PromotionalCampaignSender } from "@/components/store/PromotionalCampaignSender";
import { AutomaticSMSSettings } from "@/components/store/AutomaticSMSSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DisparoSMS() {
  return (
    <MarketingPackageGuard packageType="sms">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Disparo de SMS</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure disparos automáticos e envie campanhas promocionais via SMS
          </p>
        </div>

        <Tabs defaultValue="automatico" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="automatico">Disparos Automáticos</TabsTrigger>
            <TabsTrigger value="promocao">Campanha Promocional</TabsTrigger>
          </TabsList>

          <TabsContent value="automatico">
            <AutomaticSMSSettings channel="sms" />
          </TabsContent>

          <TabsContent value="promocao">
            <PromotionalCampaignSender channel="sms" />
          </TabsContent>
        </Tabs>
      </div>
    </MarketingPackageGuard>
  );
}
