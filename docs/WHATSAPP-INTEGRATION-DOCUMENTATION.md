# Documentação Completa da Integração WhatsApp

## Visão Geral

Esta documentação descreve toda a estrutura de integração WhatsApp utilizando a API do **Zap Responder** (proxy da API 360Dialog/WhatsApp Cloud API). O sistema implementa:

- Fila de mensagens com rate limiting
- Controle de janela de 24h (regra do WhatsApp Business)
- Envio automático de templates quando não há janela ativa
- Webhooks para receber mensagens e status
- Templates da Meta aprovados
- Histórico de conversas

---

## 1. Arquitetura do Sistema

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Frontend UI   │───▶  │   Supabase DB   │ ◀──▶ │ Edge Functions  │
│  (React/Vite)   │      │    (Fila/Logs)  │      │                 │
└─────────────────┘      └─────────────────┘      └────────┬────────┘
                                                           │
                                                           ▼
                                                 ┌─────────────────┐
                                                 │  Zap Responder  │
                                                 │  (API Render)   │
                                                 │ wpp-360dialog-  │
                                                 │ starter.onrender│
                                                 │      .com       │
                                                 └────────┬────────┘
                                                           │
                                                           ▼
                                                 ┌─────────────────┐
                                                 │  WhatsApp API   │
                                                 │   (Meta/360D)   │
                                                 └─────────────────┘
```

---

## 2. Estrutura do Banco de Dados

### 2.1 Tabela: `whatsapp_message_queue`

Fila principal de mensagens para envio.

```sql
CREATE TABLE whatsapp_message_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id UUID NOT NULL REFERENCES networks(id),
    store_id UUID REFERENCES stores(id),
    client_id UUID REFERENCES clients(id),
    phone TEXT NOT NULL,
    message_type TEXT NOT NULL, -- 'text', 'template', 'media'
    template_id UUID,
    template_name TEXT,
    template_params JSONB,
    message_text TEXT,
    media_url TEXT,
    media_type TEXT,
    priority INTEGER DEFAULT 5, -- 1-10 (menor = mais urgente)
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, sent, failed, waiting_reply, cancelled
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_message TEXT,
    wamid TEXT, -- ID da mensagem no WhatsApp
    campaign_id UUID,
    is_promotional BOOLEAN DEFAULT FALSE,
    cost NUMERIC DEFAULT 0,
    metadata JSONB,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    waiting_for_template_reply BOOLEAN DEFAULT FALSE,
    has_active_window BOOLEAN DEFAULT FALSE,
    conversation_window_checked BOOLEAN DEFAULT FALSE,
    template_sent_at TIMESTAMPTZ,
    original_message_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices recomendados
CREATE INDEX idx_whatsapp_queue_status ON whatsapp_message_queue(status);
CREATE INDEX idx_whatsapp_queue_network ON whatsapp_message_queue(network_id);
CREATE INDEX idx_whatsapp_queue_phone ON whatsapp_message_queue(phone);
CREATE INDEX idx_whatsapp_queue_scheduled ON whatsapp_message_queue(scheduled_for);
```

### 2.2 Tabela: `whatsapp_conversation_history`

Histórico de todas as mensagens trocadas.

```sql
CREATE TABLE whatsapp_conversation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id UUID NOT NULL REFERENCES networks(id),
    client_id UUID REFERENCES clients(id),
    wa_id TEXT NOT NULL, -- ID do WhatsApp (telefone)
    phone TEXT NOT NULL,
    direction TEXT NOT NULL, -- 'in' (recebida), 'out' (enviada)
    message_type TEXT NOT NULL, -- text, template, image, video, audio, document
    body_text TEXT,
    media_url TEXT,
    wamid TEXT, -- ID único da mensagem no WhatsApp
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB, -- Payload completo do webhook
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_whatsapp_history_phone ON whatsapp_conversation_history(phone);
CREATE INDEX idx_whatsapp_history_network ON whatsapp_conversation_history(network_id);
CREATE INDEX idx_whatsapp_history_timestamp ON whatsapp_conversation_history(timestamp DESC);
CREATE INDEX idx_whatsapp_history_direction ON whatsapp_conversation_history(direction);
```

### 2.3 Tabela: `whatsapp_network_settings`

Configurações de WhatsApp por rede.

```sql
CREATE TABLE whatsapp_network_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id UUID NOT NULL UNIQUE REFERENCES networks(id),
    default_template_name TEXT, -- Template padrão para iniciar conversas
    default_template_language TEXT DEFAULT 'pt_BR',
    department_id TEXT DEFAULT 'a9355171-0c38-40e3-9f22-4ed123ddaf69', -- ID do departamento no Zap Responder
    auto_send_template BOOLEAN DEFAULT TRUE, -- Enviar template automaticamente quando não há janela 24h
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.4 Tabela: `whatsapp_rate_limits`

