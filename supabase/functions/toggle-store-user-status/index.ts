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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const { user_id, is_active } = await req.json();

    if (!user_id || typeof is_active !== 'boolean') {
      throw new Error('Parâmetros inválidos');
    }

    // Verificar permissão do solicitante (gestor da rede)
    const { data: managerCheck } = await supabaseAdmin
      .from('store_managers')
      .select('network_id')
      .eq('user_id', user.id)
      .is('store_id', null)
      .single();

    if (!managerCheck) throw new Error('Sem permissão');

    // Garantir que o alvo pertence à mesma rede
    const { data: target } = await supabaseAdmin
      .from('store_managers')
      .select('id')
      .eq('user_id', user_id)
      .eq('network_id', managerCheck.network_id)
      .limit(1)
      .maybeSingle();

    if (!target) throw new Error('Usuário não pertence a esta rede');

    // Atualizar TODOS os vínculos do usuário nessa rede (principal + lojas)
    const { error: updateError } = await supabaseAdmin
      .from('store_managers')
      .update({
        is_active,
        deactivated_at: is_active ? null : new Date().toISOString(),
        deactivated_by: is_active ? null : user.id,
      })
      .eq('user_id', user_id)
      .eq('network_id', managerCheck.network_id);

    if (updateError) throw updateError;

    console.log(`User ${user_id} ${is_active ? 'activated' : 'deactivated'} by ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, is_active }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in toggle-store-user-status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
