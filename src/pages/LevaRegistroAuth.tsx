import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Turnstile } from "@marsidev/react-turnstile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogIn, Loader2, Keyboard, ArrowLeft } from "lucide-react";
import logoWhite from "@/assets/logo-white.png";

export default function LevaRegistroAuth() {
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
        // Se já está logado, verificar se é atendente e se rede está em modo manual
        const { data: manager, error: managerError } = await supabase
          .from("store_managers")
          .select("is_attendant, network_id")
          .eq("user_id", session.user.id)
          .eq("is_attendant", true)
          .limit(1)
          .maybeSingle();

        if (managerError) {
          // Se tiver mais de um registro, ou qualquer inconsistência, apenas não redireciona automaticamente
          console.warn("[LevaRegistroAuth] Erro ao buscar store_managers:", managerError);
        }

        if (manager?.is_attendant && manager?.network_id) {
          const { data: store } = await supabase
            .from("stores")
            .select("is_manual_mode")
            .eq("network_id", manager.network_id)
            .limit(1)
            .single();

          if (store?.is_manual_mode) {
            navigate('/levaregistro/lancamentos');
            return;
          }
        }
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
        'levaregistro-login',
        {
          body: {
            attendant_code: username.trim().toUpperCase(),
            password: password,
          },
        }
      );

      // Extrair dados do erro (quando retorna 403/401, o Supabase pode devolver o body no context.response)
      let responseData: any = loginData;

      if (loginError && !responseData) {
        const maybeAny = loginError as any;

        // 1) Tentar ler o JSON do response (forma mais confiável)
        const resp: Response | undefined = maybeAny?.context?.response;
        if (resp) {
          try {
            responseData = await resp.clone().json();
          } catch {
            // ignore
          }
        }

        // 2) Fallback: tentar extrair JSON da mensagem de erro
        if (!responseData) {
          const errorMsg = loginError.message || "";
          const jsonMatch = errorMsg.match(/\{.*\}/);
          if (jsonMatch) {
            try {
              responseData = JSON.parse(jsonMatch[0]);
            } catch {
              // ignore
            }
          }
        }
      }

      // Verificar se a rede não está em modo manual
      if (responseData?.is_manual_mode === false) {
        toast({
          variant: "destructive",
          title: "Lançamento Manual Indisponível",
          description: responseData?.error || "Esta rede não está configurada para lançamentos manuais.",
        });
        setIsLoading(false);
        return;
      }

      if (loginError || !responseData?.success) {
        toast({
          variant: "destructive",
          title: "Erro no login",
          description: responseData?.error || "Código ou senha incorretos.",
        });
        setIsLoading(false);
        return;
      }

      // Fazer login com email + senha
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: responseData.email,
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

      toast({
        title: "Login realizado!",
        description: "Bem-vindo ao Portal de Lançamentos.",
      });
      navigate('/levaregistro/lancamentos');
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
    <div className="min-h-screen bg-gradient-to-br from-amber-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      {/* Botão Voltar */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => window.history.length > 1 ? navigate(-1) : window.location.href = 'https://levamais.com.br'}
        className="absolute top-4 left-4 text-slate-400 hover:text-white hover:bg-slate-800"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>

      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex flex-col items-center justify-center gap-3 mb-2">
            <img src={logoWhite} alt="Leva+" className="h-12" />
            <div className="flex items-center gap-2">
              <Keyboard className="h-6 w-6 text-amber-500" />
              <h1 className="text-2xl font-bold text-white">Portal de Lançamentos</h1>
            </div>
          </div>
          <p className="text-slate-400">Faça lançamentos manuais de pontos e resgates</p>
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
                  placeholder="Ex: 1_NOMEDAEMPRESA"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toUpperCase())}
                  required
                  disabled={isLoading}
                  className="font-mono bg-slate-800 border-slate-700 text-white"
                />
                <p className="text-xs text-slate-400">
                  Formato: Número_NomeDaRede (ex: 1_REDEKOHARA)
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
                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
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

        <p className="text-center text-sm text-slate-500">
          Acesso exclusivo para funcionários cadastrados como atendentes
        </p>
      </div>
    </div>
  );
}
