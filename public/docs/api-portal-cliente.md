# API do Portal do Cliente - Leva+

## Visão Geral

Esta documentação descreve todos os endpoints necessários para replicar o Portal do Cliente Leva+ em um aplicativo nativo.

**Base URL:** `https://auivszkscfcpczrkecoc.supabase.co`

---

## 1. Autenticação

O portal suporta **DOIS métodos de login**. Escolha o mais adequado para o app:

---

### 1.1 MÉTODO 1: Login com CPF + Senha (Tradicional)

Para clientes que já criaram senha no primeiro acesso.

#### Passo 1: Buscar email do cliente pelo CPF

```
POST /functions/v1/client-login
Content-Type: application/json

{
  "cpf": "12345678900",
  "password": "senha_do_usuario"
}
```

**Resposta de sucesso:**
```json
{
  "success": true,
  "email": "joao@email.com",
  "name": "João Silva"
}
```

**Erros possíveis:**
- `"CPF não encontrado"` - CPF não existe no sistema
- `"PRIMEIRO_ACESSO: Complete seu primeiro acesso..."` - Usuário nunca criou senha (deve usar primeiro cadastro)
- `"Acesso não autorizado"` - Usuário não tem permissão de cliente

#### Passo 2: Fazer login no Supabase Auth

Com o email retornado, faça login usando Supabase Auth:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://auivszkscfcpczrkecoc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1aXZzemtzY2ZjcGN6cmtlY29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyOTczMjksImV4cCI6MjA3NTg3MzMyOX0.Gz7wyWsb5NvFau6tJ_I9cce2HJm6s1o_nESHYAf3sPk'
);

const { data, error } = await supabase.auth.signInWithPassword({
  email: emailRetornado, // email do passo 1
  password: senhaDigitada
});

if (data.session) {
  // Login bem-sucedido!
  // Use data.session.access_token para requisições autenticadas
}
```

---

### 1.2 MÉTODO 2: Login com Código OTP por Email (Sem Senha)

**Recomendado para apps nativos** - Mais seguro, não exige que usuário lembre senha.

#### Passo 1: Solicitar envio do código

```
POST /functions/v1/send-client-login-code
Content-Type: application/json

{
  "cpf": "12345678900"
}
```

**Resposta de sucesso:**
```json
{
  "success": true,
  "maskedEmail": "j***@email.com"
}
```

**Erros possíveis:**
- `"CPF não encontrado"` - CPF não existe
- `"Cliente sem acesso ao portal"` - Usuário nunca fez primeiro acesso
- `"Aguarde X segundos..."` - Rate limit (máx 1 código por minuto)

#### Passo 2: Verificar código e obter sessão

```
POST /functions/v1/verify-client-login-code
Content-Type: application/json

{
  "cpf": "12345678900",
  "code": "123456"
}
```

**Resposta de sucesso:**
```json
{
  "success": true,
  "email": "joao@email.com",
  "name": "João Silva",
  "magicLink": "https://auivszkscfcpczrkecoc.supabase.co/auth/v1/verify?token=..."
}
```

#### Passo 3: Usar o Magic Link para autenticar

O `magicLink` retornado pode ser usado de duas formas:

**Opção A - Extrair token e verificar:**
```javascript
// Extrair o token do magicLink
const url = new URL(magicLink);
const token = url.searchParams.get('token');
const type = url.searchParams.get('type');

// Verificar OTP
const { data, error } = await supabase.auth.verifyOtp({
  token_hash: token,
  type: 'magiclink'
});
```

**Opção B - Abrir link em WebView:**
```javascript
// Abre o link que faz redirect para seu app
WebBrowser.openAuthSessionAsync(magicLink, 'seuapp://callback');
```

---

### 1.3 Primeiro Cadastro (Criar Senha)

Quando o cliente nunca acessou o portal (erro `PRIMEIRO_ACESSO`):

```
POST /functions/v1/client-first-registration
Content-Type: application/json

