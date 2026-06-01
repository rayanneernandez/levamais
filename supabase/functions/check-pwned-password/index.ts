import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password } = await req.json();

    if (!password) {
      throw new Error('Senha é obrigatória');
    }

    // Gerar SHA-1 hash da senha
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    // Usar k-anonymity: enviar apenas os primeiros 5 caracteres
    const prefix = hashHex.substring(0, 5);
    const suffix = hashHex.substring(5);

    // Consultar API HIBP
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'User-Agent': 'LevaMais-Fidelidade-App',
      },
    });

    if (!response.ok) {
      throw new Error('Erro ao consultar API de senhas vazadas');
    }

    const text = await response.text();
    const hashes = text.split('\n');

    // Verificar se o hash está na lista
    let timesFound = 0;
    for (const line of hashes) {
      const [hashSuffix, count] = line.split(':');
      if (hashSuffix.trim() === suffix) {
        timesFound = parseInt(count.trim(), 10);
        break;
      }
    }

    return new Response(
      JSON.stringify({
        isPwned: timesFound > 0,
        timesFound,
        severity: timesFound > 100000 ? 'critical' : timesFound > 10000 ? 'high' : timesFound > 1000 ? 'medium' : 'low',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Erro em check-pwned-password:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
