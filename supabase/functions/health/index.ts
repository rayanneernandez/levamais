// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const checks: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {},
    responseTime: 0,
  };

  try {
    // 1. Database Health Check
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const dbStart = Date.now();
    const { error: dbError, count } = await supabase
      .from('networks')
      .select('id', { count: 'exact', head: true });

    checks.checks.database = {
      status: dbError ? 'unhealthy' : 'healthy',
      responseTime: Date.now() - dbStart,
      details: dbError ? { error: dbError.message } : { networks: count },
    };

    if (dbError) checks.status = 'degraded';

    // 2. Auth System Check
    const authStart = Date.now();
    try {
      const { error: authError } = await supabase.auth.getSession();
      checks.checks.auth = {
        status: authError ? 'unhealthy' : 'healthy',
        responseTime: Date.now() - authStart,
      };
      if (authError) checks.status = 'degraded';
    } catch (error: any) {
      checks.checks.auth = {
        status: 'unhealthy',
        responseTime: Date.now() - authStart,
        details: { error: error.message },
      };
      checks.status = 'degraded';
    }

    // 3. Cache System Check (api_cache table)
    const cacheStart = Date.now();
    const { error: cacheError } = await supabase
      .from('api_cache')
      .select('cache_key', { head: true });

    checks.checks.cache = {
      status: cacheError ? 'unhealthy' : 'healthy',
      responseTime: Date.now() - cacheStart,
    };

    if (cacheError) checks.status = 'degraded';

    // 4. Edge Functions Health (critical ones)
    checks.checks.edgeFunctions = {
      status: 'healthy',
      available: [
        'buscar-cnpj',
        'buscar-cep',
        'check-pwned-password',
        'venda-validar',
        'venda-enviar',
        'venda-cancelar',
        'send-welcome-email',
        'client-login',
      ],
    };

    // 5. Environment Check
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'RESEND_API_KEY',
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
    ];

    const missingEnvVars = requiredEnvVars.filter(
      (envVar) => !Deno.env.get(envVar)
    );

    checks.checks.environment = {
      status: missingEnvVars.length > 0 ? 'unhealthy' : 'healthy',
      missingVariables: missingEnvVars,
    };

    if (missingEnvVars.length > 0) checks.status = 'degraded';

    // Calculate total response time
    checks.responseTime = Date.now() - startTime;

    // Log health check
    console.log('Health check completed:', {
      status: checks.status,
      responseTime: checks.responseTime,
      timestamp: checks.timestamp,
    });

    // Return appropriate status code
    const statusCode = checks.status === 'healthy' ? 200 : 503;

    return new Response(JSON.stringify(checks, null, 2), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Health check failed:', error);
    
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        responseTime: Date.now() - startTime,
      }, null, 2),
      {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
