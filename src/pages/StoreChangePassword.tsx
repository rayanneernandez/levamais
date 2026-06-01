import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Store, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LIMITS } from "@/lib/input-sanitization";

const changePasswordSchema = z.object({
  newPassword: z.string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .max(LIMITS.PASSWORD, `Senha deve ter no máximo ${LIMITS.PASSWORD} caracteres`)
    .regex(/[A-Z]/, "Senha deve conter ao menos uma letra maiúscula")
    .regex(/[a-z]/, "Senha deve conter ao menos uma letra minúscula")
    .regex(/[0-9]/, "Senha deve conter ao menos um número")
    .regex(/[@$!%*?&#]/, "Senha deve conter ao menos um caractere especial (@$!%*?&#)"),
  confirmPassword: z.string().max(LIMITS.PASSWORD, `Senha deve ter no máximo ${LIMITS.PASSWORD} caracteres`)
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

const StoreChangePassword = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingPassword, setIsCheckingPassword] = useState(false);
  const [passwordCheck, setPasswordCheck] = useState<any>(null);
  const { toast } = useToast();

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const checkPasswordSecurity = async (password: string) => {
    if (!password || password.length < 8) {
      setPasswordCheck(null);
      return;
    }

    setIsCheckingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-pwned-password', {
        body: { password },
      });

      if (error) throw error;
      
      if (data.isPwned) {
        setPasswordCheck(data);
      } else {
        setPasswordCheck(null);
      }
    } catch (error) {
      console.error('Erro ao verificar senha:', error);
    } finally {
      setIsCheckingPassword(false);
    }
  };

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'newPassword' && value.newPassword) {
        checkPasswordSecurity(value.newPassword);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const handleChangePassword = async (data: ChangePasswordFormData) => {
    setIsLoading(true);
    
    try {
      // Atualizar senha
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.newPassword
      });

      if (updateError) throw updateError;

      // Atualizar flag must_change_password para todos os registros do usuário
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { error: flagError } = await supabase
          .from('store_managers')
          .update({ must_change_password: false })
          .eq('user_id', user.id)
          .is('store_id', null);

        if (flagError) {
          console.error('Erro ao atualizar flag:', flagError);
          throw flagError;
        }
      }

      toast({
        title: "Senha alterada com sucesso!",
        description: "Você será redirecionado para o portal.",
      });
      
      navigate("/levaloja");
    } catch (error: any) {
      toast({
        title: "Erro ao alterar senha",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Store className="h-8 w-8 text-cyan-400" />
            <h1 className="text-3xl font-bold">
              <span className="text-white">Leva</span>
              <span className="text-cyan-400">+</span>
              <span className="text-white"> Loja</span>
            </h1>
          </div>
          <p className="text-slate-400">Primeiro acesso - Alterar senha</p>
        </div>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Troca de Senha Obrigatória</CardTitle>
            <CardDescription>Por segurança, você precisa alterar sua senha no primeiro acesso</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(handleChangePassword)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-white">Nova Senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  maxLength={LIMITS.PASSWORD}
                  {...form.register("newPassword")}
                  className="bg-slate-800 border-slate-700 text-white"
                />
                {form.formState.errors.newPassword && (
                  <p className="text-sm text-red-400">{form.formState.errors.newPassword.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white">Confirmar Nova Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  maxLength={LIMITS.PASSWORD}
                  {...form.register("confirmPassword")}
                  className="bg-slate-800 border-slate-700 text-white"
                />
                {form.formState.errors.confirmPassword && (
                  <p className="text-sm text-red-400">{form.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              {passwordCheck && (
                <Alert variant="destructive" className="bg-red-900/20 border-red-800">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    ⚠️ Senha comprometida! Esta senha foi encontrada em {passwordCheck.timesFound.toLocaleString()} vazamentos de dados.
                    Por favor, escolha uma senha mais segura.
                  </AlertDescription>
                </Alert>
              )}

              <div className="bg-slate-800 p-3 rounded text-sm text-slate-300">
                <p className="font-semibold mb-1">A senha deve conter:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Mínimo 8 caracteres</li>
                  <li>Uma letra maiúscula</li>
                  <li>Uma letra minúscula</li>
                  <li>Um número</li>
                  <li>Um caractere especial (@$!%*?&#)</li>
                </ul>
              </div>

              <Button
                type="submit"
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                disabled={isLoading}
              >
                {isLoading ? "Alterando..." : "Alterar Senha"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StoreChangePassword;
