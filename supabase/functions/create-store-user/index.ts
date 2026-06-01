// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify the requesting user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized - No authorization header');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Unauthorized - Invalid token');
    }
    
    // Verificar se o usuário tem permissão para criar usuários (é network_manager)
    const { data: managerCheck } = await supabaseAdmin
      .from('store_managers')
      .select('network_id')
      .eq('user_id', user.id)
      .is('store_id', null)
      .single();
    
    if (!managerCheck) {
      throw new Error('Usuário não tem permissão para criar usuários');
    }

    // Get request body
    const { name, email, phone, access_profile_id, network_id, is_attendant, codigo_funcionario_pdv, store_ids, tag_ids } = await req.json();

    console.log('Creating user:', { email, name, network_id, store_ids, codigo_funcionario_pdv });

    // Generate temporary password
    const tempPassword = 'Leva+2025';

    // Create user in auth
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: name
      }
    });

    if (createError) {
      console.error('Error creating auth user:', createError);
      
      // Retornar mensagem de erro mais específica
      if (createError.message.includes('already been registered')) {
        throw new Error('Este email já está cadastrado no sistema');
      }
      
      throw createError;
    }

    console.log('Auth user created:', authData.user.id);

    // Atualizar profile (criado automaticamente pelo trigger)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: name,
        email: email,
        phone: phone,
        force_password_change: true
      })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      throw profileError;
    }

    console.log('Profile updated');

    // Add role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'network_manager'
      });

    if (roleError) {
      console.error('Error creating role:', roleError);
      throw roleError;
    }

    console.log('Role created');

    // Criar store manager principal (sem loja específica)
    const { data: principalManager, error: managerError } = await supabaseAdmin
      .from('store_managers')
      .insert({
        user_id: authData.user.id,
        network_id: network_id,
        access_profile_id: access_profile_id,
        must_change_password: true,
        is_attendant: is_attendant || false,
        codigo_funcionario_pdv: codigo_funcionario_pdv || null,
        store_id: null
      })
      .select('id, user_reference_code')
      .single();

    if (managerError) {
      console.error('Error creating store manager:', managerError);
      throw managerError;
    }

    console.log('Store manager created');

    // Criar associações com lojas específicas
    if (store_ids && store_ids.length > 0) {
      const storeAssociations = store_ids.map((storeId: string) => ({
        user_id: authData.user.id,
        network_id: network_id,
        store_id: storeId,
        access_profile_id: access_profile_id,
        must_change_password: true,
        is_attendant: is_attendant || false,
        codigo_funcionario_pdv: codigo_funcionario_pdv || null,
        attendant_code: null
      }));

      const { error: storesError } = await supabaseAdmin
        .from('store_managers')
        .insert(storeAssociations);

      if (storesError) {
        console.error('Error creating store associations:', storesError);
        throw storesError;
      }

      console.log('Store associations created');
    }

    // Criar associações com tags
    if (tag_ids && tag_ids.length > 0) {
      const tagAssociations = tag_ids.map((tagId: string) => ({
        store_manager_id: principalManager.id,
        tag_id: tagId
      }));

      const { error: tagsError } = await supabaseAdmin
        .from('store_manager_tags')
        .insert(tagAssociations);

      if (tagsError) {
        console.error('Error creating tag associations:', tagsError);
        throw tagsError;
      }

      console.log('Tag associations created');
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authData.user.id,
        user_reference_code: principalManager.user_reference_code,
        temp_password: tempPassword
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error in create-store-user:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
