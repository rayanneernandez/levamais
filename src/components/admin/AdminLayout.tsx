import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  // Logout automático após 60 minutos de inatividade
  useInactivityTimeout({
    timeoutMinutes: 60,
    warningMinutes: 5,
    redirectPath: '/adm/auth'
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/adm/auth");
        return;
      }

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (!roles) {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para acessar esta página.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/adm/auth");
        return;
      }
      
      setIsLoading(false);
    };

    checkAuth();
  }, [navigate, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full flex-col">
        <AdminHeader />
        <div className="flex flex-1 relative">
          <div className="sticky top-0 z-40 h-[calc(100vh-3rem)]">
            <AdminSidebar />
          </div>
          <main className="flex-1 py-6 pr-6 pl-1 overflow-auto">
            {children}
            <div className="fixed bottom-8 right-8 opacity-5 pointer-events-none text-center z-0">
              <div className="text-6xl font-bold mb-2">
                <span className="text-foreground">Leva</span>
                <span className="text-primary">+</span>
              </div>
              <p className="text-2xl font-bold">
                Fidelidade que Transforma
              </p>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
