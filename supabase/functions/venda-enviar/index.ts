// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from 'npm:zod@3.25.76';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 🔒 SCHEMAS DE VALIDAÇÃO ZOD
const produtoEnviarSchema = z.object({
  codigoProduto: z.string().max(50),
  nomeProduto: z.string().max(200),
  valorVenda: z.number().positive().max(100000),
  quantidade: z.number().positive().max(1000),
  codigoColaborador: z.union([z.string(), z.number()])
    .transform(v => String(v))
    .optional()
    .nullable(),
  nomeColaborador: z.string().max(100).optional().nullable(),
});

const prazoSchema = z.object({
  tipoPagamento: z.number().int().min(0).max(99),
  valorPagamento: z.number().nonnegative().max(1000000), // webPosto envia valorPagamento
  quantidadeParcelas: z.number().int().positive().max(48).optional(),
  descricaoFormaPagamento: z.string().optional(),
  idFormaPagamentoAC: z.union([z.string(), z.number()]).transform(v => String(v)).optional(),
  idTransacao: z.string().optional(),
}).transform(data => ({
  ...data,
  valorPrazo: data.valorPagamento // Mapeia para o campo esperado internamente
}));

const vendaEnviarSchema = z.object({
  codigoEmpresa: z.string()
    .transform(v => v.replace(/\D/g, ''))
    .refine(v => /^\d{14}$/.test(v), 'CNPJ inválido'),
  codigoVenda: z.string().max(50),
  idTransacao: z.string()
    .refine(v => /^[0-9a-f]+$/i.test(v.replace(/-/g, '')), 'ID de transação deve ser hexadecimal')
    .transform(v => v.replace(/-/g, '')), // Remove hífens se houver, mas mantém formato original
  produtos: z.array(produtoEnviarSchema).min(1).max(100),
  prazos: z.array(prazoSchema).min(1).max(10),
});

