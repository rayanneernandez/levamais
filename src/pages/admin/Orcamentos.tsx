import { useState, useEffect } from "react";
import { Plus, Eye, ArrowLeft, Search, FileText, Trash2, ShoppingCart, Edit, ExternalLink, LayoutGrid, List, Download, Mail, MessageCircle, Loader2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CNPJManager } from "@/components/admin/CNPJManager";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoDark from "@/assets/logo-dark.png";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate, useLocation } from "react-router-dom";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { trimmedString, trimmedEmail, trimmedOptional, cleanText, cleanEmail, LIMITS } from "@/lib/input-sanitization";

const formSchema = z.object({
  network_id: z.string().optional(),
  seller_id: z.string().min(1, "Vendedor é obrigatório"),
  requester_name: trimmedString(LIMITS.NAME, { min: 2, minMessage: "Nome do solicitante é obrigatório" }),
  requester_email: trimmedEmail(),
  requester_phone: trimmedString(LIMITS.PHONE, { min: 1, minMessage: "Telefone é obrigatório" }),
  expires_at: z.string().min(1, "Data de validade é obrigatória"),
  expected_closing_date: z.string().optional(),
  freight_value: z.string().optional(),
  temperature: z.enum(["cold", "warm", "hot"]).optional(),
  products_payment_method: z.string().optional(),
  products_installments: z.string().optional(),
  services_payment_method: z.string().optional(),
  services_installments: z.string().optional(),
  financial_contact_name: trimmedOptional(LIMITS.NAME),
  financial_contact_email: trimmedOptional(LIMITS.EMAIL),
  financial_contact_phone: trimmedOptional(LIMITS.PHONE),
  cnpjs: z.array(z.object({
    cnpj: z.string(),
    razao_social: z.string(),
  })).default([]),
  observations: trimmedOptional(LIMITS.LONG_TEXT),
  payment_type: z.string().optional(),
  products_installments_count: z.string().optional(),
  unique_services_installments_count: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CNPJItem {
  cnpj: string;
  razao_social: string;
}

interface Budget {
  id: string;
  budget_number: string;
  network_id: string | null;
  seller_id: string;
  requester_name: string;
  requester_email: string;
  requester_phone: string;
  status: string;
  decline_reason?: string | null;
  total_value: number;
  products_total: number;
  services_total: number;
  freight_value: number;
  expires_at: string;
  expected_closing_date?: string | null;
  temperature?: string | null;
  products_payment_method?: string | null;
  products_installments?: number | null;
  services_payment_method?: string | null;
  services_installments?: number | null;
  financial_contact_name?: string | null;
  financial_contact_email?: string | null;
  financial_contact_phone?: string | null;
  approval_token?: string | null;
  cnpjs?: CNPJItem[] | null;
  observations?: string | null;
  payment_type?: string | null;
  products_installments_count?: number | null;
  unique_services_installments_count?: number | null;
  created_at: string;
  networks?: {
    name: string;
  };
  email_events?: Array<{
    event_type: string;
    occurred_at: string;
  }>;
  unique_total?: number;
  recurring_total?: number;
}

interface BudgetItem {
  id?: string;
  product_service_id: string;
  quantity: number;
  unit_value: number;
  discount_type?: 'percentage' | 'value';
  discount_amount?: number;
  unit_value_with_discount: number;
  total_value: number;
}

interface Network {
  id: string;
  name: string;
  status?: string;
}

interface ProductService {
  id: string;
  code: string;
  name: string;
  type: string;
  sale_value: number;
  unit_of_measure: string;
  is_recurring?: boolean;
}

const Orcamentos = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [products, setProducts] = useState<ProductService[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingBudget, setViewingBudget] = useState<Budget | null>(null);
  const [viewingBudgetItems, setViewingBudgetItems] = useState<any[]>([]);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isFromLead, setIsFromLead] = useState(false);
  const [leadCompany, setLeadCompany] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAuditPDF, setIsGeneratingAuditPDF] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailOption, setEmailOption] = useState<"requester" | "network" | "custom">("requester");
  const [customEmail, setCustomEmail] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      network_id: "",
      seller_id: "",
      requester_name: "",
      requester_email: "",
      requester_phone: "",
      expires_at: "",
      expected_closing_date: "",
      freight_value: "0",
      products_installments: "1",
      services_installments: "1",
      cnpjs: [],
      observations: "",
      payment_type: "",
      products_installments_count: "1",
      unique_services_installments_count: "1",
    },
  });

  useEffect(() => {
    loadBudgets();
    loadNetworks();
    loadProducts();
    loadSellers();
    
    // Verificar se chegou com dados de Lead
    const state = location.state as any;
    console.log("State recebido:", state);
    if (state?.fromLead && state?.leadData) {
      const leadData = state.leadData;
      console.log("Lead data:", leadData);
      setIsFromLead(true);
      setLeadCompany(leadData.company || "");
      setLeadId(leadData.lead_id || null);
      
      form.reset({
        network_id: "",
        seller_id: leadData.seller_id || "",
        requester_name: leadData.requester_name || "",
        requester_email: leadData.requester_email || "",
        requester_phone: leadData.requester_phone || "",
        expires_at: "",
        expected_closing_date: "",
        freight_value: "0",
        temperature: leadData.temperature,
        products_installments: "1",
        services_installments: "1",
      });
      
      // Aguardar um momento para o form resetar antes de abrir o dialog
      setTimeout(() => {
        setIsDialogOpen(true);
      }, 100);
    }
    
    setIsLoading(false);
  }, [location.state]);

  const loadNetworks = async () => {
    try {
      const { data, error } = await supabase
        .from("networks")
        .select("id, name, status")
        .in("status", ["active", "negotiation"])
        .order("name");

      if (error) throw error;
      setNetworks(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar redes",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products_services")
        .select("id, code, name, type, sale_value, unit_of_measure, is_recurring")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar produtos",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadSellers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("is_seller", true);

      if (error) throw error;
      setSellers(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar vendedores",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadBudgets = async () => {
    try {
      const { data, error } = await supabase
        .from("budgets")
        .select(`
          *,
          networks (
            name
          ),
          email_events (
            event_type,
            occurred_at
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Para cada orçamento, carregar os items e calcular totais únicos/recorrentes
      const budgetsWithTotals = await Promise.all(
        (data || []).map(async (budget) => {
          const { data: items } = await supabase
            .from("budget_items")
            .select(`
              total_value,
              products_services (
                is_recurring
              )
            `)
            .eq("budget_id", budget.id);

          let unique_total = 0;
          let recurring_total = 0;

          (items || []).forEach((item: any) => {
            if (item.products_services?.is_recurring) {
              recurring_total += item.total_value;
            } else {
              unique_total += item.total_value;
            }
          });

          return {
            ...budget,
            unique_total,
            recurring_total,
            cnpjs: Array.isArray(budget.cnpjs) 
              ? budget.cnpjs.map((cnpj: any) => {
                  if (typeof cnpj === 'string') {
                    try {
                      const parsed = JSON.parse(cnpj);
                      return {
                        cnpj: parsed.cnpj || '',
                        razao_social: parsed.razao_social || ''
                      } as CNPJItem;
                    } catch {
                      return { cnpj, razao_social: '' } as CNPJItem;
                    }
                  }
                  return {
                    cnpj: cnpj.cnpj || '',
                    razao_social: cnpj.razao_social || ''
                  } as CNPJItem;
                })
              : []
          };
        })
      );
      
      setBudgets(budgetsWithTotals as Budget[]);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar orçamentos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotals = (items: BudgetItem[]) => {
    let productsTotal = 0;
    let servicesUniqueTotal = 0;
    let servicesRecurringTotal = 0;
    let totalDiscount = 0;

    items.forEach(item => {
      const product = products.find(p => p.id === item.product_service_id);
      if (product?.type === 'product') {
        productsTotal += item.total_value;
      } else if (product?.type === 'service') {
        if (product.is_recurring) {
          servicesRecurringTotal += item.total_value;
        } else {
          servicesUniqueTotal += item.total_value;
        }
      }
      
      // Calcular desconto total
      if (item.discount_amount && item.discount_amount > 0) {
        const itemDiscount = (item.unit_value - item.unit_value_with_discount) * item.quantity;
        totalDiscount += itemDiscount;
      }
    });

    return { 
      productsTotal, 
      servicesUniqueTotal, 
      servicesRecurringTotal,
      servicesTotal: servicesUniqueTotal + servicesRecurringTotal,
      totalDiscount 
    };
  };

  const onSubmit = async (data: FormData) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado",
          variant: "destructive",
        });
        return;
      }

      let networkId = data.network_id;

      // Se é de um lead e tem empresa, criar a rede/empresa com status "negotiation"
      if (isFromLead && leadCompany && !networkId) {
        const { data: newNetwork, error: networkError } = await supabase
          .from("networks")
          .insert([{
            name: leadCompany,
            email: data.requester_email,
            phone: data.requester_phone,
            status: 'negotiation',
            created_by: session.session.user.id,
            commercial_contact_name: data.requester_name,
            commercial_contact_email: data.requester_email,
            commercial_contact_phone: data.requester_phone,
          }])
          .select()
          .single();

        if (networkError) throw networkError;
        networkId = newNetwork.id;

        toast({
          title: "Empresa criada",
          description: `${leadCompany} cadastrada com status "Negociação"`,
        });
      }

      // Validação: se não for de um lead ou não criou empresa, network_id é obrigatório
      if (!isFromLead && !editingBudget && !networkId) {
        toast({
          title: "Rede obrigatória",
          description: "Selecione uma rede para criar o orçamento",
          variant: "destructive",
        });
        return;
      }

      if (budgetItems.length === 0) {
        toast({
          title: "Atenção",
          description: "Adicione pelo menos um item ao orçamento",
          variant: "destructive",
        });
        return;
      }

      const { productsTotal, servicesUniqueTotal, servicesRecurringTotal, servicesTotal } = calculateTotals(budgetItems);
      const freightValue = parseFloat(data.freight_value || "0");
      const totalValue = productsTotal + servicesTotal + freightValue;

      const budgetData: any = {
        network_id: networkId || null,
        lead_id: leadId || null,
        seller_id: data.seller_id,
        requester_name: cleanText(data.requester_name, LIMITS.NAME),
        requester_email: cleanEmail(data.requester_email),
        requester_phone: cleanText(data.requester_phone, LIMITS.PHONE),
        expires_at: new Date(data.expires_at).toISOString(),
        expected_closing_date: data.expected_closing_date ? new Date(data.expected_closing_date).toISOString() : null,
        freight_value: freightValue,
        temperature: data.temperature || null,
        products_payment_method: data.products_payment_method || null,
        products_installments: data.products_installments ? parseInt(data.products_installments) : 1,
        services_payment_method: data.services_payment_method || null,
        services_installments: data.services_installments ? parseInt(data.services_installments) : 1,
        financial_contact_name: cleanText(data.financial_contact_name, LIMITS.NAME) || null,
        financial_contact_email: cleanEmail(data.financial_contact_email) || null,
        financial_contact_phone: cleanText(data.financial_contact_phone, LIMITS.PHONE) || null,
        cnpjs: data.cnpjs || [],
        observations: cleanText(data.observations, LIMITS.LONG_TEXT) || null,
        payment_type: data.payment_type || null,
        products_installments_count: data.products_installments_count ? parseInt(data.products_installments_count) : 1,
        unique_services_installments_count: data.unique_services_installments_count ? parseInt(data.unique_services_installments_count) : 1,
        total_value: totalValue,
        products_total: productsTotal,
        services_total: servicesTotal,
      };

      if (editingBudget) {
        // Atualizar orçamento existente
        const { error: budgetError } = await supabase
          .from("budgets")
          .update(budgetData)
          .eq("id", editingBudget.id);

        if (budgetError) throw budgetError;

        // Deletar itens antigos
        await supabase
          .from("budget_items")
          .delete()
          .eq("budget_id", editingBudget.id);

        // Inserir novos itens
        const itemsToInsert = budgetItems.map(item => ({
          budget_id: editingBudget.id,
          product_service_id: item.product_service_id,
          quantity: item.quantity,
          unit_value: item.unit_value,
          discount_type: item.discount_type || null,
          discount_amount: item.discount_amount || null,
          unit_value_with_discount: item.unit_value_with_discount,
          total_value: item.total_value,
        }));

        const { error: itemsError } = await supabase
          .from("budget_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        toast({
          title: "Orçamento atualizado!",
          description: `Orçamento ${editingBudget.budget_number} atualizado com sucesso.`,
        });
      } else {
        // Criar novo orçamento
        const { data: budget, error: budgetError } = await supabase
          .from("budgets")
          .insert([{
            ...budgetData,
            created_by: session.session.user.id,
          }] as any)
          .select()
          .single();

        if (budgetError) throw budgetError;

        // Inserir itens
        const itemsToInsert = budgetItems.map(item => ({
          budget_id: budget.id,
          product_service_id: item.product_service_id,
          quantity: item.quantity,
          unit_value: item.unit_value,
          discount_type: item.discount_type || null,
          discount_amount: item.discount_amount || null,
          unit_value_with_discount: item.unit_value_with_discount,
          total_value: item.total_value,
        }));

        const { error: itemsError } = await supabase
          .from("budget_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        toast({
          title: "Orçamento criado!",
          description: `Orçamento ${budget.budget_number} criado com sucesso.`,
        });
      }

      setIsDialogOpen(false);
      setEditingBudget(null);
      form.reset();
      setBudgetItems([]);
      loadBudgets();
    } catch (error: any) {
      toast({
        title: editingBudget ? "Erro ao atualizar orçamento" : "Erro ao criar orçamento",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleView = async (budget: Budget) => {
    try {
      // Carregar itens do orçamento
      const { data: items, error } = await supabase
        .from("budget_items")
        .select(`
          *,
          products_services (
            id,
            code,
            name,
            type,
            sale_value,
            unit_of_measure,
            is_recurring
          )
        `)
        .eq("budget_id", budget.id);

      if (error) throw error;

      setViewingBudget(budget);
      setViewingBudgetItems(items || []);
      setIsViewDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar orçamento",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = async (budget: Budget) => {
    try {
      // Carregar itens do orçamento
      const { data: items, error } = await supabase
        .from("budget_items")
        .select(`
          *,
          products_services (
            id,
            code,
            name,
            type,
            sale_value,
            unit_of_measure
          )
        `)
        .eq("budget_id", budget.id);

      if (error) throw error;

      // Preencher o formulário com os dados do orçamento
      form.reset({
        network_id: budget.network_id || '',
        seller_id: budget.seller_id,
        requester_name: budget.requester_name,
        requester_email: budget.requester_email,
        requester_phone: budget.requester_phone,
        expires_at: format(new Date(budget.expires_at), 'yyyy-MM-dd'),
        expected_closing_date: budget.expected_closing_date ? format(new Date(budget.expected_closing_date), 'yyyy-MM-dd') : '',
        freight_value: budget.freight_value?.toString() || '0',
        temperature: (budget.temperature as "cold" | "hot" | "warm") || undefined,
        products_payment_method: budget.products_payment_method || '',
        products_installments: budget.products_installments?.toString() || '1',
        services_payment_method: budget.services_payment_method || '',
        services_installments: budget.services_installments?.toString() || '1',
        financial_contact_name: budget.financial_contact_name || '',
        financial_contact_email: budget.financial_contact_email || '',
        financial_contact_phone: budget.financial_contact_phone || '',
        cnpjs: budget.cnpjs || [],
        observations: budget.observations || '',
        payment_type: budget.payment_type || "",
        products_installments_count: budget.products_installments_count?.toString() || '1',
        unique_services_installments_count: budget.unique_services_installments_count?.toString() || '1',
      });

      // Carregar itens
      const budgetItemsData = items?.map(item => ({
        product_service_id: item.product_service_id,
        quantity: item.quantity,
        unit_value: item.unit_value,
        discount_type: item.discount_type as 'percentage' | 'value' | undefined,
        discount_amount: item.discount_amount || undefined,
        unit_value_with_discount: item.unit_value_with_discount,
        total_value: item.total_value,
      })) || [];

      setBudgetItems(budgetItemsData);
      setEditingBudget(budget);
      setIsDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar orçamento",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (budget: Budget) => {
    if (!confirm(`Deseja realmente excluir o orçamento ${budget.budget_number}?`)) {
      return;
    }

    try {
      // Deletar itens primeiro
      const { error: itemsError } = await supabase
        .from("budget_items")
        .delete()
        .eq("budget_id", budget.id);

      if (itemsError) throw itemsError;

      // Deletar orçamento
      const { error: budgetError } = await supabase
        .from("budgets")
        .delete()
        .eq("id", budget.id);

      if (budgetError) throw budgetError;

      toast({
        title: "Sucesso",
        description: "Orçamento excluído com sucesso",
      });

      loadBudgets();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir orçamento",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddItem = () => {
    const selectedProductId = (document.getElementById('product-select') as HTMLSelectElement)?.value;
    const quantity = parseInt((document.getElementById('quantity-input') as HTMLInputElement)?.value || "1");
    const discountType = (document.getElementById('discount-type') as HTMLSelectElement)?.value as 'percentage' | 'value' | '';
    const discountAmount = parseFloat((document.getElementById('discount-amount') as HTMLInputElement)?.value || "0");

    if (!selectedProductId) {
      toast({
        title: "Atenção",
        description: "Selecione um produto/serviço",
        variant: "destructive",
      });
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    // Calcular desconto
    let unitValueWithDiscount = product.sale_value;
    let finalDiscountAmount = 0;
    
    if (discountType && discountAmount > 0) {
      if (discountType === 'percentage') {
        finalDiscountAmount = (product.sale_value * discountAmount) / 100;
        unitValueWithDiscount = product.sale_value - finalDiscountAmount;
      } else {
        finalDiscountAmount = discountAmount;
        unitValueWithDiscount = product.sale_value - discountAmount;
      }
    }

    const newItem: BudgetItem = {
      product_service_id: selectedProductId,
      quantity: quantity,
      unit_value: product.sale_value,
      discount_type: discountType || undefined,
      discount_amount: discountAmount > 0 ? discountAmount : undefined,
      unit_value_with_discount: unitValueWithDiscount,
      total_value: unitValueWithDiscount * quantity,
    };

    setBudgetItems([...budgetItems, newItem]);
    
    // Reset inputs
    (document.getElementById('product-select') as HTMLSelectElement).value = '';
    (document.getElementById('quantity-input') as HTMLInputElement).value = '1';
    (document.getElementById('discount-type') as HTMLSelectElement).value = '';
    (document.getElementById('discount-amount') as HTMLInputElement).value = '0';
  };

  const handleRemoveItem = (index: number) => {
    setBudgetItems(budgetItems.filter((_, i) => i !== index));
  };

  const handleDialogClose = (open: boolean) => {
    console.log("Dialog state changing to:", open);
    if (!open) {
      setIsDialogOpen(false);
      setViewingBudget(null);
      form.reset();
      setBudgetItems([]);
    } else {
      setIsDialogOpen(true);
    }
  };

  const filteredBudgets = budgets.filter(budget => {
    const matchesSearch = budget.budget_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         budget.requester_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || budget.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      draft: { label: "Rascunho", variant: "secondary" },
      sent: { label: "Enviado", variant: "default" },
      pending_internal_approval: { label: "Pend. Aprovação", variant: "outline" },
      approved: { label: "Aprovado", variant: "default" },
      declined: { label: "Recusado", variant: "destructive" },
    };
    
    const config = variants[status] || { label: status, variant: "secondary" };
    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    );
  };

  const getEmailStatusBadge = (budget: Budget) => {
    const events = budget.email_events || [];
    
    if (events.length === 0) {
      return (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Mail className="h-3 w-3" />
          -
        </span>
      );
    }

    const hasOpened = events.some(e => e.event_type === "opened");
    const hasClicked = events.some(e => e.event_type === "clicked");
    const hasBounced = events.some(e => e.event_type === "bounced");
    const hasDelivered = events.some(e => e.event_type === "delivered");

    if (hasBounced) {
      return (
        <Badge variant="destructive" className="text-xs">
          <Mail className="h-3 w-3 mr-1" />
          Devolvido
        </Badge>
      );
    }

    if (hasClicked) {
      return (
        <Badge variant="default" className="bg-green-600 text-xs">
          <Mail className="h-3 w-3 mr-1" />
          Clicado
        </Badge>
      );
    }

    if (hasOpened) {
      return (
        <Badge variant="default" className="bg-blue-600 text-xs">
          <Mail className="h-3 w-3 mr-1" />
          Aberto
        </Badge>
      );
    }

    if (hasDelivered) {
      return (
        <Badge variant="secondary" className="text-xs">
          <Mail className="h-3 w-3 mr-1" />
          Entregue
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-xs">
        <Mail className="h-3 w-3 mr-1" />
        Enviado
      </Badge>
    );
  };

  const handleStatusChange = async (budgetId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("budgets")
        .update({ status: newStatus })
        .eq("id", budgetId);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: "O status do orçamento foi atualizado com sucesso.",
      });

      // Recarregar orçamentos
      await loadBudgets();
      
      // Atualizar o orçamento em visualização se estiver aberto
      if (viewingBudget?.id === budgetId) {
        const updatedBudget = budgets.find(b => b.id === budgetId);
        if (updatedBudget) {
          setViewingBudget({ ...updatedBudget, status: newStatus });
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const generatePDF = async () => {
    if (!viewingBudget || !viewingBudgetItems) return;

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Calcular totais únicos e recorrentes
    let totalUnique = 0;
    let totalRecurring = 0;
    let hasProducts = false;
    let hasDiscount = false;

    viewingBudgetItems.forEach((item: any) => {
      const product = products.find(p => p.id === item.product_service_id);
      if (product) {
        if (product.type === 'product') {
          hasProducts = true;
        }
        if (product.is_recurring) {
          totalRecurring += item.total_value;
        } else {
          totalUnique += item.total_value;
        }
        if (item.discount_amount && item.discount_amount > 0) {
          hasDiscount = true;
        }
      }
    });

    // Função para adicionar cabeçalho e rodapé
    const addHeaderFooter = () => {
      // Cabeçalho azul ciano (cor do + da logo)
      pdf.setFillColor(64, 185, 217);
      pdf.rect(0, 0, pageWidth, 20, 'F');
      
      // Rodapé
      pdf.setFillColor(64, 185, 217);
      pdf.rect(0, pageHeight - 25, pageWidth, 25, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.text('BISW Solutions - 19.404.744/0001-08', pageWidth / 2, pageHeight - 17, { align: 'center' });
      pdf.text('Av. Alm Julio de Sá Bierrenbach, 65 - Barra da Tijuca - Rio de Janeiro/RJ', pageWidth / 2, pageHeight - 12, { align: 'center' });
      pdf.text('Telefone: (21) 3950-7641 | E-mail: comercial@levamais.app', pageWidth / 2, pageHeight - 7, { align: 'center' });
    };

    // Página 1 - Capa Simples e Elegante
    addHeaderFooter();

    // Logo centralizada
    const img = new Image();
    img.src = logoDark;
    await new Promise((resolve) => {
      img.onload = resolve;
    });
    pdf.addImage(img, 'PNG', pageWidth / 2 - 50, 80, 100, 25);

    // Título
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(28);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Proposta Comercial', pageWidth / 2, 140, { align: 'center' });
    
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Leva+ Fidelidade', pageWidth / 2, 155, { align: 'center' });

    // Número do Orçamento
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(64, 185, 217);
    pdf.text(viewingBudget.budget_number, pageWidth / 2, 180, { align: 'center' });

    // Validade centralizada
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Validade da proposta: ${format(new Date(viewingBudget.expires_at), 'dd/MM/yyyy')}`, pageWidth / 2, 200, { align: 'center' });

    // Vendedor no canto inferior direito
    const seller = sellers.find(s => s.id === viewingBudget.seller_id);
    if (seller) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Vendedor: ${seller.full_name}`, pageWidth - 15, pageHeight - 35, { align: 'right' });
    }

    // Página 2 - Detalhes
    pdf.addPage();
    addHeaderFooter();
    pdf.setTextColor(0, 0, 0);

    let yPosition = 30;

    // Informações do Cliente
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Informações do Solicitante', 15, yPosition);
    yPosition += 7;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Nome: ${viewingBudget.requester_name}`, 15, yPosition);
    yPosition += 5;
    pdf.text(`Email: ${viewingBudget.requester_email}`, 15, yPosition);
    yPosition += 5;
    pdf.text(`Telefone: ${viewingBudget.requester_phone}`, 15, yPosition);
    yPosition += 5;
    if (viewingBudget.networks?.name) {
      pdf.text(`Empresa: ${viewingBudget.networks.name}`, 15, yPosition);
      yPosition += 5;
    }
    yPosition += 8;

    // CNPJs formatados
    if (viewingBudget.cnpjs && viewingBudget.cnpjs.length > 0) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('CNPJs', 15, yPosition);
      yPosition += 7;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      viewingBudget.cnpjs.forEach((cnpjItem) => {
        const cnpjFormatted = cnpjItem.cnpj.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
        const razaoSocial = cnpjItem.razao_social || 'Razão Social não informada';
        pdf.text(`${cnpjFormatted} - ${razaoSocial}`, 15, yPosition);
        yPosition += 6;
      });
      yPosition += 3;
    }

    // Itens da Proposta
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Itens da Proposta', 15, yPosition);
    yPosition += 7;

    // Preparar colunas da tabela (com Tipo na segunda posição)
    const tableColumns = ['Produto/Serviço', 'Tipo', 'Qtd', 'Valor Unit.'];
    if (hasDiscount) {
      tableColumns.push('Desconto');
    }
    tableColumns.push('Total');

    const tableData = viewingBudgetItems.map((item: any) => {
      const product = products.find(p => p.id === item.product_service_id);
      const productType = product?.type === 'product' ? 'Produto' : 'Serviço';
      const row = [
        `${product?.code} - ${product?.name}`,
        productType,
        `${item.quantity} ${product?.unit_of_measure || ''}`,
        formatCurrency(item.unit_value)
      ];
      
      if (hasDiscount) {
        row.push(
          item.discount_amount > 0 
            ? (item.discount_type === 'percentage' ? `${item.discount_amount}%` : formatCurrency(item.discount_amount))
            : '-'
        );
      }
      
      row.push(formatCurrency(item.total_value));
      return row;
    });

    autoTable(pdf, {
      startY: yPosition,
      head: [tableColumns],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [64, 185, 217], textColor: 255 },
      styles: { fontSize: 9 },
    });

    yPosition = (pdf as any).lastAutoTable.finalY + 10;

    // Subtotal de produtos (só se tiver produtos)
    if (hasProducts && viewingBudget.products_total > 0) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Subtotal Produtos:', pageWidth - 80, yPosition);
      pdf.text(formatCurrency(viewingBudget.products_total), pageWidth - 15, yPosition, { align: 'right' });
      yPosition += 6;
    }
    
    // Frete
    if (viewingBudget.freight_value > 0) {
      pdf.text('Frete:', pageWidth - 80, yPosition);
      pdf.text(formatCurrency(viewingBudget.freight_value), pageWidth - 15, yPosition, { align: 'right' });
      yPosition += 6;
    }
    
    yPosition += 4;

    // Total Único e Total Recorrente
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    
    if (totalUnique > 0) {
      pdf.text('Total Único:', pageWidth - 80, yPosition);
      pdf.setTextColor(64, 185, 217);
      pdf.text(formatCurrency(totalUnique), pageWidth - 15, yPosition, { align: 'right' });
      yPosition += 7;
    }
    
    if (totalRecurring > 0) {
      pdf.setTextColor(0, 0, 0);
      pdf.text('Total Recorrente:', pageWidth - 80, yPosition);
      pdf.setTextColor(64, 185, 217);
      pdf.text(formatCurrency(totalRecurring), pageWidth - 15, yPosition, { align: 'right' });
      yPosition += 7;
    }
    
    pdf.setTextColor(0, 0, 0);
    yPosition += 5;

    // Condições de Pagamento (Parcelamento só se tiver produtos)
    const showPaymentConditions = viewingBudget.payment_type || 
      (hasProducts && viewingBudget.products_installments_count) ||
      viewingBudget.unique_services_installments_count;

    if (showPaymentConditions) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Condições de Pagamento', 15, yPosition);
      yPosition += 7;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      if (viewingBudget.payment_type) {
        pdf.text(`Forma: ${viewingBudget.payment_type === 'boleto' ? 'Boleto' : 'PIX'}`, 15, yPosition);
        yPosition += 5;
      }
      if (hasProducts && viewingBudget.products_installments_count) {
        pdf.text(`Parcelamento Produtos: ${viewingBudget.products_installments_count}x`, 15, yPosition);
        yPosition += 5;
      }
      if (viewingBudget.unique_services_installments_count) {
        pdf.text(`Parcelamento Serviços: ${viewingBudget.unique_services_installments_count}x`, 15, yPosition);
        yPosition += 5;
      }
      yPosition += 5;
    }

    // Observações
    if (viewingBudget.observations) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Observações', 15, yPosition);
      yPosition += 7;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const splitObservations = pdf.splitTextToSize(viewingBudget.observations, pageWidth - 30);
      pdf.text(splitObservations, 15, yPosition);
    }

    // Página 3+ - Termo de Adesão
    pdf.addPage();
    addHeaderFooter();
    
    yPosition = 30;
    pdf.setTextColor(0, 0, 0);
    
    // Conteúdo do Termo
    const termContent = [
      { type: 'title', text: 'CONTRATO DE ADESÃO E COOPERAÇÃO COMERCIAL AO PROGRAMA DE FIDELIDADE "LEVA+"' },
      { type: 'paragraph', text: 'Considerando que as condições comerciais e financeiras específicas e as partes deste contrato foram previamente apresentadas e detalhadas na Proposta Comercial do Programa Leva+, que passa a fazer parte integrante deste instrumento, vinculando-se às mesmas obrigações jurídicas aqui estabelecidas, têm entre si, justas e contratadas, as cláusulas e condições seguintes:' },
      { type: 'section', text: 'CLÁUSULA 1ª – OBJETO' },
      { type: 'paragraph', text: '1. O presente contrato tem por objeto a adesão do LOJISTA PARCEIRO ao Programa de Fidelidade "Leva+", de titularidade da BISW SOLUTIONS SERVIÇOS DE INFORMATICA LTDA, com vistas à utilização da plataforma digital e do aplicativo Leva+ Fidelidade, destinados ao gerenciamento de cadastros, pontuação, cashback, retenção e comunicação com clientes.' },
      { type: 'paragraph', text: '2. A BISW é responsável pelo desenvolvimento, manutenção, infraestrutura tecnológica, autenticação, integridade dos dados e segurança da informação da plataforma Leva+.' },
      { type: 'paragraph', text: '3. O LOJISTA PARCEIRO, por sua vez, é responsável pelas operações comerciais, campanhas e regras de pontuação, atuando: como Controlador de Dados em relação às informações de suas vendas e fidelização; e como Operador, nos casos em que tratar dados pessoais sob orientação e supervisão da BISW.' },
      { type: 'paragraph', text: '4. As condições financeiras, valores de implantação, mensalidades e eventuais taxas aplicáveis ao uso do Programa Leva+ Fidelidade encontram-se especificadas na Proposta Comercial firmada entre as partes, a qual integra este contrato para todos os fins, com igual força obrigatória.' },
      { type: 'section', text: 'CLÁUSULA 2ª – RESPONSABILIDADES DO LOJISTA PARCEIRO' },
      { type: 'paragraph', text: '2.2. É de responsabilidade exclusiva do LOJISTA PARCEIRO assegurar a estabilidade de sua rede, equipamentos e conexões de internet necessários ao correto funcionamento do sistema.' },
      { type: 'paragraph', text: '2.3. O LOJISTA obriga-se a respeitar o período de fidelização definido pelo usuário, sendo expressamente vedado induzir, promover ou realizar qualquer ação que resulte na troca antecipada da rede favorita.' },
      { type: 'paragraph', text: '2.4. O uso de dados de clientes não vinculados como rede favorita é terminantemente proibido. Durante o período de fidelização, apenas a Rede Favorita poderá visualizar dados de contato (nome, telefone e e-mail) — redes não favoritas terão acesso apenas a dados limitados (nome, cidade, estado e país).' },
      { type: 'paragraph', text: '2.5. O descumprimento das obrigações acima sujeita o LOJISTA às penalidades previstas na Cláusula 6ª.' },
      { type: 'section', text: 'CLÁUSULA 3ª – REGRAS DE FUNCIONAMENTO DO PROGRAMA' },
      { type: 'paragraph', text: '3.1. Cada cliente cadastrado vincular-se-á a uma Rede Favorita (grupo de lojas ou postos), com fidelização mínima de 90 (noventa) dias, podendo optar voluntariamente por períodos estendidos de 6 (seis), 9 (nove) ou 12 (doze) meses, conforme escolha realizada no momento do cadastro.' },
      { type: 'paragraph', text: '3.2. Durante o período de fidelização, o cliente poderá pontuar e resgatar em outras redes, que serão tratadas como redes secundárias, sem acesso aos dados completos do titular.' },
      { type: 'paragraph', text: '3.3. A Rede Favorita que oferecer períodos de retenção superiores a 90 dias poderá conceder bonificações adicionais progressivas sobre os pontos ou cashback do cliente, conforme política própria e informada de forma clara ao cliente.' },
      { type: 'paragraph', text: '3.4. Ao término do período escolhido, o cliente será notificado pela plataforma via e-mail ou notificação eletrônica para confirmar ou renovar sua fidelização. A ausência de resposta implicará a liberação automática da troca de rede.' },
      { type: 'paragraph', text: '3.5. O LOJISTA PARCEIRO obriga-se a respeitar integralmente o prazo de fidelização eleito pelo cliente, sob pena de multa e bloqueio da conta.' },
      { type: 'paragraph', text: '3.6. As regras comerciais (pontuação, prazos de validade, mínimos e máximos de resgate, etc.) são definidas exclusivamente pelo LOJISTA, devendo ser informadas de forma clara e acessível aos usuários.' },
      { type: 'section', text: 'CLÁUSULA 4ª – TRATAMENTO DE DADOS PESSOAIS' },
      { type: 'paragraph', text: '4.1. O Programa Leva+ coleta apenas os dados necessários à execução do serviço, sendo obrigatórios: nome, CPF, cidade, estado e país. O campo "endereço completo" é opcional.' },
      { type: 'paragraph', text: '4.2. O tratamento de dados observará as bases legais do art. 7º da Lei nº 13.709/2018 (LGPD), especialmente: execução contratual (inc. V); legítimo interesse (inc. IX); cumprimento de obrigação legal (inc. II); e consentimento (inc. I), quando aplicável.' },
      { type: 'paragraph', text: '4.3. Redes não favoritas têm acesso limitado a dados básicos de identificação, sendo vedado o uso para marketing, contato direto ou qualquer forma de tratamento autônomo.' },
      { type: 'paragraph', text: '4.4. O LOJISTA PARCEIRO assume integral responsabilidade por qualquer tratamento de dados fora das hipóteses permitidas, respondendo administrativa, civil e criminalmente por violações à LGPD.' },
      { type: 'section', text: 'CLÁUSULA 5ª – SEGURANÇA E CONFORMIDADE DIGITAL' },
      { type: 'paragraph', text: '5.1. A BISW mantém infraestrutura tecnológica compatível com os mais elevados padrões de segurança (criptografia, logs de auditoria, controle de acesso e backup).' },
      { type: 'paragraph', text: '5.2. O LOJISTA PARCEIRO deverá adotar práticas mínimas de proteção, incluindo senhas seguras, restrição de acesso por perfil e confidencialidade dos dados de clientes.' },
      { type: 'paragraph', text: '5.3. A BISW poderá realizar auditorias técnicas remotas em casos de suspeita de uso indevido de dados ou violação de regras de fidelização, comprometendo-se a resguardar o sigilo comercial das informações auditadas.' },
      { type: 'section', text: 'CLÁUSULA 6ª – INFRAÇÕES E PENALIDADES' },
      { type: 'paragraph', text: '6.1. Configuram infração grave: uso de dados de clientes não favoritos; tentativa de manipular o vínculo de fidelização; envio indevido de comunicações; indução à troca antecipada de rede; vazamento ou compartilhamento de dados a terceiros.' },
      { type: 'paragraph', text: '6.2. A violação de qualquer dessas condutas sujeitará o LOJISTA PARCEIRO, sem prejuízo das sanções legais, a: 1. multa compensatória de R$ 10.000,00 (dez mil reais) por ocorrência; 2. bloqueio temporário ou definitivo do acesso à plataforma; 3. rescisão imediata do contrato, com perda de benefícios e bloqueio de campanhas ativas; 4. comunicação à Autoridade Nacional de Proteção de Dados (ANPD), quando aplicável.' },
      { type: 'paragraph', text: '6.3. O LOJISTA responderá também por eventuais danos materiais, morais e reputacionais sofridos pela BISW ou por usuários, de forma solidária nos termos do art. 42 da LGPD.' },
      { type: 'section', text: 'CLÁUSULA 7ª – PROPRIEDADE INTELECTUAL' },
      { type: 'paragraph', text: '7.1. Todas as marcas, layouts, softwares, algoritmos, banco de dados e demais ativos relacionados à plataforma Leva+ são de propriedade exclusiva da BISW.' },
      { type: 'paragraph', text: '7.2. É vedada ao LOJISTA PARCEIRO a cópia, distribuição, engenharia reversa, sublicenciamento ou exploração comercial do sistema fora do escopo deste contrato.' },
      { type: 'section', text: 'CLÁUSULA 8ª – PRAZO E RESCISÃO' },
      { type: 'paragraph', text: '8.1. O presente contrato é celebrado por prazo mínimo de 12 (doze) meses, contados a partir da data da assinatura eletrônica, prorrogando-se automaticamente por iguais períodos, salvo manifestação expressa em sentido contrário por qualquer das partes, mediante aviso prévio de 30 (trinta) dias antes do vencimento.' },
      { type: 'paragraph', text: '8.2. A proposta comercial assinada pelo LOJISTA PARCEIRO integra o presente contrato para todos os fins, constituindo um único instrumento jurídico. As condições financeiras, valores e periodicidade das mensalidades constam exclusivamente da referida proposta.' },
      { type: 'paragraph', text: '8.3. A aceitação da proposta comercial implica, de forma automática e irrevogável, a aceitação integral deste contrato e de todos os seus anexos, dispensando assinatura física adicional.' },
      { type: 'paragraph', text: '8.4. O cancelamento antecipado deste contrato, por iniciativa do LOJISTA PARCEIRO, antes do término do período mínimo de 12 (doze) meses, ensejará o pagamento de multa compensatória correspondente a 50% (cinquenta por cento) do valor total das mensalidades vincendas, calculadas com base na data do efetivo pedido de rescisão.' },
      { type: 'paragraph', text: '8.5. A multa prevista nesta cláusula tem natureza compensatória e não penal, sendo devida independentemente de notificação prévia, e poderá ser cobrada pela BISW de forma imediata, inclusive mediante compensação automática de valores devidos.' },
      { type: 'paragraph', text: '8.6. A BISW poderá rescindir o contrato, de pleno direito e sem ônus, em caso de descumprimento de obrigações contratuais, má utilização da plataforma, inadimplemento superior a 30 (trinta) dias ou violação das normas da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).' },
      { type: 'section', text: 'CLÁUSULA 9ª – LIMITAÇÃO DE RESPONSABILIDADE' },
      { type: 'paragraph', text: '9.1. A BISW não se responsabiliza por falhas de conexão, inatividade de PDV, erro de digitação ou negligência operacional do lojista.' },
      { type: 'paragraph', text: '9.2. O uso indevido de dados, manipulação de cadastros ou violação do prazo de fidelização não estão cobertos pela limitação de responsabilidade, sendo considerados atos dolosos e excludentes da limitação prevista nesta cláusula.' },
      { type: 'paragraph', text: '9.3. A responsabilidade financeira da BISW, em qualquer hipótese, fica limitada ao valor máximo de R$ 1.000,00 (mil reais), mesmo em casos de dolo ou culpa grave.' },
      { type: 'section', text: 'CLÁUSULA 10ª – COMUNICAÇÕES E ASSINATURA ELETRÔNICA' },
      { type: 'paragraph', text: '10.1. As comunicações entre as partes ocorrerão preferencialmente por meio eletrônico, nos endereços informados no cadastro.' },
      { type: 'paragraph', text: '10.2. O presente contrato será formalizado por assinatura digital, nos termos da MP nº 2.200-2/2001 e da Lei nº 14.063/2020, possuindo plena validade jurídica e força probatória.' },
      { type: 'section', text: 'CLÁUSULA 11ª – LEI APLICÁVEL E FORO' },
      { type: 'paragraph', text: '11.1. O presente contrato é regido pelas leis da República Federativa do Brasil, especialmente o Código Civil, a Lei nº 13.709/2018 (LGPD) e a Lei nº 12.965/2014 (Marco Civil da Internet).' },
      { type: 'paragraph', text: '11.2. Fica eleito o Foro da Comarca do Rio de Janeiro/RJ, com renúncia a qualquer outro, por mais privilegiado que seja.' },
      { type: 'paragraph', text: 'A Proposta Comercial, este Contrato e seus anexos constituem o acordo integral entre as partes, substituindo quaisquer entendimentos anteriores. A assinatura eletrônica da proposta implica aceite imediato e integral do presente contrato.' },
      { type: 'paragraph', text: 'E, por estarem assim justas e contratadas, as partes firmam o presente instrumento por meio eletrônico, com validade jurídica plena, nos termos da legislação em vigor.' }
    ];

    // Renderizar conteúdo do termo
    termContent.forEach((item) => {
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        addHeaderFooter();
        yPosition = 30;
        pdf.setTextColor(0, 0, 0); // Garantir que o texto seja preto
      }

      if (item.type === 'title') {
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        const titleLines = pdf.splitTextToSize(item.text, pageWidth - 30);
        pdf.text(titleLines, 15, yPosition);
        yPosition += (titleLines.length * 5) + 5;
      } else if (item.type === 'section') {
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        const sectionLines = pdf.splitTextToSize(item.text, pageWidth - 30);
        pdf.text(sectionLines, 15, yPosition);
        yPosition += (sectionLines.length * 5) + 3;
      } else if (item.type === 'paragraph') {
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        const paragraphLines = pdf.splitTextToSize(item.text, pageWidth - 30);
        pdf.text(paragraphLines, 15, yPosition);
        yPosition += (paragraphLines.length * 4) + 3;
      }
    });

    // Adicionar espaço antes das assinaturas
    yPosition += 10;
    
    // Se não houver espaço suficiente para assinaturas, adicionar nova página
    if (yPosition > pageHeight - 50) {
      pdf.addPage();
      addHeaderFooter();
      yPosition = 30;
    }

    // Data centralizada (data atual em português)
    pdf.setTextColor(0, 0, 0);
    const currentDate = new Date();
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 
                    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const dateString = `Rio de Janeiro - ${currentDate.getDate()} de ${months[currentDate.getMonth()]} de ${currentDate.getFullYear()}`;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(dateString, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;

    // Linhas de assinatura
    const signatureLineWidth = 60;
    const leftX = 15;
    const rightX = pageWidth - 15 - signatureLineWidth;

    // Linha esquerda - BISW Solutions
    pdf.line(leftX, yPosition, leftX + signatureLineWidth, yPosition);
    pdf.setFontSize(9);
    pdf.text('BISW Solutions', leftX + signatureLineWidth / 2, yPosition + 5, { align: 'center' });

    // Linha direita - Rede/Empresa
    pdf.line(rightX, yPosition, rightX + signatureLineWidth, yPosition);
    const companyName = viewingBudget.networks?.name || 'Rede Cruzada';
    pdf.text(companyName, rightX + signatureLineWidth / 2, yPosition + 5, { align: 'center' });
    pdf.text('(Rep. Legal)', rightX + signatureLineWidth / 2, yPosition + 9, { align: 'center' });

    // Salvar PDF
    pdf.save(`Proposta_${viewingBudget.budget_number}.pdf`);
    
    toast({
      title: "PDF gerado",
      description: "O PDF da proposta foi baixado com sucesso.",
    });
  };

  const generateAuditPDF = async () => {
    if (!viewingBudget) return;

    setIsGeneratingAuditPDF(true);
    try {
      toast({
        title: "Gerando proposta assinada",
        description: "Por favor aguarde...",
      });

      // Gerar HTML de auditoria via edge function
      const { data, error } = await supabase.functions.invoke('generate-audit-pdf', {
        body: { budget_id: viewingBudget.id },
      });

      if (error) throw error;

      // Criar elemento temporário para renderizar HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = data.html;
      tempDiv.style.width = '210mm';
      tempDiv.style.padding = '0';
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);

      // Capturar como canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 800,
        windowHeight: tempDiv.scrollHeight,
      });

      // Remover elemento temporário
      document.body.removeChild(tempDiv);

      // Criar novo PDF apenas com o documento de auditoria
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Primeira página
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= 297;

      // Páginas adicionais se necessário
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= 297;
      }

      // Salvar PDF de auditoria
      pdf.save(`Proposta_Assinada_${viewingBudget.budget_number}.pdf`);

      toast({
        title: "Proposta assinada gerada!",
        description: "O documento foi baixado com sucesso.",
      });
    } catch (error: any) {
      console.error('Erro ao gerar proposta assinada:', error);
      toast({
        title: "Erro ao gerar documento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAuditPDF(false);
    }
  };

  // Função auxiliar para gerar objeto PDF da proposta (sem fazer download)
  const generateProposalPDFObject = async (): Promise<jsPDF | null> => {
    if (!viewingBudget || !viewingBudgetItems) return null;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;

    // Calcular totais únicos e recorrentes
    let totalUnique = 0;
    let totalRecurring = 0;
    let hasProducts = false;
    let hasDiscount = false;

    viewingBudgetItems.forEach((item: any) => {
      const product = products.find(p => p.id === item.product_service_id);
      if (product) {
        if (product.type === 'product') {
          hasProducts = true;
        }
        if (product.is_recurring) {
          totalRecurring += item.total_value;
        } else {
          totalUnique += item.total_value;
        }
        if (item.discount_amount && item.discount_amount > 0) {
          hasDiscount = true;
        }
      }
    });

    // Função para adicionar cabeçalho e rodapé
    const addHeaderFooter = () => {
      pdf.setFillColor(64, 185, 217);
      pdf.rect(0, 0, pageWidth, 20, 'F');
      
      pdf.setFillColor(64, 185, 217);
      pdf.rect(0, pageHeight - 25, pageWidth, 25, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.text('BISW Solutions - 19.404.744/0001-08', pageWidth / 2, pageHeight - 17, { align: 'center' });
      pdf.text('Av. Alm Julio de Sá Bierrenbach, 65 - Barra da Tijuca - Rio de Janeiro/RJ', pageWidth / 2, pageHeight - 12, { align: 'center' });
      pdf.text('Telefone: (21) 3950-7641 | E-mail: comercial@levamais.app', pageWidth / 2, pageHeight - 7, { align: 'center' });
    };

    // Página 1 - Capa
    addHeaderFooter();

    const img = new Image();
    img.src = logoDark;
    await new Promise((resolve) => {
      img.onload = resolve;
    });
    pdf.addImage(img, 'PNG', pageWidth / 2 - 50, 80, 100, 25);

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(28);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Proposta Comercial', pageWidth / 2, 140, { align: 'center' });
    
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Leva+ Fidelidade', pageWidth / 2, 155, { align: 'center' });

    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(64, 185, 217);
    pdf.text(viewingBudget.budget_number, pageWidth / 2, 180, { align: 'center' });

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Validade da proposta: ${format(new Date(viewingBudget.expires_at), 'dd/MM/yyyy')}`, pageWidth / 2, 200, { align: 'center' });

    const seller = sellers.find(s => s.id === viewingBudget.seller_id);
    if (seller) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Vendedor: ${seller.full_name}`, pageWidth - 15, pageHeight - 35, { align: 'right' });
    }

    // Página 2 - Detalhes
    pdf.addPage();
    addHeaderFooter();
    pdf.setTextColor(0, 0, 0);

    let yPosition = 30;

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Informações do Solicitante', 15, yPosition);
    yPosition += 7;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Nome: ${viewingBudget.requester_name}`, 15, yPosition);
    yPosition += 5;
    pdf.text(`Email: ${viewingBudget.requester_email}`, 15, yPosition);
    yPosition += 5;
    pdf.text(`Telefone: ${viewingBudget.requester_phone}`, 15, yPosition);
    yPosition += 5;
    if (viewingBudget.networks?.name) {
      pdf.text(`Empresa: ${viewingBudget.networks.name}`, 15, yPosition);
      yPosition += 5;
    }
    yPosition += 8;

    if (viewingBudget.cnpjs && viewingBudget.cnpjs.length > 0) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('CNPJs', 15, yPosition);
      yPosition += 7;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      viewingBudget.cnpjs.forEach((cnpjItem: any) => {
        const cnpjFormatted = cnpjItem.cnpj.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
        const razaoSocial = cnpjItem.razao_social || 'Razão Social não informada';
        pdf.text(`${cnpjFormatted} - ${razaoSocial}`, 15, yPosition);
        yPosition += 6;
      });
      yPosition += 3;
    }

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Itens da Proposta', 15, yPosition);
    yPosition += 7;

    const tableColumns = ['Produto/Serviço', 'Tipo', 'Qtd', 'Valor Unit.'];
    if (hasDiscount) {
      tableColumns.push('Desconto');
    }
    tableColumns.push('Total');

    const tableData = viewingBudgetItems.map((item: any) => {
      const product = products.find(p => p.id === item.product_service_id);
      const productType = product?.type === 'product' ? 'Produto' : 'Serviço';
      const row = [
        `${product?.code} - ${product?.name}`,
        productType,
        `${item.quantity} ${product?.unit_of_measure || ''}`,
        formatCurrency(item.unit_value)
      ];
      
      if (hasDiscount) {
        row.push(
          item.discount_amount > 0 
            ? (item.discount_type === 'percentage' ? `${item.discount_amount}%` : formatCurrency(item.discount_amount))
            : '-'
        );
      }
      
      row.push(formatCurrency(item.total_value));
      return row;
    });

    autoTable(pdf, {
      startY: yPosition,
      head: [tableColumns],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [64, 185, 217], textColor: 255 },
      styles: { fontSize: 9 },
    });

    yPosition = (pdf as any).lastAutoTable.finalY + 10;

    if (hasProducts && viewingBudget.products_total > 0) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Subtotal Produtos:', pageWidth - 80, yPosition);
      pdf.text(formatCurrency(viewingBudget.products_total), pageWidth - 15, yPosition, { align: 'right' });
      yPosition += 6;
    }
    
    if (viewingBudget.freight_value > 0) {
      pdf.text('Frete:', pageWidth - 80, yPosition);
      pdf.text(formatCurrency(viewingBudget.freight_value), pageWidth - 15, yPosition, { align: 'right' });
      yPosition += 6;
    }
    
    yPosition += 4;

    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    
    if (totalUnique > 0) {
      pdf.text('Total Único:', pageWidth - 80, yPosition);
      pdf.setTextColor(64, 185, 217);
      pdf.text(formatCurrency(totalUnique), pageWidth - 15, yPosition, { align: 'right' });
      yPosition += 7;
    }
    
    if (totalRecurring > 0) {
      pdf.setTextColor(0, 0, 0);
      pdf.text('Total Recorrente:', pageWidth - 80, yPosition);
      pdf.setTextColor(64, 185, 217);
      pdf.text(formatCurrency(totalRecurring), pageWidth - 15, yPosition, { align: 'right' });
    }

    return pdf;
  };

  const handleSendWhatsApp = () => {
    if (!viewingBudget) return;

    const message = `*PROPOSTA COMERCIAL - ${viewingBudget.budget_number}*\n\n` +
      `Olá ${viewingBudget.requester_name}!\n\n` +
      `Segue nossa proposta comercial:\n\n` +
      `💰 *Valor Total:* ${formatCurrency(viewingBudget.total_value)}\n` +
      `📅 *Válido até:* ${format(new Date(viewingBudget.expires_at), 'dd/MM/yyyy')}\n\n` +
      `Para mais detalhes, acesse o link da proposta completa.\n\n` +
      `Estamos à disposição para quaisquer dúvidas!`;

    const whatsappUrl = `https://wa.me/55${viewingBudget.requester_phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleSendEmail = async () => {
    if (!viewingBudget) return;

    // Determinar qual email usar
    let emailToSend = "";
    if (emailOption === "requester") {
      emailToSend = viewingBudget.requester_email;
    } else if (emailOption === "network") {
      // Por enquanto não temos email na rede
      toast({
        title: "Funcionalidade em desenvolvimento",
        description: "O email da rede ainda não está disponível. Use a opção personalizada.",
        variant: "destructive",
      });
      return;
    } else {
      emailToSend = customEmail.trim();
      // Validar email customizado
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailToSend)) {
        toast({
          title: "Erro",
          description: "Digite um email válido.",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setShowEmailDialog(false);

      // Chamar edge function para enviar email com link de aprovação
      const { data, error } = await supabase.functions.invoke('send-budget-approval-email', {
        body: {
          budget_id: viewingBudget.id,
          recipient_email: emailToSend,
        },
      });

      if (error) throw error;

      toast({
        title: "Email enviado!",
        description: "A proposta foi enviada com sucesso para " + emailToSend,
      });

      // Recarregar orçamentos para atualizar status
      await loadBudgets();
      
      // Se estiver visualizando, recarregar dados atualizados
      if (viewingBudget) {
        const updatedBudget = budgets.find(b => b.id === viewingBudget.id);
        if (updatedBudget) {
          setViewingBudget(updatedBudget);
        }
      }

      // Resetar estados
      setEmailOption("requester");
      setCustomEmail("");
    } catch (error: any) {
      toast({
        title: "Erro ao enviar email",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const { productsTotal, servicesUniqueTotal, servicesRecurringTotal, servicesTotal, totalDiscount } = calculateTotals(budgetItems);
  const freightValue = parseFloat(form.watch("freight_value") || "0");
  const grandTotal = productsTotal + servicesTotal + freightValue;

  const statusColumns = [
    { id: "draft", label: "Rascunho", color: "bg-gray-100" },
    { id: "sent", label: "Enviado", color: "bg-blue-100" },
    { id: "pending_internal_approval", label: "Pend. Aprovação", color: "bg-yellow-100" },
    { id: "approved", label: "Aprovado", color: "bg-green-100" },
    { id: "declined", label: "Recusado", color: "bg-red-100" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orçamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie orçamentos e propostas comerciais</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) {
            form.reset();
            setBudgetItems([]);
            setIsFromLead(false);
            setLeadCompany("");
          }
          setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Orçamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Orçamento</DialogTitle>
              <DialogDescription>
                Preencha os dados do orçamento
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Dados do Cliente */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Dados do Solicitante</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {isFromLead && leadCompany ? (
                      <div className="col-span-2">
                        <FormLabel>Empresa</FormLabel>
                        <Input value={leadCompany} disabled className="bg-muted" />
                        <p className="text-xs text-muted-foreground mt-1">
                          Empresa do lead - para vincular à rede, edite após criar o orçamento
                        </p>
                      </div>
                    ) : (
                      <FormField
                        control={form.control}
                        name="network_id"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Rede *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione a rede" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {networks.map((network) => (
                                  <SelectItem key={network.id} value={network.id}>
                                    {network.name}
                                    {network.status === 'negotiation' && (
                                      <span className="ml-2 text-xs text-orange-600">(Em Negociação)</span>
                                    )}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="seller_id"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Vendedor Responsável *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o vendedor" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {sellers.map((seller) => (
                                <SelectItem key={seller.id} value={seller.id}>
                                  {seller.full_name || seller.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="requester_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Nome do solicitante" maxLength={LIMITS.NAME} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="requester_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="email@exemplo.com" maxLength={LIMITS.EMAIL} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="requester_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="(00) 00000-0000" maxLength={LIMITS.PHONE} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="temperature"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Temperatura</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="cold">Frio</SelectItem>
                              <SelectItem value="warm">Morno</SelectItem>
                              <SelectItem value="hot">Quente</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* Itens do Orçamento */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Itens do Orçamento
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-5">
                      <label className="text-sm font-medium">Produto/Serviço</label>
                      <select id="product-select" className="w-full mt-1.5 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="">Selecione...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.code} - {p.name} ({p.type === 'product' ? 'Produto' : p.is_recurring ? 'Serviço Recorrente' : 'Serviço Único'}) - {formatCurrency(p.sale_value)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-1">
                      <label className="text-sm font-medium">Qtd</label>
                      <Input id="quantity-input" type="number" min="1" defaultValue="1" className="mt-1.5" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Desconto</label>
                      <select id="discount-type" className="w-full mt-1.5 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="">Sem desconto</option>
                        <option value="percentage">Percentual (%)</option>
                        <option value="value">Valor (R$)</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Valor Desc.</label>
                      <Input id="discount-amount" type="number" min="0" step="0.01" defaultValue="0" className="mt-1.5" />
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      <Button type="button" onClick={handleAddItem} className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar
                      </Button>
                    </div>
                  </div>

                  {budgetItems.length > 0 && (
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto/Serviço</TableHead>
                            <TableHead className="text-center">Qtd</TableHead>
                            <TableHead className="text-right">Valor Unit.</TableHead>
                            <TableHead className="text-right">Desconto</TableHead>
                            <TableHead className="text-right">Valor c/ Desc.</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {budgetItems.map((item, index) => {
                            const product = products.find(p => p.id === item.product_service_id);
                            const hasDiscount = item.discount_amount && item.discount_amount > 0;
                            return (
                              <TableRow key={index}>
                                <TableCell>
                                  {product?.code} - {product?.name}
                                  <Badge variant="outline" className="ml-2">
                                    {product?.type === 'product' ? 'Produto' : product?.is_recurring ? 'Serviço Recorrente' : 'Serviço Único'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">{item.quantity} {product?.unit_of_measure}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.unit_value)}</TableCell>
                                <TableCell className="text-right">
                                  {hasDiscount ? (
                                    <span className="text-green-600">
                                      {item.discount_type === 'percentage' 
                                        ? `${item.discount_amount}%` 
                                        : formatCurrency(item.discount_amount)}
                                    </span>
                                  ) : '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {hasDiscount ? (
                                    <span className="font-medium">{formatCurrency(item.unit_value_with_discount)}</span>
                                  ) : '-'}
                                </TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(item.total_value)}</TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveItem(index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Totalizadores */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Produtos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatCurrency(productsTotal)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Serviços Únicos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatCurrency(servicesUniqueTotal)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Serviços Recorrentes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatCurrency(servicesRecurringTotal)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-primary">{formatCurrency(grandTotal)}</p>
                    </CardContent>
                  </Card>
                </div>

                {totalDiscount > 0 && (
                  <>
                    <Separator />
                    <Card className="border-green-200 bg-green-50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-green-700">Desconto Total Aplicado</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-green-600">-{formatCurrency(totalDiscount)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Economia total concedida</p>
                      </CardContent>
                    </Card>
                  </>
                )}

                <Separator />

                {/* Dados Adicionais */}
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="expires_at"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Validade *</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expected_closing_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Previsão Fechamento</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="freight_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor do Frete</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="0.00" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* CNPJs e Observações */}
                <div className="space-y-4">
                  <FormField
                     control={form.control}
                    name="cnpjs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJs (Opcional)</FormLabel>
                        <FormControl>
                          <CNPJManager
                            value={(field.value || []) as CNPJItem[]}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="observations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações da Proposta</FormLabel>
                        <FormControl>
                          <textarea 
                            {...field} 
                            maxLength={LIMITS.LONG_TEXT}
                            className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                            placeholder="Digite aqui observações sobre a proposta..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Condições de Pagamento */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Condições de Pagamento</h3>
                  
                  <FormField
                    control={form.control}
                    name="payment_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Forma de Pagamento</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a forma de pagamento" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="boleto">Boleto</SelectItem>
                            <SelectItem value="pix">PIX</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="products_installments_count"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parcelamento Produtos</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" min="1" max="12" placeholder="1" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="unique_services_installments_count"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parcelamento Serviços Únicos</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" min="1" max="12" placeholder="1" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Cancelar
                    </Button>
                  </DialogClose>
                  <Button type="submit">
                    {editingBudget ? 'Atualizar Orçamento' : 'Criar Orçamento'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número ou solicitante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="sent">Enviado</SelectItem>
            <SelectItem value="pending_internal_approval">Pend. Aprovação</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="declined">Recusado</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 border rounded-lg p-1">
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "kanban" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("kanban")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Rede</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Único</TableHead>
                <TableHead className="text-right">Mensal</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredBudgets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center">
                    Nenhum orçamento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredBudgets.map((budget) => (
                  <TableRow key={budget.id}>
                    <TableCell className="font-mono font-medium">{budget.budget_number}</TableCell>
                    <TableCell>{budget.networks?.name}</TableCell>
                    <TableCell>{budget.requester_name}</TableCell>
                    <TableCell>{getStatusBadge(budget.status)}</TableCell>
                    <TableCell>{getEmailStatusBadge(budget)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(budget.unique_total || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(budget.recurring_total || 0)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(budget.total_value)}</TableCell>
                    <TableCell>{format(new Date(budget.expires_at), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleView(budget)}
                          title="Ver Proposta"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(budget)}
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(budget)}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-4">
          {statusColumns.map((column) => {
            const columnBudgets = filteredBudgets.filter(b => b.status === column.id);
            return (
              <div key={column.id} className="space-y-3">
                <div className={`${column.color} p-3 rounded-lg`}>
                  <h3 className="font-semibold text-sm">{column.label}</h3>
                  <p className="text-xs text-muted-foreground">{columnBudgets.length} orçamentos</p>
                </div>
                <div className="space-y-2">
                  {columnBudgets.map((budget) => (
                    <Card key={budget.id} className="p-3 cursor-pointer hover:shadow-md transition-shadow">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <span className="font-mono text-xs font-medium">{budget.budget_number}</span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleView(budget)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleEdit(budget)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Rede</p>
                          <p className="text-sm font-medium truncate">{budget.networks?.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Solicitante</p>
                          <p className="text-sm truncate">{budget.requester_name}</p>
                        </div>
                        <div className="pt-2 border-t space-y-1">
                          {budget.unique_total! > 0 && (
                            <div className="flex justify-between">
                              <span className="text-xs text-muted-foreground">Único:</span>
                              <span className="text-xs font-medium">{formatCurrency(budget.unique_total || 0)}</span>
                            </div>
                          )}
                          {budget.recurring_total! > 0 && (
                            <div className="flex justify-between">
                              <span className="text-xs text-muted-foreground">Mensal:</span>
                              <span className="text-xs font-medium">{formatCurrency(budget.recurring_total || 0)}</span>
                            </div>
                          )}
                          <div className="flex justify-between pt-1 border-t">
                            <span className="text-xs font-semibold">Total:</span>
                            <span className="text-sm font-bold text-primary">{formatCurrency(budget.total_value)}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Validade</p>
                          <p className="text-xs">{format(new Date(budget.expires_at), 'dd/MM/yyyy')}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {columnBudgets.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      Nenhum orçamento
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog de Visualização do Orçamento */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Orçamento {viewingBudget?.budget_number}</DialogTitle>
            <DialogDescription>
              Visualize os detalhes completos do orçamento
            </DialogDescription>
          </DialogHeader>

          {/* Botões de Ação */}
          <div className="flex gap-3 pb-4 border-b">
            <Button
              onClick={handleSendWhatsApp}
              className="flex-1"
              variant="outline"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Enviar WhatsApp
            </Button>
            <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
              <DialogTrigger asChild>
                <Button
                  className="flex-1"
                  variant="outline"
                  disabled={isSubmitting}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar E-mail
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enviar Proposta por E-mail</DialogTitle>
                  <DialogDescription>
                    Escolha para qual e-mail deseja enviar a proposta
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <RadioGroup value={emailOption} onValueChange={(value: any) => setEmailOption(value)}>
                    <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                      <RadioGroupItem value="requester" id="requester" />
                      <Label htmlFor="requester" className="flex-1 cursor-pointer">
                        <div className="font-medium">E-mail solicitante/Lead</div>
                        <div className="text-sm text-muted-foreground">{viewingBudget?.requester_email}</div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer opacity-50">
                      <RadioGroupItem value="network" id="network" disabled />
                      <Label htmlFor="network" className="flex-1 cursor-pointer">
                        <div className="font-medium">E-mail da Empresa/Rede</div>
                        <div className="text-sm text-muted-foreground">(Em breve)</div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                      <RadioGroupItem value="custom" id="custom" />
                      <Label htmlFor="custom" className="flex-1 cursor-pointer">
                        <div className="font-medium">E-mail Personalizado</div>
                        <div className="text-sm text-muted-foreground">Digite um e-mail específico</div>
                      </Label>
                    </div>
                  </RadioGroup>

                  {emailOption === "custom" && (
                    <div className="space-y-2">
                      <Label htmlFor="custom-email">E-mail</Label>
                      <Input
                        id="custom-email"
                        type="email"
                        placeholder="cliente@exemplo.com"
                        value={customEmail}
                        onChange={(e) => setCustomEmail(e.target.value)}
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <DialogClose asChild>
                    <Button variant="outline">Cancelar</Button>
                  </DialogClose>
                  <Button onClick={handleSendEmail} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                    Enviar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              onClick={generatePDF}
              variant="outline"
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar Proposta
            </Button>
            {viewingBudget?.status === 'approved' && (
              <Button
                onClick={generateAuditPDF}
                className="flex-1"
                disabled={isGeneratingAuditPDF}
              >
                {isGeneratingAuditPDF ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Proposta Assinada
              </Button>
            )}
          </div>

          {viewingBudget && (
            <div className="space-y-6">
              {/* Informações Gerais */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações Gerais</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Rede</p>
                    <p className="font-medium">{viewingBudget.networks?.name || 'Não informado'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <div className="mt-2">
                      <Select 
                        value={viewingBudget.status} 
                        onValueChange={(value) => handleStatusChange(viewingBudget.id, value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Rascunho</SelectItem>
                          <SelectItem value="sent">Enviado</SelectItem>
                          <SelectItem value="pending_internal_approval">Pend. Aprovação</SelectItem>
                          <SelectItem value="approved">Aprovado</SelectItem>
                          <SelectItem value="declined">Recusado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data de Validade</p>
                    <p className="font-medium">{format(new Date(viewingBudget.expires_at), 'dd/MM/yyyy')}</p>
                  </div>
                  {viewingBudget.status === 'declined' && viewingBudget.decline_reason && (
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Motivo da Recusa</p>
                      <p className="font-medium text-destructive">{viewingBudget.decline_reason}</p>
                    </div>
                  )}
                  {viewingBudget.expected_closing_date && (
                    <div>
                      <p className="text-sm text-muted-foreground">Data Prevista de Fechamento</p>
                      <p className="font-medium">{format(new Date(viewingBudget.expected_closing_date), 'dd/MM/yyyy')}</p>
                    </div>
                  )}
                  {viewingBudget.temperature && (
                    <div>
                      <p className="text-sm text-muted-foreground">Temperatura</p>
                      <p className="font-medium capitalize">{viewingBudget.temperature}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Dados do Solicitante */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Dados do Solicitante</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium">{viewingBudget.requester_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{viewingBudget.requester_email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="font-medium">{viewingBudget.requester_phone}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Contato Financeiro */}
              {viewingBudget.financial_contact_name && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Contato Financeiro</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Nome</p>
                      <p className="font-medium">{viewingBudget.financial_contact_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{viewingBudget.financial_contact_email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Telefone</p>
                      <p className="font-medium">{viewingBudget.financial_contact_phone}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* CNPJs */}
              {viewingBudget.cnpjs && viewingBudget.cnpjs.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">CNPJs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {viewingBudget.cnpjs.map((item, index) => (
                        <Badge key={index} variant="outline" className="font-mono px-3 py-2 text-sm flex items-center justify-start">
                          {item.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')} - {item.razao_social}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Observações */}
              {viewingBudget.observations && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Observações da Proposta</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap">{viewingBudget.observations}</p>
                  </CardContent>
                </Card>
              )}

              {/* Condições de Pagamento */}
              {viewingBudget.payment_type && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Condições de Pagamento</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Forma de Pagamento</p>
                      <p className="font-medium uppercase">{viewingBudget.payment_type}</p>
                    </div>
                    {viewingBudget.products_installments_count && viewingBudget.products_installments_count > 1 && (
                      <div>
                        <p className="text-sm text-muted-foreground">Parcelamento Produtos</p>
                        <p className="font-medium">{viewingBudget.products_installments_count}x</p>
                      </div>
                    )}
                    {viewingBudget.unique_services_installments_count && viewingBudget.unique_services_installments_count > 1 && (
                      <div>
                        <p className="text-sm text-muted-foreground">Parcelamento Serviços Únicos</p>
                        <p className="font-medium">{viewingBudget.unique_services_installments_count}x</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Itens do Orçamento */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Itens do Orçamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Valor Unit.</TableHead>
                        <TableHead className="text-right">Desconto</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingBudgetItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono">{item.products_services?.code}</TableCell>
                          <TableCell>{item.products_services?.name}</TableCell>
                          <TableCell>
                            <Badge variant={item.products_services?.type === 'product' ? 'default' : 'secondary'}>
                              {item.products_services?.type === 'product' ? 'Produto' : 'Serviço'}
                              {item.products_services?.is_recurring && ' (Recorrente)'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.unit_value)}</TableCell>
                          <TableCell className="text-right">
                            {item.discount_amount > 0 ? (
                              <span className="text-green-600">
                                {item.discount_type === 'percentage' 
                                  ? `${item.discount_amount}%` 
                                  : formatCurrency(item.discount_amount)}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(item.total_value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Totais */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Totais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(() => {
                    // Calcular totais únicos e recorrentes
                    let totalUnique = 0;
                    let totalRecurring = 0;
                    let hasProducts = false;

                    viewingBudgetItems.forEach((item: any) => {
                      const product = item.products_services;
                      if (product) {
                        if (product.type === 'product') {
                          hasProducts = true;
                        }
                        if (product.is_recurring) {
                          totalRecurring += item.total_value;
                        } else {
                          totalUnique += item.total_value;
                        }
                      }
                    });

                    return (
                      <>
                        {hasProducts && viewingBudget.products_total > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal Produtos:</span>
                            <span className="font-medium">{formatCurrency(viewingBudget.products_total)}</span>
                          </div>
                        )}
                        {viewingBudget.freight_value > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Frete:</span>
                            <span className="font-medium">{formatCurrency(viewingBudget.freight_value)}</span>
                          </div>
                        )}
                        <Separator />
                        {totalUnique > 0 && (
                          <div className="flex justify-between">
                            <span className="font-semibold">Total Único:</span>
                            <span className="font-bold text-primary">{formatCurrency(totalUnique)}</span>
                          </div>
                        )}
                        {totalRecurring > 0 && (
                          <div className="flex justify-between">
                            <span className="font-semibold">Total Recorrente:</span>
                            <span className="font-bold text-primary">{formatCurrency(totalRecurring)}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Formas de Pagamento */}
              {(viewingBudget.products_payment_method || viewingBudget.services_payment_method) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Formas de Pagamento</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    {viewingBudget.products_payment_method && (
                      <div>
                        <p className="text-sm text-muted-foreground">Produtos</p>
                        <p className="font-medium">{viewingBudget.products_payment_method} - {viewingBudget.products_installments}x</p>
                      </div>
                    )}
                    {viewingBudget.services_payment_method && (
                      <div>
                        <p className="text-sm text-muted-foreground">Serviços</p>
                        <p className="font-medium">{viewingBudget.services_payment_method} - {viewingBudget.services_installments}x</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orcamentos;
