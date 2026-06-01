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

    // Timeout em minutos (padrão: 10 minutos)
    const timeoutMinutes = 10;
    const timeoutDate = new Date();
    timeoutDate.setMinutes(timeoutDate.getMinutes() - timeoutMinutes);

    console.log(`🔍 Buscando transações pendentes criadas antes de ${timeoutDate.toISOString()}`);

    // Buscar transações pendentes antigas
    const { data: pendingTransactions, error: fetchError } = await supabase
      .from('webposto_transactions')
      .select('*')
      .eq('status', 'pending')
      .lt('created_at', timeoutDate.toISOString());

    if (fetchError) {
      console.error('Erro ao buscar transações pendentes:', fetchError);
      throw new Error(`Erro ao buscar transações: ${fetchError.message}`);
    }

    if (!pendingTransactions || pendingTransactions.length === 0) {
      console.log('✅ Nenhuma transação pendente antiga encontrada');
      return new Response(
        JSON.stringify({ 
          message: 'Nenhuma transação pendente antiga encontrada',
          processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`⚠️ Encontradas ${pendingTransactions.length} transações pendentes antigas`);

    let processedCount = 0;
    let errorCount = 0;

    // Processar cada transação pendente
    for (const tx of pendingTransactions) {
      try {
        console.log(`🔄 Processando transação ${tx.id_transacao} (criada em ${tx.created_at})`);

        // Atualizar status para timeout
        const { error: updateError } = await supabase
          .from('webposto_transactions')
          .update({ 
            status: 'timeout',
            updated_at: new Date().toISOString()
          })
          .eq('id', tx.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar transação ${tx.id_transacao}:`, updateError);
          errorCount++;
        } else {
          console.log(`✅ Transação ${tx.id_transacao} marcada como timeout`);
          processedCount++;
        }
      } catch (error) {
        console.error(`❌ Erro ao processar transação ${tx.id_transacao}:`, error);
        errorCount++;
      }
    }

    const summary = {
      message: 'Limpeza de transações pendentes concluída',
      total_found: pendingTransactions.length,
      processed: processedCount,
      errors: errorCount,
      timeout_minutes: timeoutMinutes
    };

    console.log('📊 Resumo:', JSON.stringify(summary));

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro em cleanup-pending-transactions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ 
        code: 'CLEANUP_ERROR',
        message: errorMessage 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
