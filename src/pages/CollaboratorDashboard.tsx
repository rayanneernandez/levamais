import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Gift, LogOut, Users, TrendingUp, Award, Calendar, Loader2, HelpCircle, RefreshCw, Moon, Sun, User, KeyRound, HeadphonesIcon } from "lucide-react";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";
import { ForcePasswordChange } from "@/components/client/ForcePasswordChange";
import { useTheme } from "next-themes";
import logoWhite from "@/assets/logo-white.png";
import logoDark from "@/assets/logo-dark.png";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RewardsMarketplace } from "@/components/collaborator/RewardsMarketplace";
import { RedemptionHistory } from "@/components/collaborator/RedemptionHistory";
import { useSupportTicket } from "@/contexts/SupportTicketContext";
interface AttendantStats {
  totalClients: number;
  monthlyClients: number;
  totalPoints: number;
  rankPosition: number;
}

interface AttendantPoints {
  total_points: number;
}
export default function CollaboratorDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [attendantName, setAttendantName] = useState("");
  const [attendantCode, setAttendantCode] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [networkName, setNetworkName] = useState("");
  const [networkId, setNetworkId] = useState("");
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [stats, setStats] = useState<AttendantStats>({
    totalClients: 0,
    monthlyClients: 0,
    totalPoints: 0,
    rankPosition: 0
  });
  const [attendantPoints, setAttendantPoints] = useState<AttendantPoints | null>(null);
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    theme,
    setTheme
  } = useTheme();
  
  // Logout automático após 30 minutos de inatividade
  useInactivityTimeout({
    timeoutMinutes: 30,
    warningMinutes: 3,
    redirectPath: '/levacolaborador/auth'
  });
  
  useEffect(() => {
    checkAuthAndLoadData();
  }, []);
  const checkAuthAndLoadData = async () => {
    try {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session) {
        navigate('/levacolaborador/auth');
        return;
      }

      // Verificar se é atendente (buscar todos os registros)
      const {
        data: attendantRecords,
        error: attendantError
      } = await supabase.from('store_managers').select('is_attendant, attendant_code, network_id, store_id').eq('user_id', session.user.id).eq('is_attendant', true);
      if (attendantError) {
        console.error('Erro ao buscar atendente:', attendantError);
        toast({
          title: "Erro ao buscar dados do atendente",
          description: attendantError.message,
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }
      if (!attendantRecords || attendantRecords.length === 0) {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para acessar esta área.",
          variant: "destructive"
        });
        await supabase.auth.signOut();
        navigate('/levacolaborador/auth');
        return;
      }

      // Pegar o registro network-level para network_id e attendant_code
      const networkRecord = attendantRecords.find(r => r.store_id === null);
      // Pegar o registro store-level para mostrar a loja
      const storeRecord = attendantRecords.find(r => r.store_id !== null);
      if (!networkRecord) {
        toast({
          title: "Erro",
          description: "Registro de atendente inválido.",
          variant: "destructive"
        });
        await supabase.auth.signOut();
        navigate('/levacolaborador/auth');
        return;
      }

      // Buscar nome do atendente e verificar se precisa trocar senha
      const {
        data: profileData
      } = await supabase.from('profiles').select('full_name, force_password_change').eq('id', session.user.id).single();

      // Se precisa trocar senha, mostrar dialog de troca
      if (profileData?.force_password_change) {
        setForcePasswordChange(true);
        setIsLoading(false);
        return;
      }
      setAttendantName(profileData?.full_name || 'Colaborador');
      setAttendantCode(networkRecord.attendant_code);
      setUserEmail(session.user.email || '');
      setUserId(session.user.id);
      setNetworkId(networkRecord.network_id);

      // Buscar nome da rede separadamente
      if (networkRecord.network_id) {
        const {
          data: networkData
        } = await supabase.from('networks').select('name').eq('id', networkRecord.network_id).maybeSingle();
        setNetworkName(networkData?.name || 'Sem rede');
      }

      // Buscar nome da loja separadamente (se houver)
      if (storeRecord?.store_id) {
        const {
          data: storeData
        } = await supabase.from('stores').select('name').eq('id', storeRecord.store_id).maybeSingle();
        setStoreName(storeData?.name || 'Sem loja');
      } else {
        setStoreName('Sem loja');
      }

      // Buscar estatísticas
      await loadStats(session.user.id, networkRecord.network_id);
      
      // Carregar pontos do colaborador
      await loadAttendantPoints(session.user.id, networkRecord.network_id);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar seus dados.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAttendantPoints = async (userId: string, networkId: string) => {
    try {
      const { data: pointsData, error: pointsError } = await supabase
        .from("attendant_points")
        .select("total_points")
        .eq("attendant_id", userId)
        .eq("network_id", networkId)
        .single();

      if (pointsError && pointsError.code !== "PGRST116") {
        throw pointsError;
      }

      if (pointsData) {
        setAttendantPoints(pointsData);
      } else {
        // Criar registro inicial se não existir
        const { error: insertError } = await supabase
          .from("attendant_points")
          .insert({
            attendant_id: userId,
            network_id: networkId,
            total_points: 0,
          });

        if (!insertError) {
          setAttendantPoints({ total_points: 0 });
        }
      }
    } catch (error: any) {
      console.error("Erro ao carregar pontos:", error);
    }
  };
  const loadStats = async (userId: string, networkId: string) => {
    // Total de clientes cadastrados
    const {
      count: totalClients
    } = await supabase.from('clients').select('*', {
      count: 'exact',
      head: true
    }).eq('registered_by_attendant_id', userId);

    // Clientes cadastrados no mês atual
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const {
      count: monthlyClients
    } = await supabase.from('clients').select('*', {
      count: 'exact',
      head: true
    }).eq('registered_by_attendant_id', userId).gte('created_at', startOfMonth.toISOString());

    // Total de pontos gerados pelos clientes cadastrados
    const {
      data: clientsData
    } = await supabase.from('clients').select('total_points').eq('registered_by_attendant_id', userId);
    const totalPoints = clientsData?.reduce((sum, c) => sum + (c.total_points || 0), 0) || 0;

    // Ranking (simplificado - contar quantos atendentes tem mais clientes)
    const {
      data: allAttendants
    } = await supabase.from('store_managers').select('user_id').eq('network_id', networkId).eq('is_attendant', true);
    const attendantIds = allAttendants?.map(a => a.user_id) || [];
    let rankPosition = 1;
    for (const attendantId of attendantIds) {
      if (attendantId === userId) continue;
      const {
        count
      } = await supabase.from('clients').select('*', {
        count: 'exact',
        head: true
      }).eq('registered_by_attendant_id', attendantId);
      if ((count || 0) > (totalClients || 0)) {
        rankPosition++;
      }
    }
    setStats({
      totalClients: totalClients || 0,
      monthlyClients: monthlyClients || 0,
      totalPoints: Math.round(totalPoints),
      rankPosition
    });
  };
  const handleLogout = async () => {
    try {
      // Tentar fazer logout normalmente
      await supabase.auth.signOut();
    } catch (error) {
      // Se der erro, limpar o localStorage como fallback
      console.log("Erro ao fazer logout, limpando sessão localmente:", error);
      localStorage.clear();
    } finally {
      // Sempre navegar para a página de login
      navigate('/levacolaborador/auth');
      toast({
        title: "Logout realizado",
        description: "Até logo!"
      });
    }
  };
  const handleRefresh = () => {
    window.location.reload();
  };
  const getUserInitials = () => {
    if (!userEmail) return "CO";
    if (attendantName) {
      const names = attendantName.split(' ');
      return names.length > 1 ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase() : names[0].substring(0, 2).toUpperCase();
    }
    return userEmail.substring(0, 2).toUpperCase();
  };
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }

  // Se precisa trocar senha, mostrar componente de troca
  if (forcePasswordChange) {
    return <ForcePasswordChange onPasswordChanged={() => {
      setForcePasswordChange(false);
      checkAuthAndLoadData(); // Recarregar dados após troca de senha
    }} />;
  }
  return <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 h-16 shrink-0">
        <div className="flex items-center justify-between h-full px-6">
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-start">
              <img src={theme === "dark" ? logoWhite : logoDark} alt="Leva+" className="h-6" />
              <span className="text-xs text-muted-foreground pl-[2px] mx-[3px]">Portal do Colaborador</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleRefresh} title="Atualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="icon" onClick={() => navigate("/levacolaborador/ajuda")} title="Ajuda">
              <HelpCircle className="h-4 w-4" />
            </Button>
            
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Alternar tema">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar>
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{attendantName}</p>
                    <p className="text-xs text-muted-foreground">{userEmail}</p>
                    {attendantCode && <p className="text-xs font-mono text-primary">{attendantCode}</p>}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/levacolaborador/perfil")}>
                  <User className="mr-2 h-4 w-4" />
                  Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/levacolaborador/senha")}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Alterar Senha
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/levacolaborador/suporte")}>
                  <HeadphonesIcon className="mr-2 h-4 w-4" />
                  Suporte
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Welcome Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Olá, {attendantName}! 👋</CardTitle>
            <CardDescription className="text-base">
              {storeName} • {networkName}
              {attendantCode && <span className="block mt-1 font-mono text-primary font-semibold">
                  Código: {attendantCode}
                </span>}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Cadastros
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClients}</div>
              <p className="text-xs text-muted-foreground">
                Clientes cadastrados por você
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Cadastros no Mês
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.monthlyClients}</div>
              <p className="text-xs text-muted-foreground">
                Novos cadastros em {new Date().toLocaleDateString('pt-BR', {
                month: 'long'
              })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pontos Gerados
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.totalPoints.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Pontos acumulados pelos seus clientes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Sua Posição
              </CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">#{stats.rankPosition}</div>
              <p className="text-xs text-muted-foreground">
                No ranking de atendentes
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Leva+ Valoriza Section */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Gift className="h-6 w-6 text-primary" />
                    Leva+ Valoriza
                  </CardTitle>
                  <CardDescription>
                    Troque seus pontos por prêmios incríveis!
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Seus pontos</p>
                  <p className="text-3xl font-bold text-primary">
                    {attendantPoints?.total_points?.toFixed(0) || 0}
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>

          <RewardsMarketplace
            networkId={networkId}
            attendantId={userId}
            currentPoints={attendantPoints?.total_points || 0}
            onRedemption={() => loadAttendantPoints(userId, networkId)}
          />
        </div>

        {/* Histórico de Resgates */}
        <RedemptionHistory attendantId={userId} networkId={networkId} />
      </main>
    </div>;
}