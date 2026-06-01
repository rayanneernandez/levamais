import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogOut, User, Coins, Gift, CheckCircle, AlertTriangle, Keyboard, Search, ShoppingCart, Trash2, Star, Wallet, Tag, Camera } from "lucide-react";
import logoWhite from "@/assets/logo-white.png";
import { NumericKeypad } from "@/components/levaregistro/NumericKeypad";
import { FiscalDocumentScanner, FiscalDocumentData } from "@/components/levaregistro/FiscalDocumentScanner";

interface ClientData {
  id: string;
  cpf: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  total_points: number;
  birth_date: string | null;
  auto_redemption_enabled: boolean;
  is_one_member: boolean;
  favorite_network_id: string | null;
}

interface StoreProduct {
  id: string;
  name: string;
  internal_code: string;
  price: number;
}

interface CartItem {
  product: StoreProduct;
  quantity: number;
}

interface StoreConfig {
  loyalty_type: "points" | "cashback";
  points_per_real: number;
  cashback_percentage: number;
  cashback_type: "percentage" | "fixed";
  cashback_fixed_value: number;
  min_redeem_points: number;
  min_redeem_cashback: number;
  max_redeem_points: number;
  max_redeem_cashback: number;
  redemption_accumulation_type: "none" | "full" | "difference";
}

interface OnePromotion {
  id: string;
  name: string;
  description: string | null;
  promotion_type: string;
  start_date: string;
  end_date: string;
  max_redemptions_per_client: number;
}

