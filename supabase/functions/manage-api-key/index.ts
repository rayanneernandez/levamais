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

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Não autorizado');
    }

    const { action, key_type } = await req.json();

    // Buscar network_id do usuário
    const { data: managerData, error: managerError } = await supabase
      .from('store_managers')
      .select('network_id')
      .eq('user_id', user.id)
      .is('store_id', null)
      .single();

    if (managerError || !managerData) {
      throw new Error('Usuário não é um gerente de rede');
    }

    const networkId = managerData.network_id;

    if (action === 'generate') {
      // Gerar nova API key
      const { data: keyData, error: keyError } = await supabase.rpc(
        'generate_api_key',
        { network_uuid: networkId, key_type_param: key_type || 'live' }
      );

      if (keyError) throw keyError;

      // Inserir na tabela api_keys
      const { data: newKey, error: insertError } = await supabase
        .from('api_keys')
        .insert({
          network_id: networkId,
          api_key: keyData,
          key_type: key_type || 'live',
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log('Nova API key gerada:', newKey.id);

      return new Response(
        JSON.stringify({ success: true, api_key: newKey }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'regenerate') {
      // Desativar chaves antigas
      await supabase
        .from('api_keys')
        .update({ is_active: false })
        .eq('network_id', networkId)
        .eq('key_type', key_type || 'live');

      // Gerar nova chave
      const { data: keyData, error: keyError } = await supabase.rpc(
        'generate_api_key',
        { network_uuid: networkId, key_type_param: key_type || 'live' }
      );

      if (keyError) throw keyError;

      // Inserir nova chave
      const { data: newKey, error: insertError } = await supabase
        .from('api_keys')
        .insert({
          network_id: networkId,
          api_key: keyData,
          key_type: key_type || 'live',
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log('API key regenerada:', newKey.id);

      return new Response(
        JSON.stringify({ success: true, api_key: newKey }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'list') {
      // Listar API keys da rede
      const { data: keys, error: listError } = await supabase
        .from('api_keys')
        .select('*')
        .eq('network_id', networkId)
        .order('created_at', { ascending: false });

      if (listError) throw listError;

      return new Response(
        JSON.stringify({ success: true, api_keys: keys }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Ação inválida');
  } catch (error) {
    console.error('Erro em manage-api-key:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
