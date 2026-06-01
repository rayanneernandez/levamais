import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Calcula dígito verificador Luhn
function calculateLuhn(digits: string): string {
  const arr = digits.split('').reverse().map(Number);
  let sum = 0;
  
  for (let i = 0; i < arr.length; i++) {
    let digit = arr[i];
    if (i % 2 === 0) { // Posições pares (0, 2, 4...)
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit.toString();
}

// Hash determinístico para gerar tail
async function generateDeterministicTail(
  salt: string,
  clientId: string,
  memberSince: string,
  prefix: string,
  length: number
): Promise<string> {
  const data = `${salt}${clientId}${memberSince}${prefix}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  
  // Converter hash para dígitos
  const digits = hashArray.map(b => b % 10).join('');
  return digits.slice(0, length);
}

// Gera número de cartão de 16 dígitos
async function generateCardNumber(
  countryCode: string,
  ddd: string,
  clientCode: string,
  memberSince: string, // YYYY-MM-DD
  seq: number,
  clientId: string
): Promise<string> {
  const SALT = Deno.env.get('CARD_GENERATION_SALT') || 'leva-mais-one-secret-2025';
  
  // 1. Concatenar prefix (country + ddd)
  const prefix = countryCode + ddd;
  
  // 2. Preparar client_code (pad com zeros à esquerda até 4 dígitos)
  let clientCodeDigits = clientCode.padStart(4, '0');
  
  // 3. Converter member_since para YYMMDD
  const date = new Date(memberSince);
  const yy = date.getFullYear().toString().slice(-2);
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  const memberSinceDigits = yy + mm + dd;
  
  // 4. Seq (1 dígito)
  const seqDigit = (seq % 10).toString();
  
  // 5. Montar payload de 15 dígitos
  let payload = '';
  let remainingSpace = 15;
  
  // Função auxiliar para adicionar campo
  const addField = (field: string) => {
    if (remainingSpace <= 0) return;
    
    const toAdd = Math.min(field.length, remainingSpace);
    payload += field.slice(0, toAdd);
    remainingSpace -= toAdd;
    
    // Se sobrou campo, guardar para o tail
    if (field.length > toAdd) {
      return field.slice(toAdd);
    }
    return '';
  };
  
  // Adicionar campos na ordem de prioridade
  const prefixRest = addField(prefix);
  const clientCodeRest = addField(clientCodeDigits);
  const memberSinceRest = addField(memberSinceDigits);
  const seqRest = addField(seqDigit);
  
  // 6. Preencher espaço restante com tail determinístico
  if (remainingSpace > 0) {
    // Incluir restos dos campos no tail_source
    const overflow = (prefixRest || '') + (clientCodeRest || '') + (memberSinceRest || '') + (seqRest || '');
    const tail = await generateDeterministicTail(SALT + overflow, clientId, memberSince, prefix, remainingSpace);
    payload += tail.slice(0, remainingSpace);
  }
  
  // 7. Calcular Luhn sobre os 15 dígitos
  const luhnDigit = calculateLuhn(payload);
  
  // 8. Retornar 16 dígitos
  return payload + luhnDigit;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clientId } = await req.json();

    if (!clientId) {
      throw new Error('clientId é obrigatório');
    }

    // Buscar dados do cliente
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('codigo, cpf, one_member_since, favorite_network_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      throw new Error('Cliente não encontrado');
    }

    if (!client.one_member_since) {
      throw new Error('Cliente não é membro ONE');
    }

    // Verificar se já existe cartão
    const { data: existingCard } = await supabase
      .from('one_card_numbers')
      .select('card_number')
      .eq('client_id', clientId)
      .single();

    if (existingCard) {
      return new Response(
        JSON.stringify({ 
          cardNumber: existingCard.card_number,
          alreadyExists: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extrair DDD do CPF ou usar padrão
    const cpf = client.cpf || '';
    const ddd = cpf.slice(0, 2) || '11'; // Fallback para DDD 11 (SP)

    // Extrair código numérico do cliente (remover CLI- prefix)
    const clientCode = client.codigo?.replace(/\D/g, '') || '1';

    // Contar quantos cartões existentes para usar como seq
    const { count } = await supabase
      .from('one_card_numbers')
      .select('*', { count: 'exact', head: true });

    const seq = (count || 0) % 10;

    // Gerar número do cartão
    const cardNumber = await generateCardNumber(
      '55', // Brasil
      ddd,
      clientCode,
      client.one_member_since,
      seq,
      clientId
    );

    console.log(`Cartão gerado para cliente ${clientId}: ${cardNumber}`);

    // Inserir na tabela
    const { error: insertError } = await supabase
      .from('one_card_numbers')
      .insert({
        client_id: clientId,
        card_number: cardNumber,
        issued_at: client.one_member_since
      });

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({ 
        cardNumber,
        success: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao gerar número do cartão:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
