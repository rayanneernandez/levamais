import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, Mail, Phone, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OnboardingDialog } from "./OnboardingDialog";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { LIMITS, cleanText, cleanEmail } from "@/lib/input-sanitization";

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
  full_name: z.string().trim().min(3, "Nome completo é obrigatório").max(LIMITS.NAME, `Máximo de ${LIMITS.NAME} caracteres`),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(LIMITS.EMAIL, `Máximo de ${LIMITS.EMAIL} caracteres`),
  phone: z.string().trim().min(10, "Telefone inválido").max(LIMITS.PHONE, `Máximo de ${LIMITS.PHONE} caracteres`),
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

interface ProfileEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientData: any;
  userId: string;
  onUpdate: () => void;
}

export function ProfileEditDialog({
  open,
  onOpenChange,
  clientData,
  userId,
  onUpdate,
}: ProfileEditDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [showValidation, setShowValidation] = useState(false);
  const [originalEmail, setOriginalEmail] = useState("");
  const [originalPhone, setOriginalPhone] = useState("");
  const [needsEmailValidation, setNeedsEmailValidation] = useState(false);
  const [needsPhoneValidation, setNeedsPhoneValidation] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { toast } = useToast();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: clientData?.full_name || "",
      email: clientData?.email || "",
      phone: clientData?.phone || "",
      address_country: clientData?.address_country || "Brasil",
      address_zip: clientData?.address_zip || "",
      address_street: clientData?.address_street || "",
      address_number: clientData?.address_number || "",
      address_complement: clientData?.address_complement || "",
      address_neighborhood: clientData?.address_neighborhood || "",
      address_city: clientData?.address_city || "",
      address_state: clientData?.address_state || "",
    },
  });

  useEffect(() => {
    if (clientData) {
      setOriginalEmail(clientData.email || "");
      setOriginalPhone(clientData.phone || "");
      form.reset({
        full_name: clientData.full_name || "",
        email: clientData.email || "",
        phone: clientData.phone || "",
        address_country: clientData.address_country || "Brasil",
        address_zip: clientData.address_zip || "",
        address_street: clientData.address_street || "",
        address_number: clientData.address_number || "",
        address_complement: clientData.address_complement || "",
        address_neighborhood: clientData.address_neighborhood || "",
        address_city: clientData.address_city || "",
        address_state: clientData.address_state || "",
      });
      if (clientData.address_state) {
        loadCities(clientData.address_state);
      }
    }
  }, [clientData]);

  const formatCPF = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length <= 11) {
      return cleaned
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})/, "$1-$2")
        .replace(/(-\d{2})\d+?$/, "$1");
    }
    return cpf;
  };

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

  const handleSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);
    try {
      const emailChanged = data.email !== originalEmail;
      const phoneChanged = data.phone !== originalPhone;

      const updateData: any = {
        full_name: cleanText(data.full_name, LIMITS.NAME),
        email: cleanEmail(data.email, LIMITS.EMAIL),
        phone: cleanText(data.phone, LIMITS.PHONE),
        address_country: cleanText(data.address_country, LIMITS.STATE),
        address_zip: cleanText(data.address_zip, LIMITS.CEP),
        address_street: cleanText(data.address_street, LIMITS.ADDRESS),
        address_number: cleanText(data.address_number, 20),
        address_complement: cleanText(data.address_complement, LIMITS.SHORT_TEXT),
        address_neighborhood: cleanText(data.address_neighborhood, LIMITS.CITY),
        address_city: cleanText(data.address_city, LIMITS.CITY),
        address_state: cleanText(data.address_state, LIMITS.STATE),
      };

      // Se mudou email ou telefone, marcar como não validado
      if (emailChanged) {
        updateData.email_validated = false;
        setNeedsEmailValidation(true);
      }
      if (phoneChanged) {
        updateData.phone_validated = false;
        setNeedsPhoneValidation(true);
      }

      const { error } = await supabase
        .from("clients")
        .update(updateData)
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Cadastro atualizado!",
        description: emailChanged || phoneChanged
          ? "Por favor, valide seus novos dados de contato."
          : "Suas informações foram atualizadas com sucesso.",
      });

      if (emailChanged || phoneChanged) {
        onOpenChange(false);
        setShowValidation(true);
      } else {
        onOpenChange(false);
        onUpdate();
      }
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar cadastro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cadastro</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input maxLength={LIMITS.NAME} {...form.register("full_name")} />
              {form.formState.errors.full_name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.full_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={formatCPF(clientData?.cpf || "")} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">CPF não pode ser alterado</p>
            </div>

            <div className="space-y-2">
              <Label>E-mail</Label>
              <div className="flex items-center gap-2">
                <Input maxLength={LIMITS.EMAIL} {...form.register("email")} type="email" className="flex-1" />
                {clientData?.email_validated && form.watch("email") === originalEmail && (
                  <Badge variant="secondary" className="text-xs">Validado</Badge>
                )}
              </div>
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
              {form.watch("email") !== originalEmail && (
                <p className="text-xs text-amber-600">
                  Ao alterar o e-mail, você precisará validá-lo novamente.
                </p>
              )}
              {!clientData?.email_validated && form.watch("email") === originalEmail && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    setShowValidation(true);
                    setNeedsEmailValidation(true);
                  }}
                >
                  Validar e-mail agora
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label>Telefone</Label>
              <div className="flex items-center gap-2">
                <Input maxLength={LIMITS.PHONE} {...form.register("phone")} className="flex-1" />
                {clientData?.phone_validated && form.watch("phone") === originalPhone && (
                  <Badge variant="secondary" className="text-xs">Validado</Badge>
                )}
              </div>
              {form.formState.errors.phone && (
                <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
              )}
              {form.watch("phone") !== originalPhone && (
                <p className="text-xs text-amber-600">
                  Ao alterar o telefone, você precisará validá-lo novamente.
                </p>
              )}
              {!clientData?.phone_validated && form.watch("phone") === originalPhone && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    setShowValidation(true);
                    setNeedsPhoneValidation(true);
                  }}
                >
                  Validar telefone agora
                </Button>
              )}
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-4">Endereço</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>CEP (opcional)</Label>
                  <Input
                    placeholder="00000-000"
                    maxLength={9}
                    {...form.register("address_zip")}
                    onChange={(e) => handleCepChange(e.target.value)}
                  />
                  {form.formState.errors.address_zip && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.address_zip.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rua (opcional)</Label>
                    <Input maxLength={LIMITS.ADDRESS} {...form.register("address_street")} />
                    {form.formState.errors.address_street && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.address_street.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Número (opcional)</Label>
                    <Input maxLength={20} {...form.register("address_number")} />
                    {form.formState.errors.address_number && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.address_number.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
              <Label>Complemento (opcional)</Label>
              <Input maxLength={LIMITS.SHORT_TEXT} {...form.register("address_complement")} />
                </div>

                <div className="space-y-2">
                  <Label>Bairro (opcional)</Label>
                  <Input maxLength={LIMITS.CITY} {...form.register("address_neighborhood")} />
                  {form.formState.errors.address_neighborhood && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.address_neighborhood.message}
                    </p>
                  )}
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
                    <p className="text-sm text-destructive">
                      {form.formState.errors.address_country.message}
                    </p>
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
                      <p className="text-sm text-destructive">
                        {form.formState.errors.address_state.message}
                      </p>
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
                      <p className="text-sm text-destructive">
                        {form.formState.errors.address_city.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowChangePassword(true)}
                className="flex-1"
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Mudar Senha
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ChangePasswordDialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
      />

      {showValidation && userId && (
        <OnboardingDialog
          open={showValidation}
          userId={userId}
          userEmail={form.getValues("email")}
          userPhone={form.getValues("phone")}
          onComplete={() => {
            setShowValidation(false);
            onUpdate();
          }}
          skipProfileStep={true}
        />
      )}
    </>
  );
}
