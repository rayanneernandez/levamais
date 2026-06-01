import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Turnstile } from "@marsidev/react-turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { LoadingPage } from "@/components/ui/loading-page";
import logoDark from "@/assets/logo-dark.png";

const ResellerAuth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const turnstileRef = useRef<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Usuário já está logado, redirecionar
        navigate("/levarevendedor/dashboard");
      }
    } catch (error) {
      console.error("Erro ao verificar usuário:", error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!turnstileToken) {
      toast({
        title: "Verificação necessária",
        description: "Por favor, complete a verificação de segurança.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Verificar se o email pertence a uma revenda
      const { data: reseller, error: resellerError } = await supabase
        .from("resellers")
        .select("id, company_name, is_active")
        .eq("email", email)
        .maybeSingle();

      if (resellerError) {
        console.error("Erro ao verificar revendedor:", resellerError);
        toast({
          title: "Erro ao verificar cadastro",
          description: resellerError.message,
          variant: "destructive",
        });
        return;
      }

      if (!reseller) {
        toast({
          title: "Acesso negado",
          description: "Email não cadastrado como revenda",
          variant: "destructive",
        });
        return;
      }

      if (!reseller.is_active) {
        toast({
          title: "Acesso negado",
          description: "Revenda inativa. Entre em contato com o suporte",
          variant: "destructive",
        });
        return;
      }

      // Fazer login
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        if (signInError.message.includes("Invalid login credentials")) {
          toast({
            title: "Erro ao fazer login",
            description: "Email ou senha incorretos",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro ao fazer login",
            description: signInError.message,
            variant: "destructive",
          });
        }
        return;
      }

      // Login realizado com sucesso, redirecionar para dashboard
      navigate("/levarevendedor/dashboard");

    } catch (error: any) {
      console.error("Erro ao fazer login:", error);
      toast({
        title: "Erro ao fazer login",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      turnstileRef.current?.reset();
      setTurnstileToken("");
    }
  };

  if (isCheckingAuth) {
    return <LoadingPage />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary-variant to-secondary p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <img src={logoDark} alt="Leva+ Fidelidade" className="h-16" />
          </div>
          <div>
            <CardTitle className="text-2xl text-center">Portal do Revendedor</CardTitle>
            <CardDescription className="text-center">
              Entre com suas credenciais de acesso
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex justify-center">
              <Turnstile
                ref={turnstileRef}
                siteKey="0x4AAAAAAB74xByz5s7hy9rh"
                onSuccess={setTurnstileToken}
                onError={() => setTurnstileToken("")}
                onExpire={() => setTurnstileToken("")}
                options={{
                  theme: "light",
                  size: "normal",
                }}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading || !turnstileToken}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResellerAuth;
