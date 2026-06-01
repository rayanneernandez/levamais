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

    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    console.log('🔍 Verificando compromissos de retenção...');

    // 1. Marcar compromissos expirados como 'completed'
    const { data: expired, error: expiredError } = await supabase
      .from('client_retention_commitments')
      .update({ status: 'completed' })
      .eq('status', 'active')
      .lt('expires_at', now.toISOString())
      .select('id, client_id, network_id');

    if (expiredError) {
      console.error('❌ Erro ao marcar expirados:', expiredError);
    } else {
      console.log(`✅ ${expired?.length || 0} compromissos marcados como expirados`);
    }

    // 2. Encontrar compromissos que expiram em 7 dias (e ainda não receberam email)
    const { data: expiringSoon, error: expiringError } = await supabase
      .from('client_retention_commitments')
      .select(`
        id,
        client_id,
        network_id,
        expires_at,
        commitment_months,
        multiplier_applied
      `)
      .eq('status', 'active')
      .eq('expiration_email_sent', false)
      .gte('expires_at', now.toISOString())
      .lte('expires_at', sevenDaysFromNow.toISOString());

    if (expiringError) {
      console.error('❌ Erro ao buscar expirando em breve:', expiringError);
    } else {
      console.log(`📧 ${expiringSoon?.length || 0} clientes para notificar (7 dias)`);

      // Enviar emails de aviso (7 dias) e criar card de renovação
      if (expiringSoon && expiringSoon.length > 0) {
        for (const commitment of expiringSoon) {
          try {
            // Buscar cliente e rede
            const { data: client } = await supabase
              .from('clients')
              .select('user_id, full_name, network_id')
              .eq('id', commitment.client_id)
              .single();

            const { data: network } = await supabase
              .from('networks')
              .select('name')
              .eq('id', commitment.network_id)
              .single();

            if (!client || !network) continue;

            // ✨ Resetar dados de decisão para mostrar card de renovação no app
            const { error: resetDecisionError } = await supabase
              .from('clients')
              .update({
                retention_decision_made_at: null,
                retention_decision_type: null,
                retention_card_first_shown_at: new Date().toISOString(), // Atualizar para agora
              })
              .eq('id', commitment.client_id);

            if (resetDecisionError) {
              console.error(`❌ Erro ao resetar decisão de retenção:`, resetDecisionError);
            } else {
              console.log(`✅ Card de renovação ativado para cliente ${commitment.client_id}`);
            }

            // Buscar email do perfil
            const { data: profile } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', client.user_id)
              .single();

            if (profile?.email) {
              const expirationDate = new Date(commitment.expires_at);
              const formattedDate = expirationDate.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              });

              console.log(`📧 Enviando email para ${profile.email}: Expira em 7 dias (${formattedDate})`);
              
              // Enviar email de aviso (background task)
              const emailPromise = supabase.functions.invoke('send-retention-expiration-warning', {
                body: {
                  email: profile.email,
                  name: client.full_name,
                  network_name: network.name,
                  expiration_date: formattedDate,
                  commitment_months: commitment.commitment_months,
                  multiplier: commitment.multiplier_applied
                }
              }).then(({ error: emailError }) => {
                if (emailError) {
                  console.error(`❌ Erro ao enviar email para ${profile.email}:`, emailError);
                } else {
                  console.log(`✅ Email enviado para ${profile.email}`);
                }
              });
              
              // Não esperar email terminar, marcar como enviado imediatamente
              await supabase
                .from('client_retention_commitments')
                .update({ expiration_email_sent: true })
                .eq('id', commitment.id);
            }
          } catch (emailError) {
            console.error(`❌ Erro ao processar email para compromisso ${commitment.id}:`, emailError);
          }
        }
      }
    }

    // 3. Encontrar compromissos que expiraram hoje (enviar convite para renovação)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: expiredToday, error: expiredTodayError } = await supabase
      .from('client_retention_commitments')
      .select(`
        id,
        client_id,
        network_id,
        commitment_months,
        multiplier_applied
      `)
      .eq('status', 'completed')
      .gte('expires_at', today.toISOString())
      .lt('expires_at', tomorrow.toISOString());

    if (expiredTodayError) {
      console.error('❌ Erro ao buscar expirados hoje:', expiredTodayError);
    } else {
      console.log(`📧 ${expiredToday?.length || 0} clientes para convidar renovação`);

      if (expiredToday && expiredToday.length > 0) {
        for (const commitment of expiredToday) {
          try {
            // Buscar cliente e rede
            const { data: client } = await supabase
              .from('clients')
              .select('user_id, full_name')
              .eq('id', commitment.client_id)
              .single();

            const { data: network } = await supabase
              .from('networks')
              .select('name')
              .eq('id', commitment.network_id)
              .single();

            if (!client || !network) continue;

            // Buscar email do perfil
            const { data: profile } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', client.user_id)
              .single();

            if (profile?.email) {
              console.log(`📧 Enviando convite de renovação para ${profile.email}`);
              
              // Enviar email de renovação (background task)
              const emailPromise = supabase.functions.invoke('send-retention-renewal-invitation', {
                body: {
                  email: profile.email,
                  name: client.full_name,
                  network_name: network.name,
                  previous_commitment_months: commitment.commitment_months,
                  previous_multiplier: commitment.multiplier_applied
                }
              }).then(({ error: emailError }) => {
                if (emailError) {
                  console.error(`❌ Erro ao enviar convite para ${profile.email}:`, emailError);
                } else {
                  console.log(`✅ Convite enviado para ${profile.email}`);
                }
              });
            }
          } catch (emailError) {
            console.error(`❌ Erro ao processar convite para compromisso ${commitment.id}:`, emailError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        expired: expired?.length || 0,
        expiring_soon: expiringSoon?.length || 0,
        expired_today: expiredToday?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro em check-expiring-commitments:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
