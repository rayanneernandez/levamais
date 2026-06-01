import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Mail, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Turnstile } from "@marsidev/react-turnstile";
import logoWhite from "@/assets/logo-white.png";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PasswordStrengthAlert } from "@/components/client/PasswordStrengthAlert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { LIMITS, cleanEmail } from "@/lib/input-sanitization";

// Validação de CPF
const isValidCPF = (cpf: string) => {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  let remainder = 11 - (sum % 11);
  let digit = remainder >= 10 ? 0 : remainder;
  if (digit !== parseInt(cleanCPF.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  remainder = 11 - (sum % 11);
  digit = remainder >= 10 ? 0 : remainder;
  return digit === parseInt(cleanCPF.charAt(10));
};

// Schema para login tradicional
const loginSchema = z.object({
  cpf: z.string()
    .min(1, "CPF é obrigatório")
    .transform(val => val.replace(/\D/g, ''))
    .refine(val => val.length === 11, "CPF deve ter 11 dígitos")
    .refine(isValidCPF, "CPF inválido"),
  password: z.string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .max(LIMITS.PASSWORD, `Senha deve ter no máximo ${LIMITS.PASSWORD} caracteres`)
});

// Schema para login OTP (apenas CPF)
const otpLoginSchema = z.object({
  cpf: z.string()
    .min(1, "CPF é obrigatório")
    .transform(val => val.replace(/\D/g, ''))
    .refine(val => val.length === 11, "CPF deve ter 11 dígitos")
    .refine(isValidCPF, "CPF inválido")
});

type LoginFormData = z.infer<typeof loginSchema>;
type OTPLoginFormData = z.infer<typeof otpLoginSchema>;

const ClientAuth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [passwordCheck, setPasswordCheck] = useState<{isPwned: boolean; timesFound: number; severity: string} | null>(null);
  const [isCheckingPassword, setIsCheckingPassword] = useState(false);
  const [showPasswordWarning, setShowPasswordWarning] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<any>(null);
  
  // Estados para login OTP
  const [otpStep, setOtpStep] = useState<'cpf' | 'code'>('cpf');
  const [otpCode, setOtpCode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpCpf, setOtpCpf] = useState("");
  
  const { toast } = useToast();

  // Check if user is already logged in and redirect
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/levacliente');
      }
    };
    checkAuth();
  }, [navigate]);

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const otpForm = useForm<OTPLoginFormData>({
    resolver: zodResolver(otpLoginSchema),
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
        setShowPasswordWarning(true);
      } else {
        setPasswordCheck(null);
        setShowPasswordWarning(false);
      }
    } catch (error) {
      console.error('Erro ao verificar senha:', error);
    } finally {
      setIsCheckingPassword(false);
    }
  };

  const handleForgotPassword = async () => {
    const sanitizedEmail = cleanEmail(forgotPasswordEmail, LIMITS.EMAIL);
    if (!sanitizedEmail || !sanitizedEmail.includes('@')) {
      toast({
        title: 'Email inválido',
        description: 'Por favor, insira um email válido.',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingReset(true);
    
    try {
      const { error } = await supabase.functions.invoke('client-forgot-password', {
        body: { email: sanitizedEmail },
      });

      if (error) throw error;

      toast({
        title: 'Email enviado!',
        description: 'Verifique sua caixa de entrada para redefinir sua senha.',
      });
      
      setShowForgotPassword(false);
      setForgotPasswordEmail("");
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao enviar email de recuperação.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleLogin = async (data: LoginFormData) => {
    if (!turnstileToken) {
      toast({
        title: 'Verificação necessária',
        description: 'Por favor, complete a verificação de segurança.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Call edge function to get email (bypasses RLS)
      const { data: loginData, error: loginError } = await supabase.functions.invoke('client-login', {
        body: {
          cpf: data.cpf,
          password: data.password,
        },
      });

      // Extrair mensagem - quando edge function retorna 400, a mensagem vem em loginData.error
      const errorMessage = loginData?.error || loginError?.message || '';
      
      console.log('Debug login:', { loginData, loginError, errorMessage });
      
      // Verificar se é erro de primeiro acesso
      if (errorMessage.includes('PRIMEIRO_ACESSO')) {
        toast({
          title: "Primeiro Acesso Detectado",
          description: "Seu CPF já está cadastrado. Complete os dados para criar sua senha.",
          duration: 6000,
        });
        
        const email = window.prompt('📧 Digite seu email para criar sua conta:');
        if (!email) {
          throw new Error('Email é necessário para o primeiro acesso');
        }
        
        const phone = window.prompt('📱 Digite seu telefone (opcional):');
        
        // Chamar função de primeiro registro
        const { data: regData, error: regError } = await supabase.functions.invoke('client-first-registration', {
          body: {
            cpf: data.cpf,
            password: data.password,
            email,
            phone: phone || undefined
          }
        });

        if (regError) throw regError;
        if (!regData?.success) {
          throw new Error(regData?.error || 'Erro ao completar cadastro');
        }

        // Login automático após registro
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: regData.email,
          password: data.password
        });

        if (signInError) throw signInError;

        toast({
          title: "✅ Conta criada com sucesso!",
          description: "Sua senha foi definida. Bem-vindo ao Leva+!",
        });

        navigate('/levacliente');
        return;
      }

      // Se não é primeiro acesso e tem erro, lançar
      if (loginError || !loginData?.success) {
        throw new Error(errorMessage || 'Erro ao fazer login');
      }

      if (!loginData?.success) {
        throw new Error(loginData?.error || 'Erro ao buscar dados do usuário');
      }

      // Sign in with email and password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: data.password,
      });
      
      if (signInError) {
        throw new Error('CPF ou senha incorretos');
      }

      toast({
        title: "Login realizado com sucesso!",
        description: `Bem-vindo de volta, ${loginData.name}!`,
      });
      
      navigate('/levacliente');
    } catch (error: any) {
      toast({
        title: 'Erro no login',
        description: error.message,
        variant: 'destructive',
      });
      // Reset Turnstile to allow user to try again
      setTurnstileToken(null);
      if (turnstileRef.current) {
        turnstileRef.current.reset();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Função para enviar código OTP
  const handleSendOTPCode = async (data: OTPLoginFormData) => {
    setIsLoading(true);
    try {
      // Limpar CPF removendo formatação
      const cleanCPF = data.cpf.replace(/\D/g, '');
      
      console.log('Enviando código para CPF:', cleanCPF);
      
      const { data: result, error } = await supabase.functions.invoke('send-client-login-code', {
        body: { cpf: cleanCPF }
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);

      setOtpCpf(cleanCPF);
      setMaskedEmail(result.email);
      setOtpStep('code');
      
      toast({
        title: "Código enviado!",
        description: `Verifique seu email: ${result.email}`,
      });
    } catch (error: any) {
      console.error("Erro ao enviar código:", error);
      toast({
        title: "Erro ao enviar código",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Função para verificar código OTP e fazer login
  const handleVerifyOTPCode = async () => {
    if (otpCode.length !== 6) {
      toast({
        title: "Código incompleto",
        description: "Digite os 6 dígitos do código",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('verify-client-login-code', {
        body: { cpf: otpCpf, code: otpCode }
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);

      // Usar o magic link retornado para fazer login
      if (result.magicLink) {
        // Extrair o token do magic link
        const url = new URL(result.magicLink);
        const token = url.searchParams.get('token');
        const type = url.searchParams.get('type');
        
        if (token && type) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type as any
          });

          if (verifyError) throw verifyError;

          toast({
            title: "Login realizado com sucesso!",
            description: "Redirecionando...",
          });

          navigate('/levacliente');
        } else {
          throw new Error("Token inválido");
        }
      }
    } catch (error: any) {
      console.error("Erro ao verificar código:", error);
      toast({
        title: "Código inválido",
        description: error.message || "Verifique o código e tente novamente",
        variant: "destructive",
      });
      setOtpCode("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex flex-col items-center justify-center gap-3 mb-2">
            <img src={logoWhite} alt="Leva+" className="h-12" />
            <h1 className="text-2xl font-bold text-white">Portal do Cliente</h1>
          </div>
          <p className="text-slate-400">Acumule e resgate seus pontos/cashback</p>
        </div>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Bem-vindo de volta!</CardTitle>
            <CardDescription>
              Escolha como deseja acessar sua conta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="password" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="password" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Com Senha
                </TabsTrigger>
                <TabsTrigger value="otp" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Com Código
                </TabsTrigger>
              </TabsList>

              {/* Login tradicional com senha */}
              <TabsContent value="password">
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-cpf" className="text-white">CPF</Label>
                <Input
                  id="login-cpf"
                  type="text"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  {...loginForm.register("cpf")}
                  onChange={(e) => {
                    e.target.value = formatCPF(e.target.value);
                    loginForm.setValue("cpf", e.target.value);
                  }}
                  className="bg-slate-800 border-slate-700 text-white"
                />
                {loginForm.formState.errors.cpf && (
                  <p className="text-sm text-red-400">{loginForm.formState.errors.cpf.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-white">Senha</Label>
                <Input
                  id="login-password"
                  type="password"
                  maxLength={LIMITS.PASSWORD}
                  {...loginForm.register("password")}
                  onChange={(e) => {
                    loginForm.setValue("password", e.target.value);
                    checkPasswordSecurity(e.target.value);
                  }}
                  className="bg-slate-800 border-slate-700 text-white"
                />
                {loginForm.formState.errors.password && (
                  <p className="text-sm text-red-400">{loginForm.formState.errors.password.message}</p>
                )}
                {isCheckingPassword && (
                  <p className="text-xs text-slate-400">🔍 Verificando segurança...</p>
                )}
              </div>

              {showPasswordWarning && passwordCheck && (
                <PasswordStrengthAlert
                  isPwned={passwordCheck.isPwned}
                  timesFound={passwordCheck.timesFound}
                  severity={passwordCheck.severity as any}
                />
              )}

              <div className="space-y-2">
                <Label className="text-white text-sm">Verificação de segurança</Label>
                <div className="flex justify-center bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                  <Turnstile
                    ref={turnstileRef}
                    siteKey="0x4AAAAAAB74xByz5s7hy9rh"
                    onSuccess={(token) => setTurnstileToken(token)}
                    onError={() => setTurnstileToken(null)}
                    onExpire={() => setTurnstileToken(null)}
                    options={{
                      theme: "dark",
                      size: "normal",
                    }}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                disabled={isLoading || !turnstileToken}
              >
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-purple-400 hover:text-purple-300 underline"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                </form>
              </TabsContent>

              {/* Login com código OTP */}
              <TabsContent value="otp">
                {otpStep === 'cpf' ? (
                  <form onSubmit={otpForm.handleSubmit(handleSendOTPCode)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="otp-cpf" className="text-white">CPF</Label>
                      <Input
                        id="otp-cpf"
                        type="text"
                        placeholder="000.000.000-00"
                        maxLength={14}
                        {...otpForm.register("cpf")}
                        onChange={(e) => {
                          e.target.value = formatCPF(e.target.value);
                          otpForm.setValue("cpf", e.target.value);
                        }}
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                      {otpForm.formState.errors.cpf && (
                        <p className="text-sm text-red-400">{otpForm.formState.errors.cpf.message}</p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                      disabled={isLoading}
                    >
                      {isLoading ? "Enviando..." : "Enviar código por email"}
                    </Button>

                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-slate-300">
                          Enviaremos um código de 6 dígitos para o email cadastrado no seu CPF.
                        </p>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-white">Código de verificação</Label>
                      <p className="text-sm text-slate-400 mb-4">
                        Digite o código de 6 dígitos enviado para <span className="text-white font-medium">{maskedEmail}</span>
                      </p>
                      <div className="flex justify-center">
                        <InputOTP
                          maxLength={6}
                          value={otpCode}
                          onChange={setOtpCode}
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        onClick={handleVerifyOTPCode}
                        className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                        disabled={isLoading || otpCode.length !== 6}
                      >
                        {isLoading ? "Verificando..." : "Verificar e entrar"}
                      </Button>
                      
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setOtpStep('cpf');
                          setOtpCode("");
                          setMaskedEmail("");
                        }}
                        className="w-full text-slate-400 hover:text-white"
                        disabled={isLoading}
                      >
                        Voltar
                      </Button>
                    </div>

                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-slate-300 space-y-1">
                          <p>O código expira em 5 minutos.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setOtpStep('cpf');
                              otpForm.handleSubmit(handleSendOTPCode)();
                            }}
                            className="text-purple-400 hover:text-purple-300 underline"
                            disabled={isLoading}
                          >
                            Não recebeu? Reenviar código
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="mt-6 pt-6 border-t border-slate-700">
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-300">
                    <span className="font-semibold text-white">Novo por aqui?</span> O cadastro é feito nos postos e lojas parceiras da Leva+.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Recuperação de Senha */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Recuperar Senha</DialogTitle>
            <DialogDescription className="text-slate-400">
              Digite seu email para receber as instruções de recuperação de senha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email" className="text-white">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="seu@email.com"
                maxLength={LIMITS.EMAIL}
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotPasswordEmail("");
                }}
                className="flex-1"
                disabled={isSendingReset}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleForgotPassword}
                className="flex-1 bg-purple-500 hover:bg-purple-600 text-white"
                disabled={isSendingReset}
              >
                {isSendingReset ? "Enviando..." : "Enviar Email"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientAuth;
