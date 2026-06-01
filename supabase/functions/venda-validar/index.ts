import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from 'npm:zod@3.25.76';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 🔒 SCHEMAS DE VALIDAÇÃO ZOD
const produtoSchema = z.object({
  codigoSequencia: z.union([z.string(), z.number()]).optional().nullable(),
  codigoProduto: z.string().max(50, 'Código do produto muito longo'),
  nomeProduto: z.string().max(200, 'Nome do produto muito longo'),
  valorVenda: z.number().positive('Valor deve ser positivo').max(100000, 'Valor muito alto'),
  quantidade: z.number().positive('Quantidade deve ser positiva').max(1000, 'Quantidade muito alta'),
  valorUnitario: z.number().optional().nullable(),
  codigoColaborador: z.union([z.string(), z.number()])
    .transform(v => String(v))
    .optional()
    .nullable(),
  nomeColaborador: z.string().max(100).optional().nullable(),
});

const vendaValidarSchema = z.object({
  codigoEmpresa: z.string()
    .transform(v => v.replace(/\D/g, ''))
    .refine(v => /^\d{14}$/.test(v), 'CNPJ inválido - deve ter exatamente 14 dígitos'),
  codigoVoucher: z.string()
    .transform(v => v.replace(/\D/g, ''))
    .refine(v => /^\d{11}$/.test(v), 'CPF inválido - deve ter exatamente 11 dígitos'),
  codigoVenda: z.string().max(50, 'Código de venda muito longo'),
  valorTotal: z.number().positive('Valor total deve ser positivo').max(1000000, 'Valor total muito alto').optional(),
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
  produtos: z.array(produtoSchema).min(1, 'Deve ter pelo menos 1 produto').max(100, 'Máximo de 100 produtos por venda'),
});

