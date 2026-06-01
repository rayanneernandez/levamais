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

    // Buscar clientes ONE que não têm cartão
    const { data: clientsWithoutCard, error: clientsError } = await supabase
      .from('clients')
      .select('id, codigo, cpf, one_member_since')
      .eq('is_one_member', true)
      .not('one_member_since', 'is', null);

    if (clientsError) throw clientsError;

    // Verificar quais já têm cartão
    const { data: existingCards } = await supabase
      .from('one_card_numbers')
      .select('client_id');

    const existingCardClientIds = new Set(existingCards?.map(c => c.client_id) || []);
    
    const clientsNeedingCard = clientsWithoutCard?.filter(
      c => !existingCardClientIds.has(c.id)
    ) || [];

    console.log(`Encontrados ${clientsNeedingCard.length} clientes sem cartão`);

    const results = {
      total: clientsNeedingCard.length,
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Gerar cartão para cada cliente
    for (const client of clientsNeedingCard) {
      try {
        const { data, error } = await supabase.functions.invoke('generate-one-card-number', {
          body: { clientId: client.id }
        });

        if (error) {
          results.failed++;
          results.errors.push(`Cliente ${client.codigo}: ${error.message}`);
        } else {
          results.success++;
          console.log(`✓ Cartão gerado para ${client.codigo}: ${data.cardNumber}`);
        }
      } catch (err) {
        results.failed++;
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        results.errors.push(`Cliente ${client.codigo}: ${errorMsg}`);
      }
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
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
