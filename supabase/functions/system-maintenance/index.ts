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

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'health';

    if (action === 'cleanup') {
      // Limpar cache expirado
      await supabase.rpc('cleanup_expired_cache');
      
      // Limpar rate limits antigos (> 1 hora)
      await supabase.rpc('cleanup_old_rate_limits');

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Limpeza realizada com sucesso'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'health') {
      // Health check ultra-rápido - apenas ping no banco
      const startTime = Date.now();
      
      try {
        // Query mais simples possível - apenas verifica conexão
        await supabase.rpc('get_cache', { key: '_health_check_' });
        const duration = Date.now() - startTime;

        return new Response(
          JSON.stringify({ 
            status: 'healthy',
            duration_ms: duration,
            timestamp: new Date().toISOString()
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        const duration = Date.now() - startTime;
        return new Response(
          JSON.stringify({ 
            status: 'unhealthy',
            duration_ms: duration,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          }),
          { 
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    if (action === 'stats') {
      // Estatísticas do sistema
      const { count: cacheCount } = await supabase
        .from('api_cache')
        .select('id', { count: 'exact', head: true });

      const { count: rateLimitCount } = await supabase
        .from('api_rate_limits')
        .select('id', { count: 'exact', head: true });

      const { count: recentTransactionsCount } = await supabase
        .from('webposto_transactions')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 3600000).toISOString()); // Última hora

      return new Response(
        JSON.stringify({ 
          cache_entries: cacheCount || 0,
          rate_limit_entries: rateLimitCount || 0,
          transactions_last_hour: recentTransactionsCount || 0,
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        error: 'Ação inválida. Use: ?action=cleanup, ?action=health ou ?action=stats'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro em system-maintenance:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