{
  "cpf": "12345678900",
  "email": "cliente@email.com",
  "full_name": "Nome Completo",
  "phone": "11999999999",
  "birth_date": "1990-01-15",
  "password": "senha123",
  "network_id": "uuid_da_rede"
}
```

### 1.4 Recuperar Senha

```
POST /functions/v1/client-forgot-password
Content-Type: application/json

{
  "cpf": "12345678900",
  "email": "cliente@email.com"
}

---

## 2. Dados do Cliente

### 2.1 Buscar Perfil do Cliente

```
GET /rest/v1/clients?cpf=eq.{cpf}&select=*
Authorization: Bearer {token}
apikey: {anon_key}
```

**Campos retornados:**
```json
{
  "id": "uuid",
  "cpf": "12345678900",
  "full_name": "Nome do Cliente",
  "email": "cliente@email.com",
  "phone": "11999999999",
  "birth_date": "1990-01-15",
  "address_street": "Rua Example",
  "address_number": "123",
  "address_complement": "Apto 1",
  "address_neighborhood": "Centro",
  "address_city": "São Paulo",
  "address_state": "SP",
  "address_zip": "01234567",
  "is_one_member": false,
  "one_member_since": null,
  "favorite_network_id": "uuid",
  "auto_redemption_enabled": true,
  "tutorial_completed": false,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### 2.2 Atualizar Perfil

```
PATCH /rest/v1/clients?id=eq.{client_id}
Authorization: Bearer {token}
apikey: {anon_key}
Content-Type: application/json

{
  "full_name": "Novo Nome",
  "phone": "11988888888",
  "address_street": "Nova Rua",
  "address_number": "456"
}
```

### 2.3 Buscar Saldos do Cliente (Pontos/Cashback)

```
GET /rest/v1/loyalty_balances?client_id=eq.{client_id}&select=*,networks(name,logo_url,loyalty_type)
Authorization: Bearer {token}
apikey: {anon_key}
```

**Resposta:**
```json
[
  {
    "id": "uuid",
    "client_id": "uuid",
    "network_id": "uuid",
    "balance": 150.50,
    "loyalty_type": "cashback",
    "networks": {
      "name": "Posto ABC",
      "logo_url": "https://...",
      "loyalty_type": "cashback"
    }
  }
]
```

---

## 3. Redes e Lojas

### 3.1 Buscar Redes Disponíveis

```
GET /rest/v1/networks?is_active=eq.true&select=id,name,logo_url,loyalty_type,primary_color
Authorization: Bearer {token}
apikey: {anon_key}
```

### 3.2 Buscar Lojas de uma Rede

```
GET /rest/v1/stores?network_id=eq.{network_id}&is_active=eq.true&select=*
Authorization: Bearer {token}
apikey: {anon_key}
```

**Campos das lojas:**
```json
{
  "id": "uuid",
  "name": "Loja Centro",
  "address": "Rua Principal, 100",
  "city": "São Paulo",
  "state": "SP",
  "phone": "1133334444",
  "latitude": -23.5505,
  "longitude": -46.6333,
  "opening_hours": "06:00 - 22:00"
}
```

### 3.3 Definir Rede Favorita

```
PATCH /rest/v1/clients?id=eq.{client_id}
Authorization: Bearer {token}
apikey: {anon_key}
Content-Type: application/json