Controle de rate limiting por minuto.

```sql
CREATE TABLE whatsapp_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id UUID NOT NULL REFERENCES networks(id),
    window_start TIMESTAMPTZ NOT NULL,
    messages_sent INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(network_id, window_start)
);
```

### 2.5 Tabela: `whatsapp_send_logs`

Logs detalhados de envio.

```sql
CREATE TABLE whatsapp_send_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id UUID REFERENCES whatsapp_message_queue(id),
    network_id UUID REFERENCES networks(id),
    phone TEXT,
    direction TEXT, -- 'out', 'status', 'system'
    message_type TEXT,
    template_name TEXT,
    body_text TEXT,
    wamid TEXT,
    status TEXT,
    error_details TEXT,
    api_response JSONB,
    cost NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Funções do Banco de Dados

### 3.1 Verificar Janela de 24h

```sql
CREATE OR REPLACE FUNCTION has_active_conversation_window(
    p_phone TEXT, 
    p_network_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    last_inbound TIMESTAMPTZ;
BEGIN
    -- Buscar última mensagem RECEBIDA do cliente
    SELECT timestamp INTO last_inbound
    FROM whatsapp_conversation_history
    WHERE phone = p_phone
      AND network_id = p_network_id
      AND direction = 'in'
    ORDER BY timestamp DESC
    LIMIT 1;
    
    -- Se não há mensagem ou tem mais de 24h, não há janela
    IF last_inbound IS NULL OR last_inbound < (NOW() - INTERVAL '24 hours') THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$;
```

### 3.2 Incrementar Rate Limit

```sql
CREATE OR REPLACE FUNCTION increment_whatsapp_rate_limit(
    p_network_id UUID, 
    p_window_start TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    INSERT INTO whatsapp_rate_limits (network_id, window_start, messages_sent)
    VALUES (p_network_id, p_window_start, 1)
    ON CONFLICT (network_id, window_start)
    DO UPDATE SET 
        messages_sent = whatsapp_rate_limits.messages_sent + 1,
        updated_at = NOW();
END;
$$;
```

### 3.3 Trigger para Updated At

```sql
CREATE OR REPLACE FUNCTION update_whatsapp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_whatsapp_queue_updated_at
    BEFORE UPDATE ON whatsapp_message_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_whatsapp_updated_at();
```

---

## 4. Edge Functions

### 4.1 `process-whatsapp-queue` - Processador da Fila

Esta é a função principal que processa a fila de mensagens.

**Endpoint interno:** `POST /functions/v1/process-whatsapp-queue`

```typescript
// Arquivo: supabase/functions/process-whatsapp-queue/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ======== CONFIGURAÇÕES - ALTERE PARA SUA API ========
const WHATSAPP_API_BASE = "https://wpp-360dialog-starter.onrender.com"; // Sua URL do Zap Responder
const DEFAULT_DEPARTMENT_ID = "a9355171-0c38-40e3-9f22-4ed123ddaf69"; // Seu Department ID
const RATE_LIMIT_PER_MINUTE = 80; // Limite de mensagens por minuto
const BATCH_SIZE = 10; // Mensagens por lote
// =====================================================

// Verifica janela de 24h
async function hasActiveConversationWindow(supabase, phone, networkId) {
  const { data } = await supabase.rpc('has_active_conversation_window', {
    p_phone: phone,
    p_network_id: networkId
  });
  return data === true;
}

// Busca configurações da rede
async function getNetworkSettings(supabase, networkId) {
  const { data } = await supabase
    .from('whatsapp_network_settings')
    .select('*')
    .eq('network_id', networkId)
    .single();
  
  return data || {
    default_template_name: 'contato_inicial_pt',
    default_template_language: 'pt_BR',
    department_id: DEFAULT_DEPARTMENT_ID,
    auto_send_template: true
  };
}

// Busca primeiro nome do cliente
async function getClientFirstName(supabase, clientId) {
  if (!clientId) return 'Cliente';
  
  const { data } = await supabase
    .from('clients')
    .select('full_name')
    .eq('id', clientId)
    .single();
  
  return data?.full_name?.split(' ')[0] || 'Cliente';
}

// Envia mensagem de texto
async function sendTextMessage(phone, text) {
  try {
    const response = await fetch(`${WHATSAPP_API_BASE}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phone, text })
    });

    const responseText = await response.text();
    try {
      return JSON.parse(responseText);
    } catch {
      return response.ok ? { sent: true } : { sent: false, error: responseText };
    }
  } catch (error) {
    return { sent: false, error: error.message };
  }
}

// Envia template
async function sendTemplateMessage(phone, templateName, parameters, departmentId) {
  try {
    const response = await fetch(`${WHATSAPP_API_BASE}/send/template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        to: phone, 
        template: templateName, 
        language: 'pt_BR', 
        parameters: parameters.map(p => String(p || '')),
        departmentId: departmentId || DEFAULT_DEPARTMENT_ID,
        showInChat: true
      })
    });

    const responseText = await response.text();
    try {
      return JSON.parse(responseText);
    } catch {
      return response.ok ? { sent: true } : { sent: false, error: responseText };
    }
  } catch (error) {
    return { sent: false, error: error.message };
  }
}

