import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, CheckCircle2, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ForcePasswordChangeProps {
  onPasswordChanged: () => void;
}

export function ForcePasswordChange({ onPasswordChanged }: ForcePasswordChangeProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Validações de senha
  const hasMinLength = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword !== "";
  
  const isValidPassword = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidPassword) {
      toast({
        title: "Senha inválida",
        description: "A senha não atende a todos os requisitos de segurança.",
        variant: "destructive",
      });
      return;
    }

    if (!passwordsMatch) {
      toast({
        title: "Senhas não conferem",
        description: "A confirmação de senha não corresponde à nova senha.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Atualizar senha no Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      // Atualizar flag no perfil
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ force_password_change: false })
          .eq('id', user.id);

        if (profileError) throw profileError;
      }

      toast({
        title: "Senha alterada com sucesso!",
        description: "Você pode continuar usando o sistema.",
      });

      onPasswordChanged();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar senha",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const ValidationItem = ({ valid, text }: { valid: boolean; text: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {valid ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={valid ? "text-green-600" : "text-muted-foreground"}>
        {text}
      </span>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Troca de Senha Obrigatória</CardTitle>
          </div>
          <CardDescription>
            Por segurança, você precisa alterar sua senha temporária antes de continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertDescription>
              Sua senha atual é temporária e precisa ser alterada para garantir a segurança da sua conta.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Digite sua nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Digite novamente sua nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            {/* Validações */}
            <div className="space-y-2 p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Requisitos de Senha:</p>
              <ValidationItem valid={hasMinLength} text="Mínimo de 8 caracteres" />
              <ValidationItem valid={hasUpperCase} text="Pelo menos uma letra maiúscula" />
              <ValidationItem valid={hasLowerCase} text="Pelo menos uma letra minúscula" />
              <ValidationItem valid={hasNumber} text="Pelo menos um número" />
              <ValidationItem valid={hasSpecialChar} text="Pelo menos um caractere especial" />
              {confirmPassword && (
                <ValidationItem valid={passwordsMatch} text="Senhas conferem" />
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!isValidPassword || !passwordsMatch || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Alterando senha...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Alterar Senha
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
