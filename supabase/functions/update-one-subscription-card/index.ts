// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateCardRequest {
  subscription_id: string;
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
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Não autorizado');
    }

    const requestData: UpdateCardRequest = await req.json();
    console.log('🔄 Atualizando cartão da assinatura:', requestData.subscription_id);

    // Buscar assinatura
    const { data: subscription, error: subError } = await supabase
      .from('client_subscriptions_one')
      .select('*, clients(*)')
      .eq('id', requestData.subscription_id)
      .single();

    if (subError || !subscription) {
      throw new Error('Assinatura não encontrada');
    }

    const client = subscription.clients;

    // Buscar config Asaas
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

    console.log('💳 Tokenizando novo cartão...');

    // Tokenizar novo cartão
    const tokenizeResponse = await fetch(`${asaasUrl}/creditCard/tokenize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': apiKey
      },
      body: JSON.stringify({
        customer: subscription.asaas_customer_id,
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
        },
        remoteIp: req.headers.get('x-forwarded-for') || 'unknown'
      })
    });

    const tokenData = await tokenizeResponse.json();

    if (!tokenizeResponse.ok) {
      console.error('❌ Erro ao tokenizar cartão:', tokenData);
      throw new Error(tokenData.errors?.[0]?.description || 'Erro ao processar cartão');
    }

    const creditCardToken = tokenData.creditCardToken;
    console.log('✅ Cartão tokenizado');

    // Atualizar cartão na assinatura do Asaas
    console.log('🔄 Atualizando assinatura no Asaas...');

    const updateResponse = await fetch(`${asaasUrl}/subscriptions/${subscription.asaas_subscription_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'access_token': apiKey
      },
      body: JSON.stringify({
        creditCard: {
          creditCardToken: creditCardToken
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

    const updateData = await updateResponse.json();

    if (!updateResponse.ok) {
      console.error('❌ Erro ao atualizar assinatura:', updateData);
      throw new Error(updateData.errors?.[0]?.description || 'Erro ao atualizar cartão');
    }

    console.log('✅ Assinatura atualizada no Asaas');

    // Atualizar últimos dígitos no banco
    const lastDigits = requestData.card.number.slice(-4);
    
    const { error: updateDbError } = await supabase
      .from('client_subscriptions_one')
      .update({ 
        card_last_digits: lastDigits,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestData.subscription_id);

    if (updateDbError) {
      console.error('Erro ao atualizar banco:', updateDbError);
      // Não falhar aqui, pois o Asaas já foi atualizado
    }

    console.log('✅ Cartão atualizado com sucesso');

    return new Response(JSON.stringify({ 
      success: true,
      card_last_digits: lastDigits
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in update-one-subscription-card:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
