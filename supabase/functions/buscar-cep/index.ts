// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cep } = await req.json();
    
    // Validate cep is a string
    if (typeof cep !== 'string') {
      return new Response(
        JSON.stringify({ error: "CEP deve ser uma string" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Check length before processing
    if (cep.length > 15) {
      return new Response(
        JSON.stringify({ error: "CEP inválido" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Remove formatação do CEP
    const cepLimpo = cep.replace(/\D/g, '');

    // Validate cleaned CEP has exactly 8 digits
    if (cepLimpo.length !== 8) {
      return new Response(
        JSON.stringify({ error: "CEP deve conter 8 dígitos" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`Buscando dados do CEP: ${cepLimpo}`);

    // Usar BrasilAPI para buscar dados do CEP
    const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cepLimpo}`);

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ error: "CEP não encontrado" }),
          { 
            status: 404, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
      throw new Error(`Erro na API: ${response.status}`);
    }

    const data = await response.json();

    console.log("Dados recebidos da BrasilAPI:", data);

    // Formatar os dados para retornar
    const dadosFormatados = {
      cep: data.cep,
      logradouro: data.street,
      bairro: data.neighborhood,
      municipio: data.city,
      uf: data.state,
    };

    return new Response(
      JSON.stringify(dadosFormatados),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error("Erro ao buscar CEP:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao buscar dados do CEP" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
