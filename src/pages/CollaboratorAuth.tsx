import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Turnstile } from "@marsidev/react-turnstile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogIn, Loader2 } from "lucide-react";
import logoWhite from "@/assets/logo-white.png";

export default function CollaboratorAuth() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const turnstileRef = useRef<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Se já está logado, redirecionar direto para o dashboard
        navigate('/levacolaborador/dashboard');
        return;
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!turnstileToken) {
      toast({
        variant: "destructive",
        title: "Verificação necessária",
        description: "Por favor, complete a verificação de segurança.",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Chamar edge function para buscar email pelo código do atendente
      const { data: loginData, error: loginError } = await supabase.functions.invoke(
        'collaborator-login',
        {
          body: {
            attendant_code: username.trim().toUpperCase(),
            password: password,
          },
        }
      );

      if (loginError || !loginData?.success) {
        toast({
          variant: "destructive",
          title: "Erro no login",
          description: loginData?.error || "Código ou senha incorretos.",
        });
        setIsLoading(false);
        return;
      }

      // Fazer login com email + senha
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: password,
      });

      if (authError) {
        toast({
          variant: "destructive",
          title: "Erro no login",
          description: authError.message === "Invalid login credentials"
            ? "Código ou senha incorretos."
            : authError.message,
        });
        setIsLoading(false);
        return;
      }

      // Se chegou aqui, a edge function já validou que é um atendente válido
      toast({
        title: "Login realizado!",
        description: "Bem-vindo ao Portal do Colaborador.",
      });
      navigate('/levacolaborador/dashboard');
    } catch (error) {
      console.error('Erro no login:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro ao fazer login. Tente novamente.",
      });
    } finally {
      setIsLoading(false);
      turnstileRef.current?.reset();
      setTurnstileToken("");
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex flex-col items-center justify-center gap-3 mb-2">
            <img src={logoWhite} alt="Leva+" className="h-12" />
            <h1 className="text-2xl font-bold text-white">Portal do Colaborador</h1>
          </div>
          <p className="text-slate-400">Acompanhe suas estatísticas e ganhe pontos por cadastros</p>
        </div>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Login</CardTitle>
            <CardDescription>
              Entre com seu código de atendente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-white">Código do Atendente</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Ex: Código_Empresa"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toUpperCase())}
                  required
                  disabled={isLoading}
                  className="font-mono bg-slate-800 border-slate-700 text-white"
                />
                <p className="text-xs text-slate-400">
                  Ex: Código_Empresa
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-slate-800 border-slate-700 text-white"
                />
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
                className="w-full bg-green-500 hover:bg-green-600 text-white"
                disabled={isLoading || !turnstileToken}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Entrar
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
