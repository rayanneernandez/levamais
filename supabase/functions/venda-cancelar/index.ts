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

    // Validar API Key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Token não fornecido');
    }

    const apiKey = authHeader.replace('Bearer ', '');

    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('network_id')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      throw new Error('Token inválido');
    }

    const { codigoEmpresa, codigoVenda, idTransacao } = await req.json();

    console.log('Cancelando venda:', { codigoEmpresa, codigoVenda, idTransacao });

    if (!codigoEmpresa || !codigoVenda || !idTransacao) {
      throw new Error('Dados obrigatórios faltando');
    }

    // Buscar transação
    const { data: txData, error: txError } = await supabase
      .from('webposto_transactions')
      .select('*')
      .eq('id_transacao', idTransacao)
      .eq('codigo_venda', codigoVenda)
      .maybeSingle();

    if (txError) {
      console.error('Erro ao buscar transação:', txError);
      return new Response(
        JSON.stringify({ 
          code: 'DATABASE_ERROR',
          message: `Erro ao buscar transação: ${txError.message}` 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!txData) {
      console.log('Transação não encontrada - ID:', idTransacao, 'Venda:', codigoVenda);
      return new Response(
        JSON.stringify({ 
          code: 'NOT_FOUND',
          message: 'Transação não encontrada' 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Se a transação foi confirmada, precisamos reverter
    if (txData.status === 'confirmed' && txData.client_id) {
      // Buscar a transaction original
      const { data: originalTx } = await supabase
        .from('transactions')
        .select('*')
        .eq('client_id', txData.client_id)
        .eq('store_id', txData.store_id)
        .ilike('description', `%${idTransacao}%`)
        .single();

      if (originalTx) {
        // Criar transação de estorno
        await supabase
          .from('transactions')
          .insert({
            client_id: txData.client_id,
            store_id: txData.store_id,
            type: 'adjustment',
            amount: 0,
            points: -parseFloat(originalTx.points),
            description: `Cancelamento webPosto - Venda ${codigoVenda} - ID: ${idTransacao}`,
          });

        // Atualizar saldo do cliente
        const { data: clientData } = await supabase
          .from('clients')
          .select('total_points')
          .eq('id', txData.client_id)
          .single();

        if (clientData) {
          const newBalance = parseFloat(clientData.total_points) - parseFloat(originalTx.points);
          await supabase
            .from('clients')
            .update({ total_points: Math.max(0, newBalance) })
            .eq('id', txData.client_id);
        }
      }
    }

    // Marcar transação como cancelada
    await supabase
      .from('webposto_transactions')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id_transacao', idTransacao);

    console.log('Venda cancelada com sucesso:', idTransacao);

    // Retornar echo dos dados
    return new Response(
      JSON.stringify({ codigoEmpresa, codigoVenda, idTransacao }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro em venda-cancelar:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ 
        code: 'CANCELAR_ERROR',
        message: errorMessage 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
