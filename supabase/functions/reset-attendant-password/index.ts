// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
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
    )

    const { attendant_code } = await req.json()

    if (!attendant_code) {
      throw new Error('attendant_code is required')
    }

    console.log('Resetting password for attendant:', attendant_code)

    // Buscar user_id do atendente
    const { data: attendant, error: searchError } = await supabaseAdmin
      .from('store_managers')
      .select('user_id')
      .eq('attendant_code', attendant_code.toUpperCase())
      .eq('is_attendant', true)
      .single()

    if (searchError || !attendant) {
      throw new Error('Attendant not found')
    }

    // Resetar senha para Leva+2025
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      attendant.user_id,
      { password: 'Leva+2025' }
    )

    if (updateError) {
      throw updateError
    }

    // Definir force_password_change como true
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ force_password_change: true })
      .eq('id', attendant.user_id)

    if (profileError) {
      console.error('Error updating profile:', profileError)
    }

    console.log('Password reset successful for attendant:', attendant_code)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Password reset to Leva+2025',
        attendant_code 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error resetting password:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})