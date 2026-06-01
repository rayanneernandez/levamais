import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Shield, TrendingUp, Calendar, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";

interface RetentionConfig {
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

export default function ProgramaBeneficios() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientData, setClientData] = useState<any>(null);
  const [config, setConfig] = useState<RetentionConfig | null>(null);
  const [activeCommitment, setActiveCommitment] = useState<ActiveCommitment | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<6 | 9 | 12 | 'default' | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [upgradeToMonths, setUpgradeToMonths] = useState<6 | 9 | 12 | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  useEffect(() => {
    loadClientData();
  }, []);

  const loadClientData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/levacliente/auth');
        return;
      }

      // Buscar cliente
      const { data: clients, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);

      if (clientError || !clients || clients.length === 0) {
        navigate('/levacliente');
        return;
      }

      const client = clients[0];

      if (!client.favorite_network_id) {
        toast({
          title: "Sem rede favorita",
          description: "Selecione uma rede favorita primeiro.",
          variant: "destructive"
        });
        navigate('/levacliente');
        return;
      }

      // Buscar rede
      const { data: network } = await supabase
        .from('networks')
        .select('id, name, loyalty_type')
        .eq('id', client.favorite_network_id)
        .maybeSingle();

      // Buscar configuração de retenção
      const { data: configData } = await supabase
        .from('network_retention_config')
        .select('*')
        .eq('network_id', client.favorite_network_id)
        .eq('is_active', true)
        .maybeSingle();

      if (configData) {
        const multiplierField = network?.loyalty_type === 'cashback' ? 'cashback_multiplier' : 'points_multiplier';
        setConfig({
          multiplier_6: configData[`${multiplierField}_6_months`],
          multiplier_9: configData[`${multiplierField}_9_months`],
          multiplier_12: configData[`${multiplierField}_12_months`],
        });
      }

      // Buscar compromisso ativo
      const { data: commitment } = await supabase
        .from('client_retention_commitments')
        .select('*')
        .eq('client_id', client.id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (commitment) {
        setActiveCommitment(commitment);
      }

      setClientData({
        ...client,
        networks: network
      });
    } catch (error) {
      console.error('Error loading client data:', error);
      navigate('/levacliente');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlan = (months: 6 | 9 | 12 | 'default') => {
    setSelectedPlan(months);
    setShowConfirmDialog(true);
  };

  const handleConfirmPlan = async () => {
    if (!selectedPlan) return;

    setIsSubmitting(true);
    try {
      if (selectedPlan === 'default') {
        await supabase
          .from('clients')
          .update({
            retention_decision_made_at: new Date().toISOString(),
            retention_decision_type: 'default'
          })
          .eq('id', clientData.id);

        toast({
          title: "Plano padrão mantido",
          description: "Você continuará acumulando normalmente!",
        });

        navigate('/levacliente');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-retention-commitment', {
        body: {
          network_id: clientData.favorite_network_id,
          commitment_months: selectedPlan,
        },
      });

      if (error) throw error;

      await supabase
        .from('clients')
        .update({
          retention_decision_made_at: new Date().toISOString(),
          retention_decision_type: 'commitment'
        })
        .eq('id', clientData.id);

      toast({
        title: "🎉 Benefício ativado!",
        description: data.message,
      });

      await loadClientData();
      setShowConfirmDialog(false);
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

  const handleUpgrade = (months: 6 | 9 | 12) => {
    setUpgradeToMonths(months);
    setShowUpgradeDialog(true);
  };

  const handleConfirmUpgrade = async () => {
    if (!upgradeToMonths || !activeCommitment || !config) return;

    setIsSubmitting(true);
    try {
      const newMultiplier = 
        upgradeToMonths === 6 ? config.multiplier_6 :
        upgradeToMonths === 9 ? config.multiplier_9 :
        config.multiplier_12;

      const newExpiration = new Date();
      newExpiration.setMonth(newExpiration.getMonth() + upgradeToMonths);

      const { error } = await supabase
        .from('client_retention_commitments')
        .update({
          commitment_months: upgradeToMonths,
          multiplier_applied: newMultiplier,
          expires_at: newExpiration.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', activeCommitment.id);

      if (error) throw error;

      toast({
        title: "🎉 Upgrade realizado!",
        description: `Seu benefício foi aumentado para +${newMultiplier}% por ${upgradeToMonths} meses!`,
      });

      await loadClientData();
      setShowUpgradeDialog(false);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clientData || !config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <Button variant="ghost" size="sm" onClick={() => navigate('/levacliente')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              O programa de benefícios não está disponível para sua rede no momento.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const loyaltyType = clientData.networks?.loyalty_type || 'cashback';
  const plans = [
    { months: 6 as const, multiplier: config.multiplier_6, color: "from-blue-500 to-blue-600" },
    { months: 9 as const, multiplier: config.multiplier_9, color: "from-purple-500 to-purple-600" },
    { months: 12 as const, multiplier: config.multiplier_12, color: "from-amber-500 to-orange-500", popular: true },
  ];

  const availableUpgrades = activeCommitment 
    ? plans.filter(p => p.months > activeCommitment.commitment_months)
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/levacliente')} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Fidelidade</h1>
          <p className="text-muted-foreground">
            {activeCommitment 
              ? `Seu plano atual em ${clientData.networks?.name}` 
              : `Escolha um plano e ganhe benefícios em ${clientData.networks?.name}`
            }
          </p>
        </div>

        {/* Plano Atual */}
        {activeCommitment && (
          <Card className="mb-8 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Plano Atual Ativo
                  </CardTitle>
                  <CardDescription>Seu compromisso com a rede</CardDescription>
                </div>
                <Badge variant="default" className="text-lg px-4 py-2">
                  +{activeCommitment.multiplier_applied}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Período</p>
                  <p className="text-xl font-bold">{activeCommitment.commitment_months} meses</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Válido até</p>
                  <p className="text-xl font-bold">
                    {format(new Date(activeCommitment.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>

              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm">
                  <CheckCircle2 className="h-4 w-4 inline mr-1 text-green-500" />
                  Você ganha <strong>+{activeCommitment.multiplier_applied}%</strong> em {loyaltyType === 'cashback' ? 'cashback' : 'pontos'} em todas as acumulações
                </p>
              </div>

              {availableUpgrades.length > 0 && (
                <div className="pt-4 border-t space-y-3">
                  <p className="text-sm font-medium">Fazer upgrade para:</p>
                  <div className="grid grid-cols-2 gap-3">
                    {availableUpgrades.map(upgrade => (
                      <Button
                        key={upgrade.months}
                        variant="outline"
                        className="h-auto py-4"
                        onClick={() => handleUpgrade(upgrade.months)}
                      >
                        <div className="text-center w-full">
                          <div className="text-lg font-bold">{upgrade.months} meses</div>
                          <div className="text-sm text-primary">+{upgrade.multiplier}%</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Opções de Planos (quando não tem compromisso ativo) */}
        {!activeCommitment && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Plano Padrão (90 dias) */}
              <Card 
                className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg"
                onClick={() => handleSelectPlan('default')}
              >
                <CardHeader>
                  <CardTitle className="text-lg">Plano Padrão</CardTitle>
                  <CardDescription>Sem compromisso</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold mb-2">0%</div>
                  <p className="text-sm text-muted-foreground">
                    Acumule normalmente sem bônus adicional. Pode trocar de rede favorita a cada 90 dias.
                  </p>
                </CardContent>
              </Card>

              {/* Planos com compromisso */}
              {plans.map((plan) => (
                <Card 
                  key={plan.months}
                  className={`cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg relative ${plan.popular ? 'border-primary/30' : ''}`}
                  onClick={() => handleSelectPlan(plan.months)}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500">
                      Mais Escolhido
                    </Badge>
                  )}
                  <CardHeader>
                    <CardTitle className="text-lg">{plan.months} Meses</CardTitle>
                    <CardDescription>Compromisso de fidelidade</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-4xl font-bold mb-3 text-transparent bg-clip-text bg-gradient-to-r ${plan.color}`}>
                      +{plan.multiplier}%
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Ganhe {plan.multiplier}% a mais em todas as acumulações durante {plan.months} meses.
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3">Como funciona?</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Escolha um período de compromisso ou continue sem bônus</li>
                  <li>• Com compromisso: receba bônus em todas as acumulações</li>
                  <li>• Não poderá trocar de rede favorita durante o período</li>
                  <li>• Pode fazer upgrade do plano a qualquer momento</li>
                  <li>• Após o período, pode renovar com benefícios especiais</li>
                </ul>
              </CardContent>
            </Card>
          </>
        )}

        {/* Dialog de Confirmação */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar plano</AlertDialogTitle>
              <AlertDialogDescription>
                {selectedPlan === 'default' ? (
                  <p>Você continuará acumulando normalmente sem bônus adicional.</p>
                ) : selectedPlan && config && (
                  <div className="space-y-3 pt-2">
                    <p>
                      Você está escolhendo o plano de <strong>{selectedPlan} meses</strong> com{" "}
                      <strong>+{
                        selectedPlan === 6 ? config.multiplier_6 :
                        selectedPlan === 9 ? config.multiplier_9 :
                        config.multiplier_12
                      }%</strong> de bônus.
                    </p>
                    
                    <div className="bg-muted/50 p-3 rounded-lg space-y-1 text-sm">
                      <p className="font-medium text-foreground">Condições:</p>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>✅ Ganhe mais {loyaltyType === 'cashback' ? 'cashback' : 'pontos'} em cada compra</li>
                        <li>✅ Válido por {selectedPlan} meses</li>
                        <li>⚠️ Não pode trocar de rede favorita neste período</li>
                        <li>⭐ Pode fazer upgrade a qualquer momento</li>
                      </ul>
                    </div>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmPlan} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Confirmar'
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
                {upgradeToMonths && config && activeCommitment && (
                  <div className="space-y-3 pt-2">
                    <p>
                      Você está fazendo upgrade de{" "}
                      <strong>{activeCommitment.commitment_months} meses (+{activeCommitment.multiplier_applied}%)</strong>
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
                        <li>✅ Não perde os {loyaltyType === 'cashback' ? 'cashback' : 'pontos'} acumulados</li>
                        <li>✅ Sempre pode fazer upgrade, nunca downgrade</li>
                      </ul>
                    </div>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmUpgrade} disabled={isSubmitting} className="bg-primary">
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
      </div>
    </div>
  );
}
