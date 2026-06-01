import { useEffect, useState, Suspense } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider } from "@/components/ui/sidebar";
import { StoreSidebar } from "./StoreSidebar";
import { StoreHeader } from "./StoreHeader";
import { Breadcrumbs } from "./Breadcrumbs";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export function StoreLayout() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  // Logout automático após 30 minutos de inatividade
  useInactivityTimeout({
    timeoutMinutes: 30,
    warningMinutes: 3,
    redirectPath: '/levaloja/auth'
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/levaloja/auth");
        return;
      }

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'network_manager')
        .maybeSingle();
      
      if (!roles) {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para acessar esta página.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/levaloja/auth");
        return;
      }

      // Verificar se precisa trocar senha
      const { data: managerData } = await supabase
        .from('store_managers')
        .select('must_change_password')
        .eq('user_id', session.user.id)
        .is('store_id', null)
        .maybeSingle();

      if (managerData?.must_change_password === true) {
        navigate("/levaloja/trocar-senha");
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
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full flex-col">
        <StoreHeader />
        <div className="flex flex-1 relative">
          <div className="sticky top-0 z-40 h-[calc(100vh-3rem)]">
            <StoreSidebar />
          </div>
          <main className="flex-1 overflow-x-auto">
            <Breadcrumbs />
            <div className="p-6">
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-[400px]">
                  <LoadingSpinner size="lg" />
                </div>
              }>
                <Outlet />
              </Suspense>
            </div>
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
