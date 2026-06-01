# Leva+ — Plataforma de Fidelidade Digital

> Programa de fidelidade inteligente para varejo, com cashback, pontos, assinaturas e muito mais.

---

## Visão Geral

O **Leva+** é uma plataforma completa de fidelização de clientes para o varejo. Conecta lojistas, clientes finais, colaboradores e revendedores em um único ecossistema digital — acessível via web e app nativo (iOS/Android via Capacitor).

### Perfis de Usuário

| Perfil | Rota | Descrição |
|---|---|---|
| **Admin** | `/adm` | Gestão global da plataforma |
| **Lojista** | `/levaloja` | Dashboard do varejista |
| **Cliente** | `/levacliente` | App do consumidor final |
| **Colaborador** | `/levacolaborador` | Marketplace de recompensas |
| **Revendedor** | `/levarevendedor` | Painel de comissões |
| **Registro** | `/levaregistro` | PDV para lançamentos manuais |

---

## Stack Tecnológica

- **Frontend:** React 18 + TypeScript + Vite
- **UI:** Tailwind CSS + shadcn/ui + Radix UI
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions + Realtime)
- **App Nativo:** Capacitor 6 (iOS & Android)
- **Pagamentos:** Asaas (assinaturas e cobranças)
- **Comunicação:** WhatsApp API, SMS (Mex10/Twilio), E-mail (Resend)
- **Mapas:** Mapbox GL
- **Push Notifications:** Web Push + Expo Push

---

## Pré-requisitos

- Node.js 18+
- npm 9+
- Conta no [Supabase](https://supabase.com)

---

## Instalação e Desenvolvimento

```bash
# 1. Clone o repositório
git clone https://github.com/rayanneernandez/levamais.git
cd levamais

# 2. Instale as dependências
npm install --legacy-peer-deps

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

Acesse em `http://localhost:8080`

---

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz com:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
VITE_MAPBOX_TOKEN=seu-token-mapbox
```

---

## Scripts Disponíveis

```bash
npm run dev              # Servidor de desenvolvimento
npm run build            # Build de produção (web)
npm run preview          # Preview do build

# App Nativo (Capacitor)
npm run cap:build        # Build web + sync Capacitor
npm run cap:android      # Abre no Android Studio
npm run cap:ios          # Abre no Xcode
npm run cap:run:android  # Roda no emulador Android
npm run cap:run:ios      # Roda no simulador iOS
```

---

## Gerando o App Nativo

Veja o guia completo em [`GUIA-APP-CAPACITOR.md`](./GUIA-APP-CAPACITOR.md).

Resumo rápido:

```bash
npm run build
npx cap add android      # primeira vez
npx cap sync
npm run cap:android      # abre Android Studio → gera APK
```

---

## Estrutura do Projeto

```
src/
├── components/
│   ├── admin/           # Componentes do painel admin
│   ├── client/          # Componentes do app cliente
│   ├── store/           # Componentes do painel lojista
│   └── ui/              # Componentes base (shadcn/ui)
├── pages/
│   ├── admin/           # Páginas admin
│   ├── client/          # Páginas cliente
│   └── store/           # Páginas lojista
├── hooks/               # Custom hooks React
├── contexts/            # Contextos globais
├── integrations/
│   └── supabase/        # Client e tipos do Supabase
└── lib/
    └── capacitor.ts     # Utilitários para app nativo

supabase/
├── functions/           # Edge Functions (Deno)
└── migrations/          # Histórico de migrações SQL
```

---

## Edge Functions (Supabase)

As funções serverless ficam em `supabase/functions/` e rodam em **Deno**.

Para evitar falsos erros no VS Code, instale a extensão:
```bash
code --install-extension denoland.vscode-deno
```

Para fazer deploy:
```bash
supabase functions deploy nome-da-funcao
```

---

## Módulos Principais

- **Fidelidade:** Cashback, pontos, selos, programa de retenção
- **Leva One:** Assinatura premium com cartão e marketplace
- **Marketing:** Disparo de WhatsApp, SMS e e-mail segmentado
- **NPS:** Pesquisa de satisfação com resposta automática
- **Combustível:** Análise e promoções para postos
- **Financeiro:** Cobranças, planos e extrato via Asaas
- **Insights:** Chat com IA para análise de dados da loja

---

## Licença

Proprietário — © 2025 Leva+. Todos os direitos reservados.
