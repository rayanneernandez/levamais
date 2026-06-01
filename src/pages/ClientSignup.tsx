import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, User, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TermsOfUseDialog } from "@/components/client/TermsOfUseDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordStrengthAlert } from "@/components/client/PasswordStrengthAlert";
import { LIMITS, cleanText, cleanEmail } from "@/lib/input-sanitization";

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

// Função para capitalizar nome
const capitalizeName = (name: string) => {
  return name
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Schema para cadastro
const signupSchema = z.object({
  name: z.string()
    .min(3, "Nome deve ter no mínimo 3 caracteres")
    .max(100, "Nome muito longo")
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, "Nome deve conter apenas letras")
    .transform(val => val.trim())
    .refine(val => val.split(/\s+/).length >= 2, "Digite nome e sobrenome")
    .transform(capitalizeName),
  cpf: z.string()
    .min(1, "CPF é obrigatório")
    .transform(val => val.replace(/\D/g, ''))
    .refine(val => val.length === 11, "CPF deve ter 11 dígitos")
    .refine(isValidCPF, "CPF inválido"),
  email: z.string()
    .min(1, "E-mail é obrigatório")
    .transform(val => val.trim().toLowerCase())
    .pipe(z.string().email("E-mail inválido").max(LIMITS.EMAIL, `E-mail deve ter no máximo ${LIMITS.EMAIL} caracteres`)),
  phone: z.string()
    .min(1, "Telefone é obrigatório")
    .transform(val => val.replace(/\D/g, ''))
    .refine(val => val.length === 11, "Telefone deve ter DDD + 9 dígitos (ex: 21995071007)"),
  password: z.string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .max(LIMITS.PASSWORD, `Senha deve ter no máximo ${LIMITS.PASSWORD} caracteres`),
  acceptTerms: z.preprocess(
    (val) => {
      if (val === true || val === "on") return true;
      return false;
    },
    z.boolean().refine(val => val === true, "Você deve aceitar os termos de uso")
  )
});

type SignupFormData = z.infer<typeof signupSchema>;

