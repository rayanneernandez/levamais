# Guia de Exportação - Módulo de LEADs

## 📋 Visão Geral

Este documento contém todas as informações necessárias para transportar o módulo de gerenciamento de LEADs para outro projeto.

---

## 📁 Arquivos do Frontend

### 1. Página Principal
- **Caminho**: `src/pages/admin/Leads.tsx`
- **Descrição**: Página completa de gerenciamento de leads com visualização em lista e Kanban
- **Dependências**:
  - Componentes UI: Card, Button, Input, Badge, Table, Tabs, Dialog, Select, Textarea, Label
  - Hooks: useState, useEffect, useToast, useNavigate
  - Bibliotecas: date-fns, lucide-react
  - Supabase client

### 2. Integração no Roteamento
**Arquivo**: `src/App.tsx`

```tsx
// Importação
const Leads = lazy(() => import("./pages/admin/Leads"));

// Rota
<Route path="/adm/leads" element={<AdminLayout><Leads /></AdminLayout>} />
```

### 3. Menu/Sidebar
**Arquivo**: `src/components/admin/AdminSidebar.tsx`

```tsx
<SidebarMenuSubButton asChild>
  <NavLink to="/adm/leads">
    <span>LEADs</span>
  </NavLink>
</SidebarMenuSubButton>
```

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `leads`

```sql
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  temperature TEXT DEFAULT 'warm',
  source TEXT NOT NULL DEFAULT 'website',
  assigned_to UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices recomendados
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX idx_leads_email ON public.leads(email);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_updated_at();

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (ajuste conforme seu modelo de permissões)
-- Admin pode ver todos
CREATE POLICY "Admin users can view all leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin pode criar leads
CREATE POLICY "Admin users can create leads"
  ON public.leads FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin pode atualizar leads
CREATE POLICY "Admin users can update leads"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin pode deletar leads
CREATE POLICY "Admin users can delete leads"
  ON public.leads FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Vendedores podem ver apenas seus leads
CREATE POLICY "Sellers can view assigned leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid());
```

### Campos na Tabela `profiles`

O módulo utiliza um campo `is_seller` na tabela de perfis para identificar vendedores:

```sql
-- Adicionar campo is_seller se não existir
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_seller BOOLEAN DEFAULT false;

-- Índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_seller 
ON public.profiles(is_seller) WHERE is_seller = true;
```

---

## 🔧 Edge Functions

### 1. `send-contact-email`
**Caminho**: `supabase/functions/send-contact-email/index.ts`

**Funcionalidade**: Recebe contatos do formulário do site e cria automaticamente um lead.

**Trecho relevante**:
```typescript
const { error: leadError } = await supabase.from("leads").insert({
  name,
  email,
  phone: phone || null,
  company: company || null,
  message: message || "Contato via WhatsApp",
  status: "new",
  source: "website",
});
```

### 2. `approve-budget`
**Caminho**: `supabase/functions/approve-budget/index.ts`

**Funcionalidade**: Ao aprovar um orçamento, atualiza o status do lead vinculado para "won".

**Trecho relevante**:
```typescript
// Atualizar o status do lead para "won" se houver lead vinculado
if (budget.lead_id) {
  const { error: leadUpdateError } = await supabase
    .from("leads")
    .update({ status: "won" })
    .eq("id", budget.lead_id);
}
```

---

## 📦 Dependências NPM