// Função principal de processamento
async function processQueue() {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  );

  // Buscar mensagens pendentes
  const { data: queueItems } = await supabase
    .from('whatsapp_message_queue')
    .select('*')
    .eq('status', 'pending')
    .eq('waiting_for_template_reply', false)
    .lte('scheduled_for', new Date().toISOString())
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  let sent = 0, failed = 0, waiting = 0;

  for (const item of queueItems || []) {
    const currentMinute = new Date();
    currentMinute.setSeconds(0, 0);
    
    // Verificar rate limit
    const { data: rateLimitData } = await supabase
      .from('whatsapp_rate_limits')
      .select('*')
      .eq('network_id', item.network_id)
      .gte('window_start', currentMinute.toISOString())
      .single();

    if (rateLimitData?.messages_sent >= RATE_LIMIT_PER_MINUTE) {
      continue; // Pular se atingiu limite
    }

    // Verificar janela de 24h
    let hasWindow = item.has_active_window === true;
    if (!hasWindow) {
      hasWindow = await hasActiveConversationWindow(supabase, item.phone, item.network_id);
    }

    // Atualizar para processing
    await supabase
      .from('whatsapp_message_queue')
      .update({ status: 'processing', has_active_window: hasWindow })
      .eq('id', item.id);

    let result;
    
    if (hasWindow) {
      // TEM janela - enviar direto
      if (item.message_type === 'text') {
        result = await sendTextMessage(item.phone, item.message_text);
      } else if (item.message_type === 'template') {
        const clientName = await getClientFirstName(supabase, item.client_id);
        const params = item.template_params?.length ? item.template_params : [clientName];
        result = await sendTemplateMessage(item.phone, item.template_name, params);
      }
    } else {
      // SEM janela - enviar template primeiro
      const settings = await getNetworkSettings(supabase, item.network_id);
      
      if (settings.auto_send_template && settings.default_template_name) {
        const clientName = await getClientFirstName(supabase, item.client_id);
        result = await sendTemplateMessage(
          item.phone, 
          settings.default_template_name, 
          [clientName],
          settings.department_id
        );

        if (result.sent || result.success) {
          // Template enviado - colocar em espera
          await supabase
            .from('whatsapp_message_queue')
            .update({
              status: 'waiting_reply',
              waiting_for_template_reply: true,
              template_sent_at: new Date().toISOString(),
              original_message_text: item.message_text
            })
            .eq('id', item.id);

          waiting++;
          continue;
        }
      }
    }

    // Processar resultado
    const isSuccess = result?.sent || result?.success;

    if (isSuccess) {
      await supabase
        .from('whatsapp_message_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString(), wamid: result.wamid || result.messageId })
        .eq('id', item.id);
      
      await supabase.rpc('increment_whatsapp_rate_limit', {
        p_network_id: item.network_id,
        p_window_start: currentMinute.toISOString()
      });

      sent++;
    } else {
      const newRetryCount = (item.retry_count || 0) + 1;
      await supabase
        .from('whatsapp_message_queue')
        .update({
          status: newRetryCount < 3 ? 'pending' : 'failed',
          retry_count: newRetryCount,
          error_message: result?.error || 'Falha no envio'
        })
        .eq('id', item.id);

      failed++;
    }

    // Delay entre mensagens
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { sent, failed, waiting };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Processar em background
    (globalThis as any).EdgeRuntime?.waitUntil?.(processQueue()) || processQueue();

    return new Response(
      JSON.stringify({ success: true, message: 'Processamento iniciado' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### 4.2 `whatsapp-webhook` - Receber Mensagens

Webhook para receber mensagens do cliente.

```typescript
// Arquivo: supabase/functions/whatsapp-webhook/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    const body = await req.json();
    console.log('Webhook recebido:', JSON.stringify(body));

    // Ignorar mensagens enviadas por nós
    if (body.type === 'message_sent' || body.author?.type === 'bot') {
      return new Response(JSON.stringify({ success: true, skipped: 'outbound' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extrair telefone (adapte conforme seu provider)
    const chatId = body.chatId || '';
    const phone = String(chatId || body.raw_message?.from || body.from || '').replace(/\D/g, '');

    if (!phone) {
      return new Response(JSON.stringify({ success: true, skipped: 'no phone' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extrair conteúdo
    const message = body.message || {};
    const rawMessage = body.raw_message || {};
    const messageContent = message.mensagem || rawMessage.content || '';
    const messageType = rawMessage.type || 'text';
    const messageId = rawMessage.id || `msg_${Date.now()}`;

    // Buscar cliente pelo telefone
    const { data: client } = await supabase
      .from('clients')
      .select('id, network_id, favorite_network_id, full_name')
      .or(`phone.eq.${phone},phone.eq.55${phone}`)
      .limit(1)
      .maybeSingle();

    const networkId = client?.favorite_network_id || client?.network_id;

    // Salvar no histórico
    await supabase.from('whatsapp_conversation_history').insert({
      network_id: networkId,
      client_id: client?.id,
      wa_id: phone,
      phone: phone,
      direction: 'in',
      message_type: messageType,
      body_text: messageContent || '[sem conteúdo]',
      wamid: messageId,
      timestamp: new Date().toISOString(),
      metadata: body
    });

    // LIBERAR mensagens aguardando resposta
    const { data: waitingMessages } = await supabase
      .from('whatsapp_message_queue')
      .select('*')
      .eq('phone', phone)
      .eq('status', 'waiting_reply')
      .eq('waiting_for_template_reply', true);

    if (waitingMessages?.length > 0) {
      for (const msg of waitingMessages) {
        await supabase
          .from('whatsapp_message_queue')
          .update({
            status: 'pending',
            waiting_for_template_reply: false,
            has_active_window: true
          })
          .eq('id', msg.id);
      }

      // Disparar processamento imediato
      await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-whatsapp-queue`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, phone }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### 4.3 `send-whatsapp` - API para Enviar Mensagem

Endpoint para adicionar mensagem na fila.

```typescript
// Arquivo: supabase/functions/send-whatsapp/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    const body = await req.json();
    const {
      network_id,
      store_id,
      client_id,
      phone,
      message_type, // 'text', 'template'
      template_name,
      template_params,
      message_text,
      priority = 5,
      scheduled_for,
      campaign_id,
      is_promotional = false
    } = body;

    // Validações
    if (!network_id || !phone || !message_type) {
      throw new Error('network_id, phone e message_type são obrigatórios');
    }

    // Inserir na fila
    const { data: queueItem, error } = await supabase
      .from('whatsapp_message_queue')
      .insert({
        network_id,
        store_id,
        client_id,
        phone: phone.replace(/\D/g, ''),
        message_type,
        template_name,
        template_params,
        message_text,
        priority,
        scheduled_for: scheduled_for || new Date().toISOString(),
        campaign_id,
        is_promotional,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        queue_id: queueItem.id,
        message: 'Mensagem adicionada à fila'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### 4.4 `list-whatsapp-templates` - Listar Templates da Meta

```typescript
// Arquivo: supabase/functions/list-whatsapp-templates/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const WHATSAPP_API_BASE = "https://wpp-360dialog-starter.onrender.com";
const DEFAULT_DEPARTMENT_ID = "a9355171-0c38-40e3-9f22-4ed123ddaf69";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let departmentId = DEFAULT_DEPARTMENT_ID;
    
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.departmentId) departmentId = body.departmentId;
      } catch {}
    }

    const response = await fetch(
      `${WHATSAPP_API_BASE}/templates?departmentId=${departmentId}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const templates = data?.templates || data || [];

    return new Response(
      JSON.stringify({ templates: Array.isArray(templates) ? templates : [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## 5. Endpoints da API Zap Responder

### 5.1 Enviar Texto

```
POST https://wpp-360dialog-starter.onrender.com/send/text
```

**Body:**
```json
{
  "to": "5521999999999",
  "text": "Sua mensagem aqui"
}
```

### 5.2 Enviar Template

```
POST https://wpp-360dialog-starter.onrender.com/send/template
```

**Body:**
```json
{
  "to": "5521999999999",
  "template": "nome_do_template",
  "language": "pt_BR",
  "parameters": ["Valor1", "Valor2"],
  "departmentId": "seu-department-id",
  "showInChat": true
}
```

### 5.3 Listar Templates

```
GET https://wpp-360dialog-starter.onrender.com/templates?departmentId=seu-department-id
```

**Resposta:**
```json
{
  "templates": [
    {
      "name": "template_name",
      "status": "APPROVED",
      "category": "MARKETING",
      "language": "pt_BR",
      "components": [
        {
          "type": "BODY",
          "text": "Olá {{1}}, sua mensagem aqui"
        }
      ]
    }
  ]
}
```

---

## 6. Configuração do Webhook no Zap Responder

Configure o webhook para apontar para sua edge function:

```
URL: https://SEU_PROJETO.supabase.co/functions/v1/whatsapp-webhook
Método: POST
Eventos: Mensagens recebidas
```

---

## 7. Fluxo de Mensagens

### 7.1 Envio com Janela 24h Ativa

```
1. Usuário chama send-whatsapp
2. Mensagem inserida na fila (status: pending)
3. process-whatsapp-queue verifica janela 24h → ATIVA
4. Envia texto/template direto → API Zap Responder
5. Atualiza status para 'sent'
```

### 7.2 Envio SEM Janela 24h

```
1. Usuário chama send-whatsapp
2. Mensagem inserida na fila (status: pending)
3. process-whatsapp-queue verifica janela 24h → INATIVA
4. Envia template padrão configurado
5. Atualiza status para 'waiting_reply'
6. Cliente responde → webhook recebe
7. webhook-webhook libera mensagem (status: pending, has_active_window: true)
8. Dispara process-whatsapp-queue
9. Envia mensagem original
```

---

## 8. Componentes React

### 8.1 Componentes Principais

| Componente | Descrição |
|------------|-----------|
| `WhatsAppSettings` | Configurações de template e janela 24h |
| `WhatsAppQueueManager` | Gerenciamento visual da fila |
| `WhatsAppConversationHistory` | Histórico de conversas |
| `WhatsAppTemplateManager` | Visualizar templates da Meta |
| `WhatsAppTestSender` | Enviar mensagens de teste |
| `PromotionalCampaignSender` | Campanhas de marketing |

---

## 9. Variáveis de Ambiente

```env
# Supabase (automático)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Zap Responder (configurar nas edge functions)
WHATSAPP_API_BASE=https://wpp-360dialog-starter.onrender.com
DEFAULT_DEPARTMENT_ID=seu-department-id
```

---

## 10. Checklist de Implementação

- [ ] Criar tabelas no banco de dados
- [ ] Criar funções SQL (has_active_conversation_window, increment_whatsapp_rate_limit)
- [ ] Criar triggers de updated_at
- [ ] Deploy das edge functions
- [ ] Configurar webhook no Zap Responder
- [ ] Configurar Department ID correto
- [ ] Aprovar templates na Meta Business
- [ ] Configurar template padrão na tabela whatsapp_network_settings
- [ ] Testar envio manual
- [ ] Testar fluxo de janela 24h

---

## 11. Templates da Meta

Os templates precisam ser aprovados no [Meta Business Manager](https://business.facebook.com/wa/manage/message-templates).

**Exemplo de template para iniciar conversa:**

```
Nome: contato_inicial_pt
Categoria: MARKETING ou UTILITY
Idioma: pt_BR
Corpo: Olá {{1}}! Aqui é a equipe da [Empresa]. Temos uma novidade para você! Responda esta mensagem para saber mais.
```

---

## 12. Custos Estimados

| Tipo | Custo Médio |
|------|-------------|
| Template (Marketing) | R$ 0,15 - R$ 0,30 |
| Template (Utility) | R$ 0,05 - R$ 0,10 |
| Mensagem Conversação | Gratuito (dentro 24h) |

---

## 13. RLS (Row Level Security)

Aplique RLS nas tabelas para segurança:

```sql
-- Exemplo para whatsapp_message_queue
ALTER TABLE whatsapp_message_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Network access" ON whatsapp_message_queue
    FOR ALL
    USING (network_id IN (
        SELECT network_id FROM store_managers WHERE user_id = auth.uid()
    ));
```

---

## Suporte

Para dúvidas sobre a API do Zap Responder, consulte a documentação do provider ou entre em contato com o suporte.
