import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logoWhite from "@/assets/logo-white.png";

const AdminAuth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if user is admin
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .maybeSingle();
        
        if (roles) {
          navigate("/adm");
        }
      }
    };
    checkUser();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (isForgotPassword) {
        // Password reset
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/adm/auth`,
        });

        if (error) {
          toast({
            title: "Erro ao enviar email",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Email enviado!",
          description: "Verifique sua caixa de entrada para redefinir sua senha.",
        });
        setIsForgotPassword(false);
      } else {
        // Sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          toast({
            title: "Erro ao fazer login",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        if (data.session) {
          // Check if user is admin
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', data.session.user.id)
            .eq('role', 'admin')
            .maybeSingle();
          
          if (!roles) {
            toast({
              title: "Acesso negado",
              description: "Você não tem permissão para acessar o painel administrativo.",
              variant: "destructive",
            });
            await supabase.auth.signOut();
            return;
          }

          toast({
            title: "Login realizado com sucesso!",
            description: "Bem-vindo ao painel administrativo.",
          });
          navigate("/adm");
        }
      }
    } catch (error: any) {
      toast({
        title: isForgotPassword ? "Erro ao enviar email" : "Erro ao fazer login",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
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
            <h1 className="text-2xl font-bold text-white">Portal do Admin</h1>
          </div>
          <p className="text-slate-400">Acesso exclusivo para administradores</p>
        </div>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">
              {isForgotPassword ? "Recuperar Senha" : "Login Administrativo"}
            </CardTitle>
            <CardDescription>
              {isForgotPassword 
                ? "Digite seu email para receber instruções de recuperação" 
                : "Acesso restrito aos criadores da plataforma"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@levamais.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              
              {!isForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-red-500 hover:bg-red-600 text-white"
                disabled={isLoading}
              >
                {isLoading 
                  ? (isForgotPassword ? "Enviando..." : "Entrando...")
                  : (isForgotPassword ? "Enviar Email" : "Entrar")}
              </Button>

              <div className="text-center mt-4 space-y-2">
                {!isForgotPassword && (
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-sm text-cyan-400 hover:text-cyan-300 block w-full"
                  >
                    Esqueci minha senha
                  </button>
                )}

                {isForgotPassword && (
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(false)}
                    className="text-sm text-slate-400 hover:text-slate-300 block w-full"
                  >
                    Voltar para login
                  </button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAuth;
