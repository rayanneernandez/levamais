# Documentação: Módulos de Orçamento, Leads e Produtos/Serviços

## 📋 Índice
1. [Estrutura do Banco de Dados](#estrutura-do-banco-de-dados)
2. [Módulo de Produtos e Serviços](#módulo-de-produtos-e-serviços)
3. [Módulo de Leads](#módulo-de-leads)
4. [Módulo de Orçamentos](#módulo-de-orçamentos)
5. [Edge Functions](#edge-functions)
6. [Fluxo de Aprovação Digital](#fluxo-de-aprovação-digital)

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `products_services`
```sql
CREATE TABLE products_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'product' ou 'service'
  category_id UUID REFERENCES categories(id),
  unit_price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Tabela: `leads`
```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new', -- 'new', 'contacted', 'qualified', 'proposal', 'won', 'lost'
  temperature TEXT, -- 'cold', 'warm', 'hot'
  source TEXT NOT NULL DEFAULT 'website', -- 'website', 'whatsapp_button', 'referral', 'manual'
  assigned_to UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Tabela: `budgets`
```sql
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_number TEXT NOT NULL UNIQUE,
  
  -- Relacionamentos
  network_id UUID REFERENCES networks(id),
  lead_id UUID REFERENCES leads(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  seller_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Dados do Cliente
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_phone TEXT NOT NULL,
  cnpjs TEXT[] DEFAULT '{}',
  
  -- Contato Financeiro
  financial_contact_name TEXT,
  financial_contact_email TEXT,
  financial_contact_phone TEXT,
  financial_email TEXT,
  
  -- Valores
  total_value NUMERIC NOT NULL DEFAULT 0,
  products_total NUMERIC DEFAULT 0,
  services_total NUMERIC DEFAULT 0,
  freight_value NUMERIC DEFAULT 0,
  
  -- Condições de Pagamento - Produtos
  products_payment_method TEXT, -- 'boleto', 'pix', 'credit_card'
  products_installments INTEGER DEFAULT 1,
  products_installments_count INTEGER DEFAULT 1,
  products_first_payment_date DATE,
  
  -- Condições de Pagamento - Serviços
  services_payment_method TEXT,
  services_installments INTEGER DEFAULT 1,
  unique_services_installments_count INTEGER DEFAULT 1,
  services_first_payment_date DATE,
  
  payment_type TEXT, -- 'antecipado', 'parcelado'
  payment_due_days INTEGER,
  
  -- Status e Controle
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'sent', 'pending_approval', 'pending_internal_approval', 'approved', 'declined', 'expired'
  temperature TEXT,
  
  -- Datas
  expires_at TIMESTAMPTZ NOT NULL,
  expected_closing_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Aprovação do Cliente
  approval_token TEXT UNIQUE,
  approved_at TIMESTAMPTZ,
  approved_by_name TEXT,
  approved_by_cpf TEXT,
  approved_by_email TEXT,
  approved_by_position TEXT,
  approval_signature TEXT,
  approval_document_hash TEXT,
  approval_ip TEXT,
  approval_user_agent TEXT,
  approval_latitude NUMERIC,
  approval_longitude NUMERIC,
  approval_audit_pdf_url TEXT,
  
  -- Aprovação Interna (BISW)
  internal_approved_at TIMESTAMPTZ,
  internal_approved_by UUID REFERENCES profiles(id),
  internal_approved_by_name TEXT,
  internal_approved_by_email TEXT,
  internal_approved_by_cpf TEXT,
  internal_approval_ip TEXT,
  internal_approval_user_agent TEXT,
  internal_approval_document_hash TEXT,
  internal_approval_latitude NUMERIC,
  internal_approval_longitude NUMERIC,
  
  -- Aprovação BISW (Representante)
  bisw_approved_at TIMESTAMPTZ,
  bisw_approved_by_name TEXT,
  bisw_approved_by_cpf TEXT,
  bisw_approved_by_email TEXT,
  bisw_approved_by_position TEXT,
  bisw_approval_signature TEXT,
  bisw_approval_document_hash TEXT,
  bisw_approval_ip TEXT,
  bisw_approval_user_agent TEXT,
  bisw_approval_latitude NUMERIC,
  bisw_approval_longitude NUMERIC,
  
  -- Recusa
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,
  
  observations TEXT
);
```

### Tabela: `budget_items`
```sql
CREATE TABLE budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  product_service_id UUID REFERENCES products_services(id),
  
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'product' ou 'service'
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Tabela: `budget_verification_codes`
```sql
CREATE TABLE budget_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id),
  code TEXT NOT NULL,
  email TEXT NOT NULL,
  ip_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Tabela: `budget_internal_verification_codes`
```sql
CREATE TABLE budget_internal_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id),
  code TEXT NOT NULL,
  email TEXT NOT NULL,
  ip_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Tabela: `email_events`
```sql
CREATE TABLE email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID REFERENCES budgets(id),
  event_type TEXT NOT NULL, -- 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained'
  email_to TEXT NOT NULL,
  email_subject TEXT,
  resend_email_id TEXT,
  metadata JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 🛍️ Módulo de Produtos e Serviços

### Componente Principal: `ProdutosServicos.tsx`

#### Funcionalidades:
- ✅ Listar produtos e serviços
- ✅ Criar novo produto/serviço
- ✅ Editar produto/serviço existente
- ✅ Visualizar detalhes
- ✅ Ativar/Desativar
- ✅ Excluir
- ✅ Buscar por nome
- ✅ Filtrar por tipo (produto/serviço)
- ✅ Categorização

#### Schema de Validação (Zod):
```typescript
const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  type: z.enum(["product", "service"]),
  category_id: z.string().min(1, "Categoria é obrigatória"),
  unit_price: z.string().min(1, "Preço é obrigatório"),
  is_active: z.boolean().default(true)
});
```

#### Principais Funções:

**Carregar Itens:**
```typescript
const loadItems = async () => {
  const { data, error } = await supabase
    .from("products_services")
    .select(`
      *,
      categories (
        id,
        name
      )
    `)
    .order("name");
};
```

**Criar/Atualizar:**
```typescript
const onSubmit = async (values: FormData) => {
  const itemData = {
    ...values,
    unit_price: parseFloat(values.unit_price),
  };

  if (editingItem) {
    await supabase
      .from("products_services")
      .update(itemData)
      .eq("id", editingItem.id);
  } else {
    await supabase
      .from("products_services")
      .insert([itemData]);
  }
};
```

**Toggle Status:**
```typescript
const handleToggleStatus = async (id: string, currentStatus: boolean) => {
  await supabase
    .from("products_services")
    .update({ is_active: !currentStatus })
    .eq("id", id);
};
```

---

## 🎯 Módulo de Leads

### Componente Principal: `Leads.tsx`

#### Funcionalidades:
- ✅ Visualização em lista e Kanban
- ✅ Criar novo lead
- ✅ Editar lead
- ✅ Deletar lead
- ✅ Converter lead em orçamento
- ✅ Atribuir vendedor
- ✅ Definir temperatura (frio/morno/quente)
- ✅ Filtrar por status, data, temperatura
- ✅ Buscar por nome/email/empresa
- ✅ Drag and drop no Kanban

#### Status do Lead:
```typescript
const STATUS_CONFIG = {
  new: { label: "Novo", color: "bg-blue-500" },
  contacted: { label: "Contatado", color: "bg-yellow-500" },
  qualified: { label: "Qualificado", color: "bg-purple-500" },
  proposal: { label: "Proposta Enviada", color: "bg-orange-500" },
  won: { label: "Ganho", color: "bg-green-500" },
  lost: { label: "Perdido", color: "bg-red-500" }
};

const TEMPERATURE_CONFIG = {
  cold: { label: "Frio", icon: "❄️" },
  warm: { label: "Morno", icon: "🌤️" },
  hot: { label: "Quente", icon: "🔥" }
};
```

#### Principais Funções:

**Carregar Leads:**
```typescript
const loadLeads = async () => {
  const { data, error } = await supabase
    .from("leads")
    .select(`
      *,
      assigned_user:profiles!leads_assigned_to_fkey(
        id,
        full_name,
        email
      )
    `)
    .order("created_at", { ascending: false });
};
```

**Atualizar Lead:**
```typescript
const handleUpdateLead = async (leadId: string, updates: Partial<Lead>) => {
  await supabase
    .from("leads")
    .update(updates)
    .eq("id", leadId);
};
```

**Converter para Orçamento:**
```typescript
const handleConvertToBudget = () => {
  navigate("/admin/orcamentos", { 
    state: { 
      leadData: selectedLead 
    } 
  });
};
```

---

## 💼 Módulo de Orçamentos

### Componente Principal: `Orcamentos.tsx`

#### Funcionalidades:
- ✅ Criar orçamento a partir de lead
- ✅ Adicionar múltiplos produtos/serviços
- ✅ Calcular totais automaticamente
- ✅ Configurar condições de pagamento separadas (produtos/serviços)
- ✅ Adicionar múltiplos CNPJs
- ✅ Gerar PDF da proposta
- ✅ Enviar email com link de aprovação
- ✅ Sistema de aprovação dupla (cliente + interno)
- ✅ Assinatura digital com hash SHA-256
- ✅ Geolocalização na aprovação
- ✅ Auditoria completa
- ✅ Visualização em lista e Kanban
- ✅ Filtros avançados
- ✅ Rastreamento de emails

#### Schema de Validação:
```typescript
const formSchema = z.object({
  network_id: z.string().optional(),
  requester_name: z.string().min(1, "Nome é obrigatório"),
  requester_email: z.string().email("Email inválido"),
  requester_phone: z.string().min(1, "Telefone é obrigatório"),
  cnpjs: z.array(z.object({
    cnpj: z.string().min(14, "CNPJ inválido"),
    razao_social: z.string().min(1, "Razão social é obrigatória"),
    company_name: z.string().optional()
  })),
  items: z.array(z.object({
    product_service_id: z.string().optional(),
    name: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(["product", "service"]),
    quantity: z.number().min(1),
    unit_price: z.number().min(0),
    total_price: z.number()
  })),
  products_payment_method: z.string().optional(),
  products_installments_count: z.number().optional(),
  products_first_payment_date: z.string().optional(),
  services_payment_method: z.string().optional(),
  unique_services_installments_count: z.number().optional(),
  services_first_payment_date: z.string().optional(),
  freight_value: z.number().optional(),
  observations: z.string().optional(),
  financial_contact_name: z.string().optional(),
  financial_contact_email: z.string().optional(),
  financial_contact_phone: z.string().optional(),
  financial_email: z.string().optional(),
  payment_type: z.string().optional(),
  expires_at: z.string(),
  expected_closing_date: z.string().optional(),
  temperature: z.string().optional(),
  seller_id: z.string().min(1, "Vendedor é obrigatório")
});
```

#### Cálculos Automáticos:
```typescript
// Calcular total do item
const calculateItemTotal = (quantity: number, unitPrice: number) => {
  return quantity * unitPrice;
};

// Calcular totais de produtos e serviços
const calculateTotals = (items: BudgetItem[]) => {
  let productsTotal = 0;
  let servicesTotal = 0;

  items.forEach(item => {
    if (item.type === "product") {
      productsTotal += item.total_price;
    } else {
      servicesTotal += item.total_price;
    }
  });

  return { productsTotal, servicesTotal };
};

// Calcular total geral
const totalValue = productsTotal + servicesTotal + (freightValue || 0);
```

#### Criar Orçamento:
```typescript
const onSubmit = async (values: FormData) => {
  // 1. Gerar número do orçamento
  const budgetNumber = `ORC-${Date.now()}`;
  
  // 2. Calcular totais
  const { productsTotal, servicesTotal } = calculateTotals(values.items);
  const totalValue = productsTotal + servicesTotal + (values.freight_value || 0);
  
  // 3. Criar orçamento
  const { data: budget, error: budgetError } = await supabase
    .from("budgets")
    .insert([{
      budget_number: budgetNumber,
      ...values,
      products_total: productsTotal,
      services_total: servicesTotal,
      total_value: totalValue,
      status: "draft",
      created_by: user.id,
      expires_at: new Date(values.expires_at).toISOString(),
      cnpjs: values.cnpjs.map(c => c.cnpj)
    }])
    .select()
    .single();
  
  // 4. Criar itens do orçamento
  const budgetItems = values.items.map(item => ({
    budget_id: budget.id,
    ...item
  }));
  
  await supabase
    .from("budget_items")
    .insert(budgetItems);
  
  // 5. Atualizar lead se existir
  if (values.lead_id) {
    await supabase
      .from("leads")
      .update({ status: "proposal" })
      .eq("id", values.lead_id);
  }
};
```

#### Enviar para Aprovação:
```typescript
const sendBudgetForApproval = async (budgetId: string) => {
  // 1. Gerar token único
  const approvalToken = crypto.randomUUID();
  
  // 2. Atualizar orçamento
  await supabase
    .from("budgets")
    .update({
      status: "pending_approval",
      approval_token: approvalToken
    })
    .eq("id", budgetId);
  
  // 3. Enviar email com link de aprovação
  const approvalUrl = `${window.location.origin}/aprovar-orcamento/${approvalToken}`;
  
  // Chamar edge function para enviar email
  await supabase.functions.invoke("send-budget-approval-email", {
    body: {
      budget_id: budgetId,
      approval_url: approvalUrl
    }
  });
};
```

---

## ⚡ Edge Functions

### 1. `send-verification-email`
Envia código de verificação de 6 dígitos para o cliente.

```typescript
interface VerificationRequest {
  budget_id: string;
  email: string;
}

// Gera código aleatório
const code = Math.floor(100000 + Math.random() * 900000).toString();

// Salva no banco
await supabase
  .from("budget_verification_codes")
  .insert({
    budget_id,
    code,
    email,
    ip_address: req.headers.get("x-forwarded-for"),
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
  });

// Envia email
await sendEmail({
  to: email,
  subject: "Código de Verificação - Aprovação de Orçamento",
  html: `Seu código de verificação é: <strong>${code}</strong>`
});
```

### 2. `approve-budget`
Processa a aprovação do orçamento pelo cliente.

```typescript
interface ApprovalRequest {
  budget_id: string;
  approval_token: string;
  verification_code: string;
  approver_data: {
    name: string;
    cpf: string;
    email: string;
    position: string;
  };
  latitude?: number;
  longitude?: number;
}

// 1. Validar token e código
// 2. Gerar hash SHA-256 do documento
const documentHash = await generateDocumentHash(budgetData);

// 3. Gerar assinatura digital
const signature = await generateSignature(approver_data, documentHash);

// 4. Atualizar orçamento
await supabase
  .from("budgets")
  .update({
    status: "pending_internal_approval",
    approved_at: new Date().toISOString(),
    approved_by_name: approver_data.name,
    approved_by_cpf: approver_data.cpf,
    approved_by_email: approver_data.email,
    approved_by_position: approver_data.position,
    approval_signature: signature,
    approval_document_hash: documentHash,
    approval_ip: req.headers.get("x-forwarded-for"),
    approval_user_agent: req.headers.get("user-agent"),
    approval_latitude: latitude,
    approval_longitude: longitude
  })
  .eq("id", budget_id)
  .eq("approval_token", approval_token);

// 5. Gerar aprovação BISW (automática)
const biswSignature = await generateBISWSignature(documentHash);

await supabase
  .from("budgets")
  .update({
    bisw_approved_at: new Date().toISOString(),
    bisw_approved_by_name: "BISW Representante",
    bisw_approved_by_cpf: "00.000.000/0001-00",
    bisw_approval_signature: biswSignature,
    bisw_approval_document_hash: documentHash
  })
  .eq("id", budget_id);

// 6. Atualizar lead
if (budget.lead_id) {
  await supabase
    .from("leads")
    .update({ status: "won" })
    .eq("id", budget.lead_id);
}
```

### 3. `generate-audit-pdf`
Gera PDF de auditoria com todas as informações da aprovação.

```typescript
import jsPDF from "jspdf";

const generateAuditPDF = async (budgetId: string) => {
  const doc = new jsPDF();
  
  // Adicionar informações do orçamento
  // Adicionar dados de aprovação
  // Adicionar assinaturas digitais
  // Adicionar hashes
  // Adicionar timestamp
  
  const pdfBlob = doc.output("blob");
  
  // Upload para storage
  const { data, error } = await supabase.storage
    .from("audit-pdfs")
    .upload(`${budgetId}.pdf`, pdfBlob);
  
  return data.path;
};
```

---

## 🔐 Fluxo de Aprovação Digital

### Etapas:

1. **Orçamento Criado** (`draft`)
   - Vendedor cria orçamento
   - Adiciona produtos/serviços
   - Define condições de pagamento

2. **Envio para Cliente** (`pending_approval`)
   - Sistema gera token único
   - Email enviado com link de aprovação
   - Cliente acessa página de aprovação

3. **Verificação do Cliente**
   - Cliente solicita código de verificação
   - Código de 6 dígitos enviado por email
   - Validade: 10 minutos

4. **Aprovação do Cliente** (`pending_internal_approval`)
   - Cliente preenche dados (nome, CPF, email, cargo)
   - Sistema captura geolocalização
   - Gera hash SHA-256 do documento
   - Gera assinatura digital do cliente
   - Registra IP e User Agent

5. **Aprovação BISW Automática**
   - Sistema gera assinatura BISW
   - Mesmo hash do documento
   - Representante: "BISW Representante"

6. **Aprovação Interna** (opcional - `approved`)
   - Time interno revisa
   - Solicita código de verificação interno
   - Aprova ou recusa

7. **Geração de Auditoria**
   - PDF completo gerado
   - Todas as assinaturas incluídas
   - Hashes verificáveis
   - Timestamp imutável

### Segurança:

- ✅ Token único por orçamento
- ✅ Código de verificação com expiração
- ✅ Hash SHA-256 do documento
- ✅ Assinatura digital de todas as partes
- ✅ Registro de IP e User Agent
- ✅ Geolocalização
- ✅ Auditoria completa
- ✅ Imutabilidade após aprovação

---

## 📊 Relatórios e Métricas

### Métricas de Leads:
```typescript
// Taxa de conversão
const conversionRate = (wonLeads / totalLeads) * 100;

// Leads por status
const leadsByStatus = leads.reduce((acc, lead) => {
  acc[lead.status] = (acc[lead.status] || 0) + 1;
  return acc;
}, {});

// Leads por temperatura
const leadsByTemperature = leads.reduce((acc, lead) => {
  acc[lead.temperature] = (acc[lead.temperature] || 0) + 1;
  return acc;
}, {});
```

### Métricas de Orçamentos:
```typescript
// Valor total de orçamentos
const totalBudgetValue = budgets.reduce((sum, b) => sum + b.total_value, 0);

// Taxa de aprovação
const approvalRate = (approvedBudgets / totalBudgets) * 100;

// Tempo médio de aprovação
const avgApprovalTime = budgets
  .filter(b => b.approved_at)
  .reduce((sum, b) => {
    const created = new Date(b.created_at);
    const approved = new Date(b.approved_at);
    return sum + (approved - created);
  }, 0) / approvedBudgets;

// Orçamentos por vendedor
const budgetsBySeller = budgets.reduce((acc, budget) => {
  acc[budget.seller_id] = (acc[budget.seller_id] || 0) + 1;
  return acc;
}, {});
```

---

## 🎨 Componentes UI Reutilizáveis

### CNPJManager
Componente para gerenciar múltiplos CNPJs:
```typescript
<CNPJManager
  cnpjs={cnpjs}
  onAdd={(cnpj) => setCnpjs([...cnpjs, cnpj])}
  onRemove={(index) => setCnpjs(cnpjs.filter((_, i) => i !== index))}
/>
```

### StatusBadge
Badge colorido para status:
```typescript
<Badge className={STATUS_CONFIG[status].color}>
  {STATUS_CONFIG[status].label}
</Badge>
```

### TemperatureIndicator
Indicador de temperatura do lead:
```typescript
<span className="text-2xl">
  {TEMPERATURE_CONFIG[temperature].icon}
</span>
```

---

## 🔄 Integração entre Módulos

### Lead → Orçamento:
```typescript
// Em Leads.tsx
navigate("/admin/orcamentos", { 
  state: { 
    leadData: {
      lead_id: lead.id,
      requester_name: lead.name,
      requester_email: lead.email,
      requester_phone: lead.phone,
      company: lead.company
    }
  } 
});

// Em Orcamentos.tsx
const location = useLocation();
const leadData = location.state?.leadData;

useEffect(() => {
  if (leadData) {
    form.setValue("requester_name", leadData.requester_name);
    form.setValue("requester_email", leadData.requester_email);
    // ... preencher outros campos
  }
}, [leadData]);
```

### Produto → Orçamento:
```typescript
// Adicionar item ao orçamento
const addItem = (productService: ProductService) => {
  const newItem = {
    product_service_id: productService.id,
    name: productService.name,
    description: productService.description,
    type: productService.type,
    quantity: 1,
    unit_price: productService.unit_price,
    total_price: productService.unit_price
  };
  
  form.setValue("items", [...items, newItem]);
};
```

---

## 📝 Checklist de Migração para "Proposta"

Para adaptar esse sistema para outro projeto:

### 1. Renomear Entidades:
- [ ] `budgets` → `proposals`
- [ ] `budget_items` → `proposal_items`
- [ ] `budget_verification_codes` → `proposal_verification_codes`
- [ ] `budget_internal_verification_codes` → `proposal_internal_verification_codes`

### 2. Atualizar Campos:
- [ ] `budget_number` → `proposal_number`
- [ ] `budget_id` → `proposal_id`

### 3. Atualizar Edge Functions:
- [ ] `approve-budget` → `approve-proposal`
- [ ] `send-budget-approval-email` → `send-proposal-approval-email`

### 4. Atualizar Componentes:
- [ ] `Orcamentos.tsx` → `Propostas.tsx`
- [ ] Textos e labels
- [ ] Rotas (`/admin/orcamentos` → `/admin/propostas`)

### 5. Atualizar Validações:
- [ ] Manter mesma lógica de validação
- [ ] Atualizar mensagens de erro

### 6. Manter Lógica:
- ✅ Fluxo de aprovação dupla
- ✅ Assinatura digital
- ✅ Hash SHA-256
- ✅ Geolocalização
- ✅ Auditoria
- ✅ Email tracking

---

## 🚀 Deployment

### Variáveis de Ambiente:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key

# Para Edge Functions
RESEND_API_KEY=your_resend_api_key
```

### Configuração Resend:
1. Criar conta no Resend
2. Verificar domínio
3. Criar API Key
4. Adicionar como secret no Supabase

---

## 📚 Referências

- Supabase: https://supabase.com/docs
- Resend: https://resend.com/docs
- React Hook Form: https://react-hook-form.com
- Zod: https://zod.dev
- jsPDF: https://github.com/parallax/jsPDF

---

**Versão:** 1.0.0  
**Última Atualização:** Janeiro 2025  
**Autor:** Sistema BISW
