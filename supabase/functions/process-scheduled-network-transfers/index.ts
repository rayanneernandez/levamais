import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NetworkTransfer {
  id: string;
  client_id: string;
  from_network_id: string;
  to_network_id: string;
  scheduled_for: string;
  clients: {
    id: string;
    favorite_network_id: string | null;
  };
  to_network: {
    name: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];
    console.log(`🔄 Processing scheduled network transfers for ${today}`);

    // 1. Buscar transferências pendentes para hoje
    const { data: transfers, error: fetchError } = await supabase
      .from('pending_network_transfers')
      .select(`
        *,
        clients!inner(id, favorite_network_id),
        to_network:networks!pending_network_transfers_to_network_id_fkey(name)
      `)
      .eq('status', 'pending')
      .eq('scheduled_for', today);

    if (fetchError) {
      console.error('❌ Error fetching transfers:', fetchError);
      throw fetchError;
    }

    if (!transfers || transfers.length === 0) {
      console.log('✅ No pending transfers to process today');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No pending transfers',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${transfers.length} transfer(s) to process`);

    const results = [];

    for (const transfer of transfers as NetworkTransfer[]) {
      try {
        console.log(`\n🔄 Processing transfer ${transfer.id} for client ${transfer.client_id}`);

        // 2.1 Atualizar rede favorita do cliente
        const { error: updateClientError } = await supabase
          .from('clients')
          .update({ 
            favorite_network_id: transfer.to_network_id,
            favorite_network_changed_at: new Date().toISOString()
          })
          .eq('id', transfer.client_id);

        if (updateClientError) {
          console.error(`❌ Error updating client favorite network:`, updateClientError);
          throw updateClientError;
        }

        console.log(`✅ Updated client favorite_network_id to ${transfer.to_network_id}`);

        // 2.2 Atualizar assinatura ONE (se existir)
        const { error: updateSubscriptionError } = await supabase
          .from('client_subscriptions_one')
          .update({ network_id: transfer.to_network_id })
          .eq('client_id', transfer.client_id)
          .eq('status', 'active');

        if (updateSubscriptionError) {
          console.error(`❌ Error updating ONE subscription:`, updateSubscriptionError);
          // Não vamos bloquear se não houver assinatura ONE
        } else {
          console.log(`✅ Updated ONE subscription network_id`);
        }

        // 2.3 Finalizar compromisso antigo (se houver)
        const { error: completeOldCommitmentError } = await supabase
          .from('client_retention_commitments')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('client_id', transfer.client_id)
          .eq('network_id', transfer.from_network_id)
          .eq('status', 'active');

        if (completeOldCommitmentError) {
          console.error(`⚠️ Warning completing old commitment:`, completeOldCommitmentError);
        } else {
          console.log(`✅ Completed old commitment`);
        }

        // 2.4 Criar novo compromisso de 90 dias na nova rede
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 3);

        // Buscar configuração de retenção da nova rede
        const { data: retentionConfig } = await supabase
          .from('network_retention_config')
          .select('*')
          .eq('network_id', transfer.to_network_id)
          .eq('commitment_months', 3)
          .maybeSingle();

        const multiplier = retentionConfig?.multiplier || 1.0;
        const loyaltyType = retentionConfig?.loyalty_type || 'cashback';

        const { error: createCommitmentError } = await supabase
          .from('client_retention_commitments')
          .insert({
            client_id: transfer.client_id,
            network_id: transfer.to_network_id,
            commitment_months: 3,
            multiplier_applied: multiplier,
            loyalty_type: loyaltyType,
            expires_at: expiresAt.toISOString(),
            status: 'active',
            created_at: new Date().toISOString()
          });

        if (createCommitmentError) {
          console.error(`❌ Error creating new commitment:`, createCommitmentError);
          throw createCommitmentError;
        }

        console.log(`✅ Created new 90-day commitment (expires: ${expiresAt.toISOString()})`);

        // 2.5 Marcar transferência como processada
        const { error: updateTransferError } = await supabase
          .from('pending_network_transfers')
          .update({ 
            status: 'processed',
            processed_at: new Date().toISOString()
          })
          .eq('id', transfer.id);

        if (updateTransferError) {
          console.error(`❌ Error updating transfer status:`, updateTransferError);
          throw updateTransferError;
        }

        console.log(`✅ Marked transfer as processed`);

        // 2.6 Enviar notificação in-app ao cliente
        const notificationTitle = '🎉 Transferência de Rede Concluída!';
        const notificationMessage = `Sua transferência para ${transfer.to_network.name} foi processada com sucesso! Você agora está vinculado à nova rede com um novo compromisso de 90 dias. Aproveite seus benefícios e promoções exclusivas!`;
        
        const { data: notification, error: notificationError } = await supabase
          .from('client_notifications')
          .insert({
            network_id: transfer.to_network_id,
            title: notificationTitle,
            message: notificationMessage,
            created_by: transfer.client_id,
            sent_count: 1
          })
          .select()
          .single();

        if (notificationError) {
          console.error(`⚠️ Warning creating notification:`, notificationError);
        } else if (notification) {
          // Criar registro do destinatário
          const { error: recipientError } = await supabase
            .from('client_notification_recipients')
            .insert({
              notification_id: notification.id,
              client_id: transfer.client_id,
              is_read: false,
              created_at: new Date().toISOString()
            });

          if (recipientError) {
            console.error(`⚠️ Warning creating notification recipient:`, recipientError);
          } else {
            console.log(`✅ Notification sent to client`);
          }
        }

        results.push({
          transfer_id: transfer.id,
          client_id: transfer.client_id,
          to_network: transfer.to_network.name,
          status: 'success'
        });

        console.log(`✅ Transfer ${transfer.id} completed successfully`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Error processing transfer ${transfer.id}:`, error);
        results.push({
          transfer_id: transfer.id,
          client_id: transfer.client_id,
          status: 'error',
          error: errorMessage
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    console.log(`\n📊 Summary: ${successCount} successful, ${errorCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${transfers.length} transfer(s)`,
        processed: successCount,
        failed: errorCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
