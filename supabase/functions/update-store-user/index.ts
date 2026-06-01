// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Não autorizado');
    }

    // Verificar se o usuário é um network_manager
    const { data: managerData } = await supabase
      .from('store_managers')
      .select('network_id')
      .eq('user_id', user.id)
      .is('store_id', null)
      .single();

    if (!managerData) {
      throw new Error('Usuário não tem permissão para atualizar usuários');
    }

    const { 
      user_id,
      name,
      email,
      phone,
      access_profile_id,
      is_attendant,
      codigo_funcionario_pdv,
      store_ids,
      tag_ids
    } = await req.json();

    console.log('Updating user:', { user_id, name, email, access_profile_id, codigo_funcionario_pdv, store_ids });

    // Atualizar perfil
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: name,
        email: email,
        phone: phone
      })
      .eq('id', user_id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      throw profileError;
    }

    // Atualizar store_manager (entrada principal da rede)
    const { data: principalManager, error: managerError } = await supabase
      .from('store_managers')
      .update({
        access_profile_id: access_profile_id,
        is_attendant: is_attendant || false,
        codigo_funcionario_pdv: codigo_funcionario_pdv || null
      })
      .eq('user_id', user_id)
      .eq('network_id', managerData.network_id)
      .is('store_id', null)
      .select('id, user_reference_code')
      .single();

    if (managerError) {
      console.error('Error updating store_manager:', managerError);
      throw managerError;
    }

    // Atualizar lojas associadas
    // Primeiro, remover todas as associações de lojas existentes
    const { error: deleteStoresError } = await supabase
      .from('store_managers')
      .delete()
      .eq('user_id', user_id)
      .eq('network_id', managerData.network_id)
      .not('store_id', 'is', null);

    if (deleteStoresError) {
      console.error('Error deleting store associations:', deleteStoresError);
      throw deleteStoresError;
    }

    // Inserir novas associações de lojas
    if (store_ids && store_ids.length > 0) {
      const storeAssociations = store_ids.map((store_id: string) => ({
        user_id: user_id,
        network_id: managerData.network_id,
        store_id: store_id,
        access_profile_id: access_profile_id,
        is_attendant: is_attendant || false,
        codigo_funcionario_pdv: codigo_funcionario_pdv || null,
        attendant_code: null
      }));

      const { error: insertStoresError } = await supabase
        .from('store_managers')
        .insert(storeAssociations);

      if (insertStoresError) {
        console.error('Error inserting store associations:', insertStoresError);
        throw insertStoresError;
      }
    }

    // Atualizar tags
    // Primeiro, remover todas as associações de tags existentes
    const { error: deleteTagsError } = await supabase
      .from('store_manager_tags')
      .delete()
      .eq('store_manager_id', principalManager.id);

    if (deleteTagsError) {
      console.error('Error deleting tag associations:', deleteTagsError);
      throw deleteTagsError;
    }

    // Inserir novas associações de tags
    if (tag_ids && tag_ids.length > 0) {
      const tagAssociations = tag_ids.map((tag_id: string) => ({
        store_manager_id: principalManager.id,
        tag_id: tag_id
      }));

      const { error: insertTagsError } = await supabase
        .from('store_manager_tags')
        .insert(tagAssociations);

      if (insertTagsError) {
        console.error('Error inserting tag associations:', insertTagsError);
        throw insertTagsError;
      }
    }

    console.log('User updated successfully');

    return new Response(
      JSON.stringify({ success: true, user_reference_code: principalManager.user_reference_code }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in update-store-user:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