{
  "favorite_network_id": "uuid_da_rede"
}
```

---

## 4. Transações e Extrato

### 4.1 Buscar Histórico de Transações

```
GET /rest/v1/transactions?client_id=eq.{client_id}&status=eq.completed&order=created_at.desc&limit=50&select=*,stores(name)
Authorization: Bearer {token}
apikey: {anon_key}
```

**Resposta:**
```json
[
  {
    "id": "uuid",
    "client_id": "uuid",
    "store_id": "uuid",
    "network_id": "uuid",
    "transaction_type": "accumulation",
    "amount": 100.00,
    "points_earned": 10.00,
    "points_redeemed": 0,
    "status": "completed",
    "created_at": "2024-01-15T14:30:00Z",
    "stores": {
      "name": "Loja Centro"
    }
  }
]
```

**Tipos de transação (transaction_type):**
- `accumulation` - Acúmulo de pontos/cashback
- `redemption` - Resgate de pontos/cashback
- `adjustment` - Ajuste manual
- `expiration` - Expiração de pontos
- `bonus` - Bônus (aniversário, indicação, etc.)

### 4.2 Buscar Transações por Período

```
GET /rest/v1/transactions?client_id=eq.{client_id}&created_at=gte.{data_inicio}&created_at=lte.{data_fim}&order=created_at.desc
Authorization: Bearer {token}
apikey: {anon_key}
```

---

## 5. NPS (Avaliação)

### 5.1 Verificar se há Transação Pendente de Avaliação

```
GET /rest/v1/transactions?client_id=eq.{client_id}&status=eq.completed&nps_rating=is.null&nps_sent_at=not.is.null&order=created_at.desc&limit=1
Authorization: Bearer {token}
apikey: {anon_key}
```

### 5.2 Enviar Avaliação NPS

```
PATCH /rest/v1/transactions?id=eq.{transaction_id}
Authorization: Bearer {token}
apikey: {anon_key}
Content-Type: application/json

{
  "nps_rating": 9,
  "nps_comment": "Ótimo atendimento!",
  "nps_rated_at": "2024-01-15T15:00:00Z"
}
```

### 5.3 Aplicar Recompensa por Avaliação (se configurado)

```
POST /functions/v1/apply-nps-rating-reward
Authorization: Bearer {token}
Content-Type: application/json

{
  "transaction_id": "uuid",
  "rating": 9
}
```

---

## 6. Notificações

### 6.1 Buscar Notificações do Cliente

```
GET /rest/v1/client_notification_recipients?client_id=eq.{client_id}&select=*,client_notifications(title,message,created_at)&order=created_at.desc
Authorization: Bearer {token}
apikey: {anon_key}
```

### 6.2 Marcar Notificação como Lida

```
PATCH /rest/v1/client_notification_recipients?id=eq.{recipient_id}
Authorization: Bearer {token}
apikey: {anon_key}
Content-Type: application/json

{
  "is_read": true,
  "read_at": "2024-01-15T16:00:00Z"
}
```

### 6.3 Registrar Push Token

```
POST /rest/v1/push_subscriptions
Authorization: Bearer {token}
apikey: {anon_key}
Content-Type: application/json

{
  "client_id": "uuid",
  "network_id": "uuid",
  "endpoint": "https://fcm.googleapis.com/...",
  "p256dh": "chave_p256dh",
  "auth": "chave_auth",
  "device_info": {
    "platform": "android",
    "model": "Pixel 7"
  }
}
```

---

## 7. Leva+ One (Assinatura Premium)

### 7.1 Verificar Configuração do Leva+ One na Rede

```
GET /rest/v1/leva_one_config?network_id=eq.{network_id}&is_active=eq.true
Authorization: Bearer {token}
apikey: {anon_key}
```

**Resposta:**
```json
{
  "id": "uuid",
  "network_id": "uuid",
  "is_active": true,
  "monthly_value": 29.90,
  "minimum_period_months": 3,
  "cashback_multiplier": 2.0,
  "points_multiplier": 2.0,
  "additional_benefits": ["Desconto em parceiros", "Acesso VIP"]
}
```

### 7.2 Verificar Status de Assinatura do Cliente

```
GET /rest/v1/client_subscriptions_one?client_id=eq.{client_id}&status=eq.active
Authorization: Bearer {token}
apikey: {anon_key}
```

### 7.3 Criar Assinatura com Cartão de Crédito

```
POST /functions/v1/create-one-credit-card-subscription
Authorization: Bearer {token}
Content-Type: application/json

