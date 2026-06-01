# Trim + Limites de caracteres em todo o sistema (em fases)

## Decisão sobre limites

**E-mail revisado para 100 caracteres** (era 255). Justificativa:
- RFC permite 254, mas Gmail/Outlook limitam 64 no local part
- E-mails reais raramente passam de 50 caracteres
- 100 já é generoso e bloqueia abuso/spam
- Caso raro de e-mail corporativo gigante: aumentamos pontualmente

### Tabela de limites padrão

| Tipo de campo | Limite | Exemplo |
|---|---|---|
| Nome / Razão social | 100 | "João da Silva Santos" |
| E-mail | 100 | "joao.silva@empresa.com.br" |
| Telefone (com máscara) | 15 | "(31) 99999-9999" |
| CPF / CNPJ (com máscara) | 18 | "000.000.000-00" |
| Código curto / SKU | 30 | "PRD-12345" |
| Endereço (rua) | 150 | "Av. Brasil, 1234, Centro" |
| Cidade / Estado | 60 | "Belo Horizonte" |
| CEP | 9 | "30000-000" |
| Texto curto (descrição/título) | 200 | Nome de promoção |
| Texto médio (observação) | 500 | Comentário interno |
| Texto longo (mensagem/descrição completa) | 2000 | Descrição de produto |
| URL / Link | 500 | Links Google Maps, redes sociais |
| Senha | 72 | Limite do bcrypt |

---

## Estratégia: Helper único + rollout em fases

### Base (entrega junto com a Fase 1)
Criar `src/lib/input-sanitization.ts`:
- `LIMITS` — constantes acima
- `trimmedString(max, opts?)` — helper Zod com `.trim().max()`
- `trimmedEmail(max?)` — variante com `.toLowerCase().email()`
- `trimmedOptional(max)` — para campos opcionais
- `cleanText(value)` — função utilitária para usar fora de Zod (no submit, por exemplo)

Esse helper será **importado em todos os formulários** nas próximas fases — sem duplicar lógica.

---

## Fases de rollout

### Fase 1 — Portal Loja (`/levaloja/*`)
**Por que primeiro:** é onde você está agora, módulo que abriu o pedido.
- `StoreUsers.tsx` (Usuários)
- `store/Lojas.tsx` (Lojas)
- `store/Clientes.tsx` (Clientes)
- `store/Acoes.tsx` (Ações de marketing)
- `store/Fidelidade.tsx` (Configuração fidelidade)
- `store/Reajuste.tsx` (Reajuste)
- `StoreChangePassword.tsx`
- `StoreAuth.tsx`

**Risco:** baixo. Validação só afeta novos cadastros/edições.

### Fase 2 — Portal Cliente
- `ClientSignup.tsx` (cadastro de cliente — **crítico**, alto volume)
- `ClientAuth.tsx` (login)
- `client/ProfileEditDialog.tsx`
- `client/OnboardingDialog.tsx`

**Risco:** médio. Cadastro tem alto volume, precisa testar bem o fluxo completo.

### Fase 3 — Portal Admin
- `admin/Usuarios.tsx`
- `admin/Lojas.tsx`
- `admin/Empresas.tsx`
- `admin/Licencas.tsx`
- `admin/Orcamentos.tsx`
- `admin/Categorias.tsx`
- `admin/ProdutosServicos.tsx`
- `admin/Perfis.tsx`
- `admin/API.tsx`
- `admin/TestesEmail.tsx`
- `admin/NewTicketDialog.tsx`
- `admin/NewProjectDialog.tsx`
- `admin/ProjectTaskDialog.tsx`
- `admin/ProjectMeetingDialog.tsx`
- `admin/CustomerSuccessDialog.tsx`

**Risco:** baixo. Usado por equipe interna.

### Fase 4 — Páginas públicas e demais
- `Index.tsx` (landing)
- Qualquer outro formulário descoberto durante as fases anteriores

---

## O que cada fase entrega (padrão por formulário)

1. ✅ Substituir `z.string()` pelos helpers (`trimmedString`, `trimmedEmail`)
2. ✅ Adicionar atributo `maxLength={LIMITS.X}` em cada `<Input>`
3. ✅ Garantir trim final no `onSubmit` antes de enviar pro Supabase
4. ✅ Mensagens de erro padronizadas em português

---

## Impacto geral

**Riscos: muito baixos**
- ✅ Não toca em banco de dados ou edge functions
- ✅ Não invalida dados antigos (só sanitiza o que entra a partir de agora)
- ✅ Helper centralizado = se mudarmos um limite, muda no sistema todo
- ✅ Cada fase é independente — pode validar uma e seguir

**Pontos a confirmar:**
- E-mail forçado para minúsculas no salvamento (padrão da indústria, evita `Joao@x` vs `joao@x` como cadastros separados). **Confirmar se ok** para Fase 2 (cadastro de cliente).

---

## Ordem de execução sugerida

Vamos entregar **uma fase por vez**, você valida no preview, e seguimos. Começamos pela **Fase 1 (Portal Loja)** assim que aprovar este plano.
