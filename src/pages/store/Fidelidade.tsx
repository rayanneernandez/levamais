import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, AlertCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoyaltyTypeSelector } from "@/components/store/fidelidade/LoyaltyTypeSelector";
import { CashbackConfiguration } from "@/components/store/fidelidade/CashbackConfiguration";
import { PointsConfiguration } from "@/components/store/fidelidade/PointsConfiguration";
import { RedemptionSettings } from "@/components/store/fidelidade/RedemptionSettings";
import { RetentionProgramConfig } from "@/components/store/fidelidade/RetentionProgramConfig";
import { RenewalBenefitsConfig } from "@/components/store/fidelidade/RenewalBenefitsConfig";
import { ReferralProgramConfig } from "@/components/store/fidelidade/ReferralProgramConfig";
import { FuelDifferentialConfig } from "@/components/store/FuelDifferentialConfig";
import { NPSRatingRewardsConfig } from "@/components/store/NPSRatingRewardsConfig";
import { ManualModeSwitch } from "@/components/store/fidelidade/ManualModeSwitch";
import { LevaOneSwitch } from "@/components/store/fidelidade/LevaOneSwitch";
import { LIMITS } from "@/lib/input-sanitization";

const configSchema = z.object({
  loyalty_type: z.enum(["points", "cashback"], {
    required_error: "Selecione o tipo de fidelidade",
  }),
  points_per_real: z.coerce.number().min(0.01, "Valor mínimo: 0.01").optional(),
  real_per_point: z.coerce.number().min(0.001, "Valor mínimo: 0.001").optional(),
  cashback_type: z.enum(["percentage", "fixed"], {
    required_error: "Selecione o tipo de cashback",
  }).optional(),
  cashback_percentage: z.coerce.number().min(0).max(100, "Máximo: 100%").optional(),
  cashback_fixed_value: z.coerce.number().min(0).optional(),
  signup_bonus_points: z.coerce.number().min(0, "Valor mínimo: 0").optional(),
  signup_bonus_cashback: z.coerce.number().min(0, "Valor mínimo: 0").optional(),
  birthday_bonus_points: z.coerce.number().min(0, "Valor mínimo: 0").optional(),
  birthday_bonus_cashback: z.coerce.number().min(0, "Valor mínimo: 0").optional(),
  points_validity_days: z.coerce.number().int().min(0, "Mínimo: 0 (nunca expira)").max(12, "Máximo: 12 meses"),
  min_redeem_cashback: z.coerce.number().min(0, "Valor mínimo: 0").optional(),
  max_redeem_cashback: z.coerce.number().min(0, "Valor mínimo: 0").optional(),
  min_redeem_points: z.coerce.number().min(0, "Valor mínimo: 0").optional(),
  max_redeem_points: z.coerce.number().min(0, "Valor mínimo: 0").optional(),
  max_redemptions_24h: z.coerce.number().int().min(0, "Valor mínimo: 0").optional(),
  redemption_time_delay_enabled: z.boolean().optional(),
  redemption_time_delay_unit: z.enum(["immediate", "hours", "days"]).optional(),
  redemption_time_delay_value: z.coerce.number().int().min(0).optional(),
  enable_cashback_accumulation_block: z.boolean().optional(),
  block_accumulation_cashback_limit: z.coerce.number().min(0).optional(),
  enable_accumulation_period_limit: z.boolean().optional(),
  block_accumulation_duration_amount: z.coerce.number().min(0).optional(),
  block_accumulation_period_quantity: z.coerce.number().min(0).optional(),
  block_accumulation_duration_unit: z.string().optional(),
  enable_points_accumulation_block: z.boolean().optional(),
  block_accumulation_points_limit: z.coerce.number().min(0).optional(),
  enable_points_accumulation_period_limit: z.boolean().optional(),
  block_accumulation_points_duration_amount: z.coerce.number().min(0).optional(),
  block_accumulation_points_period_quantity: z.coerce.number().min(0).optional(),
  block_accumulation_points_duration_unit: z.string().optional(),
  max_redemption_sale_percentage: z.coerce.number().min(1).max(100).optional().or(z.literal("")),
  redemption_accumulation_type: z.enum(["none", "full", "difference"], {
    required_error: "Selecione o tipo de acúmulo durante resgate",
  }).optional(),
  referral_enabled: z.boolean().optional(),
  referral_bonus_type: z.enum(["cashback", "points"]).optional(),
  referral_bonus_referrer: z.coerce.number().min(0).optional(),
  referral_bonus_referred: z.coerce.number().min(0).optional(),
  signup_bonus_validity_amount: z.coerce.number().min(1).optional(),
  signup_bonus_validity_unit: z.string().optional(),
  birthday_bonus_validity_amount: z.coerce.number().min(1).optional(),
  birthday_bonus_validity_unit: z.string().optional(),
});