{
  "client_id": "uuid",
  "network_id": "uuid",
  "card": {
    "holder_name": "NOME NO CARTAO",
    "number": "4111111111111111",
    "expiry_month": "12",
    "expiry_year": "2025",
    "cvv": "123"
  },
  "holder_info": {
    "name": "Nome Completo",
    "email": "email@example.com",
    "cpf": "12345678900",
    "phone": "11999999999",
    "postal_code": "01234567",
    "address_number": "123"
  }
}
```

### 7.4 Atualizar Cartão de Crédito

```
POST /functions/v1/update-one-subscription-card
Authorization: Bearer {token}
Content-Type: application/json

{
  "subscription_id": "uuid",
  "card": {
    "holder_name": "NOME NO CARTAO",
    "number": "5555555555554444",
    "expiry_month": "06",
    "expiry_year": "2026",
    "cvv": "456"
  }
}
```

### 7.5 Cancelar Assinatura

```
POST /functions/v1/cancel-one-subscription
Authorization: Bearer {token}
Content-Type: application/json

{
  "subscription_id": "uuid",
  "reason": "Motivo do cancelamento"
}
```

### 7.6 Buscar Promoções Leva+ One

```
GET /rest/v1/one_promotions?network_id=eq.{network_id}&is_active=eq.true&start_date=lte.{hoje}&end_date=gte.{hoje}
Authorization: Bearer {token}
apikey: {anon_key}
```

---

## 8. Programa de Retenção

### 8.1 Buscar Configuração do Programa

```
GET /rest/v1/retention_program_config?network_id=eq.{network_id}&is_active=eq.true
Authorization: Bearer {token}
apikey: {anon_key}
```

**Resposta:**
```json
{
  "id": "uuid",
  "network_id": "uuid",
  "is_active": true,
  "commitment_options": [
    {
      "months": 3,
      "multiplier": 1.5,
      "description": "3 meses - 50% mais pontos"
    },
    {
      "months": 6,
      "multiplier": 2.0,
      "description": "6 meses - 100% mais pontos"
    }
  ],
  "renewal_bonus_percentage": 10
}
```

### 8.2 Buscar Compromisso Ativo do Cliente

```
GET /rest/v1/client_retention_commitments?client_id=eq.{client_id}&status=eq.active
Authorization: Bearer {token}
apikey: {anon_key}
```

### 8.3 Criar Compromisso de Retenção

```
POST /functions/v1/create-retention-commitment
Authorization: Bearer {token}
Content-Type: application/json

{
  "client_id": "uuid",
  "network_id": "uuid",
  "commitment_months": 6,
  "multiplier": 2.0
}
```

---

## 9. Programa de Indicação

### 9.1 Buscar Configuração do Programa

```
GET /rest/v1/referral_program_config?network_id=eq.{network_id}&is_active=eq.true
Authorization: Bearer {token}
apikey: {anon_key}
```

**Resposta:**
```json
{
  "id": "uuid",
  "network_id": "uuid",
  "is_active": true,
  "referrer_bonus_type": "cashback",
  "referrer_bonus_amount": 10.00,
  "referred_bonus_type": "cashback",
  "referred_bonus_amount": 5.00,
  "minimum_transaction_value": 50.00
}
```

### 9.2 Buscar Código de Indicação do Cliente

O código de indicação é o próprio `codigo` do cliente:

```
GET /rest/v1/clients?id=eq.{client_id}&select=codigo
Authorization: Bearer {token}
apikey: {anon_key}
```

### 9.3 Buscar Indicações Realizadas

```
GET /rest/v1/client_referrals?referrer_client_id=eq.{client_id}&select=*,clients!referred_client_id(full_name,created_at)
Authorization: Bearer {token}
apikey: {anon_key}
```

---

## 10. Suporte

### 10.1 Criar Ticket de Suporte

```
POST /rest/v1/support_tickets
Authorization: Bearer {token}
apikey: {anon_key}
Content-Type: application/json

{
  "network_id": "uuid",
  "client_id": "uuid",
  "subject": "Problema com pontos",
  "description": "Descrição detalhada do problema",
  "category": "pontos",
  "priority": "medium",
  "status": "open"
}
```

### 10.2 Buscar Tickets do Cliente

```
GET /rest/v1/support_tickets?client_id=eq.{client_id}&order=created_at.desc
Authorization: Bearer {token}
apikey: {anon_key}
```

### 10.3 Adicionar Mensagem ao Ticket

```
POST /rest/v1/support_ticket_messages
Authorization: Bearer {token}
apikey: {anon_key}
Content-Type: application/json

