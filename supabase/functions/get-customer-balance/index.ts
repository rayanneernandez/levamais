// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validar API Key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('API Key não fornecida');
    }

    const apiKey = authHeader.replace('Bearer ', '');

    // Buscar e validar API key
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('network_id')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      throw new Error('API Key inválida ou inativa');
    }

    // Atualizar last_used_at
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('api_key', apiKey);

    const networkId = keyData.network_id;

    // Extrair CPF da URL
    const url = new URL(req.url);
    const cpf = url.pathname.split('/').pop();

    if (!cpf) {
      throw new Error('CPF não fornecido');
    }

    console.log('Consultando saldo para CPF:', cpf);

    // Buscar cliente
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id, full_name, cpf, email, phone, total_points')
      .eq('cpf', cpf.replace(/\D/g, ''))
      .eq('network_id', networkId)
      .single();

    if (clientError || !clientData) {
      throw new Error('Cliente não encontrado');
    }

    // Buscar últimas transações
    const { data: transactions, error: transError } = await supabase
      .from('transactions')
      .select('*')
      .eq('client_id', clientData.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return new Response(
      JSON.stringify({
        success: true,
        customer: {
          id: clientData.id,
          full_name: clientData.full_name,
          cpf: clientData.cpf,
          email: clientData.email,
          phone: clientData.phone,
          balance: parseFloat(clientData.total_points),
        },
        recent_transactions: transactions || [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro em get-customer-balance:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