Deno.serve(async (req) => {
  const startTime = Date.now();
  const endpoint = 'venda-enviar';
  let queryCount = 0;
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validar API Key com Rate Limiting
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Token não fornecido');
    }

    const apiKey = authHeader.replace('Bearer ', '');

    // FASE 3: Rate Limiting
    const rateLimitWindow = new Date();
    rateLimitWindow.setSeconds(0, 0);
    
    queryCount++;
    const { data: rateLimitData } = await supabase
      .rpc('get_cache', { key: `ratelimit:${apiKey}:${endpoint}:${rateLimitWindow.toISOString()}` });
    
    if (rateLimitData) {
      const count = rateLimitData.count || 0;
      if (count >= 100) {
        return new Response(JSON.stringify({ 
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Limite de 100 requisições por minuto excedido' 
        }), { 
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      await supabase.rpc('set_cache', { 
        key: `ratelimit:${apiKey}:${endpoint}:${rateLimitWindow.toISOString()}`,
        value: { count: count + 1 },
        ttl_seconds: 60
      });
    } else {
      await supabase.rpc('set_cache', { 
        key: `ratelimit:${apiKey}:${endpoint}:${rateLimitWindow.toISOString()}`,
        value: { count: 1 },
        ttl_seconds: 60
      });
    }

    // Cache de API key
    queryCount++;
    const cacheKey = `apikey:${apiKey}`;
    const { data: cachedKeyData } = await supabase.rpc('get_cache', { key: cacheKey });
    
    let keyData;
    if (cachedKeyData) {
      keyData = cachedKeyData;
    } else {
      queryCount++;
      const { data: freshKeyData, error: keyError } = await supabase
        .from('api_keys')
        .select('network_id')
        .eq('api_key', apiKey)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (keyError || !freshKeyData) {
        throw new Error('Token inválido');
      }
      
      keyData = freshKeyData;
      await supabase.rpc('set_cache', { 
        key: cacheKey,
        value: keyData,
        ttl_seconds: 300
      });
    }

    // 🔒 VALIDAÇÃO ZOD
    const rawBody = await req.json();
    
    console.log('📦 Payload recebido (venda-enviar):', JSON.stringify(rawBody, null, 2));
    
    const validationResult = vendaEnviarSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }));
      
      console.error('❌ Validation error (venda-enviar):', JSON.stringify(errors, null, 2));
      console.error('❌ Raw body:', JSON.stringify(rawBody, null, 2));
      
      return new Response(JSON.stringify({ 
        code: 'VALIDATION_ERROR',
        message: 'Dados invalidos',
        errors
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const { codigoEmpresa, codigoVenda, idTransacao, produtos, prazos } = validationResult.data;
    
    // Validação adicional: soma dos produtos
    const valorCalculado = produtos.reduce((sum, p) => sum + p.valorVenda, 0);
    
    // Validação adicional: soma dos prazos deve bater com valor dos produtos
    const somaPrazos = prazos.reduce((sum, p) => sum + p.valorPrazo, 0);
    if (Math.abs(somaPrazos - valorCalculado) > 0.01) {
      return new Response(JSON.stringify({ 
        code: 'VALIDATION_ERROR',
        message: 'Soma dos pagamentos não corresponde ao valor total',
        errors: [{ field: 'prazos', message: 'Inconsistência nos valores de pagamento' }]
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Validação aprovada. Confirmando venda:', { codigoEmpresa, codigoVenda, idTransacao });

    // Buscar transação pendente
    queryCount++;
    const { data: txData, error: txError } = await supabase
      .from('webposto_transactions')
      .select('*')
      .eq('id_transacao', idTransacao)
      .eq('codigo_venda', codigoVenda)
      .maybeSingle();

    if (txError) {
      console.error('Erro ao buscar transação:', txError);
      throw new Error(`Erro ao buscar transação: ${txError.message}`);
    }

    if (!txData) {
      console.log('Transação não encontrada - idTransacao:', idTransacao, 'codigoVenda:', codigoVenda);
      throw new Error('Transação não encontrada ou já foi processada');
    }

    // Verificar se já foi confirmada (idempotência)
    if (txData.status === 'confirmed') {
      return new Response(null, { 
        status: 409,
        headers: corsHeaders 
      });
    }

    // Calcular valor total
    const valorTotal = produtos.reduce((sum: number, p: any) => sum + parseFloat(p.valorVenda), 0);

    // Buscar loja com cache
    queryCount++;
    const storeCacheKey = `store:${txData.store_id}`;
    const { data: cachedStoreData } = await supabase.rpc('get_cache', { key: storeCacheKey });
    
    let storeData;
    if (cachedStoreData) {
      storeData = cachedStoreData;
    } else {
      queryCount++;
      const { data: freshStoreData } = await supabase
        .from('stores')
        .select('loyalty_type, points_per_real, cashback_percentage, cashback_type, cashback_fixed_value, redemption_accumulation_type')
        .eq('id', txData.store_id)
        .single();
      
      storeData = freshStoreData;
      if (storeData) {
        await supabase.rpc('set_cache', { 
          key: storeCacheKey,
          value: storeData,
          ttl_seconds: 600
        });
      }
    }

    if (!storeData) {
      throw new Error('Loja não encontrada');
    }

    let points = 0;
    let transactionType: 'accumulation' | 'redemption' = 'accumulation';
    const redemptionAccumulationType = storeData.redemption_accumulation_type || 'none';

    // 🔥 Buscar configurações de acúmulo diferenciado por combustível
    queryCount++;
    const { data: differentialConfigs } = await supabase
      .from('fuel_differential_config')
      .select('product_code, differential_percentage')
      .eq('network_id', keyData.network_id)
      .eq('is_active', true);

    const differentialMap = new Map(
      differentialConfigs?.map((c: any) => [c.product_code.replace(/^0+/, '') || '0', c.differential_percentage]) || []
    );

    console.log(`⛽ Fuel differential configs encontradas: ${differentialConfigs?.length || 0}`, 
      differentialConfigs?.map((c: any) => `${c.product_code}: ${c.differential_percentage}%`));

    // Função auxiliar para calcular pontos/cashback com diferencial por produto
    const calculatePointsWithDifferential = (produtosCalc: any[], baseAmount?: number) => {
      let totalPoints = 0;
      
      if (produtosCalc && produtosCalc.length > 0) {
        for (const item of produtosCalc) {
          const itemAmount = parseFloat(item.valorVenda);
          const productCode = item.codigoProduto;
          const normalizedCode = productCode ? productCode.replace(/^0+/, '') || '0' : '';
          const hasDifferential = normalizedCode && differentialMap.has(normalizedCode);
          const differentialPercentage = hasDifferential ? differentialMap.get(normalizedCode) : null;

          if (storeData.loyalty_type === 'points') {
            if (hasDifferential && differentialPercentage) {
              const basePoints = itemAmount * parseFloat(storeData.points_per_real);
              totalPoints += basePoints * (1 + (differentialPercentage / 100));
              console.log(`✨ Acúmulo diferenciado (pontos): ${productCode} - ${differentialPercentage}% extra`);
            } else {
              totalPoints += itemAmount * parseFloat(storeData.points_per_real);
            }
          } else if (storeData.loyalty_type === 'cashback') {
            if (hasDifferential && differentialPercentage) {
              totalPoints += itemAmount * (differentialPercentage / 100);
              console.log(`✨ Cashback diferenciado: ${productCode} - ${differentialPercentage}%`);
            } else {
              if (storeData.cashback_type === 'percentage') {
                totalPoints += itemAmount * (parseFloat(storeData.cashback_percentage) / 100);
              } else {
                totalPoints += parseFloat(storeData.cashback_fixed_value);
              }
            }
          }
        }
      } else {
        // Fallback sem produtos
        const amount = baseAmount || 0;
        if (storeData.loyalty_type === 'points') {
          totalPoints = amount * parseFloat(storeData.points_per_real);
        } else if (storeData.loyalty_type === 'cashback') {
          if (storeData.cashback_type === 'percentage') {
            totalPoints = amount * (parseFloat(storeData.cashback_percentage) / 100);
          } else {
            totalPoints = parseFloat(storeData.cashback_fixed_value);
          }
        }
      }
      
      return totalPoints;
    };

    // Processar conforme tipo de código
    if (txData.tipo_codigo === 'P') {
      // Pontuação (acúmulo)
      console.log('📌 TIPO P - PONTUAÇÃO (Acúmulo normal)');
      points = calculatePointsWithDifferential(produtos, valorTotal);
      transactionType = 'accumulation';

      // 🎯 APLICAR MULTIPLICADOR DE RETENÇÃO (se houver compromisso ativo)
      if (txData.client_id) {
        const { data: retentionMultiplier } = await supabase
          .rpc('get_client_active_retention_multiplier', {
            client_uuid: txData.client_id,
            network_uuid: keyData.network_id
          });
        
        if (retentionMultiplier && retentionMultiplier > 0) {
          const bonus = points * (retentionMultiplier / 100);
          console.log(`🎯 Bônus de retenção aplicado: +${retentionMultiplier}% = ${bonus.toFixed(2)} extras`);
          points += bonus;
        }
      }
    } else if (txData.tipo_codigo === 'R') {
      // Verificar se é resgate de verdade (valor_cashback > 0) ou acúmulo (valor_cashback = 0)
      const redemptionValue = parseFloat(txData.valor_cashback);
      
      if (redemptionValue > 0) {
        // Verificar se é uma promoção Leva+ ONE
        const promocaoOneMetadata = txData.metadata?.promocao_one;
        
        if (promocaoOneMetadata) {
          // É uma promoção ONE, não processar resgate de pontos/cashback
          console.log('🎁 PROMOÇÃO LEVA+ ONE - Processando resgate da promoção:', promocaoOneMetadata.name);
          points = 0; // Não mexe no saldo de pontos/cashback
          transactionType = 'accumulation'; // Mantém como acúmulo
          
          // Criar registro de resgate da promoção
          queryCount++;
          const { data: redemption, error: redemptionError } = await supabase
            .from('one_promotion_redemptions')
            .insert({
              promotion_id: promocaoOneMetadata.id,
              client_id: txData.client_id,
              redeemed_at: txData.data_venda,
              status: 'resgatado',
              metadata: {
                store_id: txData.store_id,
                codigo_venda: codigoVenda,
                id_transacao: idTransacao,
                produto: promocaoOneMetadata.produto,
                desconto: promocaoOneMetadata.desconto
              }
            })
            .select()
            .single();
          
          if (redemptionError) {
            console.error('❌ Erro ao criar registro de resgate ONE:', redemptionError);
          } else {
            console.log('✅ Resgate ONE registrado:', redemption.id);
            
            // Incrementar contador de resgates da promoção
            queryCount++;
            await supabase.rpc('set_cache', {
              key: `promo_one_redeemed:${promocaoOneMetadata.id}`,
              value: { increment: true },
              ttl_seconds: 60
            });
          }
        } else {
          // RESGATE NORMAL: aplicar desconto de pontos/cashback
          console.log('🔥 TIPO R - RESGATE EFETIVO (valor_cashback:', redemptionValue, ')');
          points = -redemptionValue;
          transactionType = 'redemption';
        }
      } else {
        // ACÚMULO: tipo R com valor 0 significa que não houve resgate, apenas acúmulo
        console.log('💰 TIPO R - ACÚMULO (sem resgate, valor_cashback = 0)');
        points = calculatePointsWithDifferential(produtos, valorTotal);
        transactionType = 'accumulation';

        // 🎯 APLICAR MULTIPLICADOR DE RETENÇÃO (se houver compromisso ativo)
        if (txData.client_id) {
          const { data: retentionMultiplier } = await supabase
            .rpc('get_client_active_retention_multiplier', {
              client_uuid: txData.client_id,
              network_uuid: keyData.network_id
            });
          
          if (retentionMultiplier && retentionMultiplier > 0) {
            const bonus = points * (retentionMultiplier / 100);
            console.log(`🎯 Bônus de retenção aplicado: +${retentionMultiplier}% = ${bonus.toFixed(2)} extras`);
            points += bonus;
          }
        }
      }
      
      // Calcular acúmulo durante resgate baseado na configuração (apenas se for resgate real)
      let accumulationPoints = 0;
      
      if (redemptionValue > 0 && redemptionAccumulationType === 'full') {
        // Acumula sobre o valor total da venda (com diferencial por produto)
        accumulationPoints = calculatePointsWithDifferential(produtos, valorTotal);
      } else if (redemptionValue > 0 && redemptionAccumulationType === 'difference') {
        // Acumula sobre a diferença (valor da venda - resgate) - proporcional por produto
        const ratio = Math.max(0, (valorTotal - redemptionValue) / valorTotal);
        const adjustedProducts = produtos.map((p: any) => ({
          ...p,
          valorVenda: parseFloat(p.valorVenda) * ratio
        }));
        accumulationPoints = calculatePointsWithDifferential(adjustedProducts, Math.max(0, valorTotal - redemptionValue));
      }
      // Se redemptionAccumulationType === 'none', accumulationPoints fica 0
      
      // Se houver acúmulo, criar uma transação adicional de accumulation
      if (accumulationPoints > 0 && txData.client_id) {
        console.log('💰 Acumulando durante resgate:', accumulationPoints);
        
        const { data: accTransaction, error: accError } = await supabase
          .from('transactions')
          .insert({
            client_id: txData.client_id,
            store_id: txData.store_id,
            type: 'accumulation',
            amount: valorTotal,
            points: accumulationPoints,
            description: `webPosto - Acúmulo durante resgate - Venda ${codigoVenda}`,
            created_at: txData.data_venda,
            codigo_produto: txData.produtos?.[0]?.codigoProduto || null,
            codigo_colaborador: txData.codigo_colaborador ? String(txData.codigo_colaborador) : null,
            nome_colaborador: txData.nome_colaborador || null,
          })
          .select()
          .single();
          
        if (accError) {
          console.error('❌ Erro ao criar transação de acúmulo:', accError);
        } else {
          // Atualizar saldo com o acúmulo
          const { data: clientData } = await supabase
            .from('clients')
            .select('total_points')
            .eq('id', txData.client_id)
            .single();
            
          if (clientData) {
            const currentBalance = parseFloat(clientData.total_points);
            await supabase
              .from('clients')
              .update({ total_points: Math.max(0, currentBalance + accumulationPoints) })
              .eq('id', txData.client_id);
            
            // 📨 Enviar mensagem de acúmulo se configurada
            if (accTransaction) {
              try {
                console.log('📨 Enviando mensagem de acúmulo durante resgate...');
                await supabase.functions.invoke('send-transaction-message', {
                  body: {
                    transaction_id: accTransaction.id,
                    message_type: 'acumulo'
                  }
                });
              } catch (msgError) {
                console.error('⚠️ Erro ao enviar mensagem (não crítico):', msgError);
              }
            }
          }
        }
      }
    }

    // Criar transação no sistema
    let mainTransactionId = null;
    if (txData.client_id) {
      console.log('🔄 Criando transação para cliente:', txData.client_id);
      console.log('🔄 Valor:', valorTotal, 'Pontos/Cashback:', points);
      
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          client_id: txData.client_id,
          store_id: txData.store_id,
          type: transactionType,
          amount: valorTotal,
          points: points,
          description: `webPosto - Venda ${codigoVenda} - ID: ${idTransacao}`,
          created_at: txData.data_venda,
          codigo_produto: txData.produtos?.[0]?.codigoProduto || null,
          codigo_colaborador: txData.codigo_colaborador ? String(txData.codigo_colaborador) : null,
          nome_colaborador: txData.nome_colaborador || null,
        })
        .select()
        .single();
      
      mainTransactionId = transaction?.id;

      if (transactionError) {
        console.error('❌ Erro ao criar transação:', transactionError);
        throw new Error(`Erro ao criar transação: ${transactionError.message}`);
      }

      console.log('✅ Transação criada:', transaction);

      if (transaction) {
        // Atualizar saldo do cliente
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('total_points')
          .eq('id', txData.client_id)
          .single();

        if (clientError) {
          console.error('❌ Erro ao buscar saldo do cliente:', clientError);
          throw new Error(`Erro ao buscar saldo: ${clientError.message}`);
        }

        if (clientData) {
          const newBalance = parseFloat(clientData.total_points) + points;
          console.log('💰 Saldo anterior:', clientData.total_points, '→ Novo saldo:', newBalance);
          
          const { error: updateError } = await supabase
            .from('clients')
            .update({ 
              total_points: Math.max(0, newBalance),
              is_validated: true  // ✅ Valida automaticamente o cliente ao acumular pontos
            })
            .eq('id', txData.client_id);

          if (updateError) {
            console.error('❌ Erro ao atualizar saldo:', updateError);
            throw new Error(`Erro ao atualizar saldo: ${updateError.message}`);
          }

          console.log('✅ Saldo atualizado com sucesso');
          
          // 📨 Enviar mensagem automática baseada no tipo de transação
          if (mainTransactionId) {
            try {
              const messageType = transactionType === 'accumulation' ? 'acumulo' : 'resgate';
              console.log(`📨 Enviando mensagem automática de ${messageType}...`);
              await supabase.functions.invoke('send-transaction-message', {
                body: {
                  transaction_id: mainTransactionId,
                  message_type: messageType
                }
              });
            } catch (msgError) {
              console.error('⚠️ Erro ao enviar mensagem (não crítico):', msgError);
              // Não falha a transação se o envio de mensagem falhar
            }
          }
          
          // 🔴 Desligar resgate automaticamente após resgate efetivado
          if (transactionType === 'redemption' && txData.client_id) {
            console.log('🔄 Chamando auto-disable-redemption após resgate efetivado...');
            supabase.functions.invoke('auto-disable-redemption', {
              body: { client_id: txData.client_id }
            }).then(({ data, error }: any) => {
              if (error) {
                console.error('⚠️ Erro ao processar desligamento automático:', error);
              } else if (data?.disabled) {
                console.log('🔴 Resgate desligado automaticamente:', data.reason);
              }
            }).catch((err: any) => {
              console.error('⚠️ Erro na chamada de auto-disable:', err);
            });
          }
        }
      }
    } else {
      console.log('⚠️ Cliente não identificado, transação não será criada');
    }

    // Marcar transação como confirmada
    await supabase
      .from('webposto_transactions')
      .update({ 
        status: 'confirmed',
        pagamentos: prazos,
        updated_at: new Date().toISOString()
      })
      .eq('id_transacao', idTransacao);

    console.log('Venda confirmada com sucesso:', idTransacao);

    // FASE 2: Log estruturado
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      event: 'transaction_confirmed',
      endpoint,
      duration_ms: duration,
      queries_count: queryCount,
      status: 'success',
      transaction_id: idTransacao,
      transaction_type: txData.tipo_codigo,
      valor_total: valorTotal
    }));

    return new Response(JSON.stringify({
      codigoEmpresa: rawBody.codigoEmpresa || codigoEmpresa,
      codigoVenda,
      idTransacao
    }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // FASE 2: Log de erro estruturado
    const duration = Date.now() - startTime;
    console.error(JSON.stringify({
      event: 'transaction_confirmation_error',
      endpoint,
      duration_ms: duration,
      queries_count: queryCount,
      status: 'error',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined
    }));
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ 
        code: 'ENVIAR_ERROR',
        message: errorMessage 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
