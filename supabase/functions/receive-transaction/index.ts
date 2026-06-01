// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from 'npm:zod@3.25.76';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 🔒 SCHEMAS DE VALIDAÇÃO ZOD
const produtoSchema = z.object({
  codigoSequencia: z.number().int().positive().optional(),
  codigoColaborador: z.union([z.string(), z.number()])
    .transform(v => String(v))
    .optional()
    .nullable(),
  nomeColaborador: z.string().max(100).optional().nullable(),
  identificadorProduto: z.string().max(50).optional(),
  codigoProduto: z.string().max(50),
  nomeProduto: z.string().max(200),
  descontoVenda: z.number().nonnegative().max(100000).optional().default(0),
  valorVenda: z.number().positive().max(100000),
  quantidade: z.number().positive().max(1000),
  valorUnitario: z.number().positive().max(100000)
});

const receiveTransactionSchema = z.object({
  codigoEmpresa: z.string()
    .transform(v => v.replace(/\D/g, ''))
    .refine(v => /^\d{14}$/.test(v), 'CNPJ inválido'),
  codigoVoucher: z.string()
    .transform(v => v.replace(/\D/g, ''))
    .refine(v => /^\d{11}$/.test(v), 'CPF inválido'),
  valorTotal: z.number().positive().max(1000000),
  descontoTotal: z.number().nonnegative().max(1000000).optional().default(0),
  dataVenda: z.string()
    .transform(v => {
      // Aceita DD/MM/YYYY e converte para YYYY-MM-DD
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
        const [day, month, year] = v.split('/');
        return `${year}-${month}-${day}`;
      }
      // Aceita YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        return v;
      }
      throw new Error('Data inválida - formato esperado: DD/MM/YYYY ou YYYY-MM-DD');
    }),
  horaVenda: z.string()
    .transform(v => {
      // Aceita timestamp ISO completo e extrai a hora
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
        return v.split('T')[1].split('.')[0].substring(0, 8);
      }
      // Aceita HH:MM:SS
      if (/^\d{2}:\d{2}:\d{2}$/.test(v)) {
        return v;
      }
      throw new Error('Hora inválida - formato esperado: HH:MM:SS ou ISO timestamp');
    }),
  codigoVenda: z.string().max(50),
  produtos: z.array(produtoSchema).min(1).max(100)
});

