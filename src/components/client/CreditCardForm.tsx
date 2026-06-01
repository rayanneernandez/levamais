import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { CreditCard, Loader2, AlertCircle, CheckCircle2, XCircle, Shield, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CreditCardPreview } from "./CreditCardPreview";

interface CreditCardFormProps {
  onSubmit: (data: CreditCardFormData) => Promise<void>;
  isLoading: boolean;
}

export interface CreditCardFormData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  province: string;
  city: string;
  state: string;
}

export default function CreditCardForm({ onSubmit, isLoading }: CreditCardFormProps) {
  const [formData, setFormData] = useState<CreditCardFormData>({
    holderName: "",
    number: "",
    expiryMonth: "",
    expiryYear: "",
    ccv: "",
    postalCode: "",
    address: "",
    addressNumber: "",
    province: "",
    city: "",
    state: ""
  });

  const [errors, setErrors] = useState<Partial<CreditCardFormData>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof CreditCardFormData, boolean>>>({});
  const [loadingCep, setLoadingCep] = useState(false);
  const [showErrorSummary, setShowErrorSummary] = useState(false);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  // Buscar endereço automaticamente quando CEP tiver 8 dígitos
  useEffect(() => {
    const cepLimpo = formData.postalCode.replace(/\D/g, "");
    
    if (cepLimpo.length === 8) {
      buscarEnderecoPorCep(cepLimpo);
    }
  }, [formData.postalCode]);

  const buscarEnderecoPorCep = async (cep: string) => {
    setLoadingCep(true);
    try {
      const { data, error } = await supabase.functions.invoke('buscar-cep', {
        body: { cep }
      });

      if (error) throw error;

      if (data) {
        setFormData(prev => ({
          ...prev,
          address: data.logradouro || "",
          province: data.bairro || "",
          city: data.municipio || "",
          state: data.uf || ""
        }));
        
        toast.success("Endereço encontrado!");
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      toast.error("CEP não encontrado");
    } finally {
      setLoadingCep(false);
    }
  };

  const handleChange = (field: keyof CreditCardFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));
    // Limpar erro do campo ao digitar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    // Esconder resumo de erros quando usuário começar a corrigir
    if (showErrorSummary) {
      setShowErrorSummary(false);
    }
  };

  const handleBlur = (field: keyof CreditCardFormData) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(" ");
    } else {
      return value;
    }
  };

  const handleCardNumberChange = (value: string) => {
    const formatted = formatCardNumber(value);
    handleChange("number", formatted);
  };

  const formatCEP = (value: string) => {
    const v = value.replace(/\D/g, "");
    if (v.length <= 5) return v;
    return `${v.slice(0, 5)}-${v.slice(5, 8)}`;
  };

  const handleCEPChange = (value: string) => {
    const formatted = formatCEP(value);
    handleChange("postalCode", formatted);
  };

  const validate = (): boolean => {
    const newErrors: Partial<CreditCardFormData> = {};

    if (!formData.holderName.trim()) {
      newErrors.holderName = "Nome obrigatório";
    }

    const cardNumber = formData.number.replace(/\s/g, "");
    if (!cardNumber || cardNumber.length < 13 || cardNumber.length > 19) {
      newErrors.number = "Número inválido";
    }

    if (!formData.expiryMonth || parseInt(formData.expiryMonth) < 1 || parseInt(formData.expiryMonth) > 12) {
      newErrors.expiryMonth = "Mês inválido";
    }

    const currentYear = new Date().getFullYear() % 100;
    if (!formData.expiryYear || parseInt(formData.expiryYear) < currentYear) {
      newErrors.expiryYear = "Ano inválido";
    }

    if (!formData.ccv || formData.ccv.length < 3) {
      newErrors.ccv = "CVV inválido";
    }

    if (!formData.postalCode || formData.postalCode.replace(/\D/g, "").length !== 8) {
      newErrors.postalCode = "CEP inválido";
    }

    if (!formData.address.trim()) {
      newErrors.address = "Endereço obrigatório";
    }

    if (!formData.addressNumber.trim()) {
      newErrors.addressNumber = "Número obrigatório";
    }

    if (!formData.province.trim()) {
      newErrors.province = "Bairro obrigatório";
    }

    if (!formData.city.trim()) {
      newErrors.city = "Cidade obrigatória";
    }

    if (!formData.state.trim() || formData.state.length !== 2) {
      newErrors.state = "UF inválida";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📝 Form submit iniciado');
    
    // Marcar todos os campos como touched
    const allTouched = Object.keys(formData).reduce((acc, key) => {
      acc[key as keyof CreditCardFormData] = true;
      return acc;
    }, {} as Record<keyof CreditCardFormData, boolean>);
    setTouched(allTouched);
    
    if (!validate()) {
      console.log('❌ Validação falhou');
      setShowErrorSummary(true);
      toast.error("Por favor, corrija os erros no formulário");
      return;
    }

    console.log('✅ Validação passou, preparando dados...');
    setShowErrorSummary(false);

    // Limpar formatação antes de enviar
    const cleanData = {
      ...formData,
      number: formData.number.replace(/\s/g, ""),
      postalCode: formData.postalCode.replace(/\D/g, ""),
      state: formData.state.toUpperCase()
    };

    console.log('📤 Enviando dados limpos para onSubmit');
    await onSubmit(cleanData);
  };

  const getFieldState = (field: keyof CreditCardFormData): 'default' | 'error' | 'success' => {
    if (errors[field] && touched[field]) return 'error';
    if (!errors[field] && touched[field] && formData[field]) return 'success';
    return 'default';
  };

  const FieldIcon = ({ field }: { field: keyof CreditCardFormData }) => {
    const state = getFieldState(field);
    if (state === 'error') return <XCircle className="h-4 w-4 text-destructive" />;
    if (state === 'success') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    return null;
  };

  const errorCount = Object.keys(errors).length;

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Preview do Cartão - Desktop */}
      <div className="hidden lg:block space-y-6">
        <div className="sticky top-8">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Preview do Cartão</h3>
            <CreditCardPreview
              holderName={formData.holderName}
              number={formData.number}
              expiryMonth={formData.expiryMonth}
              expiryYear={formData.expiryYear}
              cvv={formData.ccv}
              isFlipped={isCardFlipped}
            />
          </div>

          {/* Badges de Segurança */}
          <Card className="p-6 mt-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-green-900 dark:text-green-100">
                    Pagamento 100% Seguro
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-300">
                    Seus dados estão protegidos
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                <Lock className="h-4 w-4" />
                <span>Criptografia SSL 256-bit</span>
              </div>

              {/* Bandeiras aceitas */}
              <div className="pt-4 border-t border-green-200 dark:border-green-800">
                <div className="text-xs text-green-700 dark:text-green-300 mb-2">
                  Bandeiras aceitas:
                </div>
                <div className="flex gap-3 items-center">
                  <div className="px-3 py-1.5 bg-white dark:bg-slate-900 rounded text-xs font-semibold">
                    VISA
                  </div>
                  <div className="px-3 py-1.5 bg-white dark:bg-slate-900 rounded text-xs font-semibold">
                    MASTER
                  </div>
                  <div className="px-3 py-1.5 bg-white dark:bg-slate-900 rounded text-xs font-semibold">
                    ELO
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Preview Mobile */}
        <div className="lg:hidden space-y-4">
          <CreditCardPreview
            holderName={formData.holderName}
            number={formData.number}
            expiryMonth={formData.expiryMonth}
            expiryYear={formData.expiryYear}
            cvv={formData.ccv}
            isFlipped={isCardFlipped}
          />
          
          {/* Badge de Segurança Mobile */}
          <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 p-3 rounded-lg">
            <Shield className="h-4 w-4" />
            <span>Pagamento 100% Seguro</span>
          </div>
        </div>

        {/* Resumo de Erros */}
        {showErrorSummary && errorCount > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Atenção!</strong> {errorCount} campo{errorCount > 1 ? 's precisam' : ' precisa'} ser corrigido{errorCount > 1 ? 's' : ''} antes de continuar.
            </AlertDescription>
          </Alert>
        )}

        {/* Dados do Cartão */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Dados do Cartão
          </h3>

        <div className="space-y-2">
          <Label htmlFor="holderName" className="flex items-center justify-between">
            <span>Nome no Cartão</span>
            <FieldIcon field="holderName" />
          </Label>
          <Input
            id="holderName"
            placeholder="Como está impresso no cartão"
            value={formData.holderName}
            onChange={(e) => handleChange("holderName", e.target.value.toUpperCase())}
            onBlur={() => handleBlur("holderName")}
            disabled={isLoading}
            className={cn(
              errors.holderName && touched.holderName && "border-destructive focus-visible:ring-destructive",
              !errors.holderName && touched.holderName && formData.holderName && "border-green-500 focus-visible:ring-green-500"
            )}
          />
          {errors.holderName && touched.holderName && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              {errors.holderName}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="number" className="flex items-center justify-between">
            <span>Número do Cartão</span>
            <FieldIcon field="number" />
          </Label>
          <Input
            id="number"
            placeholder="0000 0000 0000 0000"
            value={formData.number}
            onChange={(e) => handleCardNumberChange(e.target.value)}
            onBlur={() => handleBlur("number")}
            maxLength={19}
            disabled={isLoading}
            className={cn(
              errors.number && touched.number && "border-destructive focus-visible:ring-destructive",
              !errors.number && touched.number && formData.number && "border-green-500 focus-visible:ring-green-500"
            )}
          />
          {errors.number && touched.number && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              {errors.number}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="expiryMonth" className="flex items-center justify-between">
              <span>Mês</span>
              <FieldIcon field="expiryMonth" />
            </Label>
            <Input
              id="expiryMonth"
              placeholder="MM"
              value={formData.expiryMonth}
              onChange={(e) => handleChange("expiryMonth", e.target.value)}
              onBlur={() => handleBlur("expiryMonth")}
              maxLength={2}
              disabled={isLoading}
              className={cn(
                errors.expiryMonth && touched.expiryMonth && "border-destructive focus-visible:ring-destructive",
                !errors.expiryMonth && touched.expiryMonth && formData.expiryMonth && "border-green-500 focus-visible:ring-green-500"
              )}
            />
            {errors.expiryMonth && touched.expiryMonth && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {errors.expiryMonth}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiryYear" className="flex items-center justify-between">
              <span>Ano</span>
              <FieldIcon field="expiryYear" />
            </Label>
            <Input
              id="expiryYear"
              placeholder="AA"
              value={formData.expiryYear}
              onChange={(e) => handleChange("expiryYear", e.target.value)}
              onBlur={() => handleBlur("expiryYear")}
              maxLength={2}
              disabled={isLoading}
              className={cn(
                errors.expiryYear && touched.expiryYear && "border-destructive focus-visible:ring-destructive",
                !errors.expiryYear && touched.expiryYear && formData.expiryYear && "border-green-500 focus-visible:ring-green-500"
              )}
            />
            {errors.expiryYear && touched.expiryYear && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {errors.expiryYear}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ccv" className="flex items-center justify-between">
              <span>CVV</span>
              <FieldIcon field="ccv" />
            </Label>
            <Input
              id="ccv"
              placeholder="123"
              value={formData.ccv}
              onChange={(e) => handleChange("ccv", e.target.value)}
              onFocus={() => setIsCardFlipped(true)}
              onBlur={() => {
                setIsCardFlipped(false);
                handleBlur("ccv");
              }}
              maxLength={4}
              type="password"
              disabled={isLoading}
              className={cn(
                errors.ccv && touched.ccv && "border-destructive focus-visible:ring-destructive",
                !errors.ccv && touched.ccv && formData.ccv && "border-green-500 focus-visible:ring-green-500"
              )}
            />
            {errors.ccv && touched.ccv && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {errors.ccv}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Endereço de Cobrança */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-lg font-semibold">Endereço de Cobrança</h3>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="postalCode" className="flex items-center justify-between">
              <span>CEP</span>
              <FieldIcon field="postalCode" />
            </Label>
            <div className="relative">
              <Input
                id="postalCode"
                placeholder="00000-000"
                value={formData.postalCode}
                onChange={(e) => handleCEPChange(e.target.value)}
                onBlur={() => handleBlur("postalCode")}
                maxLength={9}
                disabled={isLoading || loadingCep}
                className={cn(
                  errors.postalCode && touched.postalCode && "border-destructive focus-visible:ring-destructive",
                  !errors.postalCode && touched.postalCode && formData.postalCode && "border-green-500 focus-visible:ring-green-500"
                )}
              />
              {loadingCep && (
                <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {errors.postalCode && touched.postalCode && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {errors.postalCode}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-3 space-y-2">
            <Label htmlFor="address" className="flex items-center justify-between">
              <span>Endereço</span>
              <FieldIcon field="address" />
            </Label>
            <Input
              id="address"
              placeholder="Rua, Avenida, etc"
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
              onBlur={() => handleBlur("address")}
              disabled={isLoading || loadingCep}
              className={cn(
                errors.address && touched.address && "border-destructive focus-visible:ring-destructive",
                !errors.address && touched.address && formData.address && "border-green-500 focus-visible:ring-green-500"
              )}
            />
            {errors.address && touched.address && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {errors.address}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressNumber" className="flex items-center justify-between">
              <span>Número</span>
              <FieldIcon field="addressNumber" />
            </Label>
            <Input
              id="addressNumber"
              placeholder="123"
              value={formData.addressNumber}
              onChange={(e) => handleChange("addressNumber", e.target.value)}
              onBlur={() => handleBlur("addressNumber")}
              disabled={isLoading}
              className={cn(
                errors.addressNumber && touched.addressNumber && "border-destructive focus-visible:ring-destructive",
                !errors.addressNumber && touched.addressNumber && formData.addressNumber && "border-green-500 focus-visible:ring-green-500"
              )}
              autoFocus={formData.address !== ""}
            />
            {errors.addressNumber && touched.addressNumber && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {errors.addressNumber}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="province" className="flex items-center justify-between">
            <span>Bairro</span>
            <FieldIcon field="province" />
          </Label>
          <Input
            id="province"
            placeholder="Nome do bairro"
            value={formData.province}
            onChange={(e) => handleChange("province", e.target.value)}
            onBlur={() => handleBlur("province")}
            disabled={isLoading || loadingCep}
            className={cn(
              errors.province && touched.province && "border-destructive focus-visible:ring-destructive",
              !errors.province && touched.province && formData.province && "border-green-500 focus-visible:ring-green-500"
            )}
          />
          {errors.province && touched.province && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              {errors.province}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="city" className="flex items-center justify-between">
              <span>Cidade</span>
              <FieldIcon field="city" />
            </Label>
            <Input
              id="city"
              placeholder="Nome da cidade"
              value={formData.city}
              onChange={(e) => handleChange("city", e.target.value)}
              onBlur={() => handleBlur("city")}
              disabled={isLoading || loadingCep}
              className={cn(
                errors.city && touched.city && "border-destructive focus-visible:ring-destructive",
                !errors.city && touched.city && formData.city && "border-green-500 focus-visible:ring-green-500"
              )}
            />
            {errors.city && touched.city && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {errors.city}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="state" className="flex items-center justify-between">
              <span>UF</span>
              <FieldIcon field="state" />
            </Label>
            <Input
              id="state"
              placeholder="SP"
              value={formData.state}
              onChange={(e) => handleChange("state", e.target.value.toUpperCase())}
              onBlur={() => handleBlur("state")}
              maxLength={2}
              disabled={isLoading || loadingCep}
              className={cn(
                errors.state && touched.state && "border-destructive focus-visible:ring-destructive",
                !errors.state && touched.state && formData.state && "border-green-500 focus-visible:ring-green-500"
              )}
            />
            {errors.state && touched.state && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {errors.state}
              </p>
            )}
          </div>
        </div>
      </div>

        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processando Pagamento...
            </>
          ) : (
            <>
              <Lock className="mr-2 h-5 w-5" />
              Confirmar Pagamento Seguro
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Ao confirmar, você concorda com os{" "}
          <a href="/termos-de-uso.html" target="_blank" className="underline hover:text-foreground">
            termos de uso
          </a>
        </p>
      </form>
    </div>
  );
}
