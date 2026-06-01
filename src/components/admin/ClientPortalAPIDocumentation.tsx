import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Copy, Check, ExternalLink, Lock, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = "https://auivszkscfcpczrkecoc.supabase.co/functions/v1";

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  name: string;
  description: string;
  auth: "public" | "bearer" | "supabase";
  category: string;
  requestBody?: object;
  responseExample?: object;
  queryParams?: { name: string; type: string; required: boolean; description: string }[];
  notes?: string[];
}

const endpoints: Endpoint[] = [
  // Autenticação
  {
    method: "POST",
    path: "/client-login",
    name: "Login do Cliente",
    description: "Valida CPF e senha do cliente e retorna email para autenticação no Supabase",
    auth: "public",
    category: "Autenticação",
    requestBody: {
      cpf: "12345678900",
      password: "senha123"
    },
    responseExample: {
      success: true,
      email: "cliente@email.com",
      name: "João da Silva"
    },
    notes: [
      "Se retornar erro 'PRIMEIRO_ACESSO', o cliente precisa fazer o primeiro cadastro",
      "Após receber o email, use Supabase Auth signInWithPassword(email, password)"
    ]
  },
  {
    method: "POST",
    path: "/client-first-registration",
    name: "Primeiro Cadastro",
    description: "Cadastra senha e email para clientes que ainda não têm acesso ao portal",
    auth: "public",
    category: "Autenticação",
    requestBody: {
      cpf: "12345678900",
      password: "novaSenha123",
      email: "cliente@email.com",
      phone: "11999998888"
    },
    responseExample: {
      success: true,
      message: "Cadastro realizado com sucesso!",
      email: "cliente@email.com"
    },
    notes: [
      "O CPF deve já existir no sistema (cadastrado em alguma rede)",
      "Após o cadastro, cliente pode fazer login normalmente"
    ]
  },
  {
    method: "POST",
    path: "/send-client-login-code",
    name: "Enviar Código de Login (Passwordless)",
    description: "Envia código de 6 dígitos por email para login sem senha",
    auth: "public",
    category: "Autenticação",
    requestBody: {
      cpf: "12345678900"
    },
    responseExample: {
      success: true,
      email: "cl***@gm***.com"
    },
    notes: [
      "Código válido por 5 minutos",
      "Aguarde 2 minutos entre solicitações"
    ]
  },
  {
    method: "POST",
    path: "/verify-client-login-code",
    name: "Verificar Código de Login",
    description: "Valida o código de 6 dígitos e retorna magic link para autenticação",
    auth: "public",
    category: "Autenticação",
    requestBody: {
      cpf: "12345678900",
      code: "123456"
    },
    responseExample: {
      success: true,
      email: "cliente@email.com",
      name: "João da Silva",
      magicLink: "https://..."
    },
    notes: [
      "Use o magicLink para autenticar o usuário via Supabase Auth"
    ]
  },
  {
    method: "POST",
    path: "/client-forgot-password",
    name: "Esqueci Minha Senha",
    description: "Envia email com link para redefinição de senha",
    auth: "public",
    category: "Autenticação",
    requestBody: {
      email: "cliente@email.com"
    },
    responseExample: {
      success: true,
      message: "Email de recuperação enviado com sucesso!"
    }
  },
  
  // Dados do Cliente (via Supabase)
  {
    method: "GET",
    path: "Supabase: clients",
    name: "Buscar Dados do Cliente",
    description: "Retorna todos os registros do cliente logado em todas as redes",
    auth: "supabase",
    category: "Dados do Cliente",
    responseExample: {
      id: "uuid",
      cpf: "12345678900",
      full_name: "João da Silva",
      email: "cliente@email.com",
      phone: "11999998888",
      total_points: 150.50,
      network_id: "uuid",
      favorite_network_id: "uuid",
      is_one_member: false,
      auto_redemption_enabled: true,
      birth_date: "1990-01-15",
      address_city: "São Paulo",
      address_state: "SP",
      address_country: "BR",
      email_validated: true,
      phone_validated: true
    },
    notes: [
      "Query: supabase.from('clients').select('*').eq('user_id', userId)",
      "Um cliente pode ter múltiplos registros (um por rede)"
    ]
  },
  {
    method: "GET",
    path: "Supabase: networks",
    name: "Buscar Dados da Rede",
    description: "Retorna informações das redes onde o cliente está cadastrado",
    auth: "supabase",
    category: "Dados do Cliente",
    responseExample: {
      id: "uuid",
      name: "Posto Leva+",
      loyalty_type: "cashback",
      support_whatsapp: "11999998888"
    },
    notes: [
      "Query: supabase.from('networks').select('*').in('id', networkIds)"
    ]
  },
  {
    method: "PATCH",
    path: "Supabase: clients",
    name: "Atualizar Perfil",
    description: "Atualiza dados do perfil do cliente",
    auth: "supabase",
    category: "Dados do Cliente",
    requestBody: {
      full_name: "João Silva",
      email: "novo@email.com",
      phone: "11888887777",
      birth_date: "1990-01-15",
      gender: "M",
      address_city: "São Paulo",
      address_state: "SP",
      address_country: "BR",
      address_neighborhood: "Centro"
    },
    notes: [
      "Também atualize na tabela 'profiles' o full_name e email"
    ]
  },
  {
    method: "PATCH",
    path: "Supabase: clients",
    name: "Definir Rede Favorita",
    description: "Define qual rede é a favorita do cliente",
    auth: "supabase",
    category: "Dados do Cliente",
    requestBody: {
      favorite_network_id: "uuid-da-rede"
    },
    notes: [
      "Atualiza em TODOS os registros do cliente: .eq('user_id', userId)"
    ]
  },
  
  // Transações
  {
    method: "GET",
    path: "Supabase: transactions",
    name: "Histórico de Transações",
    description: "Retorna o histórico de transações do cliente",
    auth: "supabase",
    category: "Transações",
    queryParams: [
      { name: "client_id", type: "uuid", required: true, description: "ID do registro do cliente na rede" },
      { name: "limit", type: "number", required: false, description: "Limite de registros" },
      { name: "order", type: "string", required: false, description: "Ordenação (created_at desc)" }
    ],
    responseExample: {
      id: "uuid",
      type: "accumulation",
      amount: 100.00,
      cashback: 5.00,
      description: "Abastecimento",
      created_at: "2024-01-15T10:30:00Z",
      store_id: "uuid",
      points_validity_days: 365,
      expires_at: "2025-01-15T10:30:00Z"
    },
    notes: [
      "type: 'accumulation' (acúmulo) ou 'redemption' (resgate)",
      "Query: supabase.from('transactions').select('*, stores(name, address)').eq('client_id', clientId).order('created_at', {ascending: false})"
    ]
  },
  {
    method: "GET",
    path: "Supabase: stores",
    name: "Listar Lojas da Rede",
    description: "Retorna as lojas de uma rede específica",
    auth: "supabase",
    category: "Transações",
    responseExample: {
      id: "uuid",
      name: "Posto Centro",
      address: "Rua Principal, 123",
      contact_phone: "11999998888",
      flag: "Bandeira",
      services: ["Gasolina", "Diesel", "Loja"]
    },
    notes: [
      "Query: supabase.from('stores').select('*').eq('network_id', networkId).eq('is_active', true)"
    ]
  },
  
  // Avaliações NPS
  {
    method: "POST",
    path: "Supabase: transaction_ratings",
    name: "Avaliar Transação",
    description: "Registra avaliação NPS de uma transação",
    auth: "supabase",
    category: "Avaliações",
    requestBody: {
      transaction_id: "uuid",
      client_id: "uuid",
      network_id: "uuid",
      rating: 9,
      comment: "Excelente atendimento!"
    },
    notes: [
      "rating: 0-10 (NPS score)",
      "Se a rede tem recompensa configurada, aguardar processamento automático"
    ]
  },
  
  // Resgate Automático
  {
    method: "PATCH",
    path: "Supabase: clients",
    name: "Configurar Resgate Automático",
    description: "Ativa/desativa o resgate automático de cashback",
    auth: "supabase",
    category: "Configurações",
    requestBody: {
      auto_redemption_enabled: true,
      auto_redemption_disable_mode: "immediate",
      auto_redemption_disable_days: 1
    },
    notes: [
      "auto_redemption_disable_mode: 'immediate' ou 'scheduled'",
      "Se 'scheduled', define quantos dias para desativar automaticamente"
    ]
  },
  
  // Notificações
  {
    method: "GET",
    path: "Supabase: client_notification_recipients + client_notifications",
    name: "Listar Notificações",
    description: "Retorna notificações do cliente",
    auth: "supabase",
    category: "Notificações",
    responseExample: {
      id: "uuid",
      notification_id: "uuid",
      is_read: false,
      client_notifications: {
        title: "Promoção especial!",
        message: "Aproveite 10% extra de cashback",
        created_at: "2024-01-15T10:30:00Z"
      }
    },
    notes: [
      "Query: supabase.from('client_notification_recipients').select('*, client_notifications(*)').eq('client_id', clientId)"
    ]
  },
  {
    method: "PATCH",
    path: "Supabase: client_notification_recipients",
    name: "Marcar Notificação como Lida",
    description: "Atualiza status de leitura da notificação",
    auth: "supabase",
    category: "Notificações",
    requestBody: {
      is_read: true,
      read_at: "2024-01-15T10:30:00Z"
    }
  },
  
  // Push Notifications
  {
    method: "GET",
    path: "Supabase: client_push_subscriptions",
    name: "Buscar Inscrição Push",
    description: "Verifica se o dispositivo está inscrito para push notifications",
    auth: "supabase",
    category: "Notificações",
    responseExample: {
      id: "uuid",
      client_id: "uuid",
      endpoint: "https://fcm.googleapis.com/...",
      is_active: true,
      device_type: "android"
    }
  },
  {
    method: "POST",
    path: "Supabase: client_push_subscriptions",
    name: "Registrar Push Notification",
    description: "Registra dispositivo para receber push notifications",
    auth: "supabase",
    category: "Notificações",
    requestBody: {
      client_id: "uuid",
      endpoint: "https://fcm.googleapis.com/...",
      p256dh: "key",
      auth: "auth",
      device_type: "android"
    }
  },
  
  // Leva+ One
  {
    method: "GET",
    path: "Supabase: client_subscriptions_one",
    name: "Verificar Assinatura ONE",
    description: "Verifica se o cliente tem assinatura ONE ativa",
    auth: "supabase",
    category: "Leva+ One",
    responseExample: {
      id: "uuid",
      client_id: "uuid",
      status: "active",
      monthly_value: 9.90,
      can_cancel: false,
      minimum_period_months: 12,
      card_number: "ONE12345678"
    },
    notes: [
      "status: 'pending', 'active', 'suspended', 'cancelled'"
    ]
  },
  {
    method: "POST",
    path: "/create-one-subscription",
    name: "Criar Assinatura ONE (Boleto)",
    description: "Cria nova assinatura ONE com pagamento via boleto",
    auth: "bearer",
    category: "Leva+ One",
    requestBody: {
      client_id: "uuid",
      network_id: "uuid"
    },
    responseExample: {
      success: true,
      subscription: { "..." : "dados da assinatura" },
      payment_link: "https://asaas.com/...",
      asaas_subscription_id: "sub_123"
    }
  },
  {
    method: "POST",
    path: "/create-one-credit-card-subscription",
    name: "Criar Assinatura ONE (Cartão)",
    description: "Cria nova assinatura ONE com pagamento via cartão de crédito",
    auth: "bearer",
    category: "Leva+ One",
    requestBody: {
      client_id: "uuid",
      network_id: "uuid",
      creditCard: {
        holderName: "NOME NO CARTAO",
        number: "4111111111111111",
        expiryMonth: "12",
        expiryYear: "2025",
        ccv: "123"
      },
      creditCardHolderInfo: {
        name: "Nome Completo",
        email: "email@email.com",
        cpfCnpj: "12345678900",
        postalCode: "01310100",
        addressNumber: "123",
        phone: "11999998888"
      }
    },
    responseExample: {
      success: true,
      subscription: { "..." : "dados" },
      message: "Assinatura criada com sucesso!"
    }
  },
  {
    method: "POST",
    path: "/update-one-subscription-card",
    name: "Atualizar Cartão ONE",
    description: "Atualiza o cartão de crédito de uma assinatura ONE",
    auth: "bearer",
    category: "Leva+ One",
    requestBody: {
      subscription_id: "uuid",
      creditCard: {
        holderName: "NOME NO CARTAO",
        number: "4111111111111111",
        expiryMonth: "12",
        expiryYear: "2025",
        ccv: "123"
      },
      creditCardHolderInfo: {
        name: "Nome",
        email: "email@email.com",
        cpfCnpj: "12345678900",
        postalCode: "01310100",
        addressNumber: "123",
        phone: "11999998888"
      }
    }
  },
  {
    method: "POST",
    path: "/cancel-one-subscription",
    name: "Cancelar Assinatura ONE",
    description: "Cancela uma assinatura ONE",
    auth: "bearer",
    category: "Leva+ One",
    requestBody: {
      subscription_id: "uuid"
    }
  },
  
  // Promoções ONE
  {
    method: "GET",
    path: "Supabase: one_promotions",
    name: "Listar Promoções ONE",
    description: "Retorna promoções exclusivas para membros ONE",
    auth: "supabase",
    category: "Leva+ One",
    responseExample: {
      id: "uuid",
      name: "Desconto em Gasolina",
      description: "10% de desconto",
      discount_type: "percentage",
      discount_value: 10,
      start_date: "2024-01-01",
      end_date: "2024-12-31",
      is_active: true
    },
    notes: [
      "Filtrar por: .eq('network_id', networkId).eq('is_active', true)"
    ]
  },
  
  // Resgates ONE
  {
    method: "GET",
    path: "Supabase: one_promotion_redemptions",
    name: "Histórico de Resgates ONE",
    description: "Retorna histórico de resgates de promoções ONE",
    auth: "supabase",
    category: "Leva+ One",
    responseExample: {
      id: "uuid",
      promotion_id: "uuid",
      client_id: "uuid",
      status: "used",
      redemption_code: "PROMO123",
      created_at: "2024-01-15T10:30:00Z"
    }
  },
  {
    method: "POST",
    path: "Supabase: one_promotion_redemptions",
    name: "Resgatar Promoção ONE",
    description: "Registra o resgate de uma promoção ONE",
    auth: "supabase",
    category: "Leva+ One",
    requestBody: {
      promotion_id: "uuid",
      client_id: "uuid",
      subscription_id: "uuid"
    }
  },
  
  // Marketplace ONE
  {
    method: "GET",
    path: "Supabase: marketplace_products",
    name: "Listar Produtos Marketplace",
    description: "Retorna produtos disponíveis no marketplace",
    auth: "supabase",
    category: "Marketplace",
    responseExample: {
      id: "uuid",
      name: "Produto",
      description: "Descrição",
      price: 99.90,
      category: "Categoria",
      image_url: "https://...",
      is_active: true
    }
  },
  {
    method: "POST",
    path: "Supabase: marketplace_orders",
    name: "Criar Pedido Marketplace",
    description: "Cria um novo pedido no marketplace",
    auth: "supabase",
    category: "Marketplace",
    requestBody: {
      client_id: "uuid",
      product_id: "uuid",
      quantity: 1,
      total_amount: 99.90
    }
  },
  
  // Retenção
  {
    method: "GET",
    path: "Supabase: client_retention_commitments",
    name: "Verificar Compromisso de Retenção",
    description: "Verifica se o cliente tem programa de retenção ativo",
    auth: "supabase",
    category: "Retenção",
    responseExample: {
      id: "uuid",
      client_id: "uuid",
      network_id: "uuid",
      status: "active",
      commitment_period_days: 180,
      bonus_multiplier: 1.5,
      created_at: "2024-01-01",
      expires_at: "2024-07-01"
    }
  },
  {
    method: "POST",
    path: "/create-retention-commitment",
    name: "Criar Compromisso de Retenção",
    description: "Cliente adere ao programa de retenção da rede",
    auth: "bearer",
    category: "Retenção",
    requestBody: {
      client_id: "uuid",
      network_id: "uuid"
    }
  },
  
  // Indicação
  {
    method: "GET",
    path: "Supabase: clients",
    name: "Buscar Código de Indicação",
    description: "Retorna o código de indicação do cliente",
    auth: "supabase",
    category: "Indicação",
    responseExample: {
      referral_code: "ABC123"
    },
    notes: [
      "Campo: referral_code na tabela clients"
    ]
  },
  {
    method: "GET",
    path: "Supabase: client_referrals",
    name: "Histórico de Indicações",
    description: "Retorna clientes indicados e recompensas",
    auth: "supabase",
    category: "Indicação",
    responseExample: {
      id: "uuid",
      referrer_client_id: "uuid",
      referred_client_id: "uuid",
      reward_amount: 10.00,
      status: "completed"
    }
  },
  
  // Suporte
  {
    method: "POST",
    path: "Supabase: support_tickets",
    name: "Abrir Ticket de Suporte",
    description: "Cria um novo ticket de suporte",
    auth: "supabase",
    category: "Suporte",
    requestBody: {
      client_id: "uuid",
      network_id: "uuid",
      subject: "Assunto",
      description: "Descrição do problema",
      priority: "medium"
    }
  },
  {
    method: "GET",
    path: "Supabase: support_tickets",
    name: "Listar Tickets",
    description: "Retorna tickets de suporte do cliente",
    auth: "supabase",
    category: "Suporte"
  }
];

