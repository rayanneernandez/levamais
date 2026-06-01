import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { differenceInYears } from "date-fns";
import { Loader2, CheckCircle2, Mail, Phone, Award } from "lucide-react";
import { LIMITS, cleanText } from "@/lib/input-sanitization";

const ESTADOS_BRASILEIROS = [
  { uf: "AC", nome: "Acre" },
  { uf: "AL", nome: "Alagoas" },
  { uf: "AP", nome: "Amapá" },
  { uf: "AM", nome: "Amazonas" },
  { uf: "BA", nome: "Bahia" },
  { uf: "CE", nome: "Ceará" },
  { uf: "DF", nome: "Distrito Federal" },
  { uf: "ES", nome: "Espírito Santo" },
  { uf: "GO", nome: "Goiás" },
  { uf: "MA", nome: "Maranhão" },
  { uf: "MT", nome: "Mato Grosso" },
  { uf: "MS", nome: "Mato Grosso do Sul" },
  { uf: "MG", nome: "Minas Gerais" },
  { uf: "PA", nome: "Pará" },
  { uf: "PB", nome: "Paraíba" },
  { uf: "PR", nome: "Paraná" },
  { uf: "PE", nome: "Pernambuco" },
  { uf: "PI", nome: "Piauí" },
  { uf: "RJ", nome: "Rio de Janeiro" },
  { uf: "RN", nome: "Rio Grande do Norte" },
  { uf: "RS", nome: "Rio Grande do Sul" },
  { uf: "RO", nome: "Rondônia" },
  { uf: "RR", nome: "Roraima" },
  { uf: "SC", nome: "Santa Catarina" },
  { uf: "SP", nome: "São Paulo" },
  { uf: "SE", nome: "Sergipe" },
  { uf: "TO", nome: "Tocantins" },
];

const PAISES = [
  "Brasil",
  "Argentina",
  "Uruguai",
  "Paraguai",
  "Chile",
  "Colômbia",
  "Peru",
  "Bolívia",
  "Venezuela",
  "Equador",
  "Estados Unidos",
  "Canadá",
  "México",
  "Portugal",
  "Espanha",
  "Itália",
  "França",
  "Alemanha",
  "Reino Unido",
  "China",
  "Japão",
  "Outro",
];

