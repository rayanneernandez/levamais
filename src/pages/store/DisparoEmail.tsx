import { MarketingPackageGuard } from "@/components/store/MarketingPackageGuard";
import { MessageTemplateManager } from "@/components/store/MessageTemplateManager";
import { PromotionalCampaignSender } from "@/components/store/PromotionalCampaignSender";
import { BirthdayCampaignSender } from "@/components/store/BirthdayCampaignSender";
import { ExpirationCampaignSender } from "@/components/store/ExpirationCampaignSender";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DisparoEmail() {
  return (
    <MarketingPackageGuard packageType="email">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Disparo de E-mail</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Envie campanhas de e-mail marketing para seus clientes
          </p>
        </div>

        <Tabs defaultValue="templates" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="promocao">Promoção</TabsTrigger>
            <TabsTrigger value="aniversario">Aniversário</TabsTrigger>
            <TabsTrigger value="exp-pontos">Exp. Pontos</TabsTrigger>
            <TabsTrigger value="exp-plano">Exp. Plano</TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            <MessageTemplateManager channel="email" />
          </TabsContent>

          <TabsContent value="promocao">
            <PromotionalCampaignSender channel="email" />
          </TabsContent>

          <TabsContent value="aniversario">
            <BirthdayCampaignSender channel="email" />
          </TabsContent>

          <TabsContent value="exp-pontos">
            <ExpirationCampaignSender channel="email" type="points" />
          </TabsContent>

          <TabsContent value="exp-plano">
            <ExpirationCampaignSender channel="email" type="plan" />
          </TabsContent>
        </Tabs>
      </div>
    </MarketingPackageGuard>
  );
}
