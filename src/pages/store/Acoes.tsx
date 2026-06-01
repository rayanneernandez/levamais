import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2, Sparkles, Send } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ActionCampaignMessaging } from "@/components/store/ActionCampaignMessaging";
import { FuelPromotionsManager } from "@/components/store/FuelPromotionsManager";
import { Badge } from "@/components/ui/badge";
import { LIMITS, cleanText, trimmedString } from "@/lib/input-sanitization";

const campaignSchema = z.object({
  name: trimmedString(LIMITS.SHORT_TEXT, { min: 1, minMessage: "Nome é obrigatório" }),
  multiplier: z.coerce.number().min(1, "Mínimo: 1x").max(10, "Máximo: 10x"),
  start_date: z.string().min(1, "Data inicial obrigatória"),
  end_date: z.string().min(1, "Data final obrigatória"),
  start_time: z.string().min(1, "Hora inicial obrigatória"),
  end_time: z.string().min(1, "Hora final obrigatória"),
  store_ids: z.array(z.string()).min(1, "Selecione pelo menos uma loja"),
});

type CampaignFormValues = z.infer<typeof campaignSchema>;

interface Campaign {
  id: string;
  name: string;
  action_type: "cashback" | "points";
  cashback_multiplier?: number;
  points_multiplier?: number;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  store_ids: string[];
}

