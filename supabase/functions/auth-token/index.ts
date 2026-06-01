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

    const { usuario, senha, codigoEmpresa } = await req.json();

    console.log('Autenticação webPosto:', { usuario, codigoEmpresa });

    if (!usuario || !senha || !codigoEmpresa) {
      throw new Error('Campos obrigatórios faltando');
    }

    // Buscar loja pelo CNPJ (com ou sem formatação)
    const cnpjLimpo = codigoEmpresa.replace(/\D/g, '');
    
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('id, network_id')
      .or(`cnpj.eq.${cnpjLimpo},cnpj.eq.${codigoEmpresa}`)
      .eq('status', 'active')
      .single();

    if (storeError || !storeData) {
      throw new Error('Empresa não encontrada');
    }

    // Buscar API key ativa da rede
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('api_key')
      .eq('network_id', storeData.network_id)
      .eq('is_active', true)
      .eq('key_type', 'live')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (keyError || !keyData) {
      throw new Error('Credenciais inválidas');
    }

    // Retornar token (usamos a API key como bearer token)
    const bearerToken = keyData.api_key;

    console.log('Token gerado com sucesso para:', codigoEmpresa);

    return new Response(
      JSON.stringify({ bearerToken }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`
        } 
      }
    );
  } catch (error) {
    console.error('Erro em auth-token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ 
        code: 'AUTH_ERROR',
        message: errorMessage 
      }),
      { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