const profileSchema = z.object({
  birth_date: z.string().refine((date) => {
    const birthDate = new Date(date);
    const age = differenceInYears(new Date(), birthDate);
    return age >= 18;
  }, "Você deve ter pelo menos 18 anos"),
  address_country: z.string().trim().min(3, "País é obrigatório").max(LIMITS.STATE),
  address_state: z.string().trim().min(2, "Estado é obrigatório").max(LIMITS.STATE),
  address_city: z.string().trim().min(3, "Cidade é obrigatória").max(LIMITS.CITY),
  address_zip: z.string().trim().max(LIMITS.CEP).optional().or(z.literal("")),
  address_street: z.string().trim().max(LIMITS.ADDRESS).optional().or(z.literal("")),
  address_number: z.string().trim().max(20).optional().or(z.literal("")),
  address_complement: z.string().trim().max(LIMITS.SHORT_TEXT).optional().or(z.literal("")),
  address_neighborhood: z.string().trim().max(LIMITS.CITY).optional().or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface OnboardingDialogProps {
  open: boolean;
  userId: string;
  userEmail: string;
  userPhone: string;
  onComplete: () => void;
  skipProfileStep?: boolean;
  emailValidated?: boolean;
  phoneValidated?: boolean;
  canClose?: boolean;
}

export function OnboardingDialog({ 
  open, 
  userId, 
  userEmail, 
  userPhone,
  onComplete,
  skipProfileStep = false,
  emailValidated = false,
  phoneValidated = false,
  canClose = true
}: OnboardingDialogProps) {
  // Determinar passo inicial baseado no que já está validado
  const getInitialStep = () => {
    if (!skipProfileStep) return 0;
    if (!emailValidated) return 2; // Ir para validação de email
    if (!phoneValidated) return 3; // Ir para validação de telefone
    return 4; // Tudo validado
  };

  const [step, setStep] = useState(getInitialStep());
  const [isLoading, setIsLoading] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [sentEmailCode, setSentEmailCode] = useState("");
  const [sentPhoneCode, setSentPhoneCode] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const { toast } = useToast();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      address_country: "Brasil",
      address_state: "",
      address_city: "",
      address_zip: "",
      address_street: "",
      address_number: "",
      address_complement: "",
      address_neighborhood: "",
    },
  });

  const progress = step === 0 ? 0 : ((step / 4) * 100);

  const handleCepChange = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    form.setValue("address_zip", cleanCep);

    if (cleanCep.length === 8) {
      setIsLoading(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();

        if (!data.erro) {
          form.setValue("address_street", data.logradouro);
          form.setValue("address_neighborhood", data.bairro);
          form.setValue("address_city", data.localidade);
          form.setValue("address_state", data.uf);
          await loadCities(data.uf);
          
          toast({
            title: "Endereço encontrado!",
            description: "Os campos foram preenchidos automaticamente.",
          });
        }
      } catch (error) {
        console.error("Error fetching CEP:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const loadCities = async (uf: string) => {
    try {
      const response = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
      );
      const data = await response.json();
      const cityNames = data.map((city: any) => city.nome).sort();
      setCities(cityNames);
    } catch (error) {
      console.error("Error loading cities:", error);
    }
  };

  const handleStateChange = (uf: string) => {
    form.setValue("address_state", uf);
    form.setValue("address_city", "");
    loadCities(uf);
  };

  const handleCompleteProfile = async (data: ProfileFormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          birth_date: data.birth_date,
          address_zip: cleanText(data.address_zip, LIMITS.CEP),
          address_street: cleanText(data.address_street, LIMITS.ADDRESS),
          address_number: cleanText(data.address_number, 20),
          address_complement: cleanText(data.address_complement, LIMITS.SHORT_TEXT),
          address_neighborhood: cleanText(data.address_neighborhood, LIMITS.CITY),
          address_city: cleanText(data.address_city, LIMITS.CITY),
          address_state: cleanText(data.address_state, LIMITS.STATE),
          address_country: cleanText(data.address_country, LIMITS.STATE),
        })
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Cadastro completado!",
        description: "Suas informações foram salvas com sucesso.",
      });
      
      setStep(2);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendEmailVerification = async () => {
    setIsLoading(true);
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setSentEmailCode(code);

      const { error } = await supabase.functions.invoke('send-client-email-verification', {
        body: { email: userEmail, code },
      });

      if (error) throw error;

      toast({
        title: "Código enviado!",
        description: "Verifique seu e-mail.",
      });
    } catch (error: any) {
      console.error('Erro ao enviar código de verificação:', error);
      toast({
        title: "Erro ao enviar código",
        description: error.message || "Não foi possível enviar o código. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyEmailCode = async () => {
    if (emailCode === sentEmailCode) {
      setIsLoading(true);
      try {
        const { error } = await supabase
          .from("clients")
          .update({ email_validated: true })
          .eq("user_id", userId);

        if (error) throw error;

        toast({
          title: "E-mail verificado!",
          description: "Seu e-mail foi confirmado com sucesso.",
        });
        
        setStep(3);
      } catch (error: any) {
        toast({
          title: "Erro ao verificar e-mail",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      toast({
        title: "Código inválido",
        description: "O código digitado não está correto.",
        variant: "destructive",
      });
    }
  };

  const sendPhoneVerification = async () => {
    setIsLoading(true);
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setSentPhoneCode(code);

      const { error } = await supabase.functions.invoke('send-sms-verification', {
        body: { phone: userPhone, code },
      });

      if (error) throw error;

      toast({
        title: "Código enviado!",
        description: "Verifique seu celular.",
      });
    } catch (error: any) {
      console.error("Erro ao enviar SMS:", error);
      toast({
        title: "Erro ao enviar código",
        description: error.message || "Não foi possível enviar o SMS. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyPhoneCode = async () => {
    if (phoneCode === sentPhoneCode) {
      setIsLoading(true);
      try {
        const { error } = await supabase
          .from("clients")
          .update({ 
            phone_validated: true,
            is_validated: true // Marca como validado ao concluir o onboarding
          })
          .eq("user_id", userId);

        if (error) throw error;

        toast({
          title: "Celular verificado!",
          description: "Seu telefone foi confirmado com sucesso.",
        });
        
        setStep(4);
        setTimeout(onComplete, 2000);
      } catch (error: any) {
        toast({
          title: "Erro ao verificar telefone",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      toast({
        title: "Código inválido",
        description: "O código digitado não está correto.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={canClose ? onComplete : undefined}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto" 
        onInteractOutside={(e) => {
          if (!canClose) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (!canClose) e.preventDefault();
        }}
      >
        {step === 0 ? (
          <div className="text-center py-8 space-y-6">
            <div className="flex justify-center mb-6">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center animate-scale-in">
                <Award className="h-12 w-12 text-white" />
              </div>
            </div>
            
            <div className="space-y-3 animate-fade-in">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Bem-vindo ao Leva+ Fidelidade!
              </h2>
              <p className="text-lg text-muted-foreground max-w-md mx-auto">
                Comece a acumular pontos em cada compra e troque por recompensas incríveis!
              </p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                🎁 Ganhe pontos a cada compra<br/>
                🎯 Resgate recompensas exclusivas<br/>
                ⭐ Aproveite ofertas especiais
              </p>
            </div>

            <Button 
              onClick={() => setStep(1)} 
              size="lg"
              className="mt-8 bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
            >
              Vamos completar seu cadastro!
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Complete seu cadastro</DialogTitle>
              <Progress value={progress} className="mt-2" />
              <p className="text-sm text-muted-foreground mt-2">
                Passo {step} de 4
              </p>
            </DialogHeader>

            {step === 1 && (
              <form onSubmit={form.handleSubmit(handleCompleteProfile)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <Input
                    type="date"
                    {...form.register("birth_date")}
                    max={new Date().toISOString().split('T')[0]}
                  />
                  {form.formState.errors.birth_date && (
                    <p className="text-sm text-destructive">{form.formState.errors.birth_date.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>CEP (opcional)</Label>
                  <Input
                    placeholder="00000-000"
                    maxLength={9}
                    {...form.register("address_zip")}
                    onChange={(e) => handleCepChange(e.target.value)}
                  />
                  {form.formState.errors.address_zip && (
                    <p className="text-sm text-destructive">{form.formState.errors.address_zip.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rua (opcional)</Label>
                    <Input maxLength={LIMITS.ADDRESS} {...form.register("address_street")} />
                    {form.formState.errors.address_street && (
                      <p className="text-sm text-destructive">{form.formState.errors.address_street.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Número (opcional)</Label>
                    <Input maxLength={20} {...form.register("address_number")} />
                    {form.formState.errors.address_number && (
                      <p className="text-sm text-destructive">{form.formState.errors.address_number.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Bairro (opcional)</Label>
                  <Input maxLength={LIMITS.CITY} {...form.register("address_neighborhood")} />
                  {form.formState.errors.address_neighborhood && (
                    <p className="text-sm text-destructive">{form.formState.errors.address_neighborhood.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Complemento (opcional)</Label>
                  <Input maxLength={LIMITS.SHORT_TEXT} {...form.register("address_complement")} />
                </div>

                <div className="space-y-2">
                  <Label>País *</Label>
                  <Select
                    value={form.watch("address_country")}
                    onValueChange={(value) => form.setValue("address_country", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o país" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAISES.map((pais) => (
                        <SelectItem key={pais} value={pais}>
                          {pais}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.address_country && (
                    <p className="text-sm text-destructive">{form.formState.errors.address_country.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Estado *</Label>
                    <Select
                      value={form.watch("address_state")}
                      onValueChange={handleStateChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADOS_BRASILEIROS.map((estado) => (
                          <SelectItem key={estado.uf} value={estado.uf}>
                            {estado.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.address_state && (
                      <p className="text-sm text-destructive">{form.formState.errors.address_state.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Cidade *</Label>
                    <Select
                      value={form.watch("address_city")}
                      onValueChange={(value) => form.setValue("address_city", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map((city) => (
                          <SelectItem key={city} value={city}>
                            {city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.address_city && (
                      <p className="text-sm text-destructive">{form.formState.errors.address_city.message}</p>
                    )}
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continuar
                </Button>
              </form>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <Mail className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="font-semibold">Verificar E-mail</h3>
                    <p className="text-sm text-muted-foreground">{userEmail}</p>
                  </div>
                </div>

                {!sentEmailCode ? (
                  <Button onClick={sendEmailVerification} className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enviar Código
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Digite o código enviado para seu e-mail</Label>
                      <Input
                        placeholder="000000"
                        maxLength={6}
                        value={emailCode}
                        onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={verifyEmailCode} className="flex-1" disabled={isLoading || emailCode.length !== 6}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Verificar
                      </Button>
                      <Button variant="outline" onClick={sendEmailVerification} disabled={isLoading}>
                        Reenviar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <Phone className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="font-semibold">Verificar Celular</h3>
                    <p className="text-sm text-muted-foreground">{userPhone}</p>
                  </div>
                </div>

                {!sentPhoneCode ? (
                  <Button onClick={sendPhoneVerification} className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enviar Código via SMS
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Digite o código enviado para seu celular</Label>
                      <Input
                        placeholder="000000"
                        maxLength={6}
                        value={phoneCode}
                        onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={verifyPhoneCode} className="flex-1" disabled={isLoading || phoneCode.length !== 6}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Verificar
                      </Button>
                      <Button variant="outline" onClick={sendPhoneVerification} disabled={isLoading}>
                        Reenviar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="text-center py-8">
                <CheckCircle2 className="h-16 w-16 text-secondary mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">Tudo pronto!</h3>
                <p className="text-muted-foreground">
                  Seu cadastro foi completado com sucesso.
                </p>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
