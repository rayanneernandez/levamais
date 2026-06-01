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
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get request body
    const { user_id } = await req.json();

    console.log('Deleting user:', user_id);

    // Verificar se o usuário logado tem permissão (é network_manager)
    const { data: managerCheck } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'network_manager')
      .single();

    if (!managerCheck) {
      throw new Error('Sem permissão para deletar usuários');
    }

    // Deletar store_manager (as outras tabelas devem ter CASCADE)
    const { error: deleteManagerError } = await supabaseAdmin
      .from('store_managers')
      .delete()
      .eq('user_id', user_id);

    if (deleteManagerError) {
      console.error('Error deleting store manager:', deleteManagerError);
      throw deleteManagerError;
    }

    // Deletar user_roles
    const { error: deleteRoleError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', user_id);

    if (deleteRoleError) {
      console.error('Error deleting user roles:', deleteRoleError);
      throw deleteRoleError;
    }

    // Deletar profile
    const { error: deleteProfileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', user_id);

    if (deleteProfileError) {
      console.error('Error deleting profile:', deleteProfileError);
      throw deleteProfileError;
    }

    // Deletar usuário do auth (isso deve fazer CASCADE para as outras tabelas)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      throw deleteAuthError;
    }

    console.log('User deleted successfully');

    return new Response(
      JSON.stringify({
        success: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error in delete-store-user:', error);
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