// Função para análise de anomalias
async function analyzeTransactionForAnomalies(
  supabase: any,
  transaction: any,
  client: any,
  store: any,
  networkId: string
) {
  try {
    const anomalies: any[] = [];
    let fraudScore = 0;

    // Buscar transações recentes do cliente (últimas 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('client_id', client.id)
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false });

    // Buscar transações históricas (últimos 30 dias)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: historicalTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('client_id', client.id)
      .gte('created_at', thirtyDaysAgo);

    // REGRA 1: Frequência anômala (múltiplas transações em curto período)
    if (recentTransactions && recentTransactions.length >= 5) {
      const timeSpan = new Date(transaction.created_at).getTime() - new Date(recentTransactions[recentTransactions.length - 1].created_at).getTime();
      const hoursSpan = timeSpan / (1000 * 60 * 60);
      
      if (hoursSpan < 2) {
        fraudScore += 30;
        anomalies.push({
          type: 'frequency_spike',
          severity: 'high',
          rule_code: 'FREQ_01',
          rule_name: 'Frequência Anômala - Múltiplas Transações',
          confidence: 85,
          summary: `Cliente realizou ${recentTransactions.length} transações em ${hoursSpan.toFixed(1)} horas`,
        });
      }
    }

    // REGRA 2: Valor anômalo (valor muito acima da média)
    if (historicalTransactions && historicalTransactions.length > 0) {
      const avgAmount = historicalTransactions.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0) / historicalTransactions.length;
      const currentAmount = parseFloat(transaction.amount);
      
      if (currentAmount > avgAmount * 5) {
        fraudScore += 35;
        anomalies.push({
          type: 'unusual_amount',
          severity: currentAmount > avgAmount * 10 ? 'critical' : 'high',
          rule_code: 'AMT_01',
          rule_name: 'Valor Muito Acima da Média',
          confidence: 90,
          summary: `Transação de R$ ${currentAmount.toFixed(2)} é ${(currentAmount / avgAmount).toFixed(1)}x maior que a média de R$ ${avgAmount.toFixed(2)}`,
        });
      }
    }

    // REGRA 3: Velocidade suspeita (transações muito próximas)
    if (recentTransactions && recentTransactions.length > 1) {
      const lastTransaction = recentTransactions[1];
      const timeDiff = new Date(transaction.created_at).getTime() - new Date(lastTransaction.created_at).getTime();
      const minutesDiff = timeDiff / (1000 * 60);
      
      if (minutesDiff < 5) {
        fraudScore += 25;
        anomalies.push({
          type: 'velocity_pattern',
          severity: 'medium',
          rule_code: 'VEL_01',
          rule_name: 'Transações em Sequência Rápida',
          confidence: 75,
          summary: `Nova transação apenas ${minutesDiff.toFixed(1)} minutos após a anterior`,
        });
      }
    }

    // REGRA 4: Padrão temporal suspeito (horário incomum)
    const transactionHour = new Date(transaction.created_at).getHours();
    if (transactionHour >= 0 && transactionHour < 6) {
      fraudScore += 15;
      anomalies.push({
        type: 'time_pattern',
        severity: 'low',
        rule_code: 'TIME_01',
        rule_name: 'Horário Incomum',
        confidence: 60,
        summary: `Transação realizada às ${transactionHour}h (madrugada)`,
      });
    }

    // REGRA 5: Cliente não validado
    const { data: clientFull } = await supabase
      .from('clients')
      .select('email_validated, phone_validated')
      .eq('id', client.id)
      .single();

    if (clientFull && (!clientFull.email_validated || !clientFull.phone_validated)) {
      fraudScore += 20;
      anomalies.push({
        type: 'suspicious_behavior',
        severity: 'medium',
        rule_code: 'VAL_01',
        rule_name: 'Cliente Sem Validação',
        confidence: 70,
        summary: `Cliente sem ${!clientFull.email_validated ? 'email' : 'telefone'} validado`,
      });
    }

    // Se detectou anomalias, criar registro
    if (anomalies.length > 0) {
      const mainAnomaly = anomalies.sort((a, b) => {
        const severityOrder: any = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      })[0];

      // Gerar alert_id único
      const alertId = `ALERT-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Criar anomalia
      const { data: anomaly, error: anomalyError } = await supabase
        .from('anomalies')
        .insert({
          alert_id: alertId,
          client_id: client.id,
          network_id: networkId,
          store_id: store.id,
          anomaly_type: mainAnomaly.type,
          severity: mainAnomaly.severity,
          status: 'pending',
          fraud_score: Math.min(fraudScore, 100),
          summary: mainAnomaly.summary,
          suggested_actions: [
            'Revisar histórico do cliente',
            'Verificar documentação',
            'Monitorar próximas transações',
          ],
        })
        .select()
        .single();

      if (!anomalyError && anomaly) {
        // Associar transação à anomalia
        await supabase
          .from('anomaly_transactions')
          .insert({
            anomaly_id: anomaly.id,
            transaction_id: transaction.id,
          });

        // Inserir regras acionadas
        for (const anom of anomalies) {
          await supabase
            .from('anomaly_rules')
            .insert({
              anomaly_id: anomaly.id,
              rule_code: anom.rule_code,
              rule_name: anom.rule_name,
              confidence: anom.confidence,
            });
        }

        // Criar histórico inicial
        await supabase
          .from('anomaly_history')
          .insert({
            anomaly_id: anomaly.id,
            action_type: 'created',
            action_by: '00000000-0000-0000-0000-000000000000', // System
            notes: 'Anomalia detectada automaticamente',
          });

        console.log('Anomalia detectada e registrada:', alertId);
      }
    }
  } catch (error) {
    console.error('Erro na análise de anomalias:', error);
    // Não propaga o erro para não bloquear a transação
  }
}

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
      throw new Error('API Key não fornecida');
    }

    const apiKey = authHeader.replace('Bearer ', '');

    // Buscar e validar API key
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('network_id, key_type')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (keyError || !keyData) {
      throw new Error('API Key inválida ou inativa');
    }

    // Atualizar last_used_at
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('api_key', apiKey);

    const networkId = keyData.network_id;

    // 🔒 VALIDAÇÃO ZOD
    const rawBody = await req.json();
    
    console.log('📦 Payload recebido:', JSON.stringify(rawBody, null, 2));
    
    // Não precisamos pré-processar, o Zod já faz isso
    const validationResult = receiveTransactionSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }));
      
      console.error('❌ Validation error:', JSON.stringify(errors, null, 2));
      console.error('❌ Raw errors:', JSON.stringify(validationResult.error, null, 2));
      
      return new Response(JSON.stringify({ 
        code: 'VALIDATION_ERROR',
        message: 'Dados invalidos',
        errors: errors
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('✅ Dados validados com sucesso');
    
    const {
      codigoEmpresa,
      codigoVoucher,
      produtos,
      valorTotal,
      dataVenda,
      horaVenda,
      codigoVenda,
      descontoTotal
    } = validationResult.data;
    
    // Construir data/hora da venda
    const saleDatetime = `${dataVenda}T${horaVenda}`;
    
    // Validação adicional: data não pode ser futura
    const saleDate = new Date(saleDatetime);
    const now = new Date();
    if (saleDate > now) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Data da venda não pode ser no futuro',
        validation_errors: [{ field: 'dataVenda', message: 'Data inválida' }]
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Validação adicional: soma dos produtos deve bater com valorTotal
    if (produtos && produtos.length > 0) {
      const produtosTotal = produtos.reduce((sum: number, item) => {
        return sum + item.valorVenda;
      }, 0);
      
      if (Math.abs(produtosTotal - valorTotal) > 0.01) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Soma dos produtos não corresponde ao valor total',
          validation_errors: [{ field: 'produtos', message: 'Inconsistência nos valores' }]
        }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    console.log('✅ Validação aprovada. Recebendo transação:', {
      codigoEmpresa,
      codigoVoucher,
      valorTotal,
      saleDatetime,
      codigoVenda,
      produtos_count: produtos?.length || 0,
    });

    // Buscar loja pelo CNPJ e network_id
    console.log('🔍 Buscando loja - CNPJ:', codigoEmpresa, 'Network ID:', networkId);
    
    // Formatar CNPJ para busca (o banco pode ter formatado ou limpo)
    const cnpjFormatado = codigoEmpresa.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('id, name, loyalty_type, points_per_real, cashback_percentage, cashback_type, cashback_fixed_value, redemption_accumulation_type, status')
      .eq('network_id', networkId)
      .or(`cnpj.eq.${codigoEmpresa},cnpj.eq.${cnpjFormatado}`)
      .maybeSingle();

    if (storeError) {
      console.error('❌ Erro ao buscar loja:', storeError);
      throw new Error(`Erro ao buscar loja: ${storeError.message}`);
    }
    
    if (!storeData) {
      // Verificar se a loja existe em outra rede ou com status diferente
      const { data: anyStore } = await supabase
        .from('stores')
        .select('id, name, network_id, status, cnpj')
        .eq('cnpj', codigoEmpresa)
        .maybeSingle();
      
      if (anyStore) {
        console.error('⚠️ Loja encontrada mas:', {
          store_name: anyStore.name,
          current_status: anyStore.status,
          current_network: anyStore.network_id,
          requested_network: networkId
        });
        
        if (anyStore.status !== 'active') {
          throw new Error(`Loja "${anyStore.name}" está com status "${anyStore.status}". Entre em contato com o suporte.`);
        }
        if (anyStore.network_id !== networkId) {
          throw new Error(`Loja "${anyStore.name}" pertence a outra rede. Verifique a chave API utilizada.`);
        }
      } else {
        console.error('❌ CNPJ não cadastrado:', codigoEmpresa);
        throw new Error(`CNPJ ${codigoEmpresa} não está cadastrado no sistema. Favor cadastrar a loja primeiro.`);
      }
      
      throw new Error('Loja não encontrada');
    }
    
    if (storeData.status !== 'active') {
      throw new Error(`Loja "${storeData.name}" está inativa. Entre em contato com o suporte.`);
    }
    
    console.log('✅ Loja encontrada:', storeData.name);

    // Buscar cliente pelo CPF
    const cpfLimpo = codigoVoucher.replace(/\D/g, '');
    
    // PASSO 1: Buscar cliente na rede atual
    const { data: clienteNaRede, error: clientError } = await supabase
      .from('clients')
      .select('id, total_points, favorite_network_id')
      .eq('cpf', cpfLimpo)
      .eq('network_id', networkId)
      .maybeSingle();

    if (clientError) {
      throw new Error('Erro ao buscar cliente');
    }

    let clientData = clienteNaRede;

    // PASSO 2: Se não encontrou na rede atual, buscar globalmente
    if (!clientData) {
      console.log('🔍 Cliente não encontrado na rede atual, buscando globalmente...');
      const { data: clienteGlobal, error: globalError } = await supabase
        .from('clients')
        .select('*')
        .eq('cpf', cpfLimpo)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (!globalError && clienteGlobal) {
        // Cliente existe em outra rede, criar registro na rede atual
        console.log('✅ Cliente encontrado globalmente, criando registro na nova rede...');
        const { data: novoRegistro, error: insertError } = await supabase
          .from('clients')
          .insert({
            cpf: clienteGlobal.cpf,
            full_name: clienteGlobal.full_name,
            email: clienteGlobal.email,
            phone: clienteGlobal.phone,
            birth_date: clienteGlobal.birth_date,
            address_street: clienteGlobal.address_street,
            address_number: clienteGlobal.address_number,
            address_complement: clienteGlobal.address_complement,
            address_neighborhood: clienteGlobal.address_neighborhood,
            address_city: clienteGlobal.address_city,
            address_state: clienteGlobal.address_state,
            address_zip: clienteGlobal.address_zip,
            network_id: networkId, // Nova rede
            favorite_network_id: clienteGlobal.favorite_network_id, // Mantém a favorita original
            registered_at_store_id: storeData.id,
            total_points: 0, // Começa do zero na nova rede
            is_validated: clienteGlobal.is_validated,
            email_validated: clienteGlobal.email_validated,
            phone_validated: clienteGlobal.phone_validated,
            auto_redemption_enabled: false // Padrão desabilitado na nova rede
          })
          .select('id, total_points, favorite_network_id')
          .single();
        
        if (insertError) {
          console.error('Erro ao criar registro do cliente na nova rede:', insertError);
          throw new Error('Erro ao associar cliente à nova rede');
        }
        
        clientData = novoRegistro;
        console.log('🎉 Cliente associado automaticamente à rede:', networkId);
      }
    }

    if (!clientData) {
      throw new Error('Cliente não encontrado. Favor realizar cadastro.');
    }

    // Verificar se cliente está bloqueado
    const { data: blockedClient } = await supabase
      .from('blocked_clients')
      .select('id, reason, justification')
      .eq('client_id', clientData.id)
      .eq('network_id', networkId)
      .eq('is_active', true)
      .maybeSingle();

    if (blockedClient) {
      console.log('Cliente bloqueado:', clientData.id);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Cliente bloqueado por comportamento suspeito',
          blocked: true,
          reason: blockedClient.reason
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 🔥 Buscar configurações de acúmulo diferenciado
    const { data: differentialConfigs } = await supabase
      .from('fuel_differential_config')
      .select('product_code, differential_percentage')
      .eq('network_id', networkId)
      .eq('is_active', true);

    const differentialMap = new Map(
      differentialConfigs?.map(c => [c.product_code.replace(/^0+/, '') || '0', c.differential_percentage]) || []
    );

    // 🔥 Calcular pontos ou cashback por item (acúmulo diferenciado)
    let points = 0;
    let cashbackAmount = 0;

    if (produtos && Array.isArray(produtos) && produtos.length > 0) {
      // Processar item por item
      for (const item of produtos) {
        const itemAmount = item.valorVenda;
        const productCode = item.codigoProduto;
        const normalizedCode = productCode ? productCode.replace(/^0+/, '') || '0' : '';
        
        // Verificar se tem configuração diferenciada
        const hasDifferential = normalizedCode && differentialMap.has(normalizedCode);
        const differentialPercentage = hasDifferential ? differentialMap.get(normalizedCode) : null;

        let itemPoints = 0;
        let itemCashback = 0;

        if (storeData.loyalty_type === 'points') {
          if (hasDifferential && differentialPercentage) {
            // Aplicar percentual diferenciado sobre a configuração padrão
            const basePoints = itemAmount * parseFloat(storeData.points_per_real);
            itemPoints = basePoints * (1 + (differentialPercentage / 100));
            console.log(`✨ Acúmulo diferenciado aplicado: ${productCode} - ${differentialPercentage}% extra`);
          } else {
            // Usar configuração padrão
            itemPoints = itemAmount * parseFloat(storeData.points_per_real);
          }
        } else if (storeData.loyalty_type === 'cashback') {
          if (hasDifferential && differentialPercentage) {
            // Aplicar percentual diferenciado direto
            itemCashback = itemAmount * (differentialPercentage / 100);
            console.log(`✨ Cashback diferenciado aplicado: ${productCode} - ${differentialPercentage}%`);
          } else {
            // Usar configuração padrão
            if (storeData.cashback_type === 'percentage') {
              itemCashback = itemAmount * (parseFloat(storeData.cashback_percentage) / 100);
            } else {
              itemCashback = parseFloat(storeData.cashback_fixed_value);
            }
          }
        }

        points += itemPoints;
        cashbackAmount += itemCashback;
      }

      // Para cashback, pontos = valor em reais
      if (storeData.loyalty_type === 'cashback') {
        points = cashbackAmount;
      }
    } else {
      // Fallback: se não houver produtos, usar cálculo tradicional no total
      if (storeData.loyalty_type === 'points') {
        points = valorTotal * parseFloat(storeData.points_per_real);
      } else if (storeData.loyalty_type === 'cashback') {
        if (storeData.cashback_type === 'percentage') {
          cashbackAmount = valorTotal * (parseFloat(storeData.cashback_percentage) / 100);
        } else {
          cashbackAmount = parseFloat(storeData.cashback_fixed_value);
        }
        points = cashbackAmount;
      }
    }

    // Criar transação com campos adicionais
    const firstItem = produtos && produtos.length > 0 ? produtos[0] : null;
    const codigoProduto = firstItem?.codigoProduto || null;
    const codigoColaborador = firstItem?.codigoColaborador || null;
    const nomeColaborador = firstItem?.nomeColaborador || null;

    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        client_id: clientData.id,
        store_id: storeData.id,
        type: 'purchase',
        amount: valorTotal,
        points: points,
        description: `Compra via API - Venda ${codigoVenda}`,
        created_at: saleDatetime,
        codigo_produto: codigoProduto,
        codigo_colaborador: codigoColaborador,
        nome_colaborador: nomeColaborador,
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Erro ao criar transação:', transactionError);
      throw transactionError;
    }

    // Atualizar saldo do cliente
    let newBalance = parseFloat(clientData.total_points) + points;
    await supabase
      .from('clients')
      .update({ total_points: newBalance })
      .eq('id', clientData.id);

    console.log('Transação processada com sucesso:', transaction.id);

    // 🎁 Verificar se é a primeira compra e aplicar bônus de indicação pendente
    try {
      const { data: pendingReferral } = await supabase
        .from('client_referrals')
        .select('id, referrer_client_id, referred_bonus_amount, referrer_bonus_amount, bonus_type, network_id')
        .eq('referred_client_id', clientData.id)
        .eq('bonus_applied', false)
        .maybeSingle();

      if (pendingReferral) {
        console.log('🎁 Bônus de indicação pendente encontrado, aplicando...');

        // Aplicar bônus ao indicado (cliente atual)
        if (pendingReferral.referred_bonus_amount > 0) {
          const currentBalance = parseFloat(clientData.total_points) + points; // já inclui os pontos da compra
          await supabase
            .from('clients')
            .update({ total_points: currentBalance + pendingReferral.referred_bonus_amount })
            .eq('id', clientData.id);

          await supabase
            .from('transactions')
            .insert({
              client_id: clientData.id,
              store_id: storeData.id,
              type: 'accumulation',
              points: pendingReferral.referred_bonus_amount,
              amount: 0,
              description: '🎁 Bônus de indicação!',
            });

          // Atualizar newBalance para resposta
          newBalance += pendingReferral.referred_bonus_amount;
        }

        // Aplicar bônus ao indicador
        if (pendingReferral.referrer_bonus_amount > 0) {
          const { data: referrerClient } = await supabase
            .from('clients')
            .select('total_points')
            .eq('id', pendingReferral.referrer_client_id)
            .single();

          if (referrerClient) {
            await supabase
              .from('clients')
              .update({ total_points: parseFloat(referrerClient.total_points) + pendingReferral.referrer_bonus_amount })
              .eq('id', pendingReferral.referrer_client_id);

            // Buscar nome do indicado para descrição
            const { data: referredClient } = await supabase
              .from('clients')
              .select('full_name')
              .eq('id', clientData.id)
              .single();

            const firstName = referredClient?.full_name?.split(' ')[0] || 'amigo';

            await supabase
              .from('transactions')
              .insert({
                client_id: pendingReferral.referrer_client_id,
                store_id: storeData.id,
                type: 'accumulation',
                points: pendingReferral.referrer_bonus_amount,
                amount: 0,
                description: `🎁 Bônus por indicar ${firstName}!`,
              });
          }
        }

        // Marcar como aplicado
        await supabase
          .from('client_referrals')
          .update({ bonus_applied: true })
          .eq('id', pendingReferral.id);

        console.log('✅ Bônus de indicação aplicado com sucesso!');
      }
    } catch (referralError) {
      console.error('Erro ao aplicar bônus de indicação:', referralError);
      // Não bloqueia a transação
    }

    // Análise de anomalias em background (não aguarda)
    analyzeTransactionForAnomalies(supabase, transaction, clientData, storeData, networkId).catch(err =>
      console.error('Erro ao analisar anomalias:', err)
    );

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: transaction.id,
        customer_cpf: codigoVoucher,
        points_earned: points,
        cashback_earned: cashbackAmount,
        new_balance: newBalance,
        loyalty_type: storeData.loyalty_type,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Erro em receive-transaction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Determinar o código de erro apropriado
    let errorCode = 'VALIDATION_ERROR';
    if (errorMessage.includes('API Key')) {
      errorCode = 'UNAUTHORIZED';
    } else if (errorMessage.includes('bloqueado')) {
      errorCode = 'CLIENT_BLOCKED';
    } else if (errorMessage.includes('não encontrada') || errorMessage.includes('inativa')) {
      errorCode = 'STORE_NOT_FOUND';
    }
    
    return new Response(
      JSON.stringify({ 
        code: errorCode,
        message: errorMessage
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
