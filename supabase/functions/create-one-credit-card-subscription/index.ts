import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * 🔄 FLUXO CORRETO DE PAGAMENTO - Assinatura Leva+ One
 * 
 * ✅ ETAPA 1 - COBRANÇA IMEDIATA:
 *    - Criar cobrança (payment) com dados COMPLETOS do cartão
 *    - Asaas processa como transação REAL
 *    - Asaas retorna creditCardToken na resposta
 * 
 * ✅ ETAPA 2 - ASSINATURA RECORRENTE:
 *    - Criar assinatura usando o creditCardToken
 *    - Cobranças automáticas mensais com o token
 *    - Maior taxa de aprovação e processamento seguro
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SubscriptionRequest {
  client_id: string;
  network_id: string;
  card: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  address: {
    postalCode: string;
    addressNumber: string;
    complement?: string;
    street?: string;
    province?: string;
    city?: string;
    state?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Não autorizado');
    }

    const requestData: SubscriptionRequest = await req.json();
    console.log('📝 Dados da assinatura recebidos');

    // 1. Buscar configuração do Asaas
    const { data: asaasConfig, error: configError } = await supabase
      .from('asaas_config')
      .select('*')
      .single();

    if (configError || !asaasConfig) {
      throw new Error('Configuração Asaas não encontrada');
    }

    const asaasUrl = asaasConfig.is_sandbox
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://www.asaas.com/api/v3';

    const apiKey = asaasConfig.is_sandbox
      ? asaasConfig.api_key_sandbox
      : asaasConfig.api_key_production;

    if (!apiKey) {
      throw new Error('API Key do Asaas não configurada');
    }

    console.log('🔧 Usando Asaas:', asaasConfig.is_sandbox ? 'SANDBOX' : 'PRODUCTION');

    // 2. Buscar dados do cliente
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*, favorite_network:networks!favorite_network_id(*)')
      .eq('id', requestData.client_id)
      .single();

    if (clientError || !client) {
      throw new Error('Cliente não encontrado');
    }

    console.log('✅ Cliente encontrado:', client.full_name);

    // 3. Criar ou buscar cliente no Asaas
    let asaasCustomerId = client.asaas_customer_id;

    if (!asaasCustomerId) {
      console.log('👤 Verificando se cliente já existe no Asaas...');
      
      // Primeiro buscar se já existe um cliente com este CPF no Asaas
      const cpfClean = client.cpf.replace(/\D/g, '');
      const searchResponse = await fetch(
        `${asaasUrl}/customers?cpfCnpj=${cpfClean}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'access_token': apiKey,
          },
        }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.data && searchData.data.length > 0) {
          // Cliente já existe no Asaas, usar o existente
          asaasCustomerId = searchData.data[0].id;
          console.log('✅ Cliente já existe no Asaas (por CPF):', asaasCustomerId);
          
          // Atualizar o banco local com o ID do Asaas
          await supabase
            .from('clients')
            .update({ asaas_customer_id: asaasCustomerId })
            .eq('id', client.id);
        }
      }

      // Se não encontrou, criar novo
      if (!asaasCustomerId) {
        console.log('👤 Criando novo cliente no Asaas...');
        
        const customerResponse = await fetch(`${asaasUrl}/customers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': apiKey
          },
          body: JSON.stringify({
            name: client.full_name,
            email: client.email,
            cpfCnpj: cpfClean,
            phone: client.phone?.replace(/^\+55/, ''),
            mobilePhone: client.phone?.replace(/^\+55/, ''),
            postalCode: requestData.address.postalCode,
            addressNumber: requestData.address.addressNumber,
            complement: requestData.address.complement,
            externalReference: client.codigo
          })
        });

        const customerData = await customerResponse.json();
        
        if (!customerResponse.ok) {
          console.error('❌ Erro ao criar cliente no Asaas:', customerData);
          throw new Error(customerData.errors?.[0]?.description || 'Erro ao criar cliente no Asaas');
        }

        asaasCustomerId = customerData.id;
        console.log('✅ Cliente criado no Asaas:', asaasCustomerId);

        await supabase
          .from('clients')
          .update({ asaas_customer_id: asaasCustomerId })
          .eq('id', client.id);
      }
    } else {
      console.log('✅ Cliente já existe no Asaas:', asaasCustomerId);
    }

    // 4. Buscar configuração de comissão
    const { data: commissionConfig } = await supabase
      .from('network_one_commission_config')
      .select('*')
      .eq('network_id', requestData.network_id)
      .single();

    const monthlyValue = 9.90;
    
    // 5. ✅ ETAPA 1: Criar cobrança IMEDIATA (transação real)
    console.log('💳 ETAPA 1: Criando cobrança IMEDIATA...');
    
    const dueDate = new Date().toISOString().split('T')[0];
    
    const paymentResponse = await fetch(`${asaasUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': apiKey
      },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: 'CREDIT_CARD',
        value: monthlyValue,
        dueDate: dueDate,
        description: `Leva+ One - Primeira Cobrança - ${client.favorite_network?.name || 'Rede'}`,
        externalReference: `${client.codigo}_ONE_FIRST`,
        creditCard: {
          holderName: requestData.card.holderName,
          number: requestData.card.number,
          expiryMonth: requestData.card.expiryMonth,
          expiryYear: requestData.card.expiryYear,
          ccv: requestData.card.ccv
        },
        creditCardHolderInfo: {
          name: client.full_name,
          email: client.email,
          cpfCnpj: client.cpf,
          postalCode: requestData.address.postalCode,
          addressNumber: requestData.address.addressNumber,
          addressComplement: requestData.address.complement,
          phone: client.phone?.replace(/^\+55/, '')
        }
      })
    });

    const paymentData = await paymentResponse.json();
    
    if (!paymentResponse.ok) {
      console.error('❌ Erro ao processar cobrança:', paymentData);
      
      const errorCode = paymentData.errors?.[0]?.code;
      const errorDescription = paymentData.errors?.[0]?.description;
      
      // Mensagem "crua" do Asaas para debug
      const rawMessage = errorDescription || 'Erro ao processar pagamento.';
      
      // Mensagem mais amigável mantendo o detalhe técnico
      let userFriendlyMessage = `${rawMessage}${errorCode ? ` (código: ${errorCode})` : ''}`;
      
      if (errorCode === 'invalid_creditCard') {
        userFriendlyMessage = `${rawMessage} Verifique número, validade, CVV, limite disponível e se o cartão está ativo. (código: ${errorCode})`;
      } else if (errorCode === 'invalid_address') {
        userFriendlyMessage = `${rawMessage} Verifique o CEP, número e complemento. (código: ${errorCode})`;
      } else if (errorCode === 'invalid_customer') {
        userFriendlyMessage = `${rawMessage} Dados do cliente inválidos, entre em contato com o suporte. (código: ${errorCode})`;
      }
      
      throw new Error(userFriendlyMessage || 'Erro ao processar pagamento. Tente novamente.');
    }

    console.log('✅ Cobrança imediata criada:', {
      id: paymentData.id,
      status: paymentData.status,
      value: paymentData.value
    });

    // Capturar o creditCardToken
    const creditCardToken = paymentData.creditCard?.creditCardToken;
    if (!creditCardToken) {
      console.error('⚠️ Token do cartão não encontrado');
      throw new Error('Erro ao processar dados do cartão. Tente novamente.');
    }
    
    console.log('✅ Token capturado para recorrência');

    // 6. ✅ ETAPA 2: Criar assinatura recorrente
    console.log('📅 ETAPA 2: Criando assinatura recorrente...');
    
    const nextDueDate = new Date();
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    const nextDueDateFormatted = nextDueDate.toISOString().split('T')[0];
    
    const subscriptionResponse = await fetch(`${asaasUrl}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': apiKey
      },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: 'CREDIT_CARD',
        value: monthlyValue,
        cycle: 'MONTHLY',
        nextDueDate: nextDueDateFormatted,
        description: `Assinatura Leva+ One - ${client.favorite_network?.name || 'Rede'}`,
        externalReference: `${client.codigo}_ONE`,
        creditCardToken: creditCardToken
      })
    });

    const subscriptionData = await subscriptionResponse.json();
    
    if (!subscriptionResponse.ok) {
      console.error('❌ Erro ao criar assinatura:', subscriptionData);
      throw new Error('Erro ao criar assinatura recorrente.');
    }

    console.log('✅ Assinatura recorrente criada:', subscriptionData.id);

    // 7. Salvar assinatura no banco
    const cardLastDigits = requestData.card.number.slice(-4);
    
    const { data: newSubscription, error: subError } = await supabase
      .from('client_subscriptions_one')
      .insert({
        client_id: requestData.client_id,
        network_id: requestData.network_id,
        status: paymentData.status === 'CONFIRMED' ? 'active' : 'pending',
        monthly_value: monthlyValue,
        start_date: new Date().toISOString(),
        asaas_subscription_id: subscriptionData.id,
        asaas_customer_id: asaasCustomerId,
        card_last_digits: cardLastDigits,
        minimum_period_months: 12,
        can_cancel: false
      })
      .select()
      .single();

    if (subError) {
      console.error('❌ Erro ao salvar assinatura:', subError);
      throw new Error('Erro ao salvar assinatura');
    }

    // 8. Salvar primeira cobrança
    const rawStatus = (paymentData.status || 'PENDING').toString().toLowerCase();
    const allowedStatuses = ['pending', 'confirmed', 'overdue', 'failed', 'refunded'];
    const normalizedStatus = allowedStatuses.includes(rawStatus) ? rawStatus : 'pending';

    await supabase
      .from('asaas_charges')
      .insert({
        asaas_charge_id: paymentData.id,
        network_id: requestData.network_id,
        amount: paymentData.value,
        status: normalizedStatus,
        due_date: paymentData.dueDate,
        payment_method: 'credit_card',
        billing_type: 'CREDIT_CARD',
        charge_type: 'subscription',
        description: paymentData.description,
        payment_date: normalizedStatus === 'confirmed' ? new Date().toISOString() : null,
        invoice_url: paymentData.invoiceUrl,
        // subscription_id mantido nulo aqui, pois a FK aponta para network_subscriptions
      });

    // 9. Atualizar cliente se confirmado
    if (paymentData.status === 'CONFIRMED') {
      await supabase
        .from('clients')
        .update({
          is_one_member: true,
          one_member_since: new Date().toISOString()
        })
        .eq('id', requestData.client_id);
    }

    console.log('🎉 Processo concluído!');

    return new Response(
      JSON.stringify({
        success: true,
        subscription: {
          id: newSubscription.id,
          status: newSubscription.status,
          monthly_value: monthlyValue,
          start_date: newSubscription.start_date,
          card_last_digits: cardLastDigits,
          next_charge_date: nextDueDateFormatted,
          payment_status: paymentData.status
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao processar assinatura'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
