import { LogOut, RefreshCw, Moon, Sun, User, KeyRound, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "next-themes";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import logoWhite from "@/assets/logo-white.png";
import logoDark from "@/assets/logo-dark.png";
import { APP_VERSION } from "@/config/version";
export function AdminHeader() {
  const {
    theme,
    setTheme
  } = useTheme();
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>("");
  useEffect(() => {
    const getUser = async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    getUser();
  }, []);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/adm/auth");
  };
  const handleRefresh = () => {
    window.location.reload();
  };
  const getUserInitials = () => {
    if (!userEmail) return "U";
    return userEmail.substring(0, 2).toUpperCase();
  };
  return <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 h-16 shrink-0">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div className="flex flex-col">
            <img src={theme === "dark" ? logoWhite : logoDark} alt="Leva+" className="h-6" />
            <span className="text-[10px] text-muted-foreground font-medium -ml-px mx-[6px]">Portal Adm</span>
          </div>
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
              <DropdownMenuItem onClick={() => navigate("/adm/perfil")}>
                <User className="mr-2 h-4 w-4" />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/adm/senha")}>
                <KeyRound className="mr-2 h-4 w-4" />
                Alterar Senha
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/adm/configuracoes")}>
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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