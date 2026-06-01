// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { user_id } = await req.json();

    console.log('Resetting password for user:', user_id);

    // Set default password
    const defaultPassword = 'Leva+2025';

    // Update user password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { password: defaultPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw updateError;
    }

    // Update force_password_change flag
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ force_password_change: true })
      .eq('id', user_id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
    }

    console.log('Password reset successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Senha resetada para Leva+2025. O usuário será solicitado a trocar a senha no próximo login.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error in reset-network-manager-password:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao resetar senha';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