type ConfigFormValues = z.infer<typeof configSchema>;

export default function Fidelidade() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [currentLoyaltyType, setCurrentLoyaltyType] = useState<"points" | "cashback">("points");
  const [showConversionDialog, setShowConversionDialog] = useState(false);
  const [conversionRate, setConversionRate] = useState<string>("");
  const [pendingLoyaltyType, setPendingLoyaltyType] = useState<"points" | "cashback" | null>(null);
  
  const [retentionConfig, setRetentionConfig] = useState({
    is_active: false,
    cashback_multiplier_6_months: 10,
    cashback_multiplier_9_months: 15,
    cashback_multiplier_12_months: 20,
    points_multiplier_6_months: 10,
    points_multiplier_9_months: 15,
    points_multiplier_12_months: 20,
  });

  const [referralConfig, setReferralConfig] = useState({
    referral_enabled: true,
    referral_bonus_type: 'cashback',
    referral_bonus_referrer: 10,
    referral_bonus_referred: 10,
    referral_max_uses: 0,
  });

  const [renewalConfig, setRenewalConfig] = useState({
    renewal_6_months: 5,
    renewal_9_months: 11.25,
    renewal_12_months: 20,
  });
  
  const { toast } = useToast();

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      loyalty_type: "points",
      points_per_real: 1,
      real_per_point: 0.01,
      cashback_type: "percentage",
      cashback_percentage: 5,
      cashback_fixed_value: 0.10,
      signup_bonus_points: 0,
      signup_bonus_cashback: 0,
      birthday_bonus_points: 0,
      birthday_bonus_cashback: 0,
      points_validity_days: 12,
      min_redeem_cashback: 5.00,
      max_redeem_cashback: 100.00,
      min_redeem_points: 100,
      max_redeem_points: 10000,
      max_redemptions_24h: 1,
      redemption_time_delay_enabled: false,
      redemption_time_delay_unit: "immediate",
      redemption_time_delay_value: 0,
      enable_cashback_accumulation_block: false,
      block_accumulation_cashback_limit: 500,
      enable_accumulation_period_limit: false,
      block_accumulation_duration_amount: 0,
      block_accumulation_period_quantity: 1,
      block_accumulation_duration_unit: "days",
      enable_points_accumulation_block: false,
      block_accumulation_points_limit: 50000,
      enable_points_accumulation_period_limit: false,
      block_accumulation_points_duration_amount: 0,
      block_accumulation_points_period_quantity: 1,
      block_accumulation_points_duration_unit: "days",
      redemption_accumulation_type: "none",
      max_redemption_sale_percentage: "",
      signup_bonus_validity_amount: 30,
      signup_bonus_validity_unit: "days",
      birthday_bonus_validity_amount: 7,
      birthday_bonus_validity_unit: "days",
    },
  });

  const loyaltyType = form.watch("loyalty_type");

  useEffect(() => {
    loadConfiguration();
  }, []);

  // Removed: useEffect that was overwriting referral_bonus_type after load
  // referral_bonus_type is now set correctly during loadConfiguration

  const loadConfiguration = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: manager } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!manager) throw new Error("Gerente não encontrado");
      
      setNetworkId(manager.network_id);

      const { data: store } = await supabase
        .from("stores")
        .select("*")
        .eq("network_id", manager.network_id)
        .limit(1)
        .single();

      const { data: networkData } = await supabase
        .from("networks")
        .select("referral_enabled, referral_bonus_type, referral_bonus_referrer, referral_bonus_referred, referral_max_uses, renewal_6_months_multiplier, renewal_9_months_multiplier, renewal_12_months_multiplier, signup_bonus_validity_amount, signup_bonus_validity_unit, birthday_bonus_validity_amount, birthday_bonus_validity_unit, retention_is_active, retention_cashback_multiplier_6_months, retention_cashback_multiplier_9_months, retention_cashback_multiplier_12_months, retention_points_multiplier_6_months, retention_points_multiplier_9_months, retention_points_multiplier_12_months")
        .eq("id", manager.network_id)
        .single();

      if (networkData) {
        setReferralConfig({
          referral_enabled: networkData.referral_enabled ?? true,
          referral_bonus_type: networkData.referral_bonus_type || store?.loyalty_type || 'points',
          referral_bonus_referrer: networkData.referral_bonus_referrer ?? 10,
          referral_bonus_referred: networkData.referral_bonus_referred ?? 10,
          referral_max_uses: (networkData as any).referral_max_uses ?? 0,
        });

        setRenewalConfig({
          renewal_6_months: networkData.renewal_6_months_multiplier ?? 5,
          renewal_9_months: networkData.renewal_9_months_multiplier ?? 11.25,
          renewal_12_months: networkData.renewal_12_months_multiplier ?? 20,
        });

        setRetentionConfig({
          is_active: (networkData as any).retention_is_active ?? false,
          cashback_multiplier_6_months: (networkData as any).retention_cashback_multiplier_6_months ?? 10,
          cashback_multiplier_9_months: (networkData as any).retention_cashback_multiplier_9_months ?? 15,
          cashback_multiplier_12_months: (networkData as any).retention_cashback_multiplier_12_months ?? 20,
          points_multiplier_6_months: (networkData as any).retention_points_multiplier_6_months ?? 10,
          points_multiplier_9_months: (networkData as any).retention_points_multiplier_9_months ?? 15,
          points_multiplier_12_months: (networkData as any).retention_points_multiplier_12_months ?? 20,
        });
      }

      // Retention config será mantido no estado local por enquanto
      // TODO: Adicionar tabela client_retention_config no futuro se necessário

      if (store) {
        const formValues: Partial<ConfigFormValues> = {
          loyalty_type: (store.loyalty_type as "points" | "cashback") || "points",
          points_per_real: store.points_per_real || 1,
          real_per_point: store.real_per_point || 0.01,
          cashback_type: (store.cashback_type as "percentage" | "fixed") || "percentage",
          cashback_percentage: store.cashback_percentage || 5,
          cashback_fixed_value: store.cashback_fixed_value || 0.10,
          signup_bonus_points: store.signup_bonus_points || 0,
          signup_bonus_cashback: store.signup_bonus_cashback || 0,
          birthday_bonus_points: store.birthday_bonus_points || 0,
          birthday_bonus_cashback: store.birthday_bonus_cashback || 0,
          points_validity_days: store.points_validity_days || 12,
          min_redeem_cashback: store.min_redeem_cashback || 5.00,
          max_redeem_cashback: store.max_redeem_cashback || 100.00,
          min_redeem_points: store.min_redeem_points || 100,
          max_redeem_points: store.max_redeem_points || 10000,
          max_redemptions_24h: store.max_redemptions_24h || 1,
          redemption_time_delay_enabled: store.redemption_time_delay_enabled || false,
          redemption_time_delay_unit: (store.redemption_time_delay_unit as "immediate" | "hours" | "days") || "immediate",
          redemption_time_delay_value: store.redemption_time_delay_value || 0,
          enable_cashback_accumulation_block: store.enable_cashback_accumulation_block || false,
          block_accumulation_cashback_limit: store.block_accumulation_cashback_limit || 500,
          enable_accumulation_period_limit: !!((store as any).block_accumulation_duration_amount && (store as any).block_accumulation_duration_amount > 0),
          block_accumulation_duration_amount: (store as any).block_accumulation_duration_amount || 0,
          block_accumulation_period_quantity: (store as any).block_accumulation_period_quantity || 1,
          block_accumulation_duration_unit: (store as any).block_accumulation_duration_unit || "days",
          enable_points_accumulation_block: store.enable_points_accumulation_block || false,
          block_accumulation_points_limit: store.block_accumulation_points_limit || 50000,
          enable_points_accumulation_period_limit: !!((store as any).block_accumulation_points_duration_amount && (store as any).block_accumulation_points_duration_amount > 0),
          block_accumulation_points_duration_amount: (store as any).block_accumulation_points_duration_amount || 0,
          block_accumulation_points_period_quantity: (store as any).block_accumulation_points_period_quantity || 1,
          block_accumulation_points_duration_unit: (store as any).block_accumulation_points_duration_unit || "days",
          redemption_accumulation_type: (store as any).redemption_accumulation_type || "none",
          max_redemption_sale_percentage: (store as any).max_redemption_sale_percentage || "",
          signup_bonus_validity_amount: (networkData as any)?.signup_bonus_validity_amount || 30,
          signup_bonus_validity_unit: (networkData as any)?.signup_bonus_validity_unit || "days",
          birthday_bonus_validity_amount: (networkData as any)?.birthday_bonus_validity_amount || 7,
          birthday_bonus_validity_unit: (networkData as any)?.birthday_bonus_validity_unit || "days",
        };
        
        form.reset(formValues);
        setCurrentLoyaltyType(store.loyalty_type || "points");
      }
    } catch (error: any) {
      console.error("Erro ao carregar configurações:", error);
      toast({
        title: "Erro ao carregar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (values: ConfigFormValues) => {
    if (values.loyalty_type !== currentLoyaltyType) {
      // Check if there are clients with balance before requiring conversion
      try {
        const { count } = await supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("network_id", networkId)
          .gt(currentLoyaltyType === "points" ? "points_balance" : "cashback_balance", 0);

        if (count && count > 0) {
          // Has clients with balance - show conversion dialog
          setPendingLoyaltyType(values.loyalty_type);
          setShowConversionDialog(true);
          return;
        }
      } catch (e) {
        console.log("Erro ao verificar saldos, prosseguindo sem conversão:", e);
      }

      // No clients with balance - just update the loyalty type directly
      setCurrentLoyaltyType(values.loyalty_type);
      await saveConfiguration(values);
      return;
    }

    await saveConfiguration(values);
  };

  const handleConfirmConversion = async () => {
    if (!pendingLoyaltyType) return;
    
    const values = form.getValues();
    values.loyalty_type = pendingLoyaltyType;
    
    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('convert-loyalty-balances', {
        body: {
          networkId,
          fromType: currentLoyaltyType,
          toType: pendingLoyaltyType,
          conversionRate: parseFloat(conversionRate),
        },
      });

      if (error) throw error;

      await saveConfiguration(values);
      
      setCurrentLoyaltyType(pendingLoyaltyType);
      setShowConversionDialog(false);
      setPendingLoyaltyType(null);
      setConversionRate("");
      
      toast({
        title: "Conversão realizada!",
        description: "Todos os saldos foram convertidos com sucesso.",
      });
    } catch (error: any) {
      console.error("Erro na conversão:", error);
      toast({
        title: "Erro na conversão",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveConfiguration = async (values: ConfigFormValues) => {
    if (!networkId) {
      toast({
        title: "Erro",
        description: "Network ID não encontrado",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error: storeError } = await supabase
        .from("stores")
        .update({
          loyalty_type: values.loyalty_type,
          points_per_real: values.points_per_real,
          real_per_point: values.real_per_point,
          cashback_type: values.cashback_type,
          cashback_percentage: values.cashback_percentage,
          cashback_fixed_value: values.cashback_fixed_value,
          signup_bonus_points: values.signup_bonus_points,
          signup_bonus_cashback: values.signup_bonus_cashback,
          birthday_bonus_points: values.birthday_bonus_points,
          birthday_bonus_cashback: values.birthday_bonus_cashback,
          points_validity_days: values.points_validity_days,
          min_redeem_cashback: values.min_redeem_cashback,
          max_redeem_cashback: values.max_redeem_cashback,
          min_redeem_points: values.min_redeem_points,
          max_redeem_points: values.max_redeem_points,
          max_redemptions_24h: values.max_redemptions_24h,
          redemption_time_delay_enabled: values.redemption_time_delay_enabled,
          redemption_time_delay_unit: values.redemption_time_delay_unit,
          redemption_time_delay_value: values.redemption_time_delay_value,
          enable_cashback_accumulation_block: values.enable_cashback_accumulation_block,
          block_accumulation_cashback_limit: values.block_accumulation_cashback_limit,
          block_accumulation_duration_amount: values.enable_accumulation_period_limit ? (values.block_accumulation_duration_amount || null) : null,
          block_accumulation_period_quantity: values.enable_accumulation_period_limit ? (values.block_accumulation_period_quantity || null) : null,
          block_accumulation_duration_unit: values.block_accumulation_duration_unit || "days",
          enable_points_accumulation_block: values.enable_points_accumulation_block,
          block_accumulation_points_limit: values.block_accumulation_points_limit,
          block_accumulation_points_duration_amount: values.enable_points_accumulation_period_limit ? (values.block_accumulation_points_duration_amount || null) : null,
          block_accumulation_points_period_quantity: values.enable_points_accumulation_period_limit ? (values.block_accumulation_points_period_quantity || null) : null,
          block_accumulation_points_duration_unit: values.block_accumulation_points_duration_unit || "days",
          redemption_accumulation_type: values.redemption_accumulation_type,
          max_redemption_sale_percentage: values.max_redemption_sale_percentage ? Number(values.max_redemption_sale_percentage) : null,
        })
        .eq("network_id", networkId);

      if (storeError) throw storeError;

      const { error: networkError } = await supabase
        .from("networks")
        .update({
          referral_enabled: referralConfig.referral_enabled,
          referral_bonus_type: referralConfig.referral_bonus_type,
          referral_bonus_referrer: referralConfig.referral_bonus_referrer,
          referral_bonus_referred: referralConfig.referral_bonus_referred,
          referral_max_uses: referralConfig.referral_max_uses,
          renewal_6_months_multiplier: renewalConfig.renewal_6_months,
          renewal_9_months_multiplier: renewalConfig.renewal_9_months,
          renewal_12_months_multiplier: renewalConfig.renewal_12_months,
          signup_bonus_validity_amount: values.signup_bonus_validity_amount,
          signup_bonus_validity_unit: values.signup_bonus_validity_unit,
          birthday_bonus_validity_amount: values.birthday_bonus_validity_amount,
          birthday_bonus_validity_unit: values.birthday_bonus_validity_unit,
          retention_is_active: retentionConfig.is_active,
          retention_cashback_multiplier_6_months: retentionConfig.cashback_multiplier_6_months,
          retention_cashback_multiplier_9_months: retentionConfig.cashback_multiplier_9_months,
          retention_cashback_multiplier_12_months: retentionConfig.cashback_multiplier_12_months,
          retention_points_multiplier_6_months: retentionConfig.points_multiplier_6_months,
          retention_points_multiplier_9_months: retentionConfig.points_multiplier_9_months,
          retention_points_multiplier_12_months: retentionConfig.points_multiplier_12_months,
        })
        .eq("id", networkId);

      if (networkError) throw networkError;

      // Retention config salvo nos estados locais por enquanto
      // TODO: Adicionar persistência na tabela client_retention_config se necessário

      toast({
        title: "Configurações salvas!",
        description: "As configurações de fidelidade foram atualizadas.",
      });
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <AlertDialog open={showConversionDialog} onOpenChange={setShowConversionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Atenção: Conversão de Tipo de Fidelidade
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está mudando de <strong>{currentLoyaltyType === "cashback" ? "Cashback" : "Pontuação"}</strong> para{" "}
                <strong>{pendingLoyaltyType === "cashback" ? "Cashback" : "Pontuação"}</strong>.
              </p>
              <p>
                <strong>Todos os saldos existentes dos clientes serão convertidos automaticamente.</strong>
              </p>
              <div className="space-y-2">
                <Label htmlFor="conversion-rate" className="text-sm font-medium">
                  Taxa de Conversão:
                </Label>
                <Input
                  id="conversion-rate"
                  type="number"
                  step="0.01"
                  min="0.01"
                  maxLength={LIMITS.SHORT_CODE}
                  value={conversionRate}
                  onChange={(e) => setConversionRate(e.target.value)}
                  placeholder={currentLoyaltyType === "cashback" ? "Pontos por R$" : "Reais por ponto"}
                />
                <p className="text-xs text-muted-foreground">
                  {currentLoyaltyType === "cashback" 
                    ? "Quantos pontos cada R$ 1,00 de cashback vai virar"
                    : "Quanto vale cada ponto em reais"}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmConversion}
              disabled={isSaving || !conversionRate || parseFloat(conversionRate) <= 0}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Convertendo...
                </>
              ) : (
                "Confirmar Conversão"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Switch Leva+ One */}
      <LevaOneSwitch networkId={networkId} />

      {/* Switch Leva+ Manual */}
      <ManualModeSwitch networkId={networkId} />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações de Fidelidade</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure como os clientes acumularão benefícios no programa de fidelidade
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Tipo de Fidelidade</CardTitle>
              <CardDescription>
                Selecione como seus clientes irão acumular benefícios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoyaltyTypeSelector control={form.control} />
            </CardContent>
          </Card>

          <Tabs defaultValue="config" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="config" className="text-sm">
                Configurações
              </TabsTrigger>
              <TabsTrigger value="redemption" className="text-sm">
                Limites de Resgate
              </TabsTrigger>
              <TabsTrigger value="programs" className="text-sm">
                Programas de Incentivo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="config" className="space-y-4 mt-4">
              {loyaltyType === "cashback" ? (
                <CashbackConfiguration control={form.control} watch={form.watch} />
              ) : (
                <PointsConfiguration control={form.control} watch={form.watch} />
              )}
            </TabsContent>

            <TabsContent value="redemption" className="space-y-4 mt-4">
              <RedemptionSettings 
                control={form.control} 
                watch={form.watch} 
                loyaltyType={loyaltyType} 
              />
            </TabsContent>

            <TabsContent value="programs" className="space-y-4 mt-4">
              <RetentionProgramConfig
                loyaltyType={loyaltyType}
                retentionConfig={retentionConfig}
                setRetentionConfig={setRetentionConfig}
              />
              
              <RenewalBenefitsConfig
                loyaltyType={loyaltyType}
                renewalConfig={renewalConfig}
                setRenewalConfig={setRenewalConfig}
              />
              
              <ReferralProgramConfig
                loyaltyType={loyaltyType}
                referralConfig={referralConfig}
                setReferralConfig={setReferralConfig}
              />

              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold">Configurações Avançadas</h3>
                
                <FuelDifferentialConfig loyaltyType={loyaltyType} />
                {networkId && <NPSRatingRewardsConfig networkId={networkId} loyaltyType={loyaltyType} />}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end sticky bottom-0 bg-background py-4 border-t">
            <Button type="submit" disabled={isSaving} size="lg">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Configurações
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