const methodColors: Record<string, string> = {
  GET: "bg-green-500/10 text-green-500 border-green-500/20",
  POST: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  PUT: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  PATCH: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  DELETE: "bg-red-500/10 text-red-500 border-red-500/20",
};

const authColors: Record<string, { bg: string; label: string; icon: typeof Lock }> = {
  public: { bg: "bg-green-500/10 text-green-500", label: "Público", icon: Globe },
  bearer: { bg: "bg-yellow-500/10 text-yellow-500", label: "Bearer Token", icon: Lock },
  supabase: { bg: "bg-purple-500/10 text-purple-500", label: "Supabase Auth", icon: Lock },
};

const categories = [...new Set(endpoints.map(e => e.category))];

export function ClientPortalAPIDocumentation() {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ title: "Copiado!", description: "Código copiado para a área de transferência." });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredEndpoints = selectedCategory 
    ? endpoints.filter(e => e.category === selectedCategory)
    : endpoints;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            API do Portal do Cliente - Documentação para Manus
          </CardTitle>
          <CardDescription>
            Documentação completa de todos os endpoints necessários para replicar o Portal do Cliente em um app nativo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium mb-1">Base URL (Edge Functions)</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                {BASE_URL}
              </code>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Supabase URL</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                https://auivszkscfcpczrkecoc.supabase.co
              </code>
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className={authColors.public.bg}>
              <Globe className="h-3 w-3 mr-1" />
              Público - Sem autenticação
            </Badge>
            <Badge variant="outline" className={authColors.bearer.bg}>
              <Lock className="h-3 w-3 mr-1" />
              Bearer Token - Token do usuário logado
            </Badge>
            <Badge variant="outline" className={authColors.supabase.bg}>
              <Lock className="h-3 w-3 mr-1" />
              Supabase Auth - Query direta ao Supabase com sessão
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Auth Flow */}
      <Card>
        <CardHeader>
          <CardTitle>Fluxo de Autenticação</CardTitle>
          <CardDescription>Como autenticar o cliente no app</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">1</div>
                <h3 className="font-semibold">Login CPF</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                POST /client-login com CPF e senha. Retorna email.
              </p>
            </div>
            <div className="space-y-2 p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">2</div>
                <h3 className="font-semibold">Supabase Auth</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                signInWithPassword(email, password) no Supabase Client
              </p>
            </div>
            <div className="space-y-2 p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">3</div>
                <h3 className="font-semibold">Sessão</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Armazenar session.access_token para chamadas autenticadas
              </p>
            </div>
            <div className="space-y-2 p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">4</div>
                <h3 className="font-semibold">Buscar Dados</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Query clients onde user_id = session.user.id
              </p>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">Exemplo de Código (React Native / Flutter)</p>
            <pre className="text-xs overflow-x-auto">
{`// 1. Login via CPF
const loginResponse = await fetch('${BASE_URL}/client-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ cpf: '12345678900', password: 'senha123' })
});
const { email } = await loginResponse.json();

// 2. Autenticar no Supabase
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { data: { session } } = await supabase.auth.signInWithPassword({
  email: email,
  password: 'senha123'
});

// 3. Buscar dados do cliente
const { data: clients } = await supabase
  .from('clients')
  .select('*')
  .eq('user_id', session.user.id);`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory(null)}
        >
          Todos ({endpoints.length})
        </Button>
        {categories.map(cat => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat)}
          >
            {cat} ({endpoints.filter(e => e.category === cat).length})
          </Button>
        ))}
      </div>

      {/* Endpoints */}
      <Accordion type="multiple" className="space-y-2">
        {filteredEndpoints.map((endpoint, index) => {
          const authInfo = authColors[endpoint.auth];
          const AuthIcon = authInfo.icon;
          
          return (
            <AccordionItem 
              key={`${endpoint.path}-${index}`} 
              value={`${endpoint.path}-${index}`}
              className="border rounded-lg px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 text-left w-full">
                  <Badge className={`${methodColors[endpoint.method]} font-mono text-xs`}>
                    {endpoint.method}
                  </Badge>
                  <code className="text-xs font-mono text-muted-foreground flex-1 truncate">
                    {endpoint.path}
                  </code>
                  <Badge variant="outline" className={`${authInfo.bg} text-xs`}>
                    <AuthIcon className="h-3 w-3 mr-1" />
                    {authInfo.label}
                  </Badge>
                  <span className="text-sm font-medium hidden md:block">{endpoint.name}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <div>
                  <p className="font-medium">{endpoint.name}</p>
                  <p className="text-sm text-muted-foreground">{endpoint.description}</p>
                </div>

                {endpoint.queryParams && (
                  <div>
                    <p className="text-sm font-medium mb-2">Query Parameters</p>
                    <div className="bg-muted p-3 rounded-lg space-y-2">
                      {endpoint.queryParams.map(param => (
                        <div key={param.name} className="flex items-start gap-2 text-sm">
                          <code className="bg-background px-1 rounded">{param.name}</code>
                          <Badge variant="outline" className="text-xs">{param.type}</Badge>
                          {param.required && <Badge className="text-xs bg-red-500/10 text-red-500">required</Badge>}
                          <span className="text-muted-foreground">{param.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {endpoint.requestBody && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Request Body</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(JSON.stringify(endpoint.requestBody, null, 2), `req-${index}`)}
                      >
                        {copiedId === `req-${index}` ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(endpoint.requestBody, null, 2)}
                    </pre>
                  </div>
                )}

                {endpoint.responseExample && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Response Example</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(JSON.stringify(endpoint.responseExample, null, 2), `res-${index}`)}
                      >
                        {copiedId === `res-${index}` ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(endpoint.responseExample, null, 2)}
                    </pre>
                  </div>
                )}

                {endpoint.notes && endpoint.notes.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-sm font-medium mb-2">Notas</p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      {endpoint.notes.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Supabase Config */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração Supabase</CardTitle>
          <CardDescription>Configurações para o cliente Supabase no app</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
{`// supabase.ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://auivszkscfcpczrkecoc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1aXZzemtzY2ZjcGN6cmtlY29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyOTczMjksImV4cCI6MjA3NTg3MzMyOX0.Gz7wyWsb5NvFau6tJ_I9cce2HJm6s1o_nESHYAf3sPk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});`}
          </pre>
        </CardContent>
      </Card>

      {/* Important Notes */}
      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="text-yellow-600 dark:text-yellow-400">
            ⚠️ Notas Importantes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>• <strong>RLS (Row Level Security):</strong> Todas as tabelas têm políticas que filtram por user_id automaticamente</p>
          <p>• <strong>Múltiplas Redes:</strong> Um cliente pode ter registros em várias redes (1 registro por rede)</p>
          <p>• <strong>Rede Favorita:</strong> O campo favorite_network_id define qual rede é a principal</p>
          <p>• <strong>Leva+ One:</strong> Verificar is_one_member para exibir funcionalidades exclusivas</p>
          <p>• <strong>Inatividade:</strong> Implementar logout automático após 15 minutos de inatividade</p>
          <p>• <strong>Validação:</strong> Clientes têm 7 dias para validar email/telefone após o cadastro</p>
        </CardContent>
      </Card>
    </div>
  );
}
