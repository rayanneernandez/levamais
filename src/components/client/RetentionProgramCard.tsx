import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Zap, Shield, TrendingUp, Clock, CheckCircle2, Loader2, X, ChevronDown } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface RetentionProgramCardProps {
  networkId: string;
  networkName: string;
  loyaltyType: "cashback" | "points";
  isFavorite: boolean;
  clientId: string;
}

interface RetentionConfig {
  is_active: boolean;
  multiplier_6: number;
  multiplier_9: number;
  multiplier_12: number;
}

interface ActiveCommitment {
  id: string;
  commitment_months: number;
  multiplier_applied: number;
  expires_at: string;
  status: string;
}

export function RetentionProgramCard({ 
  networkId, 
  networkName, 
  loyaltyType, 
  isFavorite,
  clientId 
}: RetentionProgramCardProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<RetentionConfig | null>(null);
  const [activeCommitment, setActiveCommitment] = useState<ActiveCommitment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<6 | 9 | 12 | 'default' | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isRenewal, setIsRenewal] = useState(false);
  const [renewalMultipliers, setRenewalMultipliers] = useState<{multiplier_6: number, multiplier_9: number, multiplier_12: number} | null>(null);
  const [retentionData, setRetentionData] = useState<{
    first_shown_at: string | null;
    decision_made_at: string | null;
    decision_type: string | null;
  } | null>(null);
  const [showExpanded, setShowExpanded] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [upgradeToMonths, setUpgradeToMonths] = useState<6 | 9 | 12 | null>(null);
  const [isHiddenInSession, setIsHiddenInSession] = useState(false);

  useEffect(() => {
    // Verificar se está oculto na sessão atual
    const hiddenInSession = sessionStorage.getItem(`retention-card-hidden-${clientId}`);
    if (hiddenInSession === 'true') {
      setIsHiddenInSession(true);
    }

    if (isFavorite) {
      loadData();
    }
  }, [networkId, isFavorite, clientId]);

  const loadData = async () => {
    try {
      // Carregar dados de decisão do cliente
      const { data: clientData } = await supabase
        .from("clients")
        .select("retention_card_first_shown_at, retention_decision_made_at, retention_decision_type")
        .eq("id", clientId)
        .single();

      if (clientData) {
        setRetentionData({
          first_shown_at: clientData.retention_card_first_shown_at,
          decision_made_at: clientData.retention_decision_made_at,
          decision_type: clientData.retention_decision_type
        });

        // Se nunca mostrou antes, marcar como mostrado agora
        if (!clientData.retention_card_first_shown_at) {
          await supabase
            .from("clients")
            .update({ retention_card_first_shown_at: new Date().toISOString() })
            .eq("id", clientId);
          
          setRetentionData({
            first_shown_at: new Date().toISOString(),
            decision_made_at: null,
            decision_type: null
          });
        }

        // Se já tomou decisão, minimizar
        if (clientData.retention_decision_made_at) {
          setIsMinimized(true);
        }
      }

      // Carregar configuração da rede
      const { data: configData } = await supabase
        .from("network_retention_config")
        .select("*")
        .eq("network_id", networkId)
        .eq("is_active", true)
        .maybeSingle();

      if (configData) {
        const multiplierField = loyaltyType === "cashback" ? "cashback_multiplier" : "points_multiplier";
        setConfig({
          is_active: configData.is_active,
          multiplier_6: configData[`${multiplierField}_6_months`],
          multiplier_9: configData[`${multiplierField}_9_months`],
          multiplier_12: configData[`${multiplierField}_12_months`],
        });
      }

      // Carregar compromisso ativo
      const { data: commitmentData } = await supabase
        .from("client_retention_commitments")
        .select("*")
        .eq("client_id", clientId)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (commitmentData) {
        setActiveCommitment(commitmentData);
      }

      // 🔄 Verificar se é uma renovação (teve compromisso completado nos últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: recentCompleted } = await supabase
        .from("client_retention_commitments")
        .select("id, expires_at")
        .eq("client_id", clientId)
        .eq("network_id", networkId)
        .eq("status", "completed")
        .gte("expires_at", thirtyDaysAgo.toISOString())
        .limit(1)
        .maybeSingle();

      // Se tem compromisso recente completado E não tem decisão atual, é renovação
      if (recentCompleted && !clientData?.retention_decision_made_at) {
        setIsRenewal(true);
        
        // Buscar multiplicadores de renovação
        const { data: networkData } = await supabase
          .from("networks")
          .select("renewal_6_months_multiplier, renewal_9_months_multiplier, renewal_12_months_multiplier")
          .eq("id", networkId)
          .maybeSingle();
        
        if (networkData) {
          setRenewalMultipliers({
            multiplier_6: networkData.renewal_6_months_multiplier,
            multiplier_9: networkData.renewal_9_months_multiplier,
            multiplier_12: networkData.renewal_12_months_multiplier,
          });
        }
        
        console.log("🔄 Renovação detectada para cliente", clientId);
      }
    } catch (error) {
      console.error("Erro ao carregar dados de retenção:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlan = (months: 6 | 9 | 12 | 'default') => {
    setSelectedPlan(months);
    setShowConfirmDialog(true);
  };

  const handleDismiss = () => {
    // Ocultar apenas na sessão atual
    sessionStorage.setItem(`retention-card-hidden-${clientId}`, 'true');
    setIsHiddenInSession(true);

    toast({
      title: "Card ocultado temporariamente",
      description: "Ele voltará a aparecer no próximo login. Você também pode acessar o programa pelo menu.",
    });
  };

  const handleUpgrade = (months: 6 | 9 | 12) => {
    setUpgradeToMonths(months);
    setShowUpgradeDialog(true);
  };

  const handleConfirmUpgrade = async () => {
    if (!upgradeToMonths || !activeCommitment) return;

    setIsSubmitting(true);
    try {
      // Calcular novo multiplicador
      const multiplierField = loyaltyType === "cashback" ? "cashback_multiplier" : "points_multiplier";
      const { data: configData } = await supabase
        .from("network_retention_config")
        .select(`${multiplierField}_${upgradeToMonths}_months`)
        .eq("network_id", networkId)
        .single();

      if (!configData) throw new Error("Configuração não encontrada");

      const newMultiplier = configData[`${multiplierField}_${upgradeToMonths}_months`];

      // Calcular nova data de expiração (estende o período proporcionalmente)
      const currentExpiration = new Date(activeCommitment.expires_at);
      const now = new Date();
      const remainingMonths = Math.ceil(differenceInDays(currentExpiration, now) / 30);
      
      // Nova expiração = data atual + novo período em meses
      const newExpiration = new Date();
      newExpiration.setMonth(newExpiration.getMonth() + upgradeToMonths);

      // Atualizar compromisso existente
      const { error: updateError } = await supabase
        .from("client_retention_commitments")
        .update({
          commitment_months: upgradeToMonths,
          multiplier_applied: newMultiplier,
          expires_at: newExpiration.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", activeCommitment.id);

      if (updateError) throw updateError;

      toast({
        title: "🎉 Upgrade realizado!",
        description: `Seu benefício foi aumentado para +${newMultiplier}% por ${upgradeToMonths} meses!`,
      });

      setShowUpgradeDialog(false);
      setUpgradeToMonths(null);
      await loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao fazer upgrade",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmPlan = async () => {
    if (!selectedPlan) return;

    setIsSubmitting(true);
    try {
      // Se escolheu plano padrão, apenas marcar decisão
      if (selectedPlan === 'default') {
        await supabase
          .from("clients")
          .update({
            retention_decision_made_at: new Date().toISOString(),
            retention_decision_type: 'default'
          })
          .eq("id", clientId);

        setIsMinimized(true);
        setShowConfirmDialog(false);
        setSelectedPlan(null);

        toast({
          title: "Plano padrão mantido",
          description: "Você continuará acumulando normalmente. Pode aderir a um benefício quando quiser!",
        });

        await loadData();
        return;
      }

      // Criar compromisso
      const { data, error } = await supabase.functions.invoke("create-retention-commitment", {
        body: {
          network_id: networkId,
          commitment_months: selectedPlan,
        },
      });

      if (error) throw error;

      // Marcar decisão
      await supabase
        .from("clients")
        .update({
          retention_decision_made_at: new Date().toISOString(),
          retention_decision_type: 'commitment'
        })
        .eq("id", clientId);

      setIsMinimized(true);

      toast({
        title: "Benefício ativado! 🎉",
        description: data.message,
      });

      // Recarregar dados
      await loadData();
      setShowConfirmDialog(false);
      setSelectedPlan(null);
    } catch (error: any) {
      toast({
        title: "Erro ao ativar benefício",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Não mostrar se não for favorita ou se não houver config ativa
  if (!isFavorite || isLoading || !config?.is_active) {
    return null;
  }

  // Se está oculto na sessão atual (clicou no X), não mostrar
  if (isHiddenInSession) {
    return null;
  }

  // Se está minimizado (decisão já foi tomada), não mostrar na tela inicial
  // O programa ficará disponível apenas no dropdown do menu
  if (isMinimized) {
    return null;
  }

  // Mostrar opções de planos (usar multiplicadores de renovação se aplicável)
  const plans = isRenewal && renewalMultipliers ? [
    { months: 6 as const, multiplier: renewalMultipliers.multiplier_6, color: "bg-blue-500" },
    { months: 9 as const, multiplier: renewalMultipliers.multiplier_9, color: "bg-purple-500" },
    { months: 12 as const, multiplier: renewalMultipliers.multiplier_12, color: "bg-gradient-to-r from-amber-500 to-orange-500", popular: true },
  ] : [
    { months: 6 as const, multiplier: config.multiplier_6, color: "bg-blue-500" },
    { months: 9 as const, multiplier: config.multiplier_9, color: "bg-purple-500" },
    { months: 12 as const, multiplier: config.multiplier_12, color: "bg-gradient-to-r from-amber-500 to-orange-500", popular: true },
  ];

  return (
    <>
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isRenewal ? (
                <>
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">🔄 Renovação Disponível!</CardTitle>
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Programa de Benefícios</CardTitle>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-7 w-7 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            {isRenewal 
              ? `Renove seu compromisso com ${networkName} e continue ganhando mais ${loyaltyType === "cashback" ? "cashback" : "pontos"}!`
              : `Comprometase com ${networkName} e ganhe mais ${loyaltyType === "cashback" ? "cashback" : "pontos"}!`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {plans.map((plan) => (
              <div key={plan.months} className="relative">
                {plan.popular && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 text-xs">
                    Popular
                  </Badge>
                )}
                <button
                  onClick={() => handleSelectPlan(plan.months)}
                  className="w-full p-4 rounded-lg border-2 border-muted hover:border-primary transition-all hover:shadow-md bg-card text-center space-y-2"
                >
                  <div className="text-2xl font-bold">{plan.months}</div>
                  <div className="text-xs text-muted-foreground">meses</div>
                  <div className={`text-lg font-bold text-primary ${plan.popular ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500' : ''}`}>
                    +{plan.multiplier}%
                  </div>
                </button>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleSelectPlan('default')}
          >
            Continuar no plano padrão (sem bônus)
          </Button>

          <div className="bg-muted/50 p-3 rounded-lg space-y-2">
            <p className="text-sm font-medium">Como funciona?</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Escolha um período de compromisso ou continue sem bônus</li>
              <li>• Com compromisso: receba bônus em todas as acumulações</li>
              <li>• Não poderá trocar de rede favorita durante o período</li>
              <li>• Pode fazer upgrade do plano a qualquer momento</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Confirmação */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedPlan === 'default' ? 'Confirmar Plano Padrão' : 'Confirmar Adesão ao Benefício'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {selectedPlan === 'default' ? (
                <>
                  <p>
                    Você está escolhendo continuar no <strong>plano padrão</strong> com {networkName}.
                  </p>
                  
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <p className="font-medium text-foreground">O que significa:</p>
                    <p className="text-sm">
                      ✅ Continue acumulando {loyaltyType === "cashback" ? "cashback" : "pontos"} normalmente
                    </p>
                    <p className="text-sm">
                      ✅ Sem compromisso de tempo
                    </p>
                    <p className="text-sm">
                      ✅ Pode aderir a um benefício quando quiser
                    </p>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Você pode mudar de ideia e aderir a um plano com bônus a qualquer momento.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Você está prestes a se comprometer com <strong>{networkName}</strong> por{" "}
                    <strong>{selectedPlan} meses</strong>.
                  </p>
                  
                  <div className="bg-primary/10 p-4 rounded-lg space-y-2">
                    <p className="font-medium text-foreground">Benefícios:</p>
                    <p className="text-sm">
                      ✅ +{selectedPlan === 6 ? config.multiplier_6 : selectedPlan === 9 ? config.multiplier_9 : config.multiplier_12}% em todas as acumulações
                    </p>
                  </div>

                  <div className="bg-amber-500/10 p-4 rounded-lg space-y-2">
                    <p className="font-medium text-foreground">Compromissos:</p>
                    <p className="text-sm">
                      ⚠️ Não poderá trocar de rede favorita durante {selectedPlan} meses
                    </p>
                    <p className="text-sm">
                      ✅ Pode fazer upgrade para um período maior
                    </p>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Ao confirmar, você concorda com os termos do programa de retenção.
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPlan} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {selectedPlan === 'default' ? 'Confirmando...' : 'Ativando...'}
                </>
              ) : (
                selectedPlan === 'default' ? 'Confirmar Plano Padrão' : 'Confirmar e Ativar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Upgrade */}
      <AlertDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fazer Upgrade do Benefício</AlertDialogTitle>
            <AlertDialogDescription>
              {upgradeToMonths && config && (
                <div className="space-y-3 pt-2">
                  <p>
                    Você está fazendo upgrade do seu benefício de{" "}
                    <strong>{activeCommitment?.commitment_months} meses (+{activeCommitment?.multiplier_applied}%)</strong>
                    {" "}para{" "}
                    <strong>{upgradeToMonths} meses (+{
                      upgradeToMonths === 6 ? config.multiplier_6 :
                      upgradeToMonths === 9 ? config.multiplier_9 :
                      config.multiplier_12
                    }%)</strong>
                  </p>
                  
                  <div className="bg-muted/50 p-3 rounded-lg space-y-1 text-sm">
                    <p className="font-medium text-foreground">Vantagens do upgrade:</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>✅ Multiplicador maior em todas as acumulações</li>
                      <li>✅ Novo período de {upgradeToMonths} meses inicia agora</li>
                      <li>✅ Não perde os pontos/cashback acumulados</li>
                      <li>✅ Sempre pode fazer upgrade, nunca downgrade</li>
                    </ul>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Deseja confirmar o upgrade?
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmUpgrade}
              disabled={isSubmitting}
              className="bg-primary"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Confirmar Upgrade
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