export default function Acoes() {
  const [isLoading, setIsLoading] = useState(false);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [loyaltyType, setLoyaltyType] = useState<"cashback" | "points">("cashback");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [messagingCampaign, setMessagingCampaign] = useState<Campaign | null>(null);
  const [isMessagingDialogOpen, setIsMessagingDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: "",
      multiplier: 2,
      start_date: "",
      end_date: "",
      start_time: "00:00",
      end_time: "23:59",
      store_ids: [],
    },
  });

  useEffect(() => {
    loadNetworkId();
    loadLoyaltyType();
    loadStores();
    loadCampaigns();
  }, []);

  const loadNetworkId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: manager } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (manager) {
        setNetworkId(manager.network_id);
      }
    } catch (error: any) {
      console.error("Erro ao carregar network_id:", error);
    }
  };

  const loadLoyaltyType = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: manager } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!manager) return;

      const { data: store } = await supabase
        .from("stores")
        .select("loyalty_type")
        .eq("network_id", manager.network_id)
        .limit(1)
        .single();

      if (store) {
        setLoyaltyType(store.loyalty_type as "cashback" | "points");
      }
    } catch (error: any) {
      console.error("Erro ao carregar tipo de fidelidade:", error);
    }
  };

  const loadStores = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: manager } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!manager) return;

      const { data, error } = await supabase
        .from("stores")
        .select("id, name")
        .eq("network_id", manager.network_id)
        .eq("status", "active");

      if (error) throw error;
      setStores(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar lojas:", error);
    }
  };

  const loadCampaigns = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: manager } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!manager) return;

      const { data: campaignsData, error: campaignsError } = await supabase
        .from("loyalty_campaigns")
        .select("*")
        .eq("network_id", manager.network_id)
        .order("created_at", { ascending: false });

      if (campaignsError) throw campaignsError;

      const campaignsWithStores = await Promise.all(
        (campaignsData || []).map(async (campaign) => {
          const { data: storeData } = await supabase
            .from("campaign_stores")
            .select("store_id")
            .eq("campaign_id", campaign.id);

          return {
            ...campaign,
            action_type: campaign.action_type as "cashback" | "points",
            store_ids: storeData?.map((s) => s.store_id) || [],
          };
        })
      );

      setCampaigns(campaignsWithStores);
    } catch (error: any) {
      console.error("Erro ao carregar campanhas:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (values: CampaignFormValues) => {
    const sanitizedValues = {
      ...values,
      name: cleanText(values.name, LIMITS.SHORT_TEXT),
    };

    if (!networkId) {
      toast({
        title: "Erro",
        description: "Network ID não encontrado",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingCampaign) {
        const updateData = {
          name: sanitizedValues.name,
          action_type: loyaltyType,
          start_date: sanitizedValues.start_date,
          end_date: sanitizedValues.end_date,
          start_time: sanitizedValues.start_time,
          end_time: sanitizedValues.end_time,
          ...(loyaltyType === "cashback" 
            ? { cashback_multiplier: sanitizedValues.multiplier, points_multiplier: 1 }
            : { points_multiplier: sanitizedValues.multiplier, cashback_multiplier: 1 }
          ),
        };

        const { error: updateError } = await supabase
          .from("loyalty_campaigns")
          .update(updateData)
          .eq("id", editingCampaign.id);

        if (updateError) throw updateError;

        await supabase
          .from("campaign_stores")
          .delete()
          .eq("campaign_id", editingCampaign.id);

        const storeInserts = sanitizedValues.store_ids.map((store_id) => ({
          campaign_id: editingCampaign.id,
          store_id,
        }));

        const { error: storesError } = await supabase
          .from("campaign_stores")
          .insert(storeInserts);

        if (storesError) throw storesError;

        toast({ title: "Ação atualizada com sucesso!" });
      } else {
        const insertData = {
          network_id: networkId,
          name: sanitizedValues.name,
          action_type: loyaltyType,
          start_date: sanitizedValues.start_date,
          end_date: sanitizedValues.end_date,
          start_time: sanitizedValues.start_time,
          end_time: sanitizedValues.end_time,
          ...(loyaltyType === "cashback" 
            ? { cashback_multiplier: sanitizedValues.multiplier, points_multiplier: 1 }
            : { points_multiplier: sanitizedValues.multiplier, cashback_multiplier: 1 }
          ),
        };

        const { data: campaign, error: campaignError } = await supabase
          .from("loyalty_campaigns")
          .insert(insertData)
          .select()
          .single();

        if (campaignError) throw campaignError;

        const storeInserts = sanitizedValues.store_ids.map((store_id) => ({
          campaign_id: campaign.id,
          store_id,
        }));

        const { error: storesError } = await supabase
          .from("campaign_stores")
          .insert(storeInserts);

        if (storesError) throw storesError;

        toast({ title: "Ação criada com sucesso!" });
      }

      setIsDialogOpen(false);
      form.reset();
      setEditingCampaign(null);
      loadCampaigns();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar ação",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteCampaign = async (id: string) => {
    try {
      const { error } = await supabase
        .from("loyalty_campaigns")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Ação removida com sucesso!" });
      loadCampaigns();
    } catch (error: any) {
      toast({
        title: "Erro ao remover ação",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ações e Promoções</h1>
        <p className="text-muted-foreground">
          Configure campanhas especiais de {loyaltyType === "cashback" ? "cashback" : "pontos"}
        </p>
      </div>

      {/* Seção de Ações de Multiplicador */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Ações de Multiplicador
              </CardTitle>
              <CardDescription>
                {loyaltyType === "cashback" ? "Cashback" : "Pontos"} em dobro, triplo ou mais em períodos específicos
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingCampaign(null);
                    form.reset();
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Ação
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingCampaign ? "Editar Ação" : `Nova Ação de ${loyaltyType === "cashback" ? "Cashback" : "Pontos"}`}
                  </DialogTitle>
                  <DialogDescription>
                    Configure uma ação especial com {loyaltyType === "cashback" ? "cashback" : "pontos"} multiplicado
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome da Ação</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Ação de Natal" maxLength={LIMITS.SHORT_TEXT} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="multiplier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Multiplicador de {loyaltyType === "cashback" ? "Cashback" : "Pontos"}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="10"
                              step="0.5"
                              placeholder="2"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Ex: 2x = {loyaltyType === "cashback" ? "cashback dobrado" : "pontos dobrados"}, 3x = {loyaltyType === "cashback" ? "cashback triplicado" : "pontos triplicados"}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="start_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data Inicial</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="end_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data Final</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="start_time"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hora Inicial</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="end_time"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hora Final</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="store_ids"
                      render={() => (
                        <FormItem>
                          <FormLabel>Lojas Participantes</FormLabel>
                          <div className="space-y-2 border rounded-md p-4 max-h-48 overflow-y-auto">
                            {stores.map((store) => (
                              <FormField
                                key={store.id}
                                control={form.control}
                                name="store_ids"
                                render={({ field }) => (
                                  <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(store.id)}
                                        onCheckedChange={(checked) => {
                                          const newValue = checked
                                            ? [...(field.value || []), store.id]
                                            : field.value?.filter((id) => id !== store.id) || [];
                                          field.onChange(newValue);
                                        }}
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal cursor-pointer">
                                      {store.name}
                                    </FormLabel>
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button type="submit">
                        {editingCampaign ? "Atualizar" : "Criar"} Ação
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Nenhuma ação cadastrada
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingCampaign(null);
                  form.reset();
                  setIsDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Ação
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{campaign.name}</h3>
                      <Badge variant="secondary">
                        {campaign.action_type === "cashback" 
                          ? `${campaign.cashback_multiplier}x`
                          : `${campaign.points_multiplier}x`
                        }
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        {new Date(campaign.start_date).toLocaleDateString("pt-BR")} - {new Date(campaign.end_date).toLocaleDateString("pt-BR")}
                      </span>
                      <span>
                        {campaign.start_time} - {campaign.end_time}
                      </span>
                      <span>
                        {campaign.store_ids.length} loja(s)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMessagingCampaign(campaign);
                        setIsMessagingDialogOpen(true);
                      }}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingCampaign(campaign);
                        form.reset({
                          name: campaign.name,
                          multiplier: campaign.action_type === "cashback" 
                            ? campaign.cashback_multiplier 
                            : campaign.points_multiplier,
                          start_date: campaign.start_date,
                          end_date: campaign.end_date,
                          start_time: campaign.start_time,
                          end_time: campaign.end_time,
                          store_ids: campaign.store_ids,
                        });
                        setIsDialogOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteCampaign(campaign.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção de Promoções de Combustível */}
      <FuelPromotionsManager loyaltyType={loyaltyType} />

      <Dialog open={isMessagingDialogOpen} onOpenChange={setIsMessagingDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {messagingCampaign && (
            <ActionCampaignMessaging
              campaignId={messagingCampaign.id}
              campaignName={messagingCampaign.name}
              campaignStoreIds={messagingCampaign.store_ids}
              onClose={() => {
                setIsMessagingDialogOpen(false);
                setMessagingCampaign(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
