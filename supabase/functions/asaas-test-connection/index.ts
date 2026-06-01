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
    // Buscar configuração do banco
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔍 Buscando configuração Asaas do banco...');

    const { data: config, error: configError } = await supabase
      .from('asaas_config')
      .select('*')
      .maybeSingle();

    if (configError) {
      console.error('❌ Erro ao buscar config:', configError);
      throw new Error('Erro ao buscar configuração: ' + configError.message);
    }

    if (!config) {
      throw new Error('Nenhuma configuração Asaas encontrada. Configure primeiro em /adm/configuracoes/asaas');
    }

    const apiKey = config.is_sandbox ? config.api_key_sandbox : config.api_key_production;
    const isSandbox = config.is_sandbox;
    
    console.log('🔍 Testando conexão com Asaas:', { isSandbox, hasApiKey: !!apiKey });

    if (!apiKey) {
      throw new Error('API Key não configurada. Configure em /adm/configuracoes/asaas');
    }

    // Definir URL baseado no modo
    const baseUrl = isSandbox 
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://www.asaas.com/api/v3';

    console.log('📡 Fazendo requisição para:', `${baseUrl}/customers`);

    // Testar conexão fazendo uma chamada simples para listar clientes
    const response = await fetch(`${baseUrl}/customers?limit=1`, {
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
      statusText: response.statusText,
      body: responseText 
    });

    if (!response.ok) {
      let errorMessage = 'Falha na conexão com Asaas';
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

    // Atualizar configuração com resultado do teste
    const { error: updateError } = await supabase
      .from('asaas_config')
      .update({
        last_test_at: new Date().toISOString(),
        last_test_status: 'success',
      })
      .eq('id', config.id);

    if (updateError) {
      console.error('Erro ao atualizar config:', updateError);
    }

    console.log('✅ Teste de conexão bem-sucedido');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Conexão com Asaas estabelecida com sucesso' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Erro no teste de conexão:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao testar conexão';
    
    // Atualizar configuração com erro
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: config } = await supabase
        .from('asaas_config')
        .select('id')
        .maybeSingle();

      if (config) {
        await supabase
          .from('asaas_config')
          .update({
            last_test_at: new Date().toISOString(),
            last_test_status: 'error',
          })
          .eq('id', config.id);
      }
    } catch (e) {
      console.error('Erro ao atualizar config com erro:', e);
    }

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
