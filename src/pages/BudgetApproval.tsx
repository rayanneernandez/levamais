import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Loader2, FileText, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { LoadingPage } from "@/components/ui/loading-page";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function BudgetApproval() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [budget, setBudget] = useState<any>(null);
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [action, setAction] = useState<'approve' | 'decline' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  // Totais calculados
  const [totalUnique, setTotalUnique] = useState(0);
  const [totalRecurring, setTotalRecurring] = useState(0);
  const [hasProducts, setHasProducts] = useState(false);
  const [hasDiscount, setHasDiscount] = useState(false);

  // Dados de aprovação
  const [approvalData, setApprovalData] = useState({
    full_name: "",
    cpf: "",
    email: "",
    position: "",
    payment_due_days: "10",
    financial_email: "",
    verification_code: "",
    billing_day: "10",
    billing_type: "per_cnpj" as 'per_cnpj' | 'single_cnpj',
    main_billing_cnpj: "",
  });

  // Controle de verificação de email
  const [emailSent, setEmailSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [canResendCode, setCanResendCode] = useState(true);

  // Dados de reprovação
  const [declineReason, setDeclineReason] = useState("");

  // Dialog de sucesso
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  useEffect(() => {
    if (!token) {
      toast({
        title: "Token inválido",
        description: "O link de aprovação é inválido ou expirou.",
        variant: "destructive",
      });
      return;
    }

    loadBudget(token);
  }, [token]);

  const loadBudget = async (budgetToken: string) => {
    try {
      const { data: budgetData, error: budgetError } = await supabase
        .from("budgets")
        .select(`
          *,
          networks (name)
        `)
        .eq("approval_token", budgetToken)
        .maybeSingle();
      
      if (budgetError) throw budgetError;
      if (!budgetData) throw new Error("Orçamento não encontrado");

      if (budgetData.status === 'approved') {
        setIsLoading(false);
        return; // Não carrega mais nada
      }

      if (budgetData.status === 'declined') {
        setSuccessMessage(`Este orçamento foi recusado. Motivo: ${budgetData.decline_reason}`);
        setShowSuccessDialog(true);
        setIsLoading(false);
        return;
      }

      setBudget(budgetData);

      // Carregar itens
      const { data: items, error: itemsError } = await supabase
        .from("budget_items")
        .select(`
          *,
          products_services (
            code,
            name,
            type,
            unit_of_measure,
            is_recurring
          )
        `)
        .eq("budget_id", budgetData.id);

      if (itemsError) throw itemsError;
      setBudgetItems(items || []);
      
      // Calcular totais
      let unique = 0;
      let recurring = 0;
      let hasProds = false;
      let hasDisc = false;
      
      (items || []).forEach((item: any) => {
        const product = item.products_services;
        if (product) {
          if (product.type === 'product') {
            hasProds = true;
          }
          if (product.is_recurring) {
            recurring += item.total_value;
          } else {
            unique += item.total_value;
          }
          if (item.discount_amount && item.discount_amount > 0) {
            hasDisc = true;
          }
        }
      });
      
      setTotalUnique(unique);
      setTotalRecurring(recurring);
      setHasProducts(hasProds);
      setHasDiscount(hasDisc);
      
      // Registrar evento de visualização da proposta
      try {
        await supabase.from("email_events").insert({
          budget_id: budgetData.id,
          event_type: "opened",
          email_to: budgetData.requester_email,
          email_subject: `Proposta Comercial ${budgetData.budget_number} - Leva+ Fidelidade`,
          occurred_at: new Date().toISOString(),
          metadata: {
            source: "budget_approval_page",
            user_agent: navigator.userAgent,
          }
        });
      } catch (openedError) {
        // Não bloquear a experiência do usuário se falhar o registro
        console.error("Erro ao registrar visualização:", openedError);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar orçamento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleSendVerificationCode = async () => {
    if (!approvalData.email) {
      toast({
        title: "Email obrigatório",
        description: "Digite seu email para receber o código de verificação",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('send-verification-email', {
        body: {
          budget_id: budget.id,
          email: approvalData.email,
        },
      });

      if (error) throw error;

      setEmailSent(true);
      setCanResendCode(false);
      
      // Permitir reenvio após 30 segundos
      setTimeout(() => {
        setCanResendCode(true);
      }, 30000);

      toast({
        title: "Código enviado",
        description: "Verifique sua caixa de entrada. O código expira em 1 minuto.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar código",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeEmail = () => {
    setEmailSent(false);
    setEmailVerified(false);
    setApprovalData({ ...approvalData, verification_code: "" });
    toast({
      title: "Email resetado",
      description: "Digite um novo email e solicite um novo código",
    });
  };

  const handleVerifyCode = async () => {
    if (!approvalData.verification_code) {
      toast({
        title: "Código obrigatório",
        description: "Digite o código recebido por email",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("budget_verification_codes")
        .select("*")
        .eq("budget_id", budget.id)
        .eq("email", approvalData.email)
        .eq("code", approvalData.verification_code)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .single();

      if (error || !data) {
        throw new Error("Código inválido ou expirado");
      }

      // Marcar como usado
      await supabase
        .from("budget_verification_codes")
        .update({ used: true, used_at: new Date().toISOString() })
        .eq("id", data.id);

      setEmailVerified(true);
      toast({
        title: "Email verificado",
        description: "Email confirmado com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Código inválido",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!emailVerified) {
      toast({
        title: "Email não verificado",
        description: "Você precisa verificar seu email antes de aprovar",
        variant: "destructive",
      });
      return;
    }

    if (!approvalData.full_name || !approvalData.cpf || !approvalData.position) {
      toast({
        title: "Dados incompletos",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (!approvalData.billing_day) {
      toast({
        title: "Dia de vencimento obrigatório",
        description: "Selecione o dia de vencimento das cobranças",
        variant: "destructive",
      });
      return;
    }

    if (approvalData.billing_type === 'single_cnpj' && !approvalData.main_billing_cnpj) {
      toast({
        title: "CNPJ principal obrigatório",
        description: "Selecione o CNPJ para faturamento consolidado",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Coletar dados de geolocalização
      let latitude = null;
      let longitude = null;

      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch {
          console.log("Geolocalização não permitida");
        }
      }

      // Enviar aprovação via edge function
      const { data, error } = await supabase.functions.invoke('approve-budget', {
        body: {
          budget_id: budget.id,
          approval_token: token,
          approved_by_name: approvalData.full_name,
          approved_by_cpf: approvalData.cpf,
          approved_by_email: approvalData.email,
          approved_by_position: approvalData.position,
          payment_due_days: parseInt(approvalData.payment_due_days),
          financial_email: approvalData.financial_email,
          billing_day: parseInt(approvalData.billing_day),
          billing_type: approvalData.billing_type,
          main_billing_cnpj: approvalData.billing_type === 'single_cnpj' ? approvalData.main_billing_cnpj : null,
          latitude,
          longitude,
        },
      });

      if (error) throw error;

      // Gerar documento de auditoria automaticamente
      toast({
        title: "Proposta aprovada!",
        description: "Gerando documento de auditoria...",
      });
      
      setTimeout(async () => {
        await handleDownloadAuditPDF();
        // Após download, limpar tudo e mostrar mensagem final
        setBudget(null);
        setAction(null);
        setIsLoading(false);
      }, 1500);
    } catch (error: any) {
      toast({
        title: "Erro ao aprovar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      toast({
        title: "Justificativa obrigatória",
        description: "Por favor, informe o motivo da recusa",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("budgets")
        .update({
          status: 'declined',
          declined_at: new Date().toISOString(),
          decline_reason: declineReason,
        })
        .eq("id", budget.id)
        .eq("approval_token", token);

      if (error) throw error;

      // Atualizar lead para "perdido" se houver lead vinculado
      if (budget.lead_id) {
        await supabase
          .from("leads")
          .update({ status: 'lost' })
          .eq("id", budget.lead_id);
      }

      setSuccessMessage("Reprovação enviada para o Comercial. Obrigado.");
      setShowSuccessDialog(true);

      if (token) {
        setTimeout(() => loadBudget(token), 2000);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao recusar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadAuditPDF = async () => {
    if (!budget) return;

    setIsGeneratingPDF(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;

      // ============= DOCUMENTO DE AUDITORIA =============
      toast({
        title: "Gerando documento de auditoria",
        description: "Processando assinaturas digitais...",
      });

      // Gerar HTML de auditoria via edge function
      const { data, error } = await supabase.functions.invoke('generate-audit-pdf', {
        body: { budget_id: budget.id },
      });

      if (error) throw error;

      // Criar elemento temporário para renderizar HTML de auditoria
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = data.html;
      tempDiv.style.width = '210mm';
      tempDiv.style.padding = '20mm';
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);

      // Capturar como canvas
      const auditCanvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      // Remover elemento temporário
      document.body.removeChild(tempDiv);

      const auditImgHeight = (auditCanvas.height * imgWidth) / auditCanvas.width;
      let auditHeightLeft = auditImgHeight;
      let auditPosition = 0;

      pdf.addImage(auditCanvas.toDataURL('image/png'), 'PNG', 0, auditPosition, imgWidth, auditImgHeight);
      auditHeightLeft -= 297;

      // Adicionar páginas adicionais se necessário
      while (auditHeightLeft > 0) {
        auditPosition = auditHeightLeft - auditImgHeight;
        pdf.addPage();
        pdf.addImage(auditCanvas.toDataURL('image/png'), 'PNG', 0, auditPosition, imgWidth, auditImgHeight);
        auditHeightLeft -= 297;
      }

      // Download do PDF de auditoria
      pdf.save(`Documento_Auditoria_${data.budget_number}.pdf`);

      toast({
        title: "Documento gerado!",
        description: "Documento de auditoria baixado com sucesso.",
      });
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro ao gerar documento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (isLoading) {
    return <LoadingPage message="Carregando proposta..." submessage="Por favor, aguarde enquanto buscamos os detalhes" />;
  }

  if (!budget) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-primary/5">
        <div className="text-center max-w-2xl mx-auto space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-6">
              <CheckCircle2 className="h-20 w-20 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold">Proposta Aprovada com Sucesso!</h1>
          <p className="text-lg text-muted-foreground">
            Agradecemos pela confiança em nosso programa de fidelidade Leva+!
          </p>
          <p className="text-base">
            Nossa equipe entrará em contato em breve para agendar a implantação do sistema
            e auxiliar no processo de configuração inicial.
          </p>
          <div className="pt-6 border-t space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>O que acontece agora?</strong>
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside text-left max-w-md mx-auto">
              <li>Você receberá um e-mail de confirmação</li>
              <li>Agendaremos a implantação do sistema</li>
              <li>Forneceremos todo o treinamento necessário</li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground pt-4">
            Este link não está mais disponível. Se precisar de uma cópia do documento, entre em contato conosco.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-muted/50 py-8">
      <div className="container max-w-5xl">
        {/* Cabeçalho */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold mb-2">Proposta Comercial</h1>
          <p className="text-xl font-semibold text-primary mb-1">{budget.budget_number}</p>
          <p className="text-muted-foreground">
            Validade: {format(new Date(budget.expires_at), 'dd/MM/yyyy')}
          </p>
        </div>

        {/* Botões de Ação */}
        {!action && budget.status === 'sent' && (
          <div className="flex gap-4 justify-center mb-8">
            <Button
              size="lg"
              className="gap-2"
              onClick={() => {
                setAction('approve');
                // Scroll suave até o formulário após um pequeno delay
                setTimeout(() => {
                  const formElement = document.getElementById('approval-form');
                  if (formElement) {
                    formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }, 100);
              }}
            >
              <CheckCircle2 className="w-5 h-5" />
              Aprovar Proposta
            </Button>
            <Button
              size="lg"
              variant="destructive"
              className="gap-2"
              onClick={() => {
                setAction('decline');
                // Scroll suave até o formulário após um pequeno delay
                setTimeout(() => {
                  const formElement = document.getElementById('decline-form');
                  if (formElement) {
                    formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }, 100);
              }}
            >
              <XCircle className="w-5 h-5" />
              Recusar Proposta
            </Button>
          </div>
        )}

        {/* Visualização da Proposta */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Detalhes da Proposta</CardTitle>
              <Badge variant={
                budget.status === 'approved' ? 'default' :
                budget.status === 'declined' ? 'destructive' :
                'secondary'
              }>
                {budget.status === 'approved' ? 'Aprovado' :
                 budget.status === 'declined' ? 'Recusado' :
                 'Aguardando'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Informações do Solicitante */}
            <div>
              <h3 className="font-semibold text-base mb-3">Informações do Solicitante</h3>
              <div className="text-sm space-y-1">
                <p><strong>Nome:</strong> {budget.requester_name}</p>
                <p><strong>Email:</strong> {budget.requester_email}</p>
                <p><strong>Telefone:</strong> {budget.requester_phone}</p>
                {budget.networks?.name && <p><strong>Empresa:</strong> {budget.networks.name}</p>}
              </div>
            </div>

            {/* CNPJs */}
            {budget.cnpjs && budget.cnpjs.length > 0 && (
              <div>
                <h3 className="font-semibold text-base mb-3">CNPJs da Proposta</h3>
                <div className="text-sm space-y-3">
                  {budget.cnpjs.map((cnpjItem: any, index: number) => {
                    // O cnpjs é um array de strings JSON, então precisamos fazer parse de cada item
                    let cnpj = '';
                    let razaoSocial = '';
                    
                    try {
                      if (typeof cnpjItem === 'string') {
                        const parsed = JSON.parse(cnpjItem);
                        cnpj = parsed.cnpj || '';
                        razaoSocial = parsed.razao_social || '';
                      } else if (cnpjItem && typeof cnpjItem === 'object') {
                        cnpj = cnpjItem.cnpj || '';
                        razaoSocial = cnpjItem.razao_social || '';
                      }
                    } catch (e) {
                      console.error('Erro ao fazer parse do CNPJ:', e);
                    }
                    
                    const cnpjFormatted = cnpj ? cnpj.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '';
                    
                    return (
                      <div key={index} className="border-l-4 border-primary pl-3 py-2">
                        {cnpjFormatted ? (
                          <>
                            <p className="font-mono font-semibold text-base">{cnpjFormatted}</p>
                            {razaoSocial && (
                              <p className="text-muted-foreground mt-1">{razaoSocial}</p>
                            )}
                          </>
                        ) : (
                          <p className="text-muted-foreground">CNPJ inválido</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Itens da Proposta */}
            <div>
              <h3 className="font-semibold text-base mb-3">Itens da Proposta</h3>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-primary text-primary-foreground">
                    <tr>
                      <th className="text-left p-3">Produto/Serviço</th>
                      <th className="text-left p-3">Tipo</th>
                      <th className="text-center p-3">Qtd</th>
                      <th className="text-right p-3">Valor Unit.</th>
                      {hasDiscount && <th className="text-right p-3">Desconto</th>}
                      <th className="text-right p-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetItems.map((item, index) => {
                      const product = item.products_services;
                      const isRecurring = product?.is_recurring;
                      const typeLabel = product?.type === 'product' ? 'Produto' : (isRecurring ? 'Serviço (Recorrente)' : 'Serviço (Único)');
                      
                      return (
                        <tr key={index} className="border-t">
                          <td className="p-3">
                            {product?.code} - {product?.name}
                          </td>
                          <td className="p-3">
                            <Badge variant={product?.type === 'product' ? 'default' : (isRecurring ? 'secondary' : 'outline')} className="text-xs">
                              {typeLabel}
                            </Badge>
                          </td>
                          <td className="text-center p-3">{item.quantity} {product?.unit_of_measure || ''}</td>
                          <td className="text-right p-3">{formatCurrency(item.unit_value)}</td>
                          {hasDiscount && (
                            <td className="text-right p-3">
                              {item.discount_amount > 0 
                                ? (item.discount_type === 'percentage' ? `${item.discount_amount}%` : formatCurrency(item.discount_amount))
                                : '-'
                              }
                            </td>
                          )}
                          <td className="text-right p-3 font-semibold">{formatCurrency(item.total_value)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totais */}
              <div className="mt-4 space-y-2">
                {hasProducts && budget.products_total > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Subtotal Produtos:</span>
                    <span className="font-medium">{formatCurrency(budget.products_total)}</span>
                  </div>
                )}
                
                {budget.freight_value > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Frete:</span>
                    <span className="font-medium">{formatCurrency(budget.freight_value)}</span>
                  </div>
                )}

                {totalUnique > 0 && (
                  <div className="flex justify-between text-base font-semibold border-t pt-2">
                    <span>Total Único:</span>
                    <span className="text-primary">{formatCurrency(totalUnique)}</span>
                  </div>
                )}
                
                {totalRecurring > 0 && (
                  <div className="flex justify-between text-base font-semibold">
                    <span>Total Recorrente:</span>
                    <span className="text-primary">{formatCurrency(totalRecurring)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Condições de Pagamento */}
            {(budget.payment_type || (hasProducts && budget.products_installments_count) || budget.unique_services_installments_count || budget.products_payment_method || budget.services_payment_method) && (
              <div>
                <h3 className="font-semibold text-base mb-3">Condições de Pagamento</h3>
                <div className="text-sm space-y-1">
                  {budget.payment_type && (
                    <p><strong>Forma:</strong> {budget.payment_type === 'boleto' ? 'Boleto' : 'PIX'}</p>
                  )}
                  {budget.products_payment_method && (
                    <p><strong>Forma Produtos:</strong> {budget.products_payment_method === 'boleto' ? 'Boleto' : 'PIX'}</p>
                  )}
                  {budget.services_payment_method && (
                    <p><strong>Forma Serviços:</strong> {budget.services_payment_method === 'boleto' ? 'Boleto' : 'PIX'}</p>
                  )}
                  {hasProducts && budget.products_installments_count && (
                    <p><strong>Parcelamento Produtos:</strong> {budget.products_installments_count}x</p>
                  )}
                  {budget.unique_services_installments_count && (
                    <p><strong>Parcelamento Serviços Únicos:</strong> {budget.unique_services_installments_count}x</p>
                  )}
                </div>
              </div>
            )}

            {/* Observações */}
            {budget.observations && (
              <div>
                <h3 className="font-semibold text-base mb-3">Observações</h3>
                <p className="text-sm whitespace-pre-wrap">{budget.observations}</p>
              </div>
            )}

            {/* Termo de Adesão */}
            <div className="border-t pt-6">
              <h3 className="font-semibold text-base mb-3">Termo de Adesão</h3>
              <div className="text-sm space-y-4 max-h-96 overflow-y-auto p-4 bg-muted/30 rounded-lg">
                <div>
                  <h4 className="font-bold text-center mb-4">CONTRATO DE ADESÃO E COOPERAÇÃO COMERCIAL AO PROGRAMA DE FIDELIDADE "LEVA+"</h4>
                  <p className="mb-4">
                    Considerando que as condições comerciais e financeiras específicas e as partes deste contrato foram previamente apresentadas e detalhadas na Proposta Comercial do Programa Leva+, que passa a fazer parte integrante deste instrumento, vinculando-se às mesmas obrigações jurídicas aqui estabelecidas, têm entre si, justas e contratadas, as cláusulas e condições seguintes:
                  </p>
                </div>

                <div>
                  <h4 className="font-bold mb-2">CLÁUSULA 1ª – OBJETO</h4>
                  <p className="mb-2">1. O presente contrato tem por objeto a adesão do LOJISTA PARCEIRO ao Programa de Fidelidade "Leva+", de titularidade da BISW SOLUTIONS SERVIÇOS DE INFORMATICA LTDA., com vistas à utilização da plataforma digital e do aplicativo Leva+ Fidelidade, destinados ao gerenciamento de cadastros, pontuação, cashback, retenção e comunicação com clientes.</p>
                  <p className="mb-2">2. A BISW é responsável pelo desenvolvimento, manutenção, infraestrutura tecnológica, autenticação, integridade dos dados e segurança da informação da plataforma Leva+.</p>
                  <p className="mb-2">3. O LOJISTA PARCEIRO, por sua vez, é responsável pelas operações comerciais, campanhas e regras de pontuação, atuando:</p>
                  <p className="mb-2 ml-4">- como Controlador de Dados em relação às informações de suas vendas e fidelização; e</p>
                  <p className="mb-2 ml-4">- como Operador, nos casos em que tratar dados pessoais sob orientação e supervisão da BISW.</p>
                  <p>4. As condições financeiras, valores de implantação, mensalidades e eventuais taxas aplicáveis ao uso do Programa Leva+ Fidelidade encontram-se especificadas na Proposta Comercial firmada entre as partes, a qual integra este contrato para todos os fins, com igual força obrigatória.</p>
                </div>

                <div>
                  <h4 className="font-bold mb-2">CLÁUSULA 2ª – RESPONSABILIDADES DO LOJISTA PARCEIRO</h4>
                  <p className="mb-2">2.2. É de responsabilidade exclusiva do LOJISTA PARCEIRO assegurar a estabilidade de sua rede, equipamentos e conexões de internet necessários ao correto funcionamento do sistema.</p>
                  <p className="mb-2">2.3. O LOJISTA obriga-se a respeitar o período de fidelização definido pelo usuário, sendo expressamente vedado induzir, promover ou realizar qualquer ação que resulte na troca antecipada da rede favorita.</p>
                  <p className="mb-2">2.4. O uso de dados de clientes não vinculados como rede favorita é terminantemente proibido. Durante o período de fidelização, apenas a Rede Favorita poderá visualizar dados de contato (nome, telefone e e-mail) — redes não favoritas terão acesso apenas a dados limitados (nome, cidade, estado e país).</p>
                  <p>2.5. O descumprimento das obrigações acima sujeita o LOJISTA às penalidades previstas na Cláusula 6ª.</p>
                </div>

                <div>
                  <h4 className="font-bold mb-2">CLÁUSULA 3ª – REGRAS DE FUNCIONAMENTO DO PROGRAMA</h4>
                  <p className="mb-2">3.1. Cada cliente cadastrado vincular-se-á a uma Rede Favorita (grupo de lojas ou postos), com fidelização mínima de 90 (noventa) dias, podendo optar voluntariamente por períodos estendidos de 6 (seis), 9 (nove) ou 12 (doze) meses, conforme escolha realizada no momento do cadastro.</p>
                  <p className="mb-2">3.2. Durante o período de fidelização, o cliente poderá pontuar e resgatar em outras redes, que serão tratadas como redes secundárias, sem acesso aos dados completos do titular.</p>
                  <p className="mb-2">3.3. A Rede Favorita que oferecer períodos de retenção superiores a 90 dias poderá conceder bonificações adicionais progressivas sobre os pontos ou cashback do cliente, conforme política própria e informada de forma clara ao cliente.</p>
                  <p className="mb-2">3.4. Ao término do período escolhido, o cliente será notificado pela plataforma via e-mail ou notificação eletrônica para confirmar ou renovar sua fidelização. A ausência de resposta implicará a liberação automática da troca de rede.</p>
                  <p className="mb-2">3.5. O LOJISTA PARCEIRO obriga-se a respeitar integralmente o prazo de fidelização eleito pelo cliente, sob pena de multa e bloqueio da conta.</p>
                  <p>3.6. As regras comerciais (pontuação, prazos de validade, mínimos e máximos de resgate, etc.) são definidas exclusivamente pelo LOJISTA, devendo ser informadas de forma clara e acessível aos usuários.</p>
                </div>

                <div>
                  <h4 className="font-bold mb-2">CLÁUSULA 4ª – TRATAMENTO DE DADOS PESSOAIS</h4>
                  <p className="mb-2">4.1. O Programa Leva+ coleta apenas os dados necessários à execução do serviço, sendo obrigatórios: nome, CPF, cidade, estado e país. O campo "endereço completo" é opcional.</p>
                  <p className="mb-2">4.2. O tratamento de dados observará as bases legais do art. 7º da Lei nº 13.709/2018 (LGPD), especialmente:</p>
                  <p className="mb-2 ml-4">- execução contratual (inc. V);</p>
                  <p className="mb-2 ml-4">- legítimo interesse (inc. IX);</p>
                  <p className="mb-2 ml-4">- cumprimento de obrigação legal (inc. II);</p>
                  <p className="mb-2 ml-4">- e consentimento (inc. I), quando aplicável.</p>
                  <p className="mb-2">4.3. Redes não favoritas têm acesso limitado a dados básicos de identificação, sendo vedado o uso para marketing, contato direto ou qualquer forma de tratamento autônomo.</p>
                  <p>4.4. O LOJISTA PARCEIRO assume integral responsabilidade por qualquer tratamento de dados fora das hipóteses permitidas, respondendo administrativa, civil e criminalmente por violações à LGPD.</p>
                </div>

                <div>
                  <h4 className="font-bold mb-2">CLÁUSULA 5ª – SEGURANÇA E CONFORMIDADE DIGITAL</h4>
                  <p className="mb-2">5.1. A BISW mantém infraestrutura tecnológica compatível com os mais elevados padrões de segurança (criptografia, logs de auditoria, controle de acesso e backup).</p>
                  <p className="mb-2">5.2. O LOJISTA PARCEIRO deverá adotar práticas mínimas de proteção, incluindo senhas seguras, restrição de acesso por perfil e confidencialidade dos dados de clientes.</p>
                  <p>5.3. A BISW poderá realizar auditorias técnicas remotas em casos de suspeita de uso indevido de dados ou violação de regras de fidelização, comprometendo-se a resguardar o sigilo comercial das informações auditadas.</p>
                </div>

                <div>
                  <h4 className="font-bold mb-2">CLÁUSULA 6ª – INFRAÇÕES E PENALIDADES</h4>
                  <p className="mb-2">6.1. Configuram infração grave:</p>
                  <p className="mb-2 ml-4">- uso de dados de clientes não favoritos;</p>
                  <p className="mb-2 ml-4">- tentativa de manipular o vínculo de fidelização;</p>
                  <p className="mb-2 ml-4">- envio indevido de comunicações;</p>
                  <p className="mb-2 ml-4">- indução à troca antecipada de rede;</p>
                  <p className="mb-2 ml-4">- vazamento ou compartilhamento de dados a terceiros.</p>
                  <p className="mb-2">6.2. A violação de qualquer dessas condutas sujeitará o LOJISTA PARCEIRO, sem prejuízo das sanções legais, a:</p>
                  <p className="mb-2 ml-4">1. multa compensatória de R$ 10.000,00 (dez mil reais) por ocorrência;</p>
                  <p className="mb-2 ml-4">2. bloqueio temporário ou definitivo do acesso à plataforma;</p>
                  <p className="mb-2 ml-4">3. rescisão imediata do contrato, com perda de benefícios e bloqueio de campanhas ativas;</p>
                  <p className="mb-2 ml-4">4. comunicação à Autoridade Nacional de Proteção de Dados (ANPD), quando aplicável.</p>
                  <p>6.3. O LOJISTA responderá também por eventuais danos materiais, morais e reputacionais sofridos pela BISW ou por usuários, de forma solidária nos termos do art. 42 da LGPD.</p>
                </div>

                <div>
                  <h4 className="font-bold mb-2">CLÁUSULA 7ª – PROPRIEDADE INTELECTUAL</h4>
                  <p className="mb-2">7.1. Todas as marcas, layouts, softwares, algoritmos, banco de dados e demais ativos relacionados à plataforma Leva+ são de propriedade exclusiva da BISW.</p>
                  <p>7.2. É vedada ao LOJISTA PARCEIRO a cópia, distribuição, engenharia reversa, sublicenciamento ou exploração comercial do sistema fora do escopo deste contrato.</p>
                </div>

                <div>
                  <h4 className="font-bold mb-2">CLÁUSULA 8ª – REAJUSTE ANUAL DE VALORES</h4>
                  <p className="mb-2">8.1. O valor previsto neste contrato será reajustado anualmente, na data de aniversário da assinatura deste instrumento, com base na variação positiva do Índice Nacional de Preços ao Consumidor Amplo (IPCA), divulgado pelo Instituto Brasileiro de Geografia e Estatística (IBGE), ou do Índice Geral de Preços do Mercado (IGP-M), divulgado pela Fundação Getúlio Vargas (FGV), aplicando-se o que for maior entre os dois no período.</p>
                  <p className="mb-2">8.2. Na hipótese de extinção de qualquer um desses índices, as partes elegerão, de comum acordo, outro índice oficial que melhor reflita a variação do poder aquisitivo da moeda no período.</p>
                  <p>8.3. O reajuste incidirá automaticamente, independentemente de notificação ou aditivo, aplicando-se sobre o valor vigente à data do reajuste.</p>
                </div>

                <div>
                  <h4 className="font-bold mb-2">CLÁUSULA 9ª – PRAZO E RESCISÃO</h4>
                  <p className="mb-2">9.1. O presente contrato é celebrado por prazo mínimo de 12 (doze) meses, contados a partir da data da assinatura eletrônica, prorrogando-se automaticamente por iguais períodos, salvo manifestação expressa em sentido contrário por qualquer das partes, mediante aviso prévio de 30 (trinta) dias antes do vencimento.</p>
                  <p className="mb-2">9.2. A proposta comercial assinada pelo LOJISTA PARCEIRO integra o presente contrato para todos os fins, constituindo um único instrumento jurídico. As condições financeiras, valores e periodicidade das mensalidades constam exclusivamente da referida proposta.</p>
                  <p className="mb-2">9.3. A aceitação da proposta comercial implica, de forma automática e irrevogável, a aceitação integral deste contrato e de todos os seus anexos, dispensando assinatura física adicional.</p>
                  <p className="mb-2">9.4. O cancelamento antecipado deste contrato, por iniciativa do LOJISTA PARCEIRO, antes do término do período mínimo de 12 (doze) meses, ensejará o pagamento de multa compensatória correspondente a 50% (cinquenta por cento) do valor total das mensalidades vincendas, calculadas com base na data do efetivo pedido de rescisão.</p>
                  <p className="mb-2">9.5. A multa prevista nesta cláusula tem natureza compensatória e não penal, sendo devida independentemente de notificação prévia, e poderá ser cobrada pela BISW de forma imediata, inclusive mediante compensação automática de valores devidos.</p>
                  <p>9.6. A BISW poderá rescindir o contrato, de pleno direito e sem ônus, em caso de descumprimento de obrigações contratuais, má utilização da plataforma, inadimplemento superior a 30 (trinta) dias ou violação das normas da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).</p>
                </div>

                <div>
                  <h4 className="font-bold mb-2">CLÁUSULA 10ª – LIMITAÇÃO DE RESPONSABILIDADE</h4>
                  <p className="mb-2">10.1. A BISW não se responsabiliza por falhas de conexão, inatividade de PDV, erro de digitação ou negligência operacional do lojista.</p>
                  <p className="mb-2">10.2. O uso indevido de dados, manipulação de cadastros ou violação do prazo de fidelização não estão cobertos pela limitação de responsabilidade, sendo considerados atos dolosos e excludentes da limitação prevista nesta cláusula.</p>
                  <p>10.3. A responsabilidade financeira da BISW, em qualquer hipótese, fica limitada ao valor máximo de R$ 1.000,00 (mil reais), mesmo em casos de dolo ou culpa grave.</p>
                </div>

                <div>
                  <h4 className="font-bold mb-2">CLÁUSULA 11ª – COMUNICAÇÕES E ASSINATURA ELETRÔNICA</h4>
                  <p className="mb-2">11.1. As comunicações entre as partes ocorrerão preferencialmente por meio eletrônico, nos endereços informados no cadastro.</p>
                  <p>11.2. O presente contrato será formalizado por assinatura digital, nos termos da MP nº 2.200-2/2001 e da Lei nº 14.063/2020, possuindo plena validade jurídica e força probatória.</p>
                </div>

                <div>
                  <h4 className="font-bold mb-2">CLÁUSULA 12ª – LEI APLICÁVEL E FORO</h4>
                  <p className="mb-2">12.1. O presente contrato é regido pelas leis da República Federativa do Brasil, especialmente o Código Civil, a Lei nº 13.709/2018 (LGPD) e a Lei nº 12.965/2014 (Marco Civil da Internet).</p>
                  <p className="mb-2">12.2. Fica eleito o Foro da Comarca do Rio de Janeiro/RJ, com renúncia a qualquer outro, por mais privilegiado que seja.</p>
                  <p>A Proposta Comercial, este Contrato e seus anexos constituem o acordo integral entre as partes, substituindo quaisquer entendimentos anteriores. A assinatura eletrônica da proposta implica aceite imediato e integral do presente contrato.</p>
                  <p>E, por estarem assim justas e contratadas, as partes firmam o presente instrumento por meio eletrônico, com validade jurídica plena, nos termos da legislação em vigor.</p>
                </div>

                <div className="mt-6 pt-4 border-t text-center">
                  <p className="text-sm">
                    Rio de Janeiro, {format(new Date(budget.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mt-6">
                    Ao aprovar esta proposta, você declara ter lido, compreendido e aceito integralmente todos os termos e condições deste contrato.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Formulário de Aprovação */}
        {action === 'approve' && (
          <Card id="approval-form">
            <CardHeader>
              <CardTitle>Dados do Representante Legal</CardTitle>
              <CardDescription>
                Preencha os dados para assinar digitalmente a proposta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome Completo *</Label>
                <Input
                  id="full_name"
                  value={approvalData.full_name}
                  onChange={(e) => setApprovalData({ ...approvalData, full_name: e.target.value })}
                  placeholder="Seu nome completo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  value={approvalData.cpf}
                  onChange={(e) => setApprovalData({ ...approvalData, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Cargo *</Label>
                <Input
                  id="position"
                  value={approvalData.position}
                  onChange={(e) => setApprovalData({ ...approvalData, position: e.target.value })}
                  placeholder="Ex: Diretor, Gerente, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Endereço de E-mail *</Label>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    type="email"
                    value={approvalData.email}
                    onChange={(e) => setApprovalData({ ...approvalData, email: e.target.value })}
                    placeholder="seu@email.com"
                    disabled={emailSent}
                  />
                  {!emailVerified && !emailSent && (
                    <Button
                      onClick={handleSendVerificationCode}
                      disabled={isSubmitting || !approvalData.email}
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar Código"}
                    </Button>
                  )}
                  {emailSent && !emailVerified && (
                    <Button
                      variant="outline"
                      onClick={handleChangeEmail}
                      disabled={isSubmitting}
                    >
                      Trocar Email
                    </Button>
                  )}
                </div>
                {emailSent && !emailVerified && (
                  <p className="text-xs text-muted-foreground">
                    💡 Código expira em 1 minuto. Verifique sua caixa de entrada e spam.
                  </p>
                )}
              </div>

              {emailSent && !emailVerified && (
                <div className="space-y-2">
                  <Label htmlFor="verification_code">Código de Verificação *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="verification_code"
                      value={approvalData.verification_code}
                      onChange={(e) => setApprovalData({ ...approvalData, verification_code: e.target.value })}
                      placeholder="000000"
                      maxLength={6}
                    />
                    <Button
                      onClick={handleVerifyCode}
                      disabled={isSubmitting || !approvalData.verification_code}
                      className="gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <LoadingSpinner size="sm" />
                          Verificando...
                        </>
                      ) : (
                        "Verificar"
                      )}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="link"
                      size="sm"
                      onClick={handleSendVerificationCode}
                      disabled={isSubmitting || !canResendCode}
                      className="text-xs h-auto p-0"
                    >
                      {canResendCode ? "Reenviar código" : "Aguarde 30s para reenviar"}
                    </Button>
                  </div>
                </div>
              )}

              {emailVerified && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  ✓ Email verificado com sucesso!
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="payment_due_days">Prazo de Pagamento (dias) *</Label>
                <Select
                  value={approvalData.payment_due_days}
                  onValueChange={(value) => setApprovalData({ ...approvalData, payment_due_days: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 dias</SelectItem>
                    <SelectItem value="10">10 dias</SelectItem>
                    <SelectItem value="15">15 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing_day">Dia de Vencimento das Cobranças *</Label>
                <Select
                  value={approvalData.billing_day}
                  onValueChange={(value) => setApprovalData({ ...approvalData, billing_day: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o dia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Dia 5</SelectItem>
                    <SelectItem value="10">Dia 10</SelectItem>
                    <SelectItem value="20">Dia 20</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Boletos mensais serão gerados 7 dias antes desta data
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing_type">Tipo de Faturamento *</Label>
                <Select
                  value={approvalData.billing_type}
                  onValueChange={(value: 'per_cnpj' | 'single_cnpj') => 
                    setApprovalData({ ...approvalData, billing_type: value, main_billing_cnpj: value === 'per_cnpj' ? '' : approvalData.main_billing_cnpj })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_cnpj">Um boleto por CNPJ</SelectItem>
                    <SelectItem value="single_cnpj">Boleto único consolidado</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {approvalData.billing_type === 'per_cnpj' 
                    ? 'Será gerado um boleto separado para cada CNPJ da proposta' 
                    : 'Será gerado um único boleto com o valor total consolidado'
                  }
                </p>
              </div>

              {approvalData.billing_type === 'single_cnpj' && budget.cnpjs && budget.cnpjs.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="main_billing_cnpj">CNPJ Principal para Faturamento *</Label>
                  <Select
                    value={approvalData.main_billing_cnpj}
                    onValueChange={(value) => setApprovalData({ ...approvalData, main_billing_cnpj: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o CNPJ" />
                    </SelectTrigger>
                    <SelectContent>
                      {budget.cnpjs.map((cnpjItem: any, index: number) => {
                        let cnpj = '';
                        let razaoSocial = '';
                        
                        try {
                          if (typeof cnpjItem === 'string') {
                            const parsed = JSON.parse(cnpjItem);
                            cnpj = parsed.cnpj || '';
                            razaoSocial = parsed.razao_social || '';
                          } else if (cnpjItem && typeof cnpjItem === 'object') {
                            cnpj = cnpjItem.cnpj || '';
                            razaoSocial = cnpjItem.razao_social || '';
                          }
                        } catch (e) {
                          console.error('Erro ao fazer parse do CNPJ:', e);
                        }
                        
                        const cnpjFormatted = cnpj ? cnpj.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '';
                        
                        if (!cnpj) return null;
                        
                        return (
                          <SelectItem key={index} value={cnpj}>
                            {cnpjFormatted} - {razaoSocial}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Todos os boletos serão emitidos neste CNPJ
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="financial_email">E-mail Financeiro</Label>
                <Input
                  id="financial_email"
                  type="email"
                  value={approvalData.financial_email}
                  onChange={(e) => setApprovalData({ ...approvalData, financial_email: e.target.value })}
                  placeholder="financeiro@empresa.com"
                />
                <p className="text-xs text-muted-foreground">
                  Os boletos serão enviados para este e-mail
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setAction(null)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={handleApprove}
                  disabled={isSubmitting || !emailVerified}
                >
                  {isSubmitting ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Processando aprovação...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirmar Aprovação
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Formulário de Recusa */}
        {action === 'decline' && (
          <Card id="decline-form">
            <CardHeader>
              <CardTitle>Recusar Proposta</CardTitle>
              <CardDescription>
                Por favor, informe o motivo da recusa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="decline_reason">Motivo da Recusa *</Label>
                <Textarea
                  id="decline_reason"
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Descreva o motivo da recusa..."
                  rows={5}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setAction(null)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 gap-2"
                  onClick={handleDecline}
                  disabled={isSubmitting || !declineReason.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Processando recusa...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Confirmar Recusa
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dialog de Sucesso */}
        <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {budget?.status === 'approved' ? '✓ Aprovado' : budget?.status === 'declined' ? '✗ Recusado' : 'Status'}
              </DialogTitle>
              <DialogDescription className="pt-4">
                {successMessage}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3">
              {budget?.status === 'approved' && (
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={handleDownloadAuditPDF}
                  disabled={isGeneratingPDF}
                >
                  {isGeneratingPDF ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Baixar Proposta Completa
                </Button>
              )}
              <Button onClick={() => setShowSuccessDialog(false)} className="flex-1">
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
