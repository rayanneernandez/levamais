import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, LogOut, Moon, RefreshCw, Sun, User, HeadphonesIcon, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/components/ThemeProvider";
import logoWhite from "@/assets/logo-white.png";
import logoDark from "@/assets/logo-dark.png";
import { APP_VERSION } from "@/config/version";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useStoreFilter } from "@/contexts/StoreFilterContext";
import { useSupportTicket } from "@/contexts/SupportTicketContext";

interface Store {
  id: string;
  name: string;
}
export function StoreHeader() {
  const {
    theme,
    setTheme
  } = useTheme();
  const navigate = useNavigate();
  const {
    selectedStore,
    setSelectedStore
  } = useStoreFilter();
  const { openSupportDialog } = useSupportTicket();
  const [userEmail, setUserEmail] = useState<string>("");
  const [stores, setStores] = useState<Store[]>([]);
  const [networkName, setNetworkName] = useState<string>("");
  useEffect(() => {
    const loadData = async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || "");

        // Buscar lojas do usuário
        const {
          data: managerData
        } = await supabase.from('store_managers').select('network_id').eq('user_id', user.id).is('store_id', null).maybeSingle();
        if (managerData?.network_id) {
          // Buscar nome da rede
          const { data: networkData } = await supabase
            .from('networks')
            .select('name')
            .eq('id', managerData.network_id)
            .single();
          
          if (networkData) {
            setNetworkName(networkData.name);
          }

          const {
            data: storesData
          } = await supabase.from('stores').select('id, name').eq('network_id', managerData.network_id).eq('status', 'active');
          if (storesData) {
            setStores(storesData);
          }
        }
      }
    };
    loadData();
  }, []);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/levaloja/auth");
  };
  const handleRefresh = () => {
    window.location.reload();
  };
  const getUserInitials = () => {
    if (!userEmail) return "U";
    return userEmail.substring(0, 2).toUpperCase();
  };
  return <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 h-16 shrink-0">
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <img src={theme === "dark" ? logoWhite : logoDark} alt="Leva+" className="h-6" />
            </div>
            <span className="text-xs text-muted-foreground mx-[5px]">Portal Lojista</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecione a filial" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">📊 Todas as Lojas</SelectItem>
              {stores.map(store => <SelectItem key={store.id} value={store.id}>
                  🏪 {store.name}
                </SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleRefresh} title="Atualizar">
            <RefreshCw className="h-4 w-4" />
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
                  <p className="text-sm font-medium">Minha Conta</p>
                  <p className="text-xs text-muted-foreground">{userEmail}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">Versão {APP_VERSION}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/levaloja/perfil")}>
                <User className="mr-2 h-4 w-4" />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/levaloja/trocar-senha")}>
                <KeyRound className="mr-2 h-4 w-4" />
                Alterar Senha
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                openSupportDialog({ 
                  rede: networkName || undefined, 
                  portal: 'Loja' 
                });
              }}>
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
    </header>;
}