Deno.serve(async (req) => {
  const startTime = Date.now();
  const endpoint = 'venda-validar';
  let queryCount = 0;
  
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

    // FASE 3: Rate Limiting (100 requisições por minuto)
    const rateLimitWindow = new Date();
    rateLimitWindow.setSeconds(0, 0); // Início do minuto atual
    
    queryCount++;
    const { data: rateLimitData, error: rateLimitError } = await supabase
      .rpc('get_cache', { key: `ratelimit:${apiKey}:${endpoint}:${rateLimitWindow.toISOString()}` });
    
    if (!rateLimitError && rateLimitData) {
      const count = rateLimitData.count || 0;
      if (count >= 100) {
        console.error(JSON.stringify({
          event: 'rate_limit_exceeded',
          api_key: apiKey.substring(0, 10) + '...',
          endpoint,
          count,
          duration_ms: Date.now() - startTime
        }));
        return new Response(JSON.stringify({ 
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Limite de 100 requisições por minuto excedido' 
        }), { 
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      // Incrementar contador
      await supabase.rpc('set_cache', { 
        key: `ratelimit:${apiKey}:${endpoint}:${rateLimitWindow.toISOString()}`,
        value: { count: count + 1 },
        ttl_seconds: 60
      });
    } else {
      // Primeira requisição desta janela
      await supabase.rpc('set_cache', { 
        key: `ratelimit:${apiKey}:${endpoint}:${rateLimitWindow.toISOString()}`,
        value: { count: 1 },
        ttl_seconds: 60
      });
    }

    // FASE 4: Verificar cache de API key
    queryCount++;
    const cacheKey = `apikey:${apiKey}`;
    const { data: cachedKeyData } = await supabase.rpc('get_cache', { key: cacheKey });
    
    let keyData;
    if (cachedKeyData) {
      keyData = cachedKeyData;
      console.log('✅ Cache hit: API key');
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
      
      // Cachear por 5 minutos
      await supabase.rpc('set_cache', { 
        key: cacheKey,
        value: keyData,
        ttl_seconds: 300
      });
      console.log('💾 Cache miss: API key stored');
    }

    // Atualizar last_used_at em background (não bloquear)
    supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('api_key', apiKey)
      .then(() => {});

    const networkId = keyData.network_id;

    // 🔒 VALIDAÇÃO ZOD
    const rawBody = await req.json();
    
    console.log('📦 Payload recebido:', JSON.stringify(rawBody, null, 2));
    
    // Validar schema (Zod já faz a limpeza do CNPJ/CPF)
    const validationResult = vendaValidarSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }));
      
      console.error(JSON.stringify({
        event: 'validation_error',
        endpoint: 'venda-validar',
        errors,
        duration_ms: Date.now() - startTime
      }));
      
      return new Response(JSON.stringify({ 
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        errors
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const { codigoEmpresa, codigoVoucher, horaVenda, dataVenda, codigoVenda, produtos } = validationResult.data;
    
    // Validação adicional: data não pode ser futura
    const dataVendaObj = new Date(dataVenda);
    const hoje = new Date();
    if (dataVendaObj > hoje) {
      return new Response(JSON.stringify({ 
        code: 'VALIDATION_ERROR',
        message: 'Data da venda não pode ser no futuro',
        errors: [{ field: 'dataVenda', message: 'Data inválida' }]
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Validação adicional: verificar que soma dos itens bate com valor total (se fornecido)
    const valorCalculado = produtos.reduce((sum, p) => sum + p.valorVenda, 0);
    if (rawBody.valorTotal && Math.abs(valorCalculado - rawBody.valorTotal) > 0.01) {
      return new Response(JSON.stringify({ 
        code: 'VALIDATION_ERROR',
        message: 'Soma dos produtos não corresponde ao valor total',
        errors: [{ field: 'valorTotal', message: 'Inconsistência nos valores' }]
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Extrair código e nome do colaborador do primeiro produto
    const codigoColaborador = produtos[0]?.codigoColaborador || null;
    const nomeColaborador = produtos[0]?.nomeColaborador || null;

    console.log('✅ Validação aprovada. Processando venda:', { codigoEmpresa, codigoVoucher, codigoVenda, codigoColaborador, nomeColaborador });

    // codigoEmpresa já vem limpo do Zod (sem formatação)
    const cnpjLimpo = codigoEmpresa;
    
    // Formatar CNPJ para busca (o banco pode ter formatado ou limpo)
    const cnpjFormatado = codigoEmpresa.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    
    // FASE 4: Cache de loja
    queryCount++;
    const storeCacheKey = `store:${networkId}:${cnpjLimpo}`;
    const { data: cachedStoreData } = await supabase.rpc('get_cache', { key: storeCacheKey });
    
    let storeData;
    if (cachedStoreData) {
      storeData = cachedStoreData;
      console.log('✅ Cache hit: store');
    } else {
      queryCount++;
      const { data: freshStoreData, error: storeError } = await supabase
        .from('stores')
        .select('id, loyalty_type, points_per_real, real_per_point, cashback_percentage, cashback_type, cashback_fixed_value, min_redeem_cashback, min_redeem_points, redemption_time_delay_enabled, redemption_time_delay_unit, redemption_time_delay_value, max_redemption_sale_percentage')
        .eq('network_id', networkId)
        .eq('status', 'active')
        .or(`cnpj.eq.${cnpjLimpo},cnpj.eq.${cnpjFormatado}`)
        .maybeSingle();

      if (storeError) {
        console.error('Erro ao buscar loja:', storeError);
        throw new Error(`Erro ao buscar loja: ${storeError.message}`);
      }

      if (!freshStoreData) {
        console.log('❌ Loja não encontrada - CNPJ:', cnpjLimpo, 'Network ID:', networkId);
        
        // Debug: verificar se existe em outra rede
        const { data: anyStore } = await supabase
          .from('stores')
          .select('id, name, network_id, status')
          .eq('cnpj', cnpjLimpo)
          .maybeSingle();
        
        if (anyStore) {
          console.log('⚠️ Loja existe mas:', {
            name: anyStore.name,
            status: anyStore.status,
            network_id: anyStore.network_id,
            expected_network: networkId
          });
        }
        
        throw new Error('Loja não encontrada ou inativa');
      }
      
      storeData = freshStoreData;
      
      // Cachear por 2 minutos (configurações podem mudar com frequência)
      await supabase.rpc('set_cache', { 
        key: storeCacheKey,
        value: storeData,
        ttl_seconds: 120
      });
      console.log('💾 Cache miss: store stored');
    }

    // codigoVoucher já vem limpo do Zod (sem formatação)
    const cpfLimpo = codigoVoucher;
    
    // FASE 4: Cache de cliente (TTL menor pois saldo muda frequentemente)
    queryCount++;
    const clientCacheKey = `client:${networkId}:${cpfLimpo}`;
    const { data: cachedClientData } = await supabase.rpc('get_cache', { key: clientCacheKey });
    
    let clientData;
    if (cachedClientData) {
      clientData = cachedClientData;
      console.log('✅ Cache hit: client');
    } else {
      // PASSO 1: Buscar cliente na rede atual
      queryCount++;
      const { data: clienteNaRede, error: clientError } = await supabase
        .from('clients')
        .select('id, total_points, auto_redemption_enabled, favorite_network_id')
        .eq('cpf', cpfLimpo)
        .eq('network_id', networkId)
        .maybeSingle();

      if (clientError) {
        throw new Error('Erro ao buscar cliente');
      }
      
      clientData = clienteNaRede;
      
      // PASSO 2: Se não encontrou na rede atual, buscar globalmente
      if (!clientData) {
        console.log('🔍 Cliente não encontrado na rede atual, buscando globalmente...');
        queryCount++;
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
          queryCount++;
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
            .select('id, total_points, auto_redemption_enabled, favorite_network_id')
            .single();
          
          if (insertError) {
            console.error('Erro ao criar registro do cliente na nova rede:', insertError);
            throw new Error('Erro ao associar cliente à nova rede');
          }
          
          clientData = novoRegistro;
          console.log('🎉 Cliente associado automaticamente à rede:', networkId);
        }
      }
      
      // Cachear por 2 minutos (menor TTL devido a mudanças frequentes)
      if (clientData) {
        await supabase.rpc('set_cache', { 
          key: clientCacheKey,
          value: clientData,
          ttl_seconds: 120
        });
        console.log('💾 Cache miss: client stored');
      }
    }

    // Calcular valor total
    const valorTotal = produtos.reduce((sum: number, p: any) => sum + parseFloat(p.valorVenda), 0);

    // 🎁 VERIFICAR PROMOÇÕES LEVA+ ONE
    let promocaoAplicada: any = null;
    let descontoPromocao = 0;
    
    if (clientData) {
      // Verificar se cliente tem assinatura ONE ativa
      queryCount++;
      const { data: subscription } = await supabase
        .from('client_subscriptions_one')
        .select('id, status')
        .eq('client_id', clientData.id)
        .eq('status', 'active')
        .maybeSingle();
      
      if (subscription) {
        console.log('🎯 Cliente tem assinatura ONE ativa, verificando promoções...');
        
        // Buscar promoções ativas para a rede
        queryCount++;
        const agora = new Date();
        const horaAtual = agora.toTimeString().split(' ')[0]; // HH:MM:SS
        
        const { data: promocoes } = await supabase
          .from('one_promotions')
          .select(`
            *,
            one_promotion_products (*),
            one_promotion_stores (*)
          `)
          .eq('network_id', networkId)
          .eq('is_active', true)
          .lte('start_date', agora.toISOString())
          .gte('end_date', agora.toISOString())
          .lte('start_time', horaAtual)
          .gte('end_time', horaAtual);
        
        // Filtrar apenas promoções que não atingiram o limite
        const promocoesFiltradas = promocoes?.filter(p => 
          !p.max_redemptions || p.current_redemptions < p.max_redemptions
        );
        
        console.log(`📦 Encontradas ${promocoesFiltradas?.length || 0} promoções ativas`);
        
        if (promocoesFiltradas && promocoesFiltradas.length > 0) {
          // Verificar cada promoção para ver se se aplica aos produtos da venda
          for (const promo of promocoesFiltradas) {
            // Verificar se a loja está na lista de lojas da promoção
            const lojaValida = promo.one_promotion_stores.some((ps: any) => 
              ps.store_id === storeData.id
            );
            
            if (!lojaValida) {
              console.log(`⏭️ Loja não participa da promoção: ${promo.name}`);
              continue;
            }
            
            // Verificar se algum produto da venda está na promoção
            const produtosPromo = promo.one_promotion_products.filter((pp: any) => !pp.is_reward);
            
            for (const produtoVenda of produtos) {
              const produtoMatch = produtosPromo.find((pp: any) => 
                pp.product_code === produtoVenda.codigoProduto
              );
              
              if (produtoMatch && produtoVenda.quantidade >= produtoMatch.quantity_required) {
                console.log(`🎉 Promoção aplicável encontrada: ${promo.name}`);
                
                // Calcular desconto baseado no tipo de promoção
                if (promo.promotion_type === 'buy_x_get_y') {
                  // Exemplo: Compre 1 Leve 2 = buy_quantity: 1, get_quantity: 2
                  // Cliente paga por 1 e leva 2, então desconto é 50% do valor total
                  const percentualDesconto = (promo.get_quantity - promo.buy_quantity) / promo.get_quantity;
                  descontoPromocao = produtoVenda.valorVenda * percentualDesconto;
                  
                  promocaoAplicada = {
                    id: promo.id,
                    name: promo.name,
                    type: promo.promotion_type,
                    desconto: descontoPromocao,
                    produto: {
                      codigo: produtoVenda.codigoProduto,
                      nome: produtoVenda.nomeProduto,
                      quantidade: produtoVenda.quantidade
                    }
                  };
                  
                  console.log(`💰 Desconto calculado: R$ ${descontoPromocao.toFixed(2)}`);
                  break;
                }
              }
            }
            
            if (promocaoAplicada) break;
          }
        }
      }
    }

    // Verificar se cliente não existe e preparar mensagem
    let mensagem = null;
    
    // FASE 5: Buscar template de mensagem do banco com cache
    if (!clientData && !promocaoAplicada) {
      // Cliente não encontrado - buscar template
      const templateCacheKey = 'msg_template:client_not_found';
      queryCount++;
      const { data: cachedTemplate } = await supabase.rpc('get_cache', { key: templateCacheKey });
      
      let templateText;
      if (cachedTemplate) {
        templateText = cachedTemplate.message_template;
        console.log('✅ Cache hit: message template client_not_found');
      } else {
        queryCount++;
        const { data: templateData } = await supabase
          .from('api_message_templates')
          .select('message_template')
          .eq('message_key', 'client_not_found')
          .eq('is_active', true)
          .maybeSingle();
        
        templateText = templateData?.message_template || 'O CPF digitado não consta em nossa base, vamos cadastrar para pontuar essa venda?';
        
        // Cachear por 5 minutos
        await supabase.rpc('set_cache', { 
          key: templateCacheKey,
          value: { message_template: templateText },
          ttl_seconds: 300
        });
        console.log('💾 Cache miss: message template stored');
      }
      
      mensagem = templateText;
      
      // Substituir tags
      mensagem = mensagem.replace(/{cpf}/g, codigoVoucher);
    }
    
    // Se aplicou promoção ONE, definir mensagem personalizada
    if (promocaoAplicada) {
      // Buscar nome completo do cliente
      queryCount++;
      const { data: clientInfo } = await supabase
        .from('clients')
        .select('full_name')
        .eq('id', clientData.id)
        .maybeSingle();
      
      // Pegar primeiro e segundo nome
      const nomeCompleto = clientInfo?.full_name || 'Cliente';
      const nomePartes = nomeCompleto.split(' ');
      const nomeCliente = nomePartes.length >= 2 
        ? `${nomePartes[0]} ${nomePartes[1]}` 
        : nomePartes[0];
      
      // Buscar código do cartão de fidelidade (últimos 4 dígitos do código do cliente)
      queryCount++;
      const { data: clientCode } = await supabase
        .from('clients')
        .select('codigo')
        .eq('id', clientData.id)
        .maybeSingle();
      
      const numeroCartao = clientCode?.codigo?.slice(-4) || '****';
      
      mensagem = `🎁 PROMOÇÃO LEVA+ ONE APLICADA!\n\n` +
                 `${promocaoAplicada.name}\n` +
                 `Cliente: ${nomeCliente}\n` +
                 `Cartão ONE: **** ${numeroCartao}\n\n` +
                 `Produto: ${promocaoAplicada.produto.nome}\n` +
                 `Desconto: R$ ${promocaoAplicada.desconto.toFixed(2)}\n\n` +
                 `⚠️ ATENÇÃO RESPONSÁVEL:\n` +
                 `Solicite ao cliente para mostrar o cartão virtual e um documento que comprove que é ele para ter o beneficio e finalizar a venda.`;
      
      console.log('🎁 Mensagem da promoção ONE:', mensagem);
    }

    // Determinar tipo de operação - SEMPRE R conforme webPosto
    let tipoCodigo = 'R'; // Sempre R, com valorCashBack = 0 ou valor calculado
    let valorCashBack = descontoPromocao || 0; // Usar desconto da promoção se houver
    let valorPorUnidadeDesconto = null;
    const tipoPagamento = [0]; // Todos os tipos de pagamento
    
    // Estrutura para retornar ambos os tipos
    let tiposDisponiveis = [
      {
        tipo: 'P', // Pontuação
        disponivel: true
      },
      {
        tipo: 'R', // Resgate
        disponivel: false,
        valorCashBack: 0
      }
    ];

    // Se cliente existe, tem saldo e RESGATE ATIVO habilitado
    if (clientData && clientData.auto_redemption_enabled) {
      const saldoCliente = parseFloat(clientData.total_points);
      const minimoResgate = storeData.loyalty_type === 'cashback' 
        ? parseFloat(storeData.min_redeem_cashback || 5) 
        : parseFloat(storeData.min_redeem_points || 100);

      // Se tem saldo acima do mínimo, verificar prazo de resgate
      if (saldoCliente >= minimoResgate) {
        let podeResgatar = true;
        let motivoBloqueio = '';

        // Verificar prazo para resgate se estiver configurado
        if (storeData.redemption_time_delay_enabled && storeData.redemption_time_delay_unit !== 'immediate') {
          queryCount++;
          const { data: ultimoAcumulo } = await supabase
            .from('transactions')
            .select('created_at')
            .eq('client_id', clientData.id)
            .eq('type', 'accumulation')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (ultimoAcumulo) {
            const dataUltimoAcumulo = new Date(ultimoAcumulo.created_at);
            const agora = new Date();
            const diferencaMs = agora.getTime() - dataUltimoAcumulo.getTime();

            let tempoEsperaMs = 0;
            if (storeData.redemption_time_delay_unit === 'hours') {
              tempoEsperaMs = (storeData.redemption_time_delay_value || 0) * 60 * 60 * 1000;
            } else if (storeData.redemption_time_delay_unit === 'days') {
              tempoEsperaMs = (storeData.redemption_time_delay_value || 0) * 24 * 60 * 60 * 1000;
            }

            if (diferencaMs < tempoEsperaMs) {
              podeResgatar = false;
              const tempoRestanteMs = tempoEsperaMs - diferencaMs;
              const horasRestantes = Math.ceil(tempoRestanteMs / (60 * 60 * 1000));
              const diasRestantes = Math.ceil(tempoRestanteMs / (24 * 60 * 60 * 1000));
              
              if (storeData.redemption_time_delay_unit === 'hours') {
                motivoBloqueio = `Aguarde ${horasRestantes} hora(s) após o último acúmulo para resgatar`;
              } else {
                motivoBloqueio = `Aguarde ${diasRestantes} dia(s) após o último acúmulo para resgatar`;
              }
              
              console.log('⏳ Prazo de resgate não atingido:', motivoBloqueio);
            }
          }
        }

        // Se já tem promoção ONE aplicada, não processar resgate de pontos/cashback
        if (!promocaoAplicada && podeResgatar) {
          // Verificar limite diário de resgate se houver configuração
          queryCount++;
          const hoje = new Date().toISOString().split('T')[0];
          const { data: resgatesHoje } = await supabase
            .from('transactions')
            .select('points, store_id')
            .eq('client_id', clientData.id)
            .eq('type', 'redemption')
            .gte('created_at', `${hoje}T00:00:00`)
            .lte('created_at', `${hoje}T23:59:59`);

          const totalResgatadoHoje = resgatesHoje?.reduce((sum, t) => sum + Math.abs(parseFloat(t.points)), 0) || 0;
          const limiteResgate = 1000; // TODO: Configurar no cadastro da loja

          if (totalResgatadoHoje >= limiteResgate) {
            podeResgatar = false;
            
            // Buscar template de mensagem de limite diário
            const templateCacheKey = 'msg_template:redemption_blocked_daily_limit';
            queryCount++;
            const { data: cachedTemplate } = await supabase.rpc('get_cache', { key: templateCacheKey });
            
            let templateText;
            if (cachedTemplate) {
              templateText = cachedTemplate.message_template;
              console.log('✅ Cache hit: message template redemption_blocked_daily_limit');
            } else {
              queryCount++;
              const { data: templateData } = await supabase
                .from('api_message_templates')
                .select('message_template')
                .eq('message_key', 'redemption_blocked_daily_limit')
                .eq('is_active', true)
                .maybeSingle();
              
              templateText = templateData?.message_template || 'Hoje seu resgate ultrapassou o limite diário, estaremos aguardando o Senhor(a) na próxima compra.';
              
              // Cachear por 5 minutos
              await supabase.rpc('set_cache', { 
                key: templateCacheKey,
                value: { message_template: templateText },
                ttl_seconds: 300
              });
              console.log('💾 Cache miss: message template stored');
            }
            
            mensagem = templateText;
            console.log('🚫 Limite diário de resgate atingido:', totalResgatadoHoje, '>=', limiteResgate);
          }
          
          if (podeResgatar) {
            tipoCodigo = 'R'; // Resgate
            
            // Aplicar limite de percentual máximo de resgate sobre a venda
            const maxRedemptionPct = parseFloat(storeData.max_redemption_sale_percentage || 100);
            const valorMaximoResgate = valorTotal * (maxRedemptionPct / 100);
            console.log(`📊 Limite de resgate: ${maxRedemptionPct}% = R$ ${valorMaximoResgate.toFixed(2)} sobre venda de R$ ${valorTotal.toFixed(2)}`);
            
            if (storeData.loyalty_type === 'cashback') {
              // Resgatar até o valor máximo permitido ou o saldo disponível
              valorCashBack = Math.min(saldoCliente, valorMaximoResgate);
            } else {
              // Para pontos, converter para valor em reais
              const realPorPonto = parseFloat(storeData.real_per_point || 0.01);
              valorCashBack = Math.min(saldoCliente * realPorPonto, valorMaximoResgate);
            }
            
            // Atualizar estrutura de tipos disponíveis
            tiposDisponiveis[1].disponivel = true;
            tiposDisponiveis[1].valorCashBack = valorCashBack;
          
          console.log('🔥 RESGATE AUTOMÁTICO ATIVADO - Cliente:', clientData.id, 'Valor:', valorCashBack);
          
          // Definir mensagem informando o resgate
          const saldoFormatado = storeData.loyalty_type === 'cashback' 
            ? `R$ ${saldoCliente.toFixed(2)}` 
            : `${saldoCliente.toFixed(0)} pontos`;
          
          const templateCacheKey = 'msg_template:redemption_active';
          queryCount++;
          const { data: cachedTemplate } = await supabase.rpc('get_cache', { key: templateCacheKey });
          
          let templateText;
          if (cachedTemplate) {
            templateText = cachedTemplate.message_template;
            console.log('✅ Cache hit: message template redemption_active');
          } else {
            queryCount++;
            const { data: templateData } = await supabase
              .from('api_message_templates')
              .select('message_template')
              .eq('message_key', 'redemption_active')
              .eq('is_active', true)
              .maybeSingle();
            
            templateText = templateData?.message_template || 'Seu saldo de {tipo} é de {saldo}, vamos realizar o resgate nessa venda.';
            
            // Cachear por 5 minutos
            await supabase.rpc('set_cache', { 
              key: templateCacheKey,
              value: { message_template: templateText },
              ttl_seconds: 300
            });
            console.log('💾 Cache miss: message template stored');
          }
          
          const tipoResgate = storeData.loyalty_type === 'cashback' ? 'cashback' : 'pontos';
          mensagem = templateText
            .replace(/{saldo}/g, saldoFormatado)
            .replace(/{tipo}/g, tipoResgate);
          
          console.log('📊 Mensagem de resgate ativo:', mensagem);
          
          // NOTA: O desligamento automático agora é feito em venda-enviar após o resgate ser efetivado
          }
        } else if (motivoBloqueio) {
          // Não pode resgatar por causa do prazo - buscar template
          const templateCacheKey = 'msg_template:redemption_blocked_time_delay';
          queryCount++;
          const { data: cachedTemplate } = await supabase.rpc('get_cache', { key: templateCacheKey });
          
          let templateText;
          if (cachedTemplate) {
            templateText = cachedTemplate.message_template;
            console.log('✅ Cache hit: message template redemption_blocked_time_delay');
          } else {
            queryCount++;
            const { data: templateData } = await supabase
              .from('api_message_templates')
              .select('message_template')
              .eq('message_key', 'redemption_blocked_time_delay')
              .eq('is_active', true)
              .maybeSingle();
            
            templateText = templateData?.message_template || 'O resgate dos seus pontos ou cashback só podem ser utilizados em {prazo}';
            
            // Cachear por 5 minutos
            await supabase.rpc('set_cache', { 
              key: templateCacheKey,
              value: { message_template: templateText },
              ttl_seconds: 300
            });
            console.log('💾 Cache miss: message template stored');
          }
          
          // Formatar prazo de acordo com a configuração
          let prazoFormatado = '';
          if (storeData.redemption_time_delay_unit === 'hours') {
            prazoFormatado = `${storeData.redemption_time_delay_value} hora(s)`;
          } else if (storeData.redemption_time_delay_unit === 'days') {
            prazoFormatado = `${storeData.redemption_time_delay_value} dia(s)`;
          }
          
          mensagem = templateText.replace(/{prazo}/g, prazoFormatado);
        }
      } else if (!promocaoAplicada) {
        // Saldo abaixo do mínimo - mostrar mensagem de acúmulo (só se não tiver promoção ONE)
        console.log('💰 Saldo abaixo do mínimo para resgate automático:', saldoCliente, '<', minimoResgate);
        
        const messageKey = storeData.loyalty_type === 'cashback' 
          ? 'cashback_accumulated_success' 
          : 'points_accumulated_success';
        
        const templateCacheKey = `msg_template:${messageKey}`;
        queryCount++;
        const { data: cachedTemplate } = await supabase.rpc('get_cache', { key: templateCacheKey });
        
        let templateText;
        if (cachedTemplate) {
          templateText = cachedTemplate.message_template;
          console.log(`✅ Cache hit: message template ${messageKey}`);
        } else {
          queryCount++;
          const { data: templateData } = await supabase
            .from('api_message_templates')
            .select('message_template')
            .eq('message_key', messageKey)
            .eq('is_active', true)
            .maybeSingle();
          
          const defaultMessage = storeData.loyalty_type === 'cashback'
            ? 'Cashback acumulado com sucesso.'
            : 'Pontos acumulados com sucesso.';
          
          templateText = templateData?.message_template || defaultMessage;
          
          // Cachear por 5 minutos
          await supabase.rpc('set_cache', { 
            key: templateCacheKey,
            value: { message_template: templateText },
            ttl_seconds: 300
          });
          console.log('💾 Cache miss: message template stored');
        }
        
        mensagem = templateText;
        console.log('✅ Acúmulo de ' + (storeData.loyalty_type === 'cashback' ? 'cashback' : 'pontos') + ' - saldo insuficiente para resgate');
      }
    } else if (clientData && !clientData.auto_redemption_enabled && !promocaoAplicada) {
      // Cliente existe mas não tem resgate ativo - SEMPRE mostrar mensagem com saldo (só se não tiver promoção ONE)
      console.log('🔍 Cliente sem resgate ativo detectado');
      const saldoCliente = parseFloat(clientData.total_points);
      const minimoResgate = storeData.loyalty_type === 'cashback' 
        ? parseFloat(storeData.min_redeem_cashback || 5) 
        : parseFloat(storeData.min_redeem_points || 100);
      
      console.log(`💰 Saldo: ${saldoCliente}, Mínimo: ${minimoResgate}`);
      
      // Se tem saldo suficiente, mostrar mensagem convidando para ativar resgate
      if (saldoCliente >= minimoResgate) {
        console.log('✅ SALDO SUFICIENTE - Mostrando convite para ativar resgate');
        const saldoFormatado = storeData.loyalty_type === 'cashback' 
          ? `R$ ${saldoCliente.toFixed(2)}` 
          : `${saldoCliente.toFixed(0)} pontos`;
        
        const templateCacheKey = 'msg_template:client_without_auto_redemption';
        queryCount++;
        const { data: cachedTemplate } = await supabase.rpc('get_cache', { key: templateCacheKey });
        
        let templateText;
        if (cachedTemplate) {
          templateText = cachedTemplate.message_template;
          console.log('✅ Cache hit: message template client_without_auto_redemption');
        } else {
          queryCount++;
          const { data: templateData } = await supabase
            .from('api_message_templates')
            .select('message_template')
            .eq('message_key', 'client_without_auto_redemption')
            .eq('is_active', true)
            .maybeSingle();
          
          templateText = templateData?.message_template || 'Seu saldo é {saldo}. Vamos resgatar? Basta ativar no seu portal cliente o resgate.';
          
          // Cachear por 5 minutos
          await supabase.rpc('set_cache', { 
            key: templateCacheKey,
            value: { message_template: templateText },
            ttl_seconds: 300
          });
          console.log('💾 Cache miss: message template stored');
        }
        
        mensagem = templateText;
        
        // Substituir tags
        mensagem = mensagem
          .replace(/{saldo}/g, saldoFormatado)
          .replace(/{nome}/g, clientData.full_name || '')
          .replace(/{cpf}/g, codigoVoucher);
        
        console.log('📊 Mensagem gerada:', mensagem);
      } else {
        console.log('⚠️ SALDO INSUFICIENTE - Mostrando mensagem de acúmulo');
        // Saldo insuficiente, mostrar mensagem de acúmulo
        const messageKey = storeData.loyalty_type === 'cashback' 
          ? 'cashback_accumulated_success' 
          : 'points_accumulated_success';
        
        const templateCacheKey = `msg_template:${messageKey}`;
        queryCount++;
        const { data: cachedTemplate } = await supabase.rpc('get_cache', { key: templateCacheKey });
        
        let templateText;
        if (cachedTemplate) {
          templateText = cachedTemplate.message_template;
          console.log(`✅ Cache hit: message template ${messageKey}`);
        } else {
          queryCount++;
          const { data: templateData } = await supabase
            .from('api_message_templates')
            .select('message_template')
            .eq('message_key', messageKey)
            .eq('is_active', true)
            .maybeSingle();
          
          const defaultMessage = storeData.loyalty_type === 'cashback'
            ? 'Cashback acumulado com sucesso.'
            : 'Pontos acumulados com sucesso.';
          
          templateText = templateData?.message_template || defaultMessage;
          
          // Cachear por 5 minutos
          await supabase.rpc('set_cache', { 
            key: templateCacheKey,
            value: { message_template: templateText },
            ttl_seconds: 300
          });
          console.log('💾 Cache miss: message template stored');
        }
        
        mensagem = templateText;
        console.log('✅ Acúmulo de ' + (storeData.loyalty_type === 'cashback' ? 'cashback' : 'pontos') + ' - sem resgate ativo');
      }
    }

    // Gerar ID de transação único
    const idTransacao = crypto.randomUUID().replace(/-/g, '').substring(0, 16);

    // Converter data/hora para timestamp com timezone do Brasil (GMT-3)
    // dataVenda já vem no formato YYYY-MM-DD do Zod
    // horaVenda já vem no formato HH:MM:SS do Zod  
    const dataVendaISO = `${dataVenda}T${horaVenda}-03:00`; // Combina data + hora + timezone Brasil

    console.log('Preparando para inserir transação:', {
      idTransacao,
      networkId,
      storeId: storeData.id,
      clientId: clientData?.id || null,
      dataVendaISO
    });

    // Salvar transação pendente
    const { data: txInsert, error: txInsertError } = await supabase
      .from('webposto_transactions')
      .insert({
        id_transacao: idTransacao,
        network_id: networkId,
        store_id: storeData.id,
        client_id: clientData?.id || null,
        codigo_empresa: codigoEmpresa,
        codigo_voucher: codigoVoucher,
        codigo_venda: codigoVenda,
        tipo_codigo: tipoCodigo,
        valor_cashback: valorCashBack,
        valor_desconto_unitario: valorPorUnidadeDesconto,
        status: 'pending',
        produtos: produtos,
        data_venda: dataVendaISO,
        codigo_colaborador: codigoColaborador || null,
        nome_colaborador: nomeColaborador || null,
        ...(promocaoAplicada && {
          metadata: {
            promocao_one: {
              id: promocaoAplicada.id,
              name: promocaoAplicada.name,
              desconto: promocaoAplicada.desconto,
              produto: promocaoAplicada.produto
            }
          }
        })
      })
      .select()
      .single();

    if (txInsertError) {
      console.error('Erro ao inserir transação:', txInsertError);
      throw new Error(`Erro ao criar transação: ${txInsertError.message}`);
    }

    console.log('Transação validada e salva com sucesso:', idTransacao, txInsert);

    // FASE 2: Log estruturado
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      event: 'transaction_validated',
      endpoint,
      duration_ms: duration,
      queries_count: queryCount,
      status: 'success',
      network_id: networkId,
      store_id: storeData.id,
      client_id: clientData?.id || null,
      transaction_type: tipoCodigo,
      valor_total: valorTotal
    }));

    // Ecoar codigoSequencia e valorUnitario nos produtos da resposta
    const produtosResponse = produtos.map((p: any, index: number) => ({
      codigoSequencia: p.codigoSequencia ?? (index + 1),
      codigoProduto: p.codigoProduto,
      nomeProduto: p.nomeProduto,
      valorVenda: p.valorVenda,
      quantidade: p.quantidade,
      valorUnitario: p.valorUnitario ?? null,
      codigoColaborador: p.codigoColaborador ?? null,
      nomeColaborador: p.nomeColaborador ?? null,
    }));

    return new Response(
      JSON.stringify({
        idTransacao,
        tipoCodigo,
        valorCashBack,
        valorPorUnidadeDesconto,
        mensagemErro: null,
        mensagem,
        mensagemFrentista: mensagem,
        tipoPagamento,
        produtos: produtosResponse,
        // Sempre retorna ambos os tipos, com R=0 quando não houver resgate
        tiposDisponiveis: tiposDisponiveis.map(t => ({
          tipo: t.tipo,
          ...(t.tipo === 'R' && { valorCashBack: t.valorCashBack || 0 })
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // FASE 2: Log de erro estruturado
    const duration = Date.now() - startTime;
    console.error(JSON.stringify({
      event: 'transaction_validation_error',
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
        code: 'VALIDATION_ERROR',
        message: errorMessage 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