Certifique-se de que as seguintes dependências estão instaladas:

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.75.0",
    "react": "^18.3.1",
    "react-router-dom": "^6.30.1",
    "date-fns": "^3.6.0",
    "lucide-react": "^0.462.0"
  }
}
```

Componentes UI (Shadcn):
- card
- button
- input
- badge
- table
- tabs
- dialog
- select
- textarea
- label
- toast

---

## ⚙️ Configurações de Status e Temperatura

O módulo utiliza dois sistemas de classificação:

### Status dos Leads
```typescript
const STATUS_CONFIG = {
  new: { label: "Novo", color: "bg-blue-500" },
  contacted: { label: "Contatado", color: "bg-yellow-500" },
  qualified: { label: "Qualificado", color: "bg-purple-500" },
  proposal: { label: "Proposta", color: "bg-orange-500" },
  won: { label: "Ganho", color: "bg-green-500" },
  lost: { label: "Perdido", color: "bg-red-500" },
};
```

### Temperatura dos Leads
```typescript
const TEMPERATURE_CONFIG = {
  cold: { label: "Frio", icon: "❄️" },
  warm: { label: "Morno", icon: "🌤️" },
  hot: { label: "Quente", icon: "🔥" },
};
```

---

## 🔗 Integrações com Outros Módulos

### 1. Orçamentos
O módulo de Leads se integra com o módulo de Orçamentos através da função `handleConvertToBudget()`:

```typescript
const handleConvertToBudget = () => {
  navigate('/adm/orcamentos', { 
    state: { 
      fromLead: true,
      leadData: {
        lead_id: selectedLead.id,
        requester_name: selectedLead.name,
        requester_email: selectedLead.email,
        requester_phone: selectedLead.phone || '',
        company: selectedLead.company || '',
        temperature: selectedLead.temperature,
        seller_id: selectedLead.assigned_to,
      }
    } 
  });
};
```

### 2. Logs de Auditoria
**Arquivo**: `src/pages/admin/LogsAuditoria.tsx`

Inclui leads no sistema de logs:
```typescript
budgets: "Orçamentos",
leads: "Leads",
blocked_clients: "Bloqueios",
```

### 3. Landing Pages
As páginas `src/pages/Index.tsx` e `src/pages/IndexAlt.tsx` possuem formulários que criam leads automaticamente.

---

## 🚀 Passo a Passo para Instalação

### 1️⃣ Banco de Dados
```bash
# Execute o script SQL fornecido acima na seção "Estrutura do Banco de Dados"
# Certifique-se de ajustar as políticas RLS conforme seu modelo de permissões
```

### 2️⃣ Arquivos Frontend
1. Copie `src/pages/admin/Leads.tsx` para o novo projeto
2. Ajuste o caminho de importação do Supabase client se necessário
3. Verifique se todos os componentes UI estão disponíveis

### 3️⃣ Rotas
1. Adicione a importação lazy em `App.tsx`
2. Adicione a rota no sistema de roteamento
3. Adicione o item no menu/sidebar

### 4️⃣ Edge Functions (Opcional)
Se usar as edge functions:
1. Copie as funções relevantes
2. Configure as variáveis de ambiente necessárias (RESEND_API_KEY, etc.)
3. Faça deploy das funções

### 5️⃣ Dependências
```bash
# Instale as dependências necessárias
npm install @supabase/supabase-js date-fns lucide-react

# Adicione componentes Shadcn se necessário
npx shadcn@latest add card button input badge table tabs dialog select textarea label toast
```

### 6️⃣ Perfis de Usuário
Certifique-se de que a tabela `profiles` tenha o campo `is_seller`:
```sql
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_seller BOOLEAN DEFAULT false;
```

---

## ✅ Checklist de Validação

- [ ] Tabela `leads` criada com todos os campos
- [ ] Índices criados
- [ ] Trigger de updated_at configurado
- [ ] Políticas RLS configuradas
- [ ] Campo `is_seller` na tabela profiles
- [ ] Arquivo `Leads.tsx` copiado e funcionando
- [ ] Rota adicionada no App.tsx
- [ ] Menu/sidebar atualizado
- [ ] Dependências NPM instaladas
- [ ] Componentes Shadcn disponíveis
- [ ] Edge functions configuradas (se necessário)
- [ ] Teste de criação de lead
- [ ] Teste de edição de lead
- [ ] Teste de exclusão de lead
- [ ] Teste de filtros (busca, data, status)
- [ ] Teste de visualização Kanban
- [ ] Teste de atribuição de vendedor
- [ ] Teste de conversão para orçamento

---

## 📝 Notas Importantes

1. **Permissões**: Ajuste as políticas RLS de acordo com seu modelo de permissões
2. **Layout**: O módulo assume que existe um `AdminLayout` para envolver a página
3. **Profiles**: Certifique-se de que a tabela de perfis está sincronizada com auth.users
4. **Formulários externos**: Se usar formulários de contato no site, configure a edge function `send-contact-email`
5. **Integração com Orçamentos**: Se não tiver módulo de orçamentos, remova a função `handleConvertToBudget()`

---

## 🎨 Funcionalidades Incluídas

- ✅ Visualização em Lista e Kanban
- ✅ Criação, edição e exclusão de leads
- ✅ Filtros por nome, email, empresa, data e status
- ✅ Sistema de status (6 estágios)
- ✅ Sistema de temperatura (frio, morno, quente)
- ✅ Atribuição de vendedores
- ✅ Campo de notas
- ✅ Rastreamento de origem (source)
- ✅ Timestamps automáticos
- ✅ Conversão para orçamento
- ✅ Integração com formulários externos
- ✅ Responsivo para mobile

---

## 🆘 Suporte

Se encontrar problemas durante a migração:
1. Verifique os logs do console do navegador
2. Verifique os logs do Supabase
3. Confirme que todas as dependências estão instaladas
4. Valide as políticas RLS
5. Certifique-se de que o usuário tem permissões adequadas

---

**Versão**: 1.0  
**Última atualização**: 2025  
**Autor**: Sistema Leva+ (Exportado do projeto original)
