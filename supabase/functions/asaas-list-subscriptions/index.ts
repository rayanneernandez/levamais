// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔍 Buscando configuração Asaas...');

    const { data: config, error: configError } = await supabase
      .from('asaas_config')
      .select('*')
      .maybeSingle();

    if (configError) {
      throw new Error('Erro ao buscar configuração: ' + configError.message);
    }

    if (!config) {
      throw new Error('Configuração Asaas não encontrada');
    }

    const apiKey = config.is_sandbox ? config.api_key_sandbox : config.api_key_production;
    const baseUrl = config.is_sandbox 
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://www.asaas.com/api/v3';

    console.log('📡 Listando assinaturas do Asaas...');

    const response = await fetch(`${baseUrl}/subscriptions?limit=20`, {
      method: 'GET',
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'LevaMaisFidelidade/1.0',
      },
    });

    const responseText = await response.text();
    console.log('📥 Resposta do Asaas:', { 
      status: response.status, 
      body: responseText.substring(0, 500) 
    });

    if (!response.ok) {
      let errorMessage = 'Erro ao listar assinaturas';
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.errors && errorData.errors.length > 0) {
          errorMessage = errorData.errors[0].description || errorMessage;
        }
      } catch (e) {
        console.error('Erro ao parsear resposta de erro:', e);
      }
      
      throw new Error(errorMessage);
    }

    const result = JSON.parse(responseText);

    console.log(`✅ ${result.data?.length || 0} assinaturas encontradas`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        subscriptions: result.data || [],
        totalCount: result.totalCount || 0,
        hasMore: result.hasMore || false,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Erro ao listar assinaturas:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
