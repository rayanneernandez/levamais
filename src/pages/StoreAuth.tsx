import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Turnstile } from "@marsidev/react-turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logoWhite from "@/assets/logo-white.png";
import { LIMITS, trimmedEmail } from "@/lib/input-sanitization";

// Schema para login de loja
const loginSchema = z.object({
  email: trimmedEmail(LIMITS.EMAIL),
  password: z.string()
    .min(1, "Senha é obrigatória")
    .max(LIMITS.PASSWORD, `Senha deve ter no máximo ${LIMITS.PASSWORD} caracteres`)
});

type LoginFormData = z.infer<typeof loginSchema>;

const StoreAuth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const turnstileRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Verificar se já está logado
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/levaloja");
      }
    });
  }, [navigate]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const handleLogin = async (data: LoginFormData) => {
    if (!turnstileToken) {
      toast({
        title: "Verificação necessária",
        description: "Por favor, complete a verificação de segurança.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) throw error;

      // Verificar se o usuário tem role de network_manager
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authData.user.id)
        .eq('role', 'network_manager')
        .single();

      if (!roles) {
        await supabase.auth.signOut();
        throw new Error('Acesso não autorizado. Esta área é exclusiva para empresas.');
      }

      // Verificar se precisa trocar senha + se está ativo
      const { data: managerData } = await supabase
        .from('store_managers')
        .select('must_change_password, is_active')
        .eq('user_id', authData.user.id)
        .is('store_id', null)
        .maybeSingle();

      if (managerData && managerData.is_active === false) {
        await supabase.auth.signOut();
        throw new Error('Seu acesso foi desativado. Entre em contato com o administrador da rede.');
      }

      if (managerData?.must_change_password === true) {
        toast({
          title: "Troca de senha obrigatória",
          description: "Por segurança, você precisa alterar sua senha no primeiro acesso.",
        });
        navigate("/levaloja/trocar-senha");
        return;
      }

      toast({
        title: "Login realizado com sucesso!",
        description: "Bem-vindo ao portal LevaLoja",
      });
      
      navigate("/levaloja");
    } catch (error: any) {
      setIsLoading(false);
      turnstileRef.current?.reset();
      setTurnstileToken("");
      toast({
        title: "Erro no login",
        description: error.message || "Verifique suas credenciais e tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          
          <div className="flex flex-col items-center justify-center gap-3 mb-2">
            <img src={logoWhite} alt="Leva+" className="h-12" />
            <h1 className="text-2xl font-bold text-white">Portal do Lojista</h1>
          </div>
        </div>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Acesso para Lojistas</CardTitle>
            <CardDescription>Entre com suas credenciais fornecidas pela equipe Leva+</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="loja@exemplo.com"
                  maxLength={LIMITS.EMAIL}
                  {...loginForm.register("email")}
                  className="bg-slate-800 border-slate-700 text-white"
                />
                {loginForm.formState.errors.email && (
                  <p className="text-sm text-red-400">{loginForm.formState.errors.email.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  maxLength={LIMITS.PASSWORD}
                  {...loginForm.register("password")}
                  className="bg-slate-800 border-slate-700 text-white"
                />
                {loginForm.formState.errors.password && (
                  <p className="text-sm text-red-400">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="flex justify-center">
                <Turnstile
                  ref={turnstileRef}
                  siteKey="0x4AAAAAAB74xByz5s7hy9rh"
                  onSuccess={setTurnstileToken}
                  onError={() => setTurnstileToken("")}
                  onExpire={() => setTurnstileToken("")}
                  options={{
                    theme: "dark",
                    size: "normal",
                  }}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                disabled={isLoading || !turnstileToken}
              >
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>
              
              <p className="text-sm text-slate-400 text-center">
                Ainda não tem acesso? Entre em contato com a equipe Leva+
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StoreAuth;
