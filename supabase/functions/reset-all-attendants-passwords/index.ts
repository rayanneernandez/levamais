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

    // Buscar todos os atendentes
    const { data: attendants, error: fetchError } = await supabaseAdmin
      .from('store_managers')
      .select('user_id')
      .eq('is_attendant', true);

    if (fetchError) {
      throw fetchError;
    }

    const uniqueUserIds = [...new Set(attendants?.map(a => a.user_id) || [])];
    
    console.log(`Resetando senha de ${uniqueUserIds.length} atendentes`);

    const defaultPassword = 'Leva+2025';
    let successCount = 0;
    let errorCount = 0;

    for (const userId of uniqueUserIds) {
      try {
        // Resetar senha
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { password: defaultPassword }
        );

        if (updateError) {
          console.error(`Erro ao resetar senha do usuário ${userId}:`, updateError);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`Erro ao processar usuário ${userId}:`, err);
        errorCount++;
      }
    }

    console.log(`Resetados: ${successCount} sucessos, ${errorCount} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Senhas resetadas: ${successCount} sucessos, ${errorCount} erros`,
        totalUsers: uniqueUserIds.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error in reset-all-attendants-passwords:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
