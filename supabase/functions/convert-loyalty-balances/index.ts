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

    const { network_id, from_type, to_type, conversion_rate } = await req.json();

    console.log('🔄 Iniciando conversão de fidelidade:', {
      network_id,
      from_type,
      to_type,
      conversion_rate,
    });

    // Validações
    if (!network_id || !from_type || !to_type || !conversion_rate) {
      throw new Error('Parâmetros obrigatórios faltando');
    }

    if (from_type === to_type) {
      throw new Error('Tipo de origem e destino são iguais');
    }

    const rate = parseFloat(conversion_rate);
    if (isNaN(rate) || rate <= 0) {
      throw new Error('Taxa de conversão inválida');
    }

    // Buscar todos os clientes da rede com saldo > 0
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, total_points')
      .eq('network_id', network_id)
      .gt('total_points', 0);

    if (clientsError) {
      console.error('❌ Erro ao buscar clientes:', clientsError);
      throw clientsError;
    }

    if (!clients || clients.length === 0) {
      console.log('ℹ️ Nenhum cliente com saldo encontrado');
      return new Response(
        JSON.stringify({
          success: true,
          clients_updated: 0,
          message: 'Nenhum cliente com saldo encontrado',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Encontrados ${clients.length} clientes com saldo`);

    // Converter saldos
    let updatedCount = 0;
    let errors = [];

    for (const client of clients) {
      try {
        const currentBalance = parseFloat(client.total_points);
        let newBalance: number;

        if (from_type === 'cashback' && to_type === 'points') {
          // Cashback (R$) -> Pontos: R$ 1 = X pontos
          newBalance = currentBalance * rate;
        } else if (from_type === 'points' && to_type === 'cashback') {
          // Pontos -> Cashback (R$): 1 ponto = R$ X
          newBalance = currentBalance * rate;
        } else {
          throw new Error(`Conversão não suportada: ${from_type} -> ${to_type}`);
        }

        // Arredondar para 2 casas decimais
        newBalance = Math.round(newBalance * 100) / 100;

        console.log(`💰 Cliente ${client.id}: ${currentBalance} -> ${newBalance}`);

        // Atualizar saldo
        const { error: updateError } = await supabase
          .from('clients')
          .update({ total_points: newBalance })
          .eq('id', client.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar cliente ${client.id}:`, updateError);
          errors.push({ client_id: client.id, error: updateError.message });
        } else {
          updatedCount++;
        }
      } catch (error: any) {
        console.error(`❌ Erro ao processar cliente ${client.id}:`, error);
        errors.push({ client_id: client.id, error: error.message });
      }
    }

    console.log(`✅ Conversão concluída: ${updatedCount}/${clients.length} clientes atualizados`);

    if (errors.length > 0) {
      console.warn('⚠️ Alguns clientes tiveram erros:', errors);
    }

    return new Response(
      JSON.stringify({
        success: true,
        clients_updated: updatedCount,
        total_clients: clients.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Erro em convert-loyalty-balances:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