const ClientSignup = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [countryCode, setCountryCode] = useState("+55");
  const [attendantName, setAttendantName] = useState<string>("");
  const [storeName, setStoreName] = useState<string>("");
  const [referrerName, setReferrerName] = useState<string>("");
  const [passwordCheck, setPasswordCheck] = useState<{isPwned: boolean; timesFound: number; severity: string} | null>(null);
  const [isCheckingPassword, setIsCheckingPassword] = useState(false);
  const { toast } = useToast();

  // Capturar parâmetros da URL (do QR Code)
  const urlParams = new URLSearchParams(window.location.search);
  const attendantId = urlParams.get('attendant');
  const storeId = urlParams.get('store');
  const referrerId = urlParams.get('ref'); // Cliente indicador

  // Verificar se tem parâmetros válidos, senão redireciona
  useEffect(() => {
    // Permite cadastro se tem (attendant E store) OU apenas ref (indicação)
    if (!referrerId && (!attendantId || !storeId)) {
      toast({
        title: 'Acesso negado',
        description: 'Cadastro apenas via QR Code com atendente ou link de indicação.',
        variant: 'destructive',
      });
      navigate('/levacliente/auth');
    }
  }, [attendantId, storeId, referrerId, navigate, toast]);

  // Buscar informações do atendente e loja
  useEffect(() => {
    const loadQRCodeInfo = async () => {
      console.log('URL Params:', { attendantId, storeId, referrerId });
      
      if (attendantId) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', attendantId)
          .single();
        
        if (profileData) {
          setAttendantName(profileData.full_name);
        }
      }

      if (storeId) {
        const { data: storeData } = await supabase
          .from('stores')
          .select('name')
          .eq('id', storeId)
          .single();
        
        if (storeData) {
          setStoreName(storeData.name);
        }
      }

      if (referrerId) {
        try {
          const { data: refInfo, error } = await supabase.functions.invoke('get-referrer-info', {
            body: { referrer_id: referrerId },
          });
          
          if (!error && refInfo?.success && refInfo.referrer_name) {
            setReferrerName(refInfo.referrer_name);
          }
        } catch (err) {
          console.error('Erro ao buscar indicador:', err);
        }
      }
    };

    loadQRCodeInfo();
  }, [attendantId, storeId, referrerId]);

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 2)}${numbers.slice(2)}`;
    return `${numbers.slice(0, 2)}${numbers.slice(2, 7)}${numbers.slice(7, 11)}`;
  };

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  // Verificar senha contra vazamentos quando usuario digita
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

  const handleSignup = async (data: SignupFormData) => {
    setIsLoading(true);
    
    try {
      // Check if CPF already exists
      const { data: existingClientByCPF } = await supabase
        .from('clients')
        .select('id')
        .eq('cpf', data.cpf)
        .maybeSingle();
      
      if (existingClientByCPF) {
        throw new Error('Este CPF já está cadastrado. Use "Esqueci minha senha" se necessário.');
      }

      // Check if email already exists
      const { data: existingClientByEmail } = await supabase
        .from('clients')
        .select('id')
        .eq('email', data.email)
        .maybeSingle();
      
      if (existingClientByEmail) {
        throw new Error('Este e-mail já está cadastrado. Use "Esqueci minha senha" se necessário.');
      }

      // Sanitiza dados antes de qualquer envio
      const cleanName = cleanText(data.name, LIMITS.NAME);
      const cleanedEmail = cleanEmail(data.email, LIMITS.EMAIL);

      // Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanedEmail,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/levacliente`,
          data: {
            full_name: cleanName,
          },
        },
      });
      
      if (authError) throw authError;
      if (!authData.user) throw new Error('Erro ao criar usuário');

      // Update profile with additional data
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: cleanName,
          email: cleanedEmail,
          phone: data.phone,
          cpf: data.cpf,
        })
        .eq('id', authData.user.id);
      
      if (profileError) {
        console.error('Error updating profile:', profileError);
      }

      // Create client record with country code + phone
      const fullPhone = `${countryCode}${data.phone}`;
      
      // Se há indicação, buscar dados do indicador
      let referrerData = null;
      let referralNetworkId = null;
      if (referrerId) {
        const { data: referrer } = await supabase
          .from('clients')
          .select('id, favorite_network_id, network_id')
          .eq('id', referrerId)
          .single();
        
        if (referrer && referrer.favorite_network_id) {
          referrerData = referrer;
          referralNetworkId = referrer.favorite_network_id;
          
          // Verificar limite de indicações
          const { count } = await supabase
            .from('client_referrals')
            .select('*', { count: 'exact', head: true })
            .eq('referrer_client_id', referrerId);

          const { data: networkForLimit } = await supabase
            .from('networks')
            .select('referral_max_uses')
            .eq('id', referralNetworkId)
            .single();
          
          const maxUses = (networkForLimit as any)?.referral_max_uses || 0;
          
          if (maxUses > 0 && count && count >= maxUses) {
            throw new Error(`Este link de indicação já atingiu o limite máximo de ${maxUses} indicações.`);
          }
        }
      }
      
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .insert({
          user_id: authData.user.id,
          cpf: data.cpf,
          full_name: cleanName,
          email: cleanedEmail,
          phone: fullPhone,
          referred_by_user_id: referrerId || attendantId || null,
          registered_by_attendant_id: referrerId ? null : attendantId || null, // Se foi indicação, não tem atendente
          registered_at_store_id: storeId || null,
          network_id: referralNetworkId || null, // Se foi indicação, já entra na rede
          favorite_network_id: referralNetworkId || null, // Mesma rede favorita do indicador
        })
        .select()
        .single();
      
      if (clientError) {
        console.error('Error creating client record:', clientError);
        throw new Error('Erro ao criar registro de cliente. Entre em contato com o suporte.');
      }

      // Assign client role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'client',
        });
      
      if (roleError) {
        console.error('Error assigning client role:', roleError);
        throw new Error('Erro ao atribuir permissões. Entre em contato com o suporte.');
      }

      // Vincular cliente à rede e aplicar bônus
      try {
        let targetNetworkId = referralNetworkId; // Rede do indicador tem prioridade
        let targetStore = null;
        
        if (storeId && !referralNetworkId) {
          const { data } = await supabase
            .from('stores')
            .select('id, network_id, signup_bonus_points, signup_bonus_cashback, loyalty_type')
            .eq('id', storeId)
            .eq('status', 'active')
            .single();
          
          targetStore = data;
          targetNetworkId = data?.network_id;
        }

        // Buscar configurações da rede para aplicar bônus
        if (targetNetworkId && clientData) {
          const { data: networkConfig } = await supabase
            .from('networks')
            .select('referral_enabled, referral_bonus_type, referral_bonus_referrer, referral_bonus_referred')
            .eq('id', targetNetworkId)
            .single();

          // Se veio de loja e não tem indicação
          if (targetStore && !referrerId) {
            // Vincular cliente à rede da loja
            await supabase
              .from('clients')
              .update({ 
                network_id: targetNetworkId,
                favorite_network_id: targetNetworkId
              })
              .eq('id', clientData.id);

            let bonusApplied = false;

            // Apply points bonus
            if (targetStore.loyalty_type === 'points' && targetStore.signup_bonus_points && targetStore.signup_bonus_points > 0) {
              await supabase
                .from('clients')
                .update({ 
                  total_points: (clientData.total_points || 0) + targetStore.signup_bonus_points 
                })
                .eq('id', clientData.id);
              bonusApplied = true;
            }

            // Apply cashback bonus  
            if (targetStore.loyalty_type === 'cashback' && targetStore.signup_bonus_cashback && targetStore.signup_bonus_cashback > 0) {
              await supabase
                .from('clients')
                .update({ 
                  total_points: (clientData.total_points || 0) + targetStore.signup_bonus_cashback 
                })
                .eq('id', clientData.id);
              bonusApplied = true;
            }

            // Log bonus transaction if bonus was applied
            if (bonusApplied) {
              const bonusAmount = targetStore.loyalty_type === 'points' 
                ? targetStore.signup_bonus_points 
                : targetStore.signup_bonus_cashback;

              await supabase
                .from('transactions')
                .insert({
                  client_id: clientData.id,
                  store_id: targetStore.id,
                  type: 'accumulation',
                  points: bonusAmount || 0,
                  amount: 0,
                  description: '🎁 Bônus de boas-vindas!',
                });
            }
          }

          // Se foi indicação, criar registro pendente (bônus será aplicado na primeira compra)
          if (referrerId && referrerData && networkConfig?.referral_enabled) {
            const bonusAmount = networkConfig.referral_bonus_referred || 0;

            // Criar registro de indicação como PENDENTE
            await supabase
              .from('client_referrals')
              .insert({
                referrer_client_id: referrerId,
                referred_client_id: clientData.id,
                network_id: targetNetworkId,
                bonus_type: networkConfig.referral_bonus_type || 'cashback',
                referrer_bonus_amount: networkConfig.referral_bonus_referrer || 0,
                referred_bonus_amount: bonusAmount,
                bonus_applied: false, // Será aplicado na primeira compra
              });
          }
        }
      } catch (bonusError) {
        console.error('Error applying signup bonus:', bonusError);
      }

      // Send welcome email
      try {
        await supabase.functions.invoke('send-welcome-email', {
          body: {
            name: cleanName,
            email: cleanedEmail,
            cpf: data.cpf,
          },
        });
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError);
      }

      toast({
        title: "Cadastro realizado com sucesso!",
        description: "Sua conta foi criada. Redirecionando...",
      });
      
      navigate('/levacliente');
    } catch (error: any) {
      toast({
        title: 'Erro no cadastro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => navigate("/levacliente/auth")}
            className="mb-4 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          
          <div className="flex items-center justify-center gap-2 mb-2">
            <User className="h-8 w-8 text-purple-400" />
            <h1 className="text-3xl font-bold">
              <span className="text-white">Leva</span>
              <span className="text-cyan-400">+</span>
              <span className="text-white"> Cliente</span>
            </h1>
          </div>
          {referrerName ? (
            <p className="text-slate-400">Cadastro via indicação</p>
          ) : (
            <p className="text-slate-400">Cadastro via atendente</p>
          )}
        </div>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Novo Cadastro</CardTitle>
            <CardDescription>Preencha seus dados para começar a acumular pontos</CardDescription>
            
            {referrerName && (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                <UserCheck className="h-4 w-4 text-cyan-400" />
                <span>Você foi convidado por</span>
                <span className="font-semibold text-cyan-400">{referrerName}</span>
              </div>
            )}

            {attendantName && !referrerName && (
              <Alert className="mt-4 bg-purple-500/10 border-purple-500/50">
                <UserCheck className="h-4 w-4 text-purple-400" />
                <AlertDescription className="text-sm text-purple-200">
                  Você está sendo cadastrado por{" "}
                  <span className="font-semibold">{attendantName}</span>
                  {storeName && ` na loja ${storeName}`}
                </AlertDescription>
              </Alert>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name" className="text-white">Nome Completo</Label>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="Seu nome completo"
                  maxLength={LIMITS.NAME}
                  {...signupForm.register("name")}
                  className="bg-slate-800 border-slate-700 text-white"
                />
                {signupForm.formState.errors.name && (
                  <p className="text-sm text-red-400">{signupForm.formState.errors.name.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-cpf" className="text-white">CPF</Label>
                <Input
                  id="signup-cpf"
                  type="text"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  {...signupForm.register("cpf")}
                  onChange={(e) => {
                    e.target.value = formatCPF(e.target.value);
                    signupForm.setValue("cpf", e.target.value);
                  }}
                  className="bg-slate-800 border-slate-700 text-white"
                />
                {signupForm.formState.errors.cpf && (
                  <p className="text-sm text-red-400">{signupForm.formState.errors.cpf.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-white">E-mail</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="seu@email.com"
                  maxLength={LIMITS.EMAIL}
                  {...signupForm.register("email")}
                  className="bg-slate-800 border-slate-700 text-white"
                />
                {signupForm.formState.errors.email && (
                  <p className="text-sm text-red-400">{signupForm.formState.errors.email.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-phone" className="text-white">Telefone</Label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white rounded-md px-3 py-2 w-24"
                  >
                    <option value="+55">🇧🇷 +55</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+351">🇵🇹 +351</option>
                  </select>
                  <Input
                    id="signup-phone"
                    type="tel"
                    placeholder="21999999999"
                    maxLength={11}
                    {...signupForm.register("phone")}
                    onChange={(e) => {
                      e.target.value = formatPhone(e.target.value);
                      signupForm.setValue("phone", e.target.value);
                    }}
                    className="bg-slate-800 border-slate-700 text-white flex-1"
                  />
                </div>
                {signupForm.formState.errors.phone && (
                  <p className="text-sm text-red-400">{signupForm.formState.errors.phone.message}</p>
                )}
                <p className="text-xs text-slate-400">
                  DDD + número celular (ex: 21999999999)
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-white">Senha</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  maxLength={LIMITS.PASSWORD}
                  {...signupForm.register("password")}
                  onChange={(e) => {
                    signupForm.setValue("password", e.target.value);
                    checkPasswordSecurity(e.target.value);
                  }}
                  className="bg-slate-800 border-slate-700 text-white"
                />
                {signupForm.formState.errors.password && (
                  <p className="text-sm text-red-400">{signupForm.formState.errors.password.message}</p>
                )}
                {isCheckingPassword && (
                  <p className="text-xs text-slate-400">🔍 Verificando segurança da senha...</p>
                )}
                {passwordCheck && (
                  <PasswordStrengthAlert
                    isPwned={passwordCheck.isPwned}
                    timesFound={passwordCheck.timesFound}
                    severity={passwordCheck.severity as any}
                  />
                )}
              </div>

              <div className="space-y-3 bg-slate-800/50 backdrop-blur-sm p-4 rounded-lg border border-purple-500/20">
                <div className="text-center space-y-1">
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => setShowTermsDialog(true)}
                      className="text-purple-400 hover:text-purple-300 underline font-medium transition-colors"
                    >
                      Termo de Uso
                    </button>
                    <span className="text-slate-400">e</span>
                    <button
                      type="button"
                      onClick={() => setShowTermsDialog(true)}
                      className="text-purple-400 hover:text-purple-300 underline font-medium transition-colors"
                    >
                      Política de Privacidade
                    </button>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="terms"
                    checked={signupForm.watch("acceptTerms")}
                    onCheckedChange={(checked) => {
                      signupForm.setValue("acceptTerms", checked === true);
                    }}
                    className="border-purple-300 data-[state=checked]:bg-purple-500 data-[state=checked]:text-white mt-0.5"
                  />
                  <label htmlFor="terms" className="text-xs text-slate-200 cursor-pointer leading-relaxed">
                    Li e concordo integralmente com o Termo de Uso e a Política de Privacidade do Programa Leva+, autorizando o tratamento de meus dados pessoais para execução do programa de fidelidade, comunicação via e-mail, SMS e WhatsApp, e análises estatísticas, conforme a LGPD.
                  </label>
                </div>

                {signupForm.formState.errors.acceptTerms && (
                  <p className="text-sm text-red-400 mt-2 text-center">
                    {signupForm.formState.errors.acceptTerms.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                disabled={isLoading}
              >
                {isLoading ? "Cadastrando..." : "Criar Conta"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <TermsOfUseDialog 
        open={showTermsDialog} 
        onOpenChange={setShowTermsDialog}
      />
    </div>
  );
};

export default ClientSignup;