{
  "ticket_id": "uuid",
  "sender_type": "client",
  "sender_id": "uuid",
  "message": "Mensagem do cliente"
}
```

### 10.4 Buscar Mensagens do Ticket

```
GET /rest/v1/support_ticket_messages?ticket_id=eq.{ticket_id}&order=created_at.asc
Authorization: Bearer {token}
apikey: {anon_key}
```

---

## 11. Configurações do Cliente

### 11.1 Ativar/Desativar Resgate Automático

```
PATCH /rest/v1/clients?id=eq.{client_id}
Authorization: Bearer {token}
apikey: {anon_key}
Content-Type: application/json

{
  "auto_redemption_enabled": false
}
```

### 11.2 Marcar Tutorial como Concluído

```
PATCH /rest/v1/clients?id=eq.{client_id}
Authorization: Bearer {token}
apikey: {anon_key}
Content-Type: application/json

{
  "tutorial_completed": true
}
```

---

## 12. Utilitários

### 12.1 Buscar CEP

```
POST /functions/v1/buscar-cep
Content-Type: application/json

{
  "cep": "01310100"
}
```

**Resposta:**
```json
{
  "cep": "01310-100",
  "logradouro": "Avenida Paulista",
  "bairro": "Bela Vista",
  "localidade": "São Paulo",
  "uf": "SP"
}
```

---

## Notas Importantes

### Autenticação

Todas as requisições autenticadas devem incluir:
- `Authorization: Bearer {session_token}` - Token JWT obtido no login
- `apikey: {anon_key}` - Chave pública da API

**Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1aXZzemtzY2ZjcGN6cmtlY29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyOTczMjksImV4cCI6MjA3NTg3MzMyOX0.Gz7wyWsb5NvFau6tJ_I9cce2HJm6s1o_nESHYAf3sPk`

### Formato de Datas

Todas as datas estão em formato ISO 8601: `2024-01-15T14:30:00Z`

### Paginação

Use os parâmetros `limit` e `offset` para paginação:
```
GET /rest/v1/transactions?client_id=eq.{id}&limit=20&offset=40
```

### Ordenação

Use o parâmetro `order` para ordenação:
```
GET /rest/v1/transactions?order=created_at.desc
```

### Filtros

Operadores disponíveis:
- `eq.` - Igual
- `neq.` - Diferente
- `gt.` - Maior que
- `gte.` - Maior ou igual
- `lt.` - Menor que
- `lte.` - Menor ou igual
- `like.` - Contém (case sensitive)
- `ilike.` - Contém (case insensitive)
- `is.` - É (para null/true/false)
- `in.` - Lista de valores

### Seleção de Campos

Use `select` para escolher campos específicos:
```
GET /rest/v1/clients?id=eq.{id}&select=id,full_name,email
```

### Relacionamentos

Use vírgula para incluir relações:
```
GET /rest/v1/transactions?select=*,stores(name,address)
```

---

## Códigos de Erro Comuns

| Código | Descrição |
|--------|-----------|
| 400 | Requisição inválida |
| 401 | Não autorizado (token inválido/expirado) |
| 403 | Acesso negado (sem permissão) |
| 404 | Recurso não encontrado |
| 409 | Conflito (registro duplicado) |
| 422 | Dados inválidos |
| 500 | Erro interno do servidor |

---

## Tipos de Fidelidade

- `cashback` - Sistema de cashback (valores em R$)
- `points` - Sistema de pontos

---

## Status de Transações

- `pending` - Pendente
- `completed` - Concluída
- `cancelled` - Cancelada
- `reversed` - Estornada

---

## Status de Assinatura Leva+ One

- `active` - Ativa
- `cancelled` - Cancelada
- `suspended` - Suspensa
- `pending` - Aguardando pagamento
