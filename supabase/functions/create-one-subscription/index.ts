// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { client_id, network_id } = await req.json();

    console.log('Creating ONE subscription for client:', client_id, 'network:', network_id);

    // 1. Buscar dados do cliente
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*, profiles(*)')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      throw new Error('Cliente não encontrado');
    }

    // 2. Buscar dados da rede
    const { data: network, error: networkError } = await supabase
      .from('networks')
      .select('*')
      .eq('id', network_id)
      .single();

    if (networkError || !network) {
      throw new Error('Rede não encontrada');
    }

    // 3. Verificar se já existe assinatura ativa
    const { data: existingSub } = await supabase
      .from('client_subscriptions_one')
      .select('*')
      .eq('client_id', client_id)
      .eq('status', 'active')
      .maybeSingle();

    if (existingSub) {
      throw new Error('Cliente já possui assinatura ONE ativa');
    }

    // 4. Buscar config Asaas
    const { data: asaasConfig, error: asaasError } = await supabase
      .from('asaas_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (asaasError || !asaasConfig) {
      throw new Error('Configuração Asaas não encontrada');
    }

    const asaasUrl = asaasConfig.is_sandbox 
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://www.asaas.com/api/v3';
    
    const apiKey = asaasConfig.is_sandbox 
      ? asaasConfig.api_key_sandbox 
      : asaasConfig.api_key_production;

    // 5. Criar/Buscar customer no Asaas
    let asaasCustomerId = client.asaas_customer_id;
    
    if (!asaasCustomerId) {
      console.log('Checking if Asaas customer already exists...');
      
      // Primeiro buscar se já existe um cliente com este CPF no Asaas
      const cpfClean = client.cpf_cnpj?.replace(/\D/g, '') || '';
      if (cpfClean) {
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
            console.log('Asaas customer already exists (by CPF):', asaasCustomerId);
            
            // Atualizar o banco local com o ID do Asaas
            await supabase
              .from('clients')
              .update({ asaas_customer_id: asaasCustomerId })
              .eq('id', client_id);
          }
        }
      }

      // Se não encontrou, criar novo
      if (!asaasCustomerId) {
        console.log('Creating new Asaas customer for client:', client.profiles?.full_name);
        
        const customerResponse = await fetch(`${asaasUrl}/customers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': apiKey
          },
          body: JSON.stringify({
            name: client.profiles?.full_name || 'Cliente',
            email: client.email,
            cpfCnpj: cpfClean,
            phone: client.phone?.replace(/\D/g, '')
          })
        });
        
        if (!customerResponse.ok) {
          const errorData = await customerResponse.json();
          console.error('Asaas customer error:', errorData);
          throw new Error('Erro ao criar cliente no Asaas');
        }

        const customerData = await customerResponse.json();
        asaasCustomerId = customerData.id;
        
        // Salvar customer_id
        await supabase
          .from('clients')
          .update({ asaas_customer_id: asaasCustomerId })
          .eq('id', client_id);

        console.log('Asaas customer created:', asaasCustomerId);
      }
    }

    // 6. Criar assinatura recorrente no Asaas
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 7); // 7 dias para primeiro pagamento
    
    console.log('Creating Asaas subscription');
    
    const subscriptionResponse = await fetch(`${asaasUrl}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': apiKey
      },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: 'BOLETO',
        value: 9.90,
        nextDueDate: nextDueDate.toISOString().split('T')[0],
        cycle: 'MONTHLY',
        description: `Leva+ One - ${network.name}`,
        externalReference: `ONE_${client_id}`
      })
    });

    if (!subscriptionResponse.ok) {
      const errorData = await subscriptionResponse.json();
      console.error('Asaas subscription error:', errorData);
      throw new Error('Erro ao criar assinatura no Asaas');
    }

    const subscriptionData = await subscriptionResponse.json();
    console.log('Asaas subscription created:', subscriptionData.id);

    // 7. Salvar assinatura no banco
    const { data: subscription, error: subError } = await supabase
      .from('client_subscriptions_one')
      .insert({
        client_id,
        network_id,
        asaas_subscription_id: subscriptionData.id,
        asaas_customer_id: asaasCustomerId,
        status: 'pending',
        start_date: new Date().toISOString(),
        monthly_value: 9.90,
        minimum_period_months: 12,
        can_cancel: false
      })
      .select()
      .single();

    if (subError) {
      console.error('Error saving subscription:', subError);
      throw new Error('Erro ao salvar assinatura');
    }

    console.log('Subscription saved in database:', subscription.id);

    return new Response(JSON.stringify({
      success: true,
      subscription,
      payment_link: subscriptionData.invoiceUrl,
      asaas_subscription_id: subscriptionData.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in create-one-subscription:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
