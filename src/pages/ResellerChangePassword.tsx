import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { LoadingPage } from "@/components/ui/loading-page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import logoDark from "@/assets/logo-dark.png";

const ResellerChangePassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/levarevendedor/auth");
        return;
      }

      // Verificar se é um revendedor
      const { data: reseller, error: resellerError } = await supabase
        .from("resellers")
        .select("id")
        .eq("email", session.user.email)
        .maybeSingle();

      if (resellerError) {
        console.error("Erro ao verificar revendedor:", resellerError);
        navigate("/levarevendedor/auth");
        return;
      }

      if (!reseller) {
        await supabase.auth.signOut();
        navigate("/levarevendedor/auth");
        return;
      }

      // Verificar se ainda precisa trocar a senha
      const { data: profile } = await supabase
        .from("profiles")
        .select("force_password_change")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!profile?.force_password_change) {
        navigate("/levarevendedor/dashboard");
      }

    } catch (error) {
      console.error("Erro ao verificar usuário:", error);
      navigate("/levarevendedor/auth");
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Erro",
        description: "A senha deve ter no mínimo 8 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (newPassword === "Global@2025") {
      toast({
        title: "Erro",
        description: "Você não pode usar a senha padrão",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      // Atualizar flag de troca de senha
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ force_password_change: false })
          .eq("id", user.id);

        if (profileError) throw profileError;
      }

      toast({
        title: "Senha alterada com sucesso",
        description: "Você será redirecionado para o painel",
      });

      setTimeout(() => {
        navigate("/levarevendedor/dashboard");
      }, 1500);

    } catch (error: any) {
      console.error("Erro ao alterar senha:", error);
      toast({
        title: "Erro ao alterar senha",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
            <CardTitle className="text-2xl text-center">Trocar Senha</CardTitle>
            <CardDescription className="text-center">
              Por segurança, você deve alterar sua senha padrão
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Esta é sua primeira vez acessando o sistema. Por favor, escolha uma nova senha segura.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Mínimo de 8 caracteres
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Alterando..." : "Alterar Senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResellerChangePassword;