// Função para análise de anomalias em transações manuais
async function analyzeManualTransactionForAnomalies(
  supabaseClient: any,
  transaction: { id: string; client_id: string; amount: number; type: string },
  client: ClientData,
  storeId: string,
  networkId: string,
  attendantId: string
) {
  try {
    const anomalies: any[] = [];
    let fraudScore = 0;

    // Buscar transações recentes do cliente (últimas 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentTransactions } = await supabaseClient
      .from('transactions')
      .select('*')
      .eq('client_id', client.id)
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false });

    // Buscar transações históricas (últimos 30 dias)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: historicalTransactions } = await supabaseClient
      .from('transactions')
      .select('*')
      .eq('client_id', client.id)
      .gte('created_at', thirtyDaysAgo);

    // REGRA MANUAL 1: Transação manual sempre tem peso base
    fraudScore += 10;
    
    // REGRA 1: Frequência anômala (múltiplas transações em curto período)
    if (recentTransactions && recentTransactions.length >= 5) {
      const timeSpan = Date.now() - new Date(recentTransactions[recentTransactions.length - 1].created_at).getTime();
      const hoursSpan = timeSpan / (1000 * 60 * 60);
      
      if (hoursSpan < 2) {
        fraudScore += 30;
        anomalies.push({
          type: 'frequency_spike',
          severity: 'high',
          rule_code: 'FREQ_01',
          rule_name: 'Frequência Anômala - Múltiplas Transações',
          confidence: 85,
          summary: `${recentTransactions.length} transações em ${hoursSpan.toFixed(1)}h (modo manual)`,
        });
      }
    }

    // REGRA 2: Valor muito acima da média
    if (historicalTransactions && historicalTransactions.length > 0) {
      const avgAmount = historicalTransactions.reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0) / historicalTransactions.length;
      const currentAmount = transaction.amount;
      
      if (currentAmount > avgAmount * 5) {
        fraudScore += 35;
        anomalies.push({
          type: 'unusual_amount',
          severity: currentAmount > avgAmount * 10 ? 'critical' : 'high',
          rule_code: 'AMT_01',
          rule_name: 'Valor Muito Acima da Média (Manual)',
          confidence: 90,
          summary: `Valor R$${currentAmount.toFixed(2)} é ${(currentAmount / avgAmount).toFixed(1)}x a média (R$${avgAmount.toFixed(2)}) - modo manual`,
        });
      }
    }

    // REGRA 3: Velocidade (transações muito próximas)
    if (recentTransactions && recentTransactions.length >= 2) {
      const lastTransaction = recentTransactions[0];
      const timeDiff = Date.now() - new Date(lastTransaction.created_at).getTime();
      const minutesDiff = timeDiff / (1000 * 60);
      
      if (minutesDiff < 5) {
        fraudScore += 25;
        anomalies.push({
          type: 'velocity_pattern',
          severity: 'medium',
          rule_code: 'VEL_01',
          rule_name: 'Transações em Sequência Rápida (Manual)',
          confidence: 80,
          summary: `Transação ${minutesDiff.toFixed(1)} minutos após a anterior - modo manual`,
        });
      }
    }

    // REGRA 4: Padrão temporal suspeito (horário incomum)
    const transactionHour = new Date().getHours();
    if (transactionHour >= 0 && transactionHour < 6) {
      fraudScore += 15;
      anomalies.push({
        type: 'time_pattern',
        severity: 'low',
        rule_code: 'TIME_01',
        rule_name: 'Horário Incomum (Manual)',
        confidence: 60,
        summary: `Transação manual às ${transactionHour}h - horário incomum`,
      });
    }

    // REGRA 5: Cliente sem validação (específica para manual)
    if (!client.email && !client.phone) {
      fraudScore += 20;
      anomalies.push({
        type: 'suspicious_behavior',
        severity: 'medium',
        rule_code: 'VAL_02',
        rule_name: 'Cliente Sem Contato (Manual)',
        confidence: 70,
        summary: `Cliente sem email e telefone cadastrado - modo manual`,
      });
    }

    // REGRA MANUAL 6: Múltiplos resgates no mesmo dia
    if (transaction.type === 'redemption') {
      const todayRedemptions = recentTransactions?.filter((t: any) => t.type === 'redemption') || [];
      if (todayRedemptions.length >= 3) {
        fraudScore += 25;
        anomalies.push({
          type: 'suspicious_behavior',
          severity: 'high',
          rule_code: 'MANUAL_01',
          rule_name: 'Múltiplos Resgates Manuais',
          confidence: 85,
          summary: `${todayRedemptions.length} resgates manuais no mesmo dia`,
        });
      }
    }

    // Se detectou anomalias significativas (fraudScore >= 25), criar registro
    if (anomalies.length > 0 && fraudScore >= 25) {
      const mainAnomaly = anomalies.sort((a, b) => {
        const severityOrder: any = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      })[0];

      // Gerar alert_id único
      const alertId = `MANUAL-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Criar anomalia
      const { data: anomaly, error: anomalyError } = await supabaseClient
        .from('anomalies')
        .insert({
          alert_id: alertId,
          client_id: client.id,
          network_id: networkId,
          store_id: storeId,
          anomaly_type: mainAnomaly.type,
          severity: mainAnomaly.severity,
          status: 'pending',
          fraud_score: Math.min(fraudScore, 100),
          summary: mainAnomaly.summary,
          details: {
            source: 'manual_mode',
            attendant_id: attendantId,
            transaction_type: transaction.type,
            all_rules_triggered: anomalies.map(a => a.rule_code),
          },
          suggested_actions: [
            'Revisar histórico do cliente',
            'Verificar operações do atendente',
            'Monitorar próximas transações manuais',
          ],
        })
        .select()
        .single();

      if (!anomalyError && anomaly) {
        // Associar transação à anomalia
        await supabaseClient
          .from('anomaly_transactions')
          .insert({
            anomaly_id: anomaly.id,
            transaction_id: transaction.id,
          });

        // Inserir regras acionadas
        for (const anom of anomalies) {
          await supabaseClient
            .from('anomaly_rules')
            .insert({
              anomaly_id: anomaly.id,
              rule_code: anom.rule_code,
              rule_name: anom.rule_name,
              confidence: anom.confidence,
            });
        }

        // Criar histórico inicial
        await supabaseClient
          .from('anomaly_history')
          .insert({
            anomaly_id: anomaly.id,
            action_type: 'created',
            action_by: '00000000-0000-0000-0000-000000000000', // System
            notes: `Anomalia detectada em transação manual - Atendente: ${attendantId}`,
          });

        console.log('🚨 Anomalia manual detectada:', alertId, 'Score:', fraudScore);
      }
    }
  } catch (error) {
    console.error('Erro na análise de anomalias manuais:', error);
    // Não propaga o erro para não bloquear a transação
  }
}

export default function LevaRegistroLancamentos() {
  const [isLoading, setIsLoading] = useState(true);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [attendantId, setAttendantId] = useState<string | null>(null);
  const [attendantName, setAttendantName] = useState<string>("");
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);
  
  // Client state
  const [cpfInput, setCpfInput] = useState("");
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [client, setClient] = useState<ClientData | null>(null);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ full_name: "", phone: "", email: "", birth_date: "", cpf: "" });
  
  // Accumulation state
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  
  // Redemption state
  const [pinInput, setPinInput] = useState("");
  const [isPinValidated, setIsPinValidated] = useState(false);
  const [redemptionValue, setRedemptionValue] = useState("");
  const [redemptionTab, setRedemptionTab] = useState<"cashback" | "promotions">("cashback");
  
  // Leva+ One promotions
  const [onePromotions, setOnePromotions] = useState<OnePromotion[]>([]);
  const [isLoadingPromotions, setIsLoadingPromotions] = useState(false);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  
  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [lastScannedDocument, setLastScannedDocument] = useState<FiscalDocumentData | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/levaregistro');
        return;
      }

      // Buscar dados do atendente
      const { data: manager, error: managerError } = await supabase
        .from("store_managers")
        .select("id, network_id, store_id, is_attendant")
        .eq("user_id", session.user.id)
        .eq("is_attendant", true)
        .limit(1)
        .maybeSingle();

      if (managerError) {
        console.warn("[LevaRegistroLancamentos] Erro ao buscar store_managers:", managerError);
      }

      if (!manager?.is_attendant || !manager?.network_id) {
        toast({ title: "Acesso negado", description: "Você não tem permissão para acessar esta página.", variant: "destructive" });
        navigate('/levaregistro');
        return;
      }

      // Verificar se rede está em modo manual
      const { data: store } = await supabase
        .from("stores")
        .select("id, is_manual_mode, loyalty_type, points_per_real, cashback_percentage, cashback_type, cashback_fixed_value, min_redeem_points, min_redeem_cashback, max_redeem_points, max_redeem_cashback, redemption_accumulation_type")
        .eq("network_id", manager.network_id)
        .limit(1)
        .single();

      if (!store?.is_manual_mode) {
        toast({ title: "Modo Manual Desativado", description: "Esta rede não está configurada para lançamentos manuais.", variant: "destructive" });
        navigate('/levaregistro');
        return;
      }

      // Buscar nome do atendente
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .single();

      setNetworkId(manager.network_id);
      setStoreId(store.id);
      setAttendantId(manager.id);
      setAttendantName(profile?.full_name || "Atendente");
      setStoreConfig({
        loyalty_type: (store.loyalty_type as "points" | "cashback") || "points",
        points_per_real: store.points_per_real || 1,
        cashback_percentage: store.cashback_percentage || 5,
        cashback_type: (store.cashback_type as "percentage" | "fixed") || "percentage",
        cashback_fixed_value: store.cashback_fixed_value || 0.1,
        min_redeem_points: store.min_redeem_points || 100,
        min_redeem_cashback: store.min_redeem_cashback || 5,
        max_redeem_points: store.max_redeem_points || 10000,
        max_redeem_cashback: store.max_redeem_cashback || 100,
        redemption_accumulation_type: (store.redemption_accumulation_type as "none" | "full" | "difference") || "none",
      });

      // Carregar produtos
      await loadProducts(manager.network_id);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({ title: "Erro", description: "Erro ao carregar dados.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const loadProducts = async (netId: string) => {
    const { data } = await supabase
      .from("store_products")
      .select("id, name, internal_code, price")
      .eq("network_id", netId)
      .eq("is_active", true)
      .order("name");
    setProducts(data || []);
  };

  const loadOnePromotions = async (netId: string) => {
    setIsLoadingPromotions(true);
    try {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("one_promotions")
        .select("id, name, description, promotion_type, start_date, end_date, max_redemptions_per_client")
        .eq("network_id", netId)
        .eq("is_active", true)
        .lte("start_date", now)
        .gte("end_date", now)
        .order("end_date");
      setOnePromotions(data || []);
    } catch (error) {
      console.error("Erro ao carregar promoções:", error);
    } finally {
      setIsLoadingPromotions(false);
    }
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2');
  };

  const searchClient = async () => {
    const cleanCPF = cpfInput.replace(/\D/g, '');
    if (cleanCPF.length !== 11) {
      toast({ title: "CPF inválido", description: "Digite um CPF válido com 11 dígitos.", variant: "destructive" });
      return;
    }

    setIsSearchingClient(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, cpf, full_name, phone, email, total_points, birth_date, auto_redemption_enabled, is_one_member, favorite_network_id")
        .eq("cpf", cleanCPF)
        .single();

      if (error || !data) {
        setNewClientForm({ ...newClientForm, cpf: cleanCPF });
        setShowNewClientDialog(true);
        return;
      }

      setClient({
        ...data,
        auto_redemption_enabled: data.auto_redemption_enabled ?? false,
        is_one_member: data.is_one_member ?? false,
      });
      
      // Se o cliente tem resgate ativo, já valida automaticamente
      if (data.auto_redemption_enabled) {
        setIsPinValidated(true);
      }
      
      // Se é membro Leva+ One, carregar promoções
      if (data.is_one_member && networkId) {
        loadOnePromotions(networkId);
      }
      
      toast({ title: "Cliente encontrado!", description: data.full_name || "Cliente" });
    } catch (error) {
      console.error("Erro ao buscar cliente:", error);
    } finally {
      setIsSearchingClient(false);
    }
  };

  const createNewClient = async () => {
    if (!networkId || !storeId) return;

    // Validações básicas
    if (!newClientForm.full_name.trim()) {
      toast({ title: "Campo obrigatório", description: "Digite o nome do cliente.", variant: "destructive" });
      return;
    }
    if (!newClientForm.birth_date) {
      toast({ title: "Campo obrigatório", description: "A data de nascimento é obrigatória para o PIN de resgate.", variant: "destructive" });
      return;
    }
    
    setIsProcessing(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          cpf: newClientForm.cpf,
          full_name: newClientForm.full_name.trim() || null,
          phone: newClientForm.phone.replace(/\D/g, '') || null,
          email: newClientForm.email.trim().toLowerCase() || null,
          birth_date: newClientForm.birth_date || null,
          network_id: networkId,
          registered_at_store_id: storeId,
          registered_by_attendant_id: attendantId,
        })
        .select()
        .single();

      if (error) throw error;

      setClient({
        id: data.id,
        cpf: data.cpf,
        full_name: data.full_name,
        phone: data.phone,
        email: data.email,
        total_points: 0,
        birth_date: data.birth_date,
        auto_redemption_enabled: false,
        is_one_member: false,
        favorite_network_id: null,
      });
      setShowNewClientDialog(false);
      setNewClientForm({ full_name: "", phone: "", email: "", birth_date: "", cpf: "" });
      toast({ title: "Cliente cadastrado!", description: "Cliente cadastrado com sucesso." });
    } catch (error: any) {
      console.error("Erro ao cadastrar cliente:", error);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const addToCart = (product: StoreProduct) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => 
      item.product.id === productId 
        ? { ...item, quantity }
        : item
    ));
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  };

  const calculatePoints = (value: number) => {
    if (!storeConfig) return 0;
    if (storeConfig.loyalty_type === "cashback") {
      if (storeConfig.cashback_type === "percentage") {
        return value * (storeConfig.cashback_percentage / 100);
      }
      return storeConfig.cashback_fixed_value;
    }
    return value * storeConfig.points_per_real;
  };

  const validateBirthdayPin = (birthDate: string, pin: string): boolean => {
    const date = new Date(birthDate + 'T00:00:00');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const expectedPin = day + month;
    return pin === expectedPin;
  };

  const handlePinValidation = () => {
    if (!client?.birth_date) {
      toast({ title: "Erro", description: "Cliente não possui data de nascimento cadastrada.", variant: "destructive" });
      return;
    }

    if (pinInput.length !== 4) {
      toast({ title: "Senha inválida", description: "Digite os 4 dígitos da senha.", variant: "destructive" });
      return;
    }

    if (validateBirthdayPin(client.birth_date, pinInput)) {
      setIsPinValidated(true);
      
      // Se é membro Leva+ One, carregar promoções
      if (client.is_one_member && networkId) {
        loadOnePromotions(networkId);
      }
      
      toast({ title: "Senha validada!", description: "Você pode prosseguir com o resgate." });
    } else {
      toast({ title: "Senha incorreta", description: "A senha não confere com a data de nascimento.", variant: "destructive" });
      setPinInput("");
    }
  };

  const processAccumulation = async () => {
    if (!client || !networkId || !storeId || !storeConfig) return;
    
    const totalValue = getCartTotal();
    if (totalValue <= 0) {
      toast({ title: "Selecione produtos", description: "Adicione produtos ao carrinho para pontuar.", variant: "destructive" });
      return;
    }

    let pointsToAdd = calculatePoints(totalValue);

    setIsProcessing(true);
    try {
      // 🔒 Verificar se cliente está bloqueado (igual ao WebPosto)
      const { data: blockedClient } = await supabase
        .from('blocked_clients')
        .select('id, reason, justification')
        .eq('client_id', client.id)
        .eq('network_id', networkId)
        .eq('is_active', true)
        .maybeSingle();

      if (blockedClient) {
        toast({ 
          title: "Cliente Bloqueado", 
          description: `Este cliente está bloqueado: ${blockedClient.reason}`, 
          variant: "destructive" 
        });
        setIsProcessing(false);
        return;
      }

      // 🎯 APLICAR MULTIPLICADOR DE RETENÇÃO (igual ao WebPosto)
      const { data: retentionMultiplier } = await supabase
        .rpc('get_client_active_retention_multiplier', {
          client_uuid: client.id,
          network_uuid: networkId
        });
      
      if (retentionMultiplier && retentionMultiplier > 0) {
        const bonus = pointsToAdd * (retentionMultiplier / 100);
        console.log(`🎯 Bônus de retenção aplicado: +${retentionMultiplier}% = ${bonus.toFixed(2)} extras`);
        pointsToAdd += bonus;
      }

      // Dados do cupom fiscal se disponível
      const nfceData = lastScannedDocument?.type === "nfce" || lastScannedDocument?.type === "nfe"
        ? {
            nfce_access_key: lastScannedDocument.accessKey || null,
            nfce_cnpj: lastScannedDocument.cnpj || null,
            nfce_emitter_name: lastScannedDocument.razaoSocial || null,
          }
        : {};

      // Criar transação (igual ao WebPosto mas com flag de manual)
      const { data: transactionData, error: transactionError } = await supabase
        .from("transactions")
        .insert({
          client_id: client.id,
          store_id: storeId!,
          type: "accumulation" as const,
          points: pointsToAdd,
          amount: totalValue,
          description: `Lançamento Manual - Acúmulo${lastScannedDocument?.accessKey ? ` - NFC-e: ${lastScannedDocument.accessKey.slice(-8)}` : ''}`,
          is_manual_entry: true,
          ...nfceData,
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Atualizar saldo do cliente e validar (igual ao WebPosto)
      const { error: updateError } = await supabase
        .from("clients")
        .update({ 
          total_points: client.total_points + pointsToAdd,
          is_validated: true  // ✅ Valida automaticamente o cliente ao acumular
        })
        .eq("id", client.id);

      if (updateError) throw updateError;

      // 📨 Enviar mensagem automática (igual ao WebPosto)
      if (transactionData) {
        try {
          console.log('📨 Enviando mensagem automática de acúmulo...');
          await supabase.functions.invoke('send-transaction-message', {
            body: {
              transaction_id: transactionData.id,
              message_type: 'acumulo'
            }
          });
        } catch (msgError) {
          console.error('⚠️ Erro ao enviar mensagem (não crítico):', msgError);
        }

        // Analisar anomalias em background
        analyzeManualTransactionForAnomalies(
          supabase,
          { id: transactionData.id, client_id: client.id, amount: totalValue, type: 'accumulation' },
          client,
          storeId,
          networkId,
          attendantId || ''
        ).catch(err => console.error('Erro na análise de anomalias:', err));
      }

      setSuccessMessage(
        storeConfig.loyalty_type === "cashback"
          ? `${pointsToAdd.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de cashback acumulado!`
          : `${pointsToAdd.toFixed(0)} pontos acumulados!`
      );
      setShowSuccessDialog(true);
      resetForm();
    } catch (error: any) {
      console.error("Erro ao processar acúmulo:", error);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const processRedemption = async () => {
    if (!client || !networkId || !storeId || !storeConfig || !isPinValidated) return;
    
    const redeemValue = parseFloat(redemptionValue);
    if (!redeemValue || redeemValue <= 0) {
      toast({ title: "Valor inválido", description: "Digite um valor válido para resgate.", variant: "destructive" });
      return;
    }

    const minRedeem = storeConfig.loyalty_type === "cashback" ? storeConfig.min_redeem_cashback : storeConfig.min_redeem_points;
    const maxRedeem = storeConfig.loyalty_type === "cashback" ? storeConfig.max_redeem_cashback : storeConfig.max_redeem_points;

    if (redeemValue < minRedeem) {
      toast({ title: "Valor mínimo", description: `O valor mínimo de resgate é ${minRedeem.toLocaleString('pt-BR', storeConfig.loyalty_type === "cashback" ? { style: 'currency', currency: 'BRL' } : undefined)}.`, variant: "destructive" });
      return;
    }

    if (redeemValue > maxRedeem) {
      toast({ title: "Valor máximo", description: `O valor máximo de resgate é ${maxRedeem.toLocaleString('pt-BR', storeConfig.loyalty_type === "cashback" ? { style: 'currency', currency: 'BRL' } : undefined)}.`, variant: "destructive" });
      return;
    }

    if (redeemValue > client.total_points) {
      toast({ title: "Saldo insuficiente", description: "O cliente não possui saldo suficiente.", variant: "destructive" });
      return;
    }

    // Verificar valor da venda no carrinho para acúmulo durante resgate
    const cartTotal = getCartTotal();

    setIsProcessing(true);
    try {
      // 🔒 Verificar se cliente está bloqueado (igual ao WebPosto)
      const { data: blockedClient } = await supabase
        .from('blocked_clients')
        .select('id, reason, justification')
        .eq('client_id', client.id)
        .eq('network_id', networkId)
        .eq('is_active', true)
        .maybeSingle();

      if (blockedClient) {
        toast({ 
          title: "Cliente Bloqueado", 
          description: `Este cliente está bloqueado: ${blockedClient.reason}`, 
          variant: "destructive" 
        });
        setIsProcessing(false);
        return;
      }

      // Criar transação de resgate (igual ao WebPosto mas com flag de manual)
      const { data: transactionData, error: transactionError } = await supabase
        .from("transactions")
        .insert({
          client_id: client.id,
          store_id: storeId!,
          type: "redemption" as const,
          points: -redeemValue,
          amount: redeemValue,
          description: `Lançamento Manual - Resgate`,
          is_manual_entry: true,
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      let newBalance = client.total_points - redeemValue;

      // 💰 ACÚMULO DURANTE RESGATE (igual ao WebPosto)
      // Se tem produtos no carrinho e a configuração permite acúmulo durante resgate
      if (cartTotal > 0 && storeConfig.redemption_accumulation_type !== 'none') {
        let accumulationPoints = 0;
        let baseValue = 0;

        if (storeConfig.redemption_accumulation_type === 'full') {
          // Acumula sobre o valor total da venda
          baseValue = cartTotal;
        } else if (storeConfig.redemption_accumulation_type === 'difference') {
          // Acumula sobre a diferença (valor da venda - resgate)
          baseValue = Math.max(0, cartTotal - redeemValue);
        }

        if (baseValue > 0) {
          if (storeConfig.loyalty_type === 'points') {
            accumulationPoints = baseValue * storeConfig.points_per_real;
          } else if (storeConfig.loyalty_type === 'cashback') {
            if (storeConfig.cashback_type === 'percentage') {
              accumulationPoints = baseValue * (storeConfig.cashback_percentage / 100);
            } else {
              accumulationPoints = storeConfig.cashback_fixed_value;
            }
          }

          if (accumulationPoints > 0) {
            console.log('💰 Acumulando durante resgate:', accumulationPoints);
            
            // Criar transação de acúmulo adicional
            const { data: accTransaction, error: accError } = await supabase
              .from('transactions')
              .insert({
                client_id: client.id,
                store_id: storeId,
                type: 'accumulation',
                amount: cartTotal,
                points: accumulationPoints,
                description: `Lançamento Manual - Acúmulo durante resgate`,
                is_manual_entry: true,
              })
              .select()
              .single();

            if (accError) {
              console.error('❌ Erro ao criar transação de acúmulo:', accError);
            } else {
              newBalance += accumulationPoints;
              
              // 📨 Enviar mensagem de acúmulo
              if (accTransaction) {
                try {
                  console.log('📨 Enviando mensagem de acúmulo durante resgate...');
                  await supabase.functions.invoke('send-transaction-message', {
                    body: {
                      transaction_id: accTransaction.id,
                      message_type: 'acumulo'
                    }
                  });
                } catch (msgError) {
                  console.error('⚠️ Erro ao enviar mensagem (não crítico):', msgError);
                }
              }
            }
          }
        }
      }

      // Atualizar saldo do cliente
      const { error: updateError } = await supabase
        .from("clients")
        .update({ total_points: Math.max(0, newBalance) })
        .eq("id", client.id);

      if (updateError) throw updateError;

      // 📨 Enviar mensagem automática de resgate (igual ao WebPosto)
      if (transactionData) {
        try {
          console.log('📨 Enviando mensagem automática de resgate...');
          await supabase.functions.invoke('send-transaction-message', {
            body: {
              transaction_id: transactionData.id,
              message_type: 'resgate'
            }
          });
        } catch (msgError) {
          console.error('⚠️ Erro ao enviar mensagem (não crítico):', msgError);
        }

        // Analisar anomalias em background
        analyzeManualTransactionForAnomalies(
          supabase,
          { id: transactionData.id, client_id: client.id, amount: redeemValue, type: 'redemption' },
          client,
          storeId,
          networkId,
          attendantId || ''
        ).catch(err => console.error('Erro na análise de anomalias:', err));
      }

      // 🔴 Desligar resgate automaticamente após resgate efetivado
      console.log('🔄 Chamando auto-disable-redemption após resgate manual...');
      supabase.functions.invoke('auto-disable-redemption', {
        body: { client_id: client.id }
      }).then(({ data, error }: any) => {
        if (error) {
          console.error('⚠️ Erro ao processar desligamento automático:', error);
        } else if (data?.disabled) {
          console.log('🔴 Resgate desligado automaticamente:', data.reason);
        }
      }).catch((err: any) => {
        console.error('⚠️ Erro na chamada de auto-disable:', err);
      });

      setSuccessMessage(
        storeConfig.loyalty_type === "cashback"
          ? `${redeemValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} resgatado com sucesso! Aplique o desconto manualmente no PDV.`
          : `${redeemValue.toFixed(0)} pontos resgatados com sucesso! Aplique o desconto manualmente no PDV.`
      );
      setShowSuccessDialog(true);
      resetForm();
    } catch (error: any) {
      console.error("Erro ao processar resgate:", error);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const processOnePromotionRedemption = async (promotion: OnePromotion) => {
    if (!client || !storeId) return;
    
    setIsProcessing(true);
    try {
      // Verificar se já atingiu o limite de resgates
      const { data: redemptions } = await supabase
        .from("one_promotion_redemptions")
        .select("id")
        .eq("promotion_id", promotion.id)
        .eq("client_id", client.id);
      
      if (redemptions && redemptions.length >= promotion.max_redemptions_per_client) {
        toast({ title: "Limite atingido", description: "O cliente já atingiu o limite de resgates desta promoção.", variant: "destructive" });
        setIsProcessing(false);
        return;
      }

      // Registrar resgate
      const { error } = await supabase
        .from("one_promotion_redemptions")
        .insert({
          promotion_id: promotion.id,
          client_id: client.id,
          store_id: storeId,
          status: "solicitado",
          metadata: { source: "levaregistro", attendant_id: attendantId },
        });

      if (error) throw error;

      setSuccessMessage(`Promoção "${promotion.name}" resgatada com sucesso! O cliente pode utilizar o benefício.`);
      setShowSuccessDialog(true);
    } catch (error: any) {
      console.error("Erro ao resgatar promoção:", error);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setCpfInput("");
    setClient(null);
    setCart([]);
    setPinInput("");
    setIsPinValidated(false);
    setRedemptionValue("");
    setOnePromotions([]);
    setRedemptionTab("cashback");
    setLastScannedDocument(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/levaregistro');
  };

  const handleFiscalDocumentScan = (data: FiscalDocumentData) => {
    setLastScannedDocument(data);
    
    if (data.type === "ean") {
      // Buscar produto pelo EAN/código
      const product = products.find(p => 
        p.internal_code === data.documentNumber || 
        p.internal_code.includes(data.documentNumber || "")
      );
      if (product) {
        addToCart(product);
        toast({ title: "Produto adicionado!", description: product.name });
      } else {
        toast({ 
          title: "Produto não encontrado", 
          description: `Código ${data.documentNumber} não está cadastrado.`, 
          variant: "destructive" 
        });
      }
    } else if ((data.type === "nfce" || data.type === "nfe") && data.totalValue && data.totalValue > 0) {
      // Para NFC-e/NF-e COM VALOR, criar produto virtual e adicionar ao carrinho
      const virtualProduct: StoreProduct = {
        id: `nfce-${Date.now()}`,
        name: `Cupom Fiscal - ${data.accessKey?.substring(25, 34) || 'NFC-e'}`,
        internal_code: data.accessKey || `nfce-${Date.now()}`,
        price: data.totalValue,
      };
      
      // Adicionar ao carrinho como item único (substituindo o carrinho atual)
      setCart([{ product: virtualProduct, quantity: 1 }]);
      
      toast({ 
        title: "Cupom fiscal adicionado!", 
        description: `Valor: ${data.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} - Finalize o acúmulo para registrar.`
      });
    } else if (data.type === "nfce" || data.type === "nfe") {
      // NFC-e/NF-e sem valor - apenas informativo
      toast({ 
        title: `${data.type.toUpperCase()} lido!`, 
        description: `Documento: ${data.accessKey?.substring(0, 20)}... - Digite o valor manualmente.`,
        variant: "destructive"
      });
    } else if (data.type === "cupom") {
      toast({ 
        title: "Cupom lido!", 
        description: `Número: ${data.documentNumber}` 
      });
    } else {
      toast({ 
        title: "Código lido", 
        description: `Dados: ${data.rawData.substring(0, 30)}...` 
      });
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.internal_code.toLowerCase().includes(productSearch.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-950 via-slate-900 to-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-900/80 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src={logoWhite} alt="Leva+" className="h-6 sm:h-8" />
            <div className="flex items-center gap-1 sm:gap-2">
              <Keyboard className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
              <span className="font-semibold text-white text-sm sm:text-base hidden xs:inline">Portal de Lançamentos</span>
              <span className="font-semibold text-white text-sm sm:hidden">Lançamentos</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-xs sm:text-sm text-slate-400 hidden sm:inline">Olá, {attendantName}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-400 hover:text-white px-2 sm:px-3">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Busca de Cliente */}
        {!client ? (
          <Card className="max-w-xl mx-auto bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-white flex items-center gap-2 text-lg sm:text-xl">
                <User className="h-5 w-5" />
                Identificar Cliente
              </CardTitle>
              <CardDescription className="text-sm">Digite o CPF do cliente para continuar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 pt-0">
              <div className="space-y-2">
                <Label className="text-white text-sm sm:text-base">CPF do Cliente</Label>
                <div className="flex gap-2">
                  <Input
                    value={formatCPF(cpfInput)}
                    onChange={(e) => setCpfInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="000.000.000-00"
                    className="bg-slate-700 border-slate-600 text-white text-base sm:text-lg font-mono"
                    maxLength={14}
                  />
                  <Button 
                    onClick={searchClient} 
                    disabled={isSearchingClient || cpfInput.replace(/\D/g, '').length !== 11}
                    className="bg-amber-500 hover:bg-amber-600 px-3 sm:px-4"
                  >
                    {isSearchingClient ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <NumericKeypad 
                value={cpfInput}
                onChange={(v) => setCpfInput(v.slice(0, 11))}
                onConfirm={searchClient}
                maxLength={11}
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Card do Cliente - Sem CPF */}
            <Card className="mb-4 sm:mb-6 bg-slate-800/50 border-slate-700">
              <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 sm:h-7 sm:w-7 text-amber-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-xl font-semibold text-white truncate">
                        {client.full_name || "Cliente"}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {client.is_one_member && (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Leva+ One
                          </Badge>
                        )}
                        {client.auto_redemption_enabled ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resgate Ativo
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Resgate c/ Senha
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pl-13 sm:pl-0">
                    <div className="text-left sm:text-right">
                      <p className="text-xs sm:text-sm text-slate-400">Saldo Disponível</p>
                      <p className="text-lg sm:text-2xl font-bold text-amber-500">
                        {storeConfig?.loyalty_type === "cashback" 
                          ? client.total_points.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                          : `${client.total_points.toFixed(0)} pts`
                        }
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={resetForm} className="text-xs sm:text-sm whitespace-nowrap">
                      Trocar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs de Operação */}
            <Tabs defaultValue="accumulation" className="space-y-4 sm:space-y-6">
              <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-slate-800 h-10 sm:h-11">
                <TabsTrigger value="accumulation" className="data-[state=active]:bg-amber-500 text-sm sm:text-base">
                  <Coins className="h-4 w-4 mr-1 sm:mr-2" />
                  Pontuar
                </TabsTrigger>
                <TabsTrigger value="redemption" className="data-[state=active]:bg-amber-500 text-sm sm:text-base">
                  <Gift className="h-4 w-4 mr-1 sm:mr-2" />
                  Resgatar
                </TabsTrigger>
              </TabsList>

              {/* Pontuação - Apenas por produtos */}
              <TabsContent value="accumulation">
                <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
                  {/* Produtos */}
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-3 sm:pb-6">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-white text-base sm:text-lg">Selecionar Produtos</CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowScanner(true)}
                          className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                        >
                          <Camera className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">Ler Código</span>
                        </Button>
                      </div>
                      <CardDescription className="text-xs sm:text-sm">
                        Adicione os produtos ou leia o cupom fiscal
                      </CardDescription>
                      
                      {/* Info do último documento escaneado */}
                      {lastScannedDocument && (lastScannedDocument.type === "nfce" || lastScannedDocument.type === "nfe") && (
                        <Alert className="border-green-500/30 bg-green-500/10 mt-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <AlertDescription className="text-slate-300 text-xs">
                            {lastScannedDocument.type.toUpperCase()} lido
                            {lastScannedDocument.totalValue && lastScannedDocument.totalValue > 0 && (
                              <span className="font-semibold text-green-400 ml-1">
                                - {lastScannedDocument.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </span>
                            )}
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      <div className="relative mt-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Buscar produto..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="pl-9 bg-slate-700 border-slate-600 text-white text-sm sm:text-base"
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {products.length === 0 ? (
                        <Alert className="border-amber-500/30 bg-amber-500/10">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <AlertDescription className="text-slate-300 text-xs sm:text-sm">
                            Nenhum produto cadastrado. Cadastre produtos na área de gerenciamento da loja.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="max-h-[200px] sm:max-h-[300px] overflow-y-auto space-y-2">
                          {filteredProducts.map((product) => (
                            <div
                              key={product.id}
                              className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 cursor-pointer active:bg-slate-600 transition-colors"
                              onClick={() => addToCart(product)}
                            >
                              <div className="min-w-0 flex-1 mr-2 flex flex-col sm:flex-row sm:items-center sm:gap-3">
                                <p className="text-white font-medium text-sm sm:text-base truncate">{product.name}</p>
                                <p className="text-xs text-slate-400 sm:text-slate-500">{product.internal_code}</p>
                              </div>
                              <p className="text-amber-500 font-semibold text-sm sm:text-base whitespace-nowrap">
                                {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Carrinho */}
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-3 sm:pb-6">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-white flex items-center gap-2 text-base sm:text-lg">
                          <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
                          Resumo
                        </CardTitle>
                        {cart.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                            onClick={() => setCart([])}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Esvaziar
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {cart.length > 0 ? (
                        <div className="space-y-2 sm:space-y-3 max-h-[150px] sm:max-h-[200px] overflow-y-auto">
                          {cart.map((item) => (
                            <div key={item.product.id} className="flex items-center justify-between p-2 rounded bg-slate-700/50 gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-white text-xs sm:text-sm truncate">{item.product.name}</p>
                                <p className="text-slate-400 text-[10px] sm:text-xs">
                                  {item.product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} x {item.quantity}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => updateCartQuantity(item.product.id, parseInt(e.target.value) || 0)}
                                  className="w-12 sm:w-16 h-7 sm:h-8 text-center bg-slate-600 border-slate-500 text-white text-sm"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 sm:h-8 sm:w-8 text-red-400 hover:text-red-300"
                                  onClick={() => removeFromCart(item.product.id)}
                                >
                                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-400 text-center py-6 sm:py-8 text-sm">
                          Nenhum produto selecionado
                        </p>
                      )}

                      <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-700 space-y-2 sm:space-y-3">
                        <div className="flex justify-between text-base sm:text-lg font-semibold text-white">
                          <span>Total:</span>
                          <span>{getCartTotal().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                        
                        <div className="flex justify-between text-amber-500 text-sm sm:text-base">
                          <span>{storeConfig?.loyalty_type === "cashback" ? "Cashback:" : "Pontuação:"}</span>
                          <span className="font-bold">
                            {storeConfig?.loyalty_type === "cashback"
                              ? calculatePoints(getCartTotal()).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                              : `${calculatePoints(getCartTotal()).toFixed(0)} pts`
                            }
                          </span>
                        </div>
                      </div>

                      <Button
                        className="w-full mt-4 sm:mt-6 bg-amber-500 hover:bg-amber-600 text-sm sm:text-base"
                        size="lg"
                        onClick={processAccumulation}
                        disabled={isProcessing || getCartTotal() <= 0}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        Confirmar Pontuação
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Resgate - Com verificação de Resgate Ativo */}
              <TabsContent value="redemption">
                <Card className="max-w-xl mx-auto bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-3 sm:pb-6">
                    <CardTitle className="text-white flex items-center gap-2 text-base sm:text-lg">
                      <Gift className="h-4 w-4 sm:h-5 sm:w-5" />
                      Realizar Resgate
                    </CardTitle>
                    {client.auto_redemption_enabled && (
                      <CardDescription className="flex items-center gap-2 text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        Cliente com resgate ativo - sem necessidade de senha
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4 sm:space-y-6 pt-0">
                    {/* Se não tem resgate ativo, pedir PIN */}
                    {!isPinValidated && !client.auto_redemption_enabled ? (
                      <>
                        <Alert className="border-amber-500/30 bg-amber-500/10">
                          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                          <AlertDescription className="text-slate-300 text-xs sm:text-sm">
                            O cliente deve digitar a senha de 4 dígitos
                          </AlertDescription>
                        </Alert>

                        <div className="space-y-2">
                          <Label className="text-white text-sm sm:text-base">Senha do Cliente (4 dígitos)</Label>
                          <Input
                            type="password"
                            maxLength={4}
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="••••"
                            className="text-center text-xl sm:text-2xl tracking-[0.5em] bg-slate-700 border-slate-600 text-white"
                          />
                        </div>

                        <NumericKeypad
                          value={pinInput}
                          onChange={(v) => setPinInput(v.slice(0, 4))}
                          onConfirm={handlePinValidation}
                          maxLength={4}
                          isPassword
                        />
                      </>
                    ) : (
                      <>
                        {/* Tabs de opções de resgate */}
                        {client.is_one_member ? (
                          <Tabs value={redemptionTab} onValueChange={(v) => setRedemptionTab(v as "cashback" | "promotions")}>
                            <TabsList className="grid w-full grid-cols-2 bg-slate-700 mb-4">
                              <TabsTrigger value="cashback" className="text-xs sm:text-sm data-[state=active]:bg-amber-500">
                                <Wallet className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                {storeConfig?.loyalty_type === "cashback" ? "Cashback" : "Pontos"}
                              </TabsTrigger>
                              <TabsTrigger value="promotions" className="text-xs sm:text-sm data-[state=active]:bg-amber-500">
                                <Tag className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                Promoções One
                              </TabsTrigger>
                            </TabsList>

                            {/* Cashback/Pontos */}
                            <TabsContent value="cashback" className="space-y-4">
                              <div className="space-y-2">
                                <Label className="text-white text-sm sm:text-base">
                                  Valor do Resgate ({storeConfig?.loyalty_type === "cashback" ? "R$" : "pontos"})
                                </Label>
                                <Input
                                  type="number"
                                  step={storeConfig?.loyalty_type === "cashback" ? "0.01" : "1"}
                                  min="0"
                                  max={client.total_points}
                                  value={redemptionValue}
                                  onChange={(e) => setRedemptionValue(e.target.value)}
                                  placeholder="0"
                                  className="text-base sm:text-lg bg-slate-700 border-slate-600 text-white"
                                />
                                <p className="text-xs sm:text-sm text-slate-400">
                                  Saldo disponível: {storeConfig?.loyalty_type === "cashback"
                                    ? client.total_points.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                    : `${client.total_points.toFixed(0)} pontos`
                                  }
                                </p>
                              </div>

                              <Alert className="border-blue-500/30 bg-blue-500/10">
                                <AlertDescription className="text-slate-300 text-xs sm:text-sm">
                                  💡 Após confirmar, aplique o desconto manualmente no PDV antes de finalizar a venda.
                                </AlertDescription>
                              </Alert>

                              <Button
                                className="w-full bg-amber-500 hover:bg-amber-600 text-sm sm:text-base"
                                size="lg"
                                onClick={processRedemption}
                                disabled={isProcessing || !redemptionValue || parseFloat(redemptionValue) <= 0}
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                )}
                                Confirmar Resgate
                              </Button>
                            </TabsContent>

                            {/* Promoções Leva+ One */}
                            <TabsContent value="promotions" className="space-y-4">
                              {isLoadingPromotions ? (
                                <div className="flex items-center justify-center py-8">
                                  <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                                </div>
                              ) : onePromotions.length > 0 ? (
                                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                  {onePromotions.map((promo) => (
                                    <div key={promo.id} className="p-3 sm:p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                            <Gift className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                            <h4 className="font-medium text-white text-sm sm:text-base truncate">{promo.name}</h4>
                                          </div>
                                          {promo.description && (
                                            <p className="text-xs sm:text-sm text-slate-400 line-clamp-2">{promo.description}</p>
                                          )}
                                          <p className="text-xs text-slate-500 mt-1">
                                            Válido até {new Date(promo.end_date).toLocaleDateString('pt-BR')}
                                          </p>
                                        </div>
                                        <Button
                                          size="sm"
                                          onClick={() => processOnePromotionRedemption(promo)}
                                          disabled={isProcessing}
                                          className="bg-amber-500 hover:bg-amber-600 text-xs sm:text-sm whitespace-nowrap"
                                        >
                                          {isProcessing ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            "Resgatar"
                                          )}
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-8">
                                  <Tag className="h-10 w-10 mx-auto text-slate-500 mb-3" />
                                  <p className="text-slate-400 text-sm">Nenhuma promoção disponível no momento</p>
                                </div>
                              )}
                            </TabsContent>
                          </Tabs>
                        ) : (
                          /* Cliente não é membro One - só cashback/pontos */
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-white text-sm sm:text-base">
                                Valor do Resgate ({storeConfig?.loyalty_type === "cashback" ? "R$" : "pontos"})
                              </Label>
                              <Input
                                type="number"
                                step={storeConfig?.loyalty_type === "cashback" ? "0.01" : "1"}
                                min="0"
                                max={client.total_points}
                                value={redemptionValue}
                                onChange={(e) => setRedemptionValue(e.target.value)}
                                placeholder="0"
                                className="text-base sm:text-lg bg-slate-700 border-slate-600 text-white"
                              />
                              <p className="text-xs sm:text-sm text-slate-400">
                                Saldo disponível: {storeConfig?.loyalty_type === "cashback"
                                  ? client.total_points.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                  : `${client.total_points.toFixed(0)} pontos`
                                }
                              </p>
                            </div>

                            <Alert className="border-blue-500/30 bg-blue-500/10">
                              <AlertDescription className="text-slate-300 text-xs sm:text-sm">
                                💡 Após confirmar, aplique o desconto manualmente no PDV antes de finalizar a venda.
                              </AlertDescription>
                            </Alert>

                            <Button
                              className="w-full bg-amber-500 hover:bg-amber-600 text-sm sm:text-base"
                              size="lg"
                              onClick={processRedemption}
                              disabled={isProcessing || !redemptionValue || parseFloat(redemptionValue) <= 0}
                            >
                              {isProcessing ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4 mr-2" />
                              )}
                              Confirmar Resgate
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      {/* Dialog: Novo Cliente */}
      <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Cadastrar Novo Cliente</DialogTitle>
            <DialogDescription>
              CPF: {formatCPF(newClientForm.cpf)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white">Nome Completo <span className="text-red-400">*</span></Label>
              <Input
                value={newClientForm.full_name}
                onChange={(e) => setNewClientForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Nome completo do cliente"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-white">Data de Nascimento <span className="text-red-400">*</span></Label>
              <Input
                type="date"
                value={newClientForm.birth_date}
                onChange={(e) => setNewClientForm(f => ({ ...f, birth_date: e.target.value }))}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-white">Telefone</Label>
              <Input
                value={newClientForm.phone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 11);
                  const formatted = value
                    .replace(/(\d{2})(\d)/, '($1) $2')
                    .replace(/(\d{5})(\d)/, '$1-$2');
                  setNewClientForm(f => ({ ...f, phone: formatted }));
                }}
                placeholder="(00) 00000-0000"
                className="bg-slate-700 border-slate-600 text-white"
                maxLength={15}
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-white">E-mail</Label>
              <Input
                type="email"
                value={newClientForm.email}
                onChange={(e) => setNewClientForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@exemplo.com"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowNewClientDialog(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button 
              onClick={createNewClient} 
              disabled={isProcessing || !newClientForm.full_name.trim() || !newClientForm.birth_date} 
              className="bg-amber-500 hover:bg-amber-600 w-full sm:w-auto"
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cadastrar Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Sucesso */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-center">
          <div className="py-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Operação Realizada!</h3>
            <p className="text-slate-400">{successMessage}</p>
          </div>
          <DialogFooter className="justify-center">
            <Button onClick={() => setShowSuccessDialog(false)} className="bg-amber-500 hover:bg-amber-600">
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scanner de Documento Fiscal */}
      <FiscalDocumentScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleFiscalDocumentScan}
      />
    </div>
  );
}
