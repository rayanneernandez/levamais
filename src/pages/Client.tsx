import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, ArrowUpRight, LogOut, User, KeyRound, ChevronDown, AlertCircle, Store, MapPin, ChevronRight, Search, Calendar, ChevronLeft, Zap, HelpCircle, RefreshCw, Gift, HeadphonesIcon, Settings, Star, CreditCard, Tag, Shield, TrendingUp, Volume2, VolumeX, Bell, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";
import { isNotificationSoundEnabled, setNotificationSoundEnabled } from "@/utils/notificationSound";
import { OnboardingDialog } from "@/components/client/OnboardingDialog";
import { TutorialTour } from "@/components/client/TutorialTour";
import { InstallPWADialog } from "@/components/client/InstallPWADialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, differenceInDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ProfileEditDialog } from "@/components/client/ProfileEditDialog";
import { ChangePasswordDialog } from "@/components/client/ChangePasswordDialog";
import { StoreMapDialog } from "@/components/client/StoreMapDialog";
import { RetentionProgramCard } from "@/components/client/RetentionProgramCard";
import { ReferralDialog } from "@/components/client/ReferralDialog";
import { NotificationBell } from "@/components/client/NotificationBell";
import { PushNotificationPrompt } from "@/components/client/PushNotificationPrompt";
import { PushNotificationSettings } from "@/components/client/PushNotificationSettings";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Switch } from "@/components/ui/switch";
import { useSupportTicket } from "@/contexts/SupportTicketContext";
import { useTheme } from "next-themes";
import heroImage from "@/assets/hero-loyalty.png";
import logoWhite from "@/assets/logo-white.png";
import logoDark from "@/assets/logo-dark.png";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TransactionRatingDialog } from "@/components/client/TransactionRatingDialog";
import { ResetPasswordDialog } from "@/components/client/ResetPasswordDialog";
import { NetworkTransferManager } from "@/components/client/NetworkTransferManager";
import { StoreCard } from "@/components/client/StoreCard";
interface NetworkBalance {
  network_id: string;
  network_name: string;
  total_points: number;
  client_record_id: string;
  is_favorite: boolean;
  loyalty_type: string;
  one_enabled: boolean;
}
interface Store {
  store_id: string;
  store_name: string;
  store_address: string;
  store_phone: string;
  flag?: string | null;
  services?: string[] | null;
}
interface Transaction {
  id: string;
  type: string;
  store_id: string;
  store_name: string;
  amount: number;
  cashback: number;
  description: string;
  created_at: string;
  points_validity_days: number;
  expires_at: string;
  network_id?: string;
  nome_colaborador?: string | null;
  codigo_colaborador?: string | null;
}
const Client = () => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    theme
  } = useTheme();
  const {
    openSupportDialog
  } = useSupportTicket();
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [showValidationAlert, setShowValidationAlert] = useState(false);
  const [showStoreMap, setShowStoreMap] = useState(false);
  const [showReferralDialog, setShowReferralDialog] = useState(false);
  const [showPushSettings, setShowPushSettings] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [notificationSoundEnabled, setNotificationSoundEnabledState] = useState(isNotificationSoundEnabled());
  const [userId, setUserId] = useState<string | null>(null);

  // Logout automático após 15 minutos de inatividade
  useInactivityTimeout({
    timeoutMinutes: 15,
    warningMinutes: 2,
    redirectPath: '/levacliente/auth'
  });
  const [userEmail, setUserEmail] = useState<string>("");
  const [userPhone, setUserPhone] = useState<string>("");
  const [clientData, setClientData] = useState<any>(null);
  const [networkBalances, setNetworkBalances] = useState<NetworkBalance[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [networkStores, setNetworkStores] = useState<{
    [key: string]: Store[];
  }>({});
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expiringPoints, setExpiringPoints] = useState<number>(0);
  const [daysUntilBlock, setDaysUntilBlock] = useState<number>(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [autoRedemptionEnabled, setAutoRedemptionEnabled] = useState(false);
  const [showRedemptionConfigDialog, setShowRedemptionConfigDialog] = useState(false);
  const [redemptionDisableMode, setRedemptionDisableMode] = useState<'immediate' | 'scheduled'>('immediate');
  const [redemptionDisableDays, setRedemptionDisableDays] = useState<number>(1);

  // Filtros e paginação
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [showStoresCollapse, setShowStoresCollapse] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Pull-to-refresh states
  const [pullStartY, setPullStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  
  // Rating dialog state
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionRatings, setTransactionRatings] = useState<{ [key: string]: { rating: number; comment: string | null } }>({});
  
  // Retention commitment state
  const [activeCommitment, setActiveCommitment] = useState<any>(null);
  const [retentionConfig, setRetentionConfig] = useState<any>(null);
  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number>(0);
  
  // WhatsApp suporte da rede favorita
  const [favoriteNetworkWhatsApp, setFavoriteNetworkWhatsApp] = useState<{
    phone: string | null;
    message: string | null;
  }>({ phone: null, message: null });

  // Função para recarregar dados
  const refreshData = async () => {
    if (!userId) return;
    setIsRefreshing(true);
    try {
      const {
        data: allClientRecords
      } = await supabase.from('clients').select('*').eq('user_id', userId).order('created_at', {
        ascending: false
      });
      if (allClientRecords && allClientRecords.length > 0) {
        const {
          data: networksData
        } = await supabase.from('networks').select('id, name, loyalty_type, one_enabled').in('id', [...new Set(allClientRecords.map(r => r.network_id))]);
        const networksMap = new Map(networksData?.map(n => [n.id, n]) || []);
        const balances: NetworkBalance[] = allClientRecords.map(record => {
          const network = networksMap.get(record.network_id);
          return {
            network_id: record.network_id,
            network_name: network?.name || 'Rede',
            total_points: Number(record.total_points) || 0,
            client_record_id: record.id,
            is_favorite: record.favorite_network_id === record.network_id,
            loyalty_type: network?.loyalty_type || 'cashback',
            one_enabled: network?.one_enabled || false
          };
        }).sort((a, b) => {
          if (a.is_favorite && !b.is_favorite) return -1;
          if (!a.is_favorite && b.is_favorite) return 1;
          return 0;
        });
        setNetworkBalances(balances);
        await loadAllNetworksData(balances, allClientRecords);
        toast({
          title: "Atualizado!",
          description: "Seus dados foram atualizados com sucesso."
        });
      }
    } catch (error) {
      console.error('Erro ao atualizar:', error);
    } finally {
      setIsRefreshing(false);
      setIsPulling(false);
      setPullDistance(0);
    }
  };
  
  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    // Só ativar se estiver no topo da página e em dispositivo móvel
    if (window.scrollY === 0 && window.innerWidth < 768) {
      setPullStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartY === 0 || window.scrollY > 0 || window.innerWidth >= 768) return;
    
    const currentY = e.touches[0].clientY;
    const distance = currentY - pullStartY;
    
    // Só considerar movimento para baixo e limitar a 150px
    if (distance > 0) {
      const dampedDistance = Math.min(distance * 0.5, 150); // Efeito de "borracha"
      setPullDistance(dampedDistance);
      setIsPulling(dampedDistance > 60);
    }
  };

  const handleTouchEnd = () => {
    if (isPulling && pullDistance > 60) {
      refreshData();
    } else {
      setPullDistance(0);
      setIsPulling(false);
    }
    setPullStartY(0);
  };
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: {
            session
          }
        } = await supabase.auth.getSession();
        if (!session) {
          navigate('/levacliente/auth');
          return;
        }
        setUserId(session.user.id);

        // Verify client role
        const {
          data: roleData,
          error: roleError
        } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id).eq('role', 'client').maybeSingle();
        if (roleError || !roleData) {
          await supabase.auth.signOut();
          // Only show toast if there was an actual session (not just checking)
          if (roleData === null && !roleError) {
            toast({
              title: "Acesso não autorizado",
              description: "Você não tem permissão para acessar esta área.",
              variant: "destructive"
            });
          }
          navigate('/levacliente/auth');
          return;
        }

        // Buscar TODOS os registros de client para este user_id
        const {
          data: allClientRecords
        } = await supabase.from('clients').select('*').eq('user_id', session.user.id).order('created_at', {
          ascending: false
        });
        if (!allClientRecords || allClientRecords.length === 0) {
          await supabase.auth.signOut();
          navigate('/levacliente/auth');
          return;
        }

        // Buscar dados das redes separadamente (incluindo one_enabled)
        const networkIds = [...new Set(allClientRecords.map(r => r.network_id))];
        const {
          data: networksData
        } = await supabase.from('networks').select('id, name, loyalty_type, one_enabled').in('id', networkIds);
        const networksMap = new Map(networksData?.map(n => [n.id, n]) || []);

        // Montar array de saldos por rede e ordenar (favorita primeiro)
        const balances: NetworkBalance[] = allClientRecords.map(record => {
          const network = networksMap.get(record.network_id);
          return {
            network_id: record.network_id,
            network_name: network?.name || 'Rede',
            total_points: Number(record.total_points) || 0,
            client_record_id: record.id,
            is_favorite: record.favorite_network_id === record.network_id,
            loyalty_type: network?.loyalty_type || 'cashback',
            one_enabled: network?.one_enabled || false
          };
        }).sort((a, b) => {
          // Favorita sempre primeiro
          if (a.is_favorite && !b.is_favorite) return -1;
          if (!a.is_favorite && b.is_favorite) return 1;
          return 0;
        });
        setNetworkBalances(balances);

        // Selecionar rede favorita por padrão
        const favoriteBalance = balances.find(b => b.is_favorite);
        const defaultNetwork = favoriteBalance || balances[0];
        setSelectedNetwork(defaultNetwork.network_id);

        // Usar o registro favorito ou o primeiro como clientData principal
        const mainClientRecord = allClientRecords.find(r => r.network_id === defaultNetwork.network_id) || allClientRecords[0];
        
        // Verificar se tem assinatura ONE ativa
        const { data: oneSubscriptions } = await supabase
          .from('client_subscriptions_one')
          .select('*')
          .eq('client_id', mainClientRecord.id)
          .eq('status', 'active')
          .limit(1);
        
        const oneSubscription = oneSubscriptions && oneSubscriptions.length > 0 ? oneSubscriptions[0] : null;
        
        // Atualizar is_one_member baseado na assinatura
        if (oneSubscription && !mainClientRecord.is_one_member) {
          await supabase
            .from('clients')
            .update({ is_one_member: true })
            .eq('id', mainClientRecord.id);
          mainClientRecord.is_one_member = true;
        } else if (!oneSubscription && mainClientRecord.is_one_member) {
          await supabase
            .from('clients')
            .update({ is_one_member: false })
            .eq('id', mainClientRecord.id);
          mainClientRecord.is_one_member = false;
        }
        
        setClientData(mainClientRecord);
        setUserEmail(mainClientRecord.email || session.user.email || "");
        setUserPhone(mainClientRecord.phone || "");
        setAutoRedemptionEnabled(mainClientRecord.auto_redemption_enabled || false);
        
        // Buscar compromisso de retenção ativo (se houver rede favorita)
        if (mainClientRecord.favorite_network_id) {
          const { data: commitment } = await supabase
            .from('client_retention_commitments')
            .select('*')
            .eq('client_id', mainClientRecord.id)
            .eq('network_id', mainClientRecord.favorite_network_id)
            .eq('status', 'active')
            .maybeSingle();
          
          if (commitment) {
            setActiveCommitment(commitment);
            const expiry = new Date(commitment.expires_at);
            const today = new Date();
            const daysLeft = differenceInDays(expiry, today);
            setDaysUntilExpiry(daysLeft);
          }
          
          // Buscar configuração de retenção da rede
          const { data: config } = await supabase
            .from('network_retention_config')
            .select('*')
            .eq('network_id', mainClientRecord.favorite_network_id)
            .eq('is_active', true)
            .maybeSingle();
          
          if (config) {
            setRetentionConfig(config);
          }
          
          // Buscar WhatsApp suporte da rede favorita
          const { data: networkData } = await supabase
            .from('networks')
            .select('support_whatsapp, support_whatsapp_message')
            .eq('id', mainClientRecord.favorite_network_id)
            .maybeSingle();
          
          if (networkData?.support_whatsapp) {
            setFavoriteNetworkWhatsApp({
              phone: networkData.support_whatsapp,
              message: networkData.support_whatsapp_message
            });
          }
        }
        
        // Carregar configurações de desligamento automático
        const mode = mainClientRecord.auto_redemption_disable_mode;
        if (mode === 'immediate' || mode === 'scheduled') {
          setRedemptionDisableMode(mode);
        }
        setRedemptionDisableDays(mainClientRecord.auto_redemption_disable_days || 1);

        // Check if profile is complete (apenas país, estado e cidade são obrigatórios)
        const isProfileComplete = mainClientRecord.birth_date && mainClientRecord.address_country && mainClientRecord.address_state && mainClientRecord.address_city;

        // Check if validations are complete
        const hasValidatedEmail = mainClientRecord.email_validated;
        const hasValidatedPhone = mainClientRecord.phone_validated;

        // Calculate days since registration
        const createdAt = new Date(mainClientRecord.created_at);
        const daysSinceRegistration = differenceInDays(new Date(), createdAt);
        const daysLeft = 7 - daysSinceRegistration;

        // Check if account should be blocked (7 days without validation)
        const shouldBlock = daysSinceRegistration >= 7 && (!hasValidatedEmail || !hasValidatedPhone);
        setIsBlocked(shouldBlock);
        setDaysUntilBlock(daysLeft > 0 ? daysLeft : 0);

        // Show validation alert if not validated and not already showing onboarding
        if ((!hasValidatedEmail || !hasValidatedPhone) && isProfileComplete) {
          setShowValidationAlert(true);
        }

        // Priority: Onboarding only (terms removed from here)
        if (!isProfileComplete || shouldBlock) {
          setShowOnboarding(true);
        }

        // Carregar lojas e transações de todas as redes
        await loadAllNetworksData(balances, allClientRecords);
        setIsLoading(false);
      } catch (error) {
        console.error('Error checking auth:', error);
        navigate('/levacliente/auth');
      }
    };
    checkAuth();

    // Set up auth state listener
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate('/levacliente/auth');
      } else if (event === 'PASSWORD_RECOVERY') {
        setShowResetPassword(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  // Realtime: Escutar novas transações
  useEffect(() => {
    if (!userId || !clientData?.id) return;
    const clientIds = networkBalances.map(b => b.client_record_id);
    if (clientIds.length === 0) return;
    console.log('🔴 Iniciando escuta de transações em tempo real...');
    const channel = supabase.channel('transactions-realtime').on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'transactions'
    }, async payload => {
      console.log('🔔 Nova transação recebida!', payload);

      // Verificar se é transação do cliente atual
      if (clientIds.includes(payload.new.client_id)) {
        const transactionType = payload.new.type === 'accumulation' ? 'acúmulo' : 'resgate';
        toast({
          title: payload.new.type === 'accumulation' ? '💰 Novo acúmulo!' : '🎁 Resgate realizado!',
          description: `Sua transação de ${transactionType} foi processada!`
        });

        // Recarregar dados
        await refreshData();
      }
    }).subscribe();
    return () => {
      console.log('🔴 Parando escuta de transações...');
      supabase.removeChannel(channel);
    };
  }, [userId, clientData?.id, networkBalances]);
  const loadAllNetworksData = async (balances: NetworkBalance[], clientRecords: any[]) => {
    try {
      // Carregar lojas de todas as redes
      const storesData: {
        [key: string]: Store[];
      } = {};
      for (const balance of balances) {
        const {
          data: stores
        } = await supabase.from('stores').select('id, name, address, contact_phone, flag, services').eq('network_id', balance.network_id).eq('status', 'active').order('name');
        storesData[balance.network_id] = (stores || []).map(store => ({
          store_id: store.id,
          store_name: store.name,
          store_address: store.address || '',
          store_phone: store.contact_phone || '',
          flag: store.flag,
          services: store.services,
        }));
      }
      setNetworkStores(storesData);

      // Carregar transações de todas as redes
      const clientIds = clientRecords.map(r => r.id);
      const {
        data: allTransactions
      } = await supabase.from('transactions').select(`
          id,
          type,
          amount,
          points,
          description,
          created_at,
          store_id,
          client_id,
          nome_colaborador,
          codigo_colaborador,
          stores!inner (
            id,
            name,
            network_id,
            points_validity_days
          )
        `).in('client_id', clientIds).order('created_at', {
        ascending: false
      });

      // Processar transações
      const processedTransactions: Transaction[] = (allTransactions || []).map((t: any) => {
        const createdDate = new Date(t.created_at);
        const validityDays = t.stores?.points_validity_days || 365;
        const expiresAt = new Date(createdDate);
        expiresAt.setDate(expiresAt.getDate() + validityDays);
        return {
          id: t.id,
          type: t.type,
          store_id: t.store_id,
          store_name: t.stores?.name || 'Loja não encontrada',
          amount: Number(t.amount) || 0,
          cashback: t.type === 'redemption' ? -Math.abs(t.points) : Math.abs(t.points),
          description: t.description || '',
          created_at: t.created_at,
          points_validity_days: validityDays,
          expires_at: expiresAt.toISOString(),
          network_id: t.stores?.network_id,
          nome_colaborador: t.nome_colaborador,
          codigo_colaborador: t.codigo_colaborador
        };
      });
      setTransactions(processedTransactions);

      // Calcular pontos que expiram em 30 dias (de todas as redes)
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(now.getDate() + 30);
      const expiring = processedTransactions.filter(t => t.type === 'accumulation' || t.type === 'purchase').filter(t => {
        const expiresAt = new Date(t.expires_at);
        return expiresAt > now && expiresAt <= thirtyDaysFromNow;
      }).reduce((sum, t) => sum + Math.abs(Number(t.cashback)), 0);
      setExpiringPoints(expiring);
      
      // Buscar avaliações existentes
      await loadTransactionRatings(processedTransactions.map(t => t.id));
    } catch (error) {
      console.error('Erro ao carregar dados das redes:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar suas informações.",
        variant: "destructive"
      });
    }
  };
  
  const loadTransactionRatings = async (transactionIds: string[]) => {
    try {
      const { data } = await supabase
        .from("transaction_ratings")
        .select("transaction_id, rating, comment, store_reply, reply_at")
        .in("transaction_id", transactionIds);

      if (data) {
        const ratingsMap: { [key: string]: { rating: number; comment: string | null; store_reply?: string | null; reply_at?: string | null } } = {};
        data.forEach((rating) => {
          ratingsMap[rating.transaction_id] = {
            rating: rating.rating,
            comment: rating.comment,
            store_reply: rating.store_reply,
            reply_at: rating.reply_at
          };
        });
        setTransactionRatings(ratingsMap);
      }
    } catch (error) {
      console.error("Erro ao carregar avaliações:", error);
    }
  };
  
  const handleOpenRatingDialog = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowRatingDialog(true);
  };

  const handleRatingDialogClose = async () => {
    setShowRatingDialog(false);
    setSelectedTransaction(null);
    // Recarregar avaliações
    if (transactions.length > 0) {
      await loadTransactionRatings(transactions.map(t => t.id));
    }
  };
  
  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);

    // Verificar se o usuário já completou o tutorial
    if (clientData?.id) {
      const {
        data
      } = await supabase.from('clients').select('tutorial_completed').eq('id', clientData.id).single();

      // Se não completou o tutorial, mostrar
      if (!data?.tutorial_completed) {
        setTimeout(() => {
          setShowTutorial(true);
        }, 500);
        return;
      }
    }
    toast({
      title: "Cadastro completo!",
      description: "Você já pode começar a acumular pontos!"
    });
    // Reload page to fetch updated data
    window.location.reload();
  };
  const handleTutorialComplete = () => {
    setShowTutorial(false);
    toast({
      title: "Cadastro completo!",
      description: "Você já pode começar a acumular pontos!"
    });
    window.location.reload();
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/levacliente/auth");
  };
  const handleChangePassword = () => {
    setShowChangePasswordDialog(true);
  };
  
  const handleToggleNotificationSound = () => {
    const newValue = !notificationSoundEnabled;
    setNotificationSoundEnabledState(newValue);
    setNotificationSoundEnabled(newValue);
    toast({
      title: newValue ? "Som ativado" : "Som desativado",
      description: newValue 
        ? "Você receberá notificações sonoras" 
        : "Notificações serão silenciosas"
    });
  };

  const handleToggleAutoRedemption = async () => {
    try {
      const newValue = !autoRedemptionEnabled;
      const {
        error
      } = await supabase.from('clients').update({
        auto_redemption_enabled: newValue
      }).eq('user_id', userId);
      if (error) throw error;
      setAutoRedemptionEnabled(newValue);
      toast({
        title: newValue ? "Resgate Ativo habilitado!" : "Resgate Ativo desabilitado",
        description: newValue ? "Seu cashback será resgatado automaticamente no PDV quando atingir o valor mínimo." : "Você continuará acumulando cashback normalmente nas suas compras."
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar configuração",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleSaveRedemptionConfig = async () => {
    try {
      const updates: any = {
        auto_redemption_disable_mode: redemptionDisableMode,
      };

      if (redemptionDisableMode === 'scheduled') {
        updates.auto_redemption_disable_days = redemptionDisableDays;
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + redemptionDisableDays);
        updates.auto_redemption_disable_scheduled_at = scheduledDate.toISOString();
      } else {
        updates.auto_redemption_disable_days = null;
        updates.auto_redemption_disable_scheduled_at = null;
      }

      const { error } = await supabase
        .from('clients')
        .update(updates)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Configuração salva!",
        description: redemptionDisableMode === 'immediate' 
          ? "O resgate será desligado automaticamente após cada uso no PDV."
          : `O resgate ficará ativo por ${redemptionDisableDays} ${redemptionDisableDays === 1 ? 'dia' : 'dias'} e depois desligará automaticamente.`
      });

      setShowRedemptionConfigDialog(false);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar configuração",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Saldo da rede selecionada
  const selectedBalance = networkBalances.find(b => b.network_id === selectedNetwork);
  const totalPoints = selectedBalance?.total_points || 0;
  const loyaltyType = selectedBalance?.loyalty_type || 'cashback';
  const networkName = selectedBalance?.network_name || '';

  // Totais consolidados de todas as redes
  const totalCashback = networkBalances.filter(b => b.loyalty_type === 'cashback').reduce((sum, b) => sum + b.total_points, 0);
  const totalPointsAllNetworks = networkBalances.filter(b => b.loyalty_type === 'points').reduce((sum, b) => sum + b.total_points, 0);
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>;
  }
  return <>
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div 
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-200"
          style={{ 
            height: `${pullDistance}px`,
            opacity: pullDistance / 150 
          }}
        >
          <div className="flex flex-col items-center gap-2">
            <RefreshCw 
              className={`h-6 w-6 text-primary transition-transform duration-200 ${
                isPulling ? 'rotate-180' : ''
              } ${isRefreshing ? 'animate-spin' : ''}`} 
            />
            <span className="text-xs text-muted-foreground font-medium">
              {isRefreshing ? 'Atualizando...' : isPulling ? 'Solte para atualizar' : 'Puxe para atualizar'}
            </span>
          </div>
        </div>
      )}
      
      {userId && userEmail && <>
          <OnboardingDialog open={showOnboarding} userId={userId} userEmail={userEmail} userPhone={userPhone} onComplete={handleOnboardingComplete} skipProfileStep={clientData?.birth_date && clientData?.address_country && clientData?.address_city && clientData?.address_state} emailValidated={clientData?.email_validated} phoneValidated={clientData?.phone_validated} canClose={daysUntilBlock > 0} />

          <TutorialTour open={showTutorial} onComplete={handleTutorialComplete} userId={userId} />
        </>}

      {/* Profile Edit Dialog */}
      {userId && <ProfileEditDialog open={showProfileDialog} onOpenChange={setShowProfileDialog} clientData={clientData} userId={userId} onUpdate={() => window.location.reload()} />}

      {/* Change Password Dialog */}
      <ChangePasswordDialog open={showChangePasswordDialog} onOpenChange={setShowChangePasswordDialog} />

      {/* Store Map Dialog */}
      <StoreMapDialog open={showStoreMap} onOpenChange={setShowStoreMap} networkName={networkName} stores={selectedNetwork ? (networkStores[selectedNetwork] || []).map(s => ({
      id: s.store_id,
      name: s.store_name,
      address: s.store_address,
      contact_phone: s.store_phone
    })) : []} />

      {/* Referral Dialog */}
      {selectedNetwork && selectedBalance && <ReferralDialog open={showReferralDialog} onOpenChange={setShowReferralDialog} clientId={selectedBalance.client_record_id} networkId={selectedNetwork} />}

      {/* Validation Alert */}
      <AlertDialog open={showValidationAlert} onOpenChange={setShowValidationAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirme seus dados de contato</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {isBlocked ? <>
                  <p className="text-destructive font-medium">
                    ⚠️ Sua conta está bloqueada para acúmulo e resgate de pontos.
                  </p>
                  <p>
                    Você não confirmou seus dados de contato nos últimos 7 dias. Por favor, valide agora para voltar a acumular e resgatar pontos.
                  </p>
                </> : <>
                  <p>
                    Para continuar acumulando e resgatando pontos, você precisa confirmar seus dados de contato.
                  </p>
                  {daysUntilBlock > 0 && <p className="text-amber-600 font-medium">
                      ⏰ Você tem {daysUntilBlock} {daysUntilBlock === 1 ? 'dia' : 'dias'} para confirmar. Após este prazo, o acúmulo e resgate ficarão bloqueados até a confirmação.
                    </p>}
                  <div className="space-y-2 mt-4">
                    {!clientData?.email_validated && <div className="flex items-center gap-2 text-sm">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                        <span>E-mail não validado</span>
                      </div>}
                    {!clientData?.phone_validated && <div className="flex items-center gap-2 text-sm">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                        <span>Telefone não validado</span>
                      </div>}
                  </div>
                </>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            {!isBlocked && daysUntilBlock > 0 && <Button variant="outline" onClick={() => setShowValidationAlert(false)}>
                Pular por agora
              </Button>}
            <AlertDialogAction onClick={() => {
            setShowValidationAlert(false);
            setShowOnboarding(true);
          }}>
              Validar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <div 
        className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Marca d'água */}
        <div className="fixed inset-0 pointer-events-none z-0 opacity-5" style={{
        backgroundImage: `url(${heroImage})`,
        backgroundSize: '40%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }} />
        {/* Header */}
        <header className="border-b bg-card/80 backdrop-blur-xl sticky top-0 z-50 shadow-sm relative">
          <div className="container mx-auto px-4 py-3">
            {/* Primeira linha: Logo, Totais Consolidados e Menu */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <img src={theme === "dark" ? logoWhite : logoDark} alt="Leva+ Cliente" className="h-6 mb-1" />
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground mx-[5px]">{clientData?.full_name || "Carregando..."}</p>
                  {clientData?.is_one_member && (
                    <Badge className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white text-xs px-2 py-0.5">
                      <CreditCard className="h-3 w-3 mr-1" />
                      One
                    </Badge>
                  )}
                </div>
              </div>

              {/* Totais Consolidados - Centro */}
              {networkBalances.length > 0 && <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  {totalCashback >= 0 && networkBalances.some(b => b.loyalty_type === 'cashback') && <div className="flex items-center gap-2 px-2 md:px-3 py-2 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 border border-green-200 dark:border-green-800 shadow-sm">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] md:text-xs text-muted-foreground font-medium whitespace-nowrap">💰 Cashback Total</span>
                        <span className="text-sm md:text-base font-bold text-green-600 dark:text-green-400 whitespace-nowrap">
                          R$ {totalCashback.toFixed(2)}
                        </span>
                      </div>
                    </div>}
                  
                  {totalPointsAllNetworks >= 0 && networkBalances.some(b => b.loyalty_type === 'points') && <div className="flex items-center gap-2 px-2 md:px-3 py-2 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border border-blue-200 dark:border-blue-800 shadow-sm">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] md:text-xs text-muted-foreground font-medium whitespace-nowrap">⭐ Pontos Total</span>
                        <span className="text-sm md:text-base font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          {totalPointsAllNetworks.toFixed(0)} pts
                        </span>
                      </div>
                    </div>}
                </div>}

              <div className="flex items-center gap-2">
                {/* Botão de Atualizar */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={refreshData} 
                  disabled={isRefreshing}
                  className="h-9 w-9"
                  title="Atualizar dados"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
                
                <NotificationBell />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <User className="h-4 w-4 mr-2" />
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[100] bg-background">
                  <DropdownMenuItem onClick={() => setShowProfileDialog(true)}>
                    <User className="h-4 w-4 mr-2" />
                    Meu Cadastro
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/levacliente/meu-cartao")}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Meu Cartão
                    {clientData?.is_one_member && (
                      <Badge variant="secondary" className="ml-auto bg-gradient-to-r from-yellow-500 to-yellow-600 text-white text-xs">One</Badge>
                    )}
                  </DropdownMenuItem>
                  {selectedBalance?.is_favorite && (
                    <DropdownMenuItem onClick={() => navigate("/levacliente/programa-beneficios")}>
                      <Shield className="h-4 w-4 mr-2" />
                      Fidelidade
                      {activeCommitment && (
                        <Badge variant="secondary" className="ml-auto bg-gradient-to-r from-blue-400 to-blue-500 text-white text-xs">
                          {activeCommitment.commitment_months}M
                        </Badge>
                      )}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setShowReferralDialog(true)}>
                    <Gift className="h-4 w-4 mr-2" />
                    Indica+ Leva+
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowConfigDialog(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Configurações
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/levacliente/ajuda")}>
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Ajuda
                  </DropdownMenuItem>
                  {favoriteNetworkWhatsApp.phone && (
                    <DropdownMenuItem onClick={() => {
                      const defaultMessage = clientData?.full_name 
                        ? `Olá! Sou ${clientData.full_name.split(' ').slice(0, 2).join(' ')}, cliente Leva+, e preciso de ajuda.`
                        : 'Olá! Sou cliente Leva+ e preciso de ajuda.';
                      const message = favoriteNetworkWhatsApp.message || defaultMessage;
                      window.open(`https://wa.me/${favoriteNetworkWhatsApp.phone}?text=${encodeURIComponent(message)}`, '_blank');
                    }}>
                      <MessageCircle className="h-4 w-4 mr-2 text-green-500" />
                      WhatsApp Suporte
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8 max-w-4xl relative z-10">
          {/* Push Notification Prompt */}
          <div className="mb-6">
            <PushNotificationPrompt />
          </div>

          {/* Seletor de Rede - Design Moderno */}
          {networkBalances.length > 1 && <Card className="p-6 mb-6 bg-gradient-to-br from-card via-card to-accent/5 border-2 hover:border-primary/50 transition-all duration-300 shadow-lg hover:shadow-xl">
              <label className="text-sm font-semibold text-muted-foreground mb-3 block flex items-center gap-2">
                <Award className="h-4 w-4 text-primary animate-pulse" />
                Escolha sua rede de fidelidade
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-auto py-4 px-5 border-2 hover:border-primary hover:bg-primary/5 transition-all duration-300 group">
                    <div className="flex items-center gap-3">
                      {selectedBalance?.is_favorite && <span className="text-2xl animate-bounce">⭐</span>}
                      <div className="text-left">
                        <p className="font-bold text-base group-hover:text-primary transition-colors">
                          {networkName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {loyaltyType === 'points' ? `${totalPoints.toFixed(0)} pontos disponíveis` : `R$ ${totalPoints.toFixed(2)} disponível`}
                        </p>
                      </div>
                    </div>
                    <ChevronDown className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] z-[100] bg-background/95 backdrop-blur-xl border-2 shadow-2xl">
                  {networkBalances.map(balance => <DropdownMenuItem key={balance.network_id} onClick={() => setSelectedNetwork(balance.network_id)} className="cursor-pointer p-4 hover:bg-primary/10 transition-all duration-200">
                      <div className="flex items-center justify-between w-full gap-3">
                        <div className="flex items-center gap-3 flex-1">
                          {balance.is_favorite && <span className="text-xl">⭐</span>}
                          <div>
                            <p className="font-semibold">{balance.network_name}</p>
                            {balance.is_favorite && <span className="text-xs text-primary font-medium">Rede Favorita</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-primary">
                            {balance.loyalty_type === 'points' ? `${balance.total_points.toFixed(0)} pts` : `R$ ${balance.total_points.toFixed(2)}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {balance.loyalty_type === 'points' ? 'pontos' : 'cashback'}
                          </p>
                        </div>
                      </div>
                    </DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
            </Card>}

          {/* Alerta de conta bloqueada */}
          {isBlocked && <Card className="p-4 mb-6 bg-destructive/10 border-destructive/20">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">
                    Conta bloqueada para acúmulo e resgate de pontos
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Valide seus dados de contato para desbloquear.
                  </p>
                </div>
              </div>
            </Card>}

          {/* Alerta de pontos expirando */}
            {expiringPoints > 0 && !isBlocked && <Card className="p-4 mb-6 bg-amber-500/10 border-amber-500/20">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    Atenção! Você tem R$ {expiringPoints.toFixed(2)} em cashback que expira em 30 dias.
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-200">
                    Utilize seu cashback antes que expire!
                  </p>
                </div>
              </div>
            </Card>}

          {/* Card de Saldo - Mais vibrante */}
          <Card className="p-6 md:p-8 mb-8 bg-gradient-to-br from-primary/90 via-primary to-secondary/90 text-white relative overflow-hidden shadow-2xl border-0 hover:shadow-primary/50 transition-all duration-500 hover:scale-[1.02]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-pulse" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 animate-pulse" />
            <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-white/5 rounded-full blur-xl -translate-x-1/2 -translate-y-1/2" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-white/90 text-sm mb-2 font-medium flex items-center gap-2">
                    {selectedBalance?.is_favorite && <span className="text-lg animate-bounce">⭐</span>}
                    Saldo Disponível
                  </p>
                  {loyaltyType === 'points' ? <>
                      <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-1 animate-fade-in">{totalPoints.toFixed(0)} pts</h2>
                      <p className="text-white/80 text-sm">pontos acumulados</p>
                    </> : <>
                      <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-1 animate-fade-in">R$ {totalPoints.toFixed(2)}</h2>
                      <p className="text-white/80 text-sm">cashback acumulado</p>
                    </>}
                  <p className="text-white/70 text-xs mt-3 flex items-center gap-1">
                    <Store className="h-3 w-3" />
                    {networkName}
                  </p>
                </div>
                <div className="h-20 w-20 md:h-28 md:w-28 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center flex-shrink-0 hover:scale-110 transition-transform duration-300">
                  <Award className="h-12 w-12 md:h-16 md:w-16 text-white drop-shadow-lg" />
                </div>
              </div>
            </div>
          </Card>

          {/* Banner Leva+ One - Apenas para não membros */}
          {!clientData?.is_one_member && selectedBalance?.is_favorite && selectedBalance?.one_enabled && (
            <Card
              className="p-5 md:p-6 mb-8 bg-gradient-to-br from-yellow-500/10 via-amber-500/10 to-orange-500/10 border-2 border-yellow-500/30 hover:border-yellow-500/50 transition-all duration-300 shadow-lg hover:shadow-xl cursor-pointer hover:scale-[1.01]"
              onClick={() => navigate('/levacliente/meu-cartao')}
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg flex-shrink-0">
                    <CreditCard className="h-8 w-8 text-white animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                      ⚡ Leva+
                      <Badge variant="secondary" className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold px-3 py-1 shadow-lg">One</Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Tenha acesso a promoções exclusivas em <strong>{networkName}</strong>
                    </p>
                  </div>
                </div>
                <Button 
                  variant="default" 
                  size="lg"
                  className="w-full md:w-auto bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold shadow-lg"
                >
                  Assinar Agora
                </Button>
              </div>
            </Card>
          )}

          {/* Card de Programa de Retenção - Apenas para não membros com rede favorita */}
          {!clientData?.is_one_member && selectedBalance?.is_favorite && selectedNetwork && selectedBalance && (
            <div className="mb-8">
              <RetentionProgramCard
                networkId={selectedNetwork}
                networkName={networkName}
                loyaltyType={loyaltyType as "cashback" | "points"}
                isFavorite={selectedBalance.is_favorite}
                clientId={selectedBalance.client_record_id}
              />
            </div>
          )}

          {/* Gerenciador de Transferência de Rede */}
          {selectedBalance && selectedNetwork && !selectedBalance.is_favorite && networkBalances.length > 1 && (() => {
            const favoriteBalance = networkBalances.find(b => b.is_favorite);
            if (!favoriteBalance) return null;
            
            return (
              <div className="mb-8">
                <NetworkTransferManager
                  clientId={selectedBalance.client_record_id}
                  currentNetworkId={favoriteBalance.network_id}
                  currentNetworkName={favoriteBalance.network_name}
                  targetNetworkId={selectedNetwork}
                  targetNetworkName={networkName}
                />
              </div>
            );
          })()}

          {/* Banner de Renovação de Fidelidade - Quando próximo de expirar */}
          {!clientData?.is_one_member && activeCommitment && retentionConfig && daysUntilExpiry > 0 && daysUntilExpiry <= 30 && (
            <Card 
              className="p-5 md:p-6 mb-8 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 border-2 border-primary/30 hover:border-primary/50 transition-all duration-300 shadow-lg hover:shadow-xl cursor-pointer hover:scale-[1.01]"
              onClick={() => navigate('/levacliente/programa-beneficios')}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg flex-shrink-0">
                    <TrendingUp className="h-8 w-8 text-white animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                      🔄 Renovação Disponível
                      <Badge variant="secondary" className="bg-primary text-white">
                        {daysUntilExpiry} {daysUntilExpiry === 1 ? 'dia' : 'dias'} restantes
                      </Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Renove seu plano de fidelidade com <strong>{networkName}</strong> e continue com benefícios especiais
                    </p>
                  </div>
                </div>
                <Button 
                  variant="default" 
                  size="lg"
                  className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white font-bold shadow-lg"
                >
                  Renovar Agora
                </Button>
              </div>
            </Card>
          )}

          {/* Resgate Ativo Card - Mais atrativo */}
          <Card className="p-5 md:p-6 mb-8 bg-gradient-to-r from-card via-accent/10 to-card border-2 hover:border-primary/50 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.01]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <div className={`p-3 md:p-4 rounded-2xl transition-all duration-500 flex-shrink-0 shadow-lg ${autoRedemptionEnabled ? 'bg-gradient-to-br from-green-500 to-green-600 text-white scale-110' : 'bg-muted/50 text-muted-foreground scale-100'}`}>
                  <Zap className={`h-6 w-6 md:h-7 md:w-7 ${autoRedemptionEnabled ? 'animate-pulse' : ''}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base md:text-lg font-bold mb-1 flex items-center gap-2">
                    Resgate Ativo
                    {autoRedemptionEnabled && <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full animate-pulse">ATIVO</span>}
                  </h3>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {autoRedemptionEnabled ? "✅ Resgate automático ativado no PDV" : "💰 Apenas acumulando cashback"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => setShowRedemptionConfigDialog(true)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Switch checked={autoRedemptionEnabled} onCheckedChange={handleToggleAutoRedemption} className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-green-500 data-[state=checked]:to-green-600 flex-shrink-0 shadow-lg hover:scale-110 transition-transform" />
              </div>
            </div>
          </Card>

          {clientData?.is_one_member && selectedBalance?.one_enabled && (
            <>
              <Card 
                className="p-5 md:p-6 mb-4 bg-gradient-to-br from-yellow-500/10 via-amber-500/10 to-orange-500/10 border-2 border-yellow-500/30 hover:border-yellow-500/50 transition-all duration-300 shadow-lg hover:shadow-xl cursor-pointer hover:scale-[1.01]"
                onClick={() => navigate('/levacliente/promocoes-one')}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
                  <div className="flex items-center gap-3 md:gap-4 flex-1 w-full">
                    <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg flex-shrink-0">
                      <Tag className="h-6 w-6 md:h-8 md:w-8 text-white animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base md:text-lg font-bold mb-1 flex items-center gap-2 flex-wrap">
                        ⭐ Promoções Exclusivas Leva+
                        <Badge variant="secondary" className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold px-3 py-1 text-sm shadow-lg">
                          One
                        </Badge>
                      </h3>
                      <p className="text-xs md:text-sm text-muted-foreground line-clamp-1">
                        Acesse ofertas especiais disponíveis em <strong>{networkName}</strong>
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="default" 
                    size="lg"
                    className="w-full md:w-auto flex-shrink-0 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold shadow-lg"
                  >
                    Ver Promoções
                  </Button>
                </div>
              </Card>
            </>
          )}

          {/* Lojas da Rede Selecionada - Card grande e clicável */}
          {selectedNetwork && networkStores[selectedNetwork] && networkStores[selectedNetwork].length > 0 && <Card className="p-4 md:p-6 mb-8 bg-gradient-to-br from-primary/5 via-accent/10 to-secondary/5 border-2 hover:border-primary/50 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Collapsible open={showStoresCollapse} onOpenChange={setShowStoresCollapse}>
                <CollapsibleTrigger className="w-full group">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between cursor-pointer gap-3 md:gap-4">
                    <div className="flex items-center gap-3 md:gap-4 flex-1 w-full">
                      <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg flex-shrink-0">
                        <Store className="h-6 w-6 md:h-8 md:w-8 text-white" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <h2 className="text-base md:text-lg lg:text-xl font-bold mb-1 group-hover:text-primary transition-colors flex items-center gap-2 flex-wrap">
                          📍 Postos e Lojas - {networkName}
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">
                            {networkStores[selectedNetwork].length} {networkStores[selectedNetwork].length === 1 ? 'local' : 'locais'}
                          </Badge>
                        </h2>
                        <p className="text-xs md:text-sm text-muted-foreground line-clamp-1">
                          Locais disponíveis para acumular e resgatar
                        </p>
                      </div>
                    </div>
                    <Button 
                      size="default"
                      variant="outline"
                      className="w-full md:w-auto flex-shrink-0 font-semibold shadow-lg hover:shadow-xl hover:bg-primary hover:text-primary-foreground"
                    >
                      {showStoresCollapse ? 'Ocultar' : 'Ver Locais'}
                      <ChevronDown className={`ml-2 h-4 w-4 md:h-5 md:w-5 transition-transform duration-300 ${showStoresCollapse ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 md:mt-6 animate-accordion-down">
                  <div className="grid gap-3">
                    {networkStores[selectedNetwork].map((store, index) => (
                      <div 
                        key={store.store_id}
                        className="animate-fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <StoreCard 
                          store={{
                            id: store.store_id,
                            name: store.store_name,
                            address: store.store_address,
                            flag: store.flag,
                            services: store.services,
                          }} 
                        />
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>}

          {/* Transactions - Header mais atrativo */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                <ArrowUpRight className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">📝 Extrato</h2>
                <p className="text-sm text-muted-foreground">
                  Histórico completo de suas movimentações
                </p>
              </div>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por loja..." value={searchTerm} onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }} className="pl-9" />
              </div>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "dd/MM/yyyy", {
                    locale: ptBR
                  }) : "Filtrar por data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={selectedDate} onSelect={date => {
                  setSelectedDate(date);
                  setCurrentPage(1);
                }} initialFocus className="p-3 pointer-events-auto" />
                  {selectedDate && <div className="p-2 border-t">
                      <Button variant="outline" size="sm" onClick={() => {
                    setSelectedDate(undefined);
                    setCurrentPage(1);
                  }} className="w-full">
                        Limpar filtro
                      </Button>
                    </div>}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {transactions.length === 0 ? <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Você ainda não possui transações.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Visite uma loja parceira para começar a acumular pontos!
              </p>
            </Card> : (() => {
          // Filtrar por rede selecionada primeiro
          const networkTransactions = selectedNetwork ? transactions.filter(t => t.network_id === selectedNetwork) : transactions;

          // Aplicar filtros
          const filteredTransactions = networkTransactions.filter(transaction => {
            const matchesSearch = searchTerm === "" || transaction.store_name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesDate = !selectedDate || new Date(transaction.created_at) >= startOfDay(selectedDate) && new Date(transaction.created_at) <= endOfDay(selectedDate);
            return matchesSearch && matchesDate;
          });

          // Paginação
          const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
          const startIndex = (currentPage - 1) * itemsPerPage;
          const endIndex = startIndex + itemsPerPage;
          const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);
          if (filteredTransactions.length === 0) {
            return <Card className="p-8 text-center">
                  <p className="text-muted-foreground">
                    Nenhuma transação encontrada com os filtros aplicados.
                  </p>
                </Card>;
          }
          return <>
                <div className="space-y-2">
                  {paginatedTransactions.map(transaction => {
                const expiresAt = new Date(transaction.expires_at);
                const now = new Date();
                const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const isExpiringSoon = (transaction.type === 'accumulation' || transaction.type === 'purchase') && daysUntilExpiry > 0 && daysUntilExpiry <= 30;
                const isEarning = transaction.type === 'accumulation' || transaction.type === 'purchase';
                return <Card key={transaction.id} className="p-4 hover:shadow-lg transition-all duration-300 border-l-4 hover:scale-[1.02] animate-fade-in group" style={{
                  borderLeftColor: isEarning ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'
                }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform ${isEarning ? "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900" : "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900"}`}>
                              <ArrowUpRight className={`h-6 w-6 ${isEarning ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400 rotate-90"}`} />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-sm group-hover:text-primary transition-colors">{transaction.store_name}</h4>
                              {transaction.description && <p className="text-xs text-muted-foreground mt-0.5">
                                  {transaction.description}
                                </p>}
                              {transaction.amount > 0 && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                  💳 Compra: R$ {transaction.amount.toFixed(2)}
                                </p>}
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                🕐 {format(new Date(transaction.created_at), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR
                          })}
                              </p>
                              {isExpiringSoon && <div className="flex items-center gap-1 mt-1">
                                  <span className="text-xs bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-950/50 dark:to-orange-900/50 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 px-2 py-1 rounded-full font-semibold shadow-sm">
                                    ⏰ Expira em {daysUntilExpiry} {daysUntilExpiry === 1 ? 'dia' : 'dias'}
                                  </span>
                                </div>}
                            </div>
                          </div>
                          <div className="text-right ml-3 flex flex-col gap-2">
                            <div>
                              <p className={`text-xl font-bold ${isEarning ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                {transaction.cashback > 0 ? "+" : "-"}R$ {Math.abs(transaction.cashback).toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground font-semibold">cashback</p>
                            </div>
                            <Button
                              variant={transactionRatings[transaction.id] ? "secondary" : "outline"}
                              size="sm"
                              onClick={() => handleOpenRatingDialog(transaction)}
                              className="text-xs whitespace-nowrap"
                            >
                              {transactionRatings[transaction.id] ? (
                                <div className="flex items-center gap-1">
                                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                  {transactionRatings[transaction.id].rating}
                                </div>
                              ) : (
                                <>
                                  <Star className="h-3 w-3 mr-1" />
                                  Avaliar
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </Card>;
              })}
                </div>

                {/* Paginação */}
                {totalPages > 1 && <div className="mt-6 flex justify-center">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                        </PaginationItem>
                        
                        {Array.from({
                    length: totalPages
                  }, (_, i) => i + 1).map(page => <PaginationItem key={page}>
                            <PaginationLink onClick={() => setCurrentPage(page)} isActive={currentPage === page} className="cursor-pointer">
                              {page}
                            </PaginationLink>
                          </PaginationItem>)}
                        
                        <PaginationItem>
                          <PaginationNext onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>}
              </>;
        })()}
        
        {/* Install PWA Dialog */}
        <div className="mt-8">
          <InstallPWADialog />
        </div>
        </div>

        {/* Dialog de Configuração de Desligamento do Resgate */}
        <Dialog open={showRedemptionConfigDialog} onOpenChange={setShowRedemptionConfigDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurar Desligamento do Resgate
              </DialogTitle>
              <DialogDescription>
                Escolha como deseja que o resgate seja desativado quando você desligar
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <RadioGroup value={redemptionDisableMode} onValueChange={(value: 'immediate' | 'scheduled') => setRedemptionDisableMode(value)}>
                <div className="flex items-start space-x-3 space-y-0 rounded-lg border p-4 hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="immediate" id="immediate" />
                  <div className="flex-1">
                    <Label htmlFor="immediate" className="font-medium cursor-pointer">
                      Desligar Após Cada Resgate
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Toda vez que você usar o resgate no PDV, ele será desligado automaticamente
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 space-y-0 rounded-lg border p-4 hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="scheduled" id="scheduled" />
                  <div className="flex-1">
                    <Label htmlFor="scheduled" className="font-medium cursor-pointer">
                      Desligar Após Período
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1 mb-3">
                      O resgate ficará ativo por um período e depois desligará automaticamente
                    </p>
                    
                    {redemptionDisableMode === 'scheduled' && (
                      <div className="space-y-2 mt-3">
                        <Label htmlFor="days" className="text-sm">
                          Desligar após quantos dias?
                        </Label>
                        <Input
                          id="days"
                          type="number"
                          min="1"
                          max="30"
                          value={redemptionDisableDays}
                          onChange={(e) => setRedemptionDisableDays(Math.min(30, Math.max(1, parseInt(e.target.value) || 1)))}
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                          Máximo: 30 dias
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRedemptionConfigDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveRedemptionConfig}>
                Salvar Configuração
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Rating Dialog */}
        {selectedTransaction && (
          <TransactionRatingDialog
            open={showRatingDialog}
            onOpenChange={handleRatingDialogClose}
            transactionId={selectedTransaction.id}
            clientId={networkBalances.find(b => b.network_id === selectedTransaction.network_id)?.client_record_id || ""}
            storeId={selectedTransaction.store_id}
            networkId={selectedTransaction.network_id || ""}
            attendantName={selectedTransaction.nome_colaborador}
            storeName={selectedTransaction.store_name}
            existingRating={transactionRatings[selectedTransaction.id]}
          />
        )}

        {/* Push Notification Settings */}
        <PushNotificationSettings 
          open={showPushSettings}
          onOpenChange={setShowPushSettings}
        />

        {/* Diálogo de Configurações */}
        <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configurações</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {notificationSoundEnabled ? (
                    <Volume2 className="h-5 w-5 text-primary" />
                  ) : (
                    <VolumeX className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">Som de Notificações</p>
                    <p className="text-sm text-muted-foreground">Reproduzir som ao receber notificações</p>
                  </div>
                </div>
                <Switch 
                  checked={notificationSoundEnabled}
                  onCheckedChange={handleToggleNotificationSound}
                />
              </div>
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Notificações Push</p>
                      <p className="text-sm text-muted-foreground">Gerenciar notificações do navegador</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowConfigDialog(false);
                      setShowPushSettings(true);
                    }}
                  >
                    Configurar
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <ResetPasswordDialog 
          open={showResetPassword}
          onSuccess={() => {
            setShowResetPassword(false);
            toast({
              title: "Senha atualizada!",
              description: "Sua senha foi alterada com sucesso. Você já pode usar o aplicativo.",
            });
          }}
        />
      </div>
    </>;

};
export default Client;