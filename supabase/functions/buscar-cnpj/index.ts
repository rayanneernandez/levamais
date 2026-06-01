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
    const { cnpj } = await req.json();
    
    // Validate cnpj is a string
    if (typeof cnpj !== 'string') {
      return new Response(
        JSON.stringify({ error: "CNPJ deve ser uma string" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Check length before processing
    if (cnpj.length > 20) {
      return new Response(
        JSON.stringify({ error: "CNPJ inválido" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Remove formatação do CNPJ
    const cnpjLimpo = cnpj.replace(/\D/g, '');

    // Validate cleaned CNPJ has exactly 14 digits
    if (cnpjLimpo.length !== 14) {
      return new Response(
        JSON.stringify({ error: "CNPJ deve conter 14 dígitos" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`Buscando dados do CNPJ: ${cnpjLimpo}`);

    // Usar BrasilAPI para buscar dados do CNPJ
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ error: "CNPJ não encontrado" }),
          { 
            status: 404, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
      throw new Error(`Erro na API: ${response.status}`);
    }

    const data = await response.json();

    console.log("Dados recebidos da BrasilAPI:", JSON.stringify({
      razao_social: data.razao_social,
      nome_fantasia: data.nome_fantasia,
      descricao_tipo_de_logradouro: data.descricao_tipo_de_logradouro,
      logradouro: data.logradouro
    }));

    // Formatar os dados para retornar
    const dadosFormatados = {
      cnpj: data.cnpj,
      razao_social: data.razao_social || data.nome_fantasia || "",
      nome_fantasia: data.nome_fantasia || data.razao_social || "",
      logradouro: data.descricao_tipo_de_logradouro 
        ? `${data.descricao_tipo_de_logradouro} ${data.logradouro}`.trim()
        : data.logradouro,
      numero: data.numero,
      complemento: data.complemento,
      bairro: data.bairro,
      municipio: data.municipio,
      uf: data.uf,
      cep: data.cep,
      ddd_telefone_1: data.ddd_telefone_1,
      email: data.email,
    };

    return new Response(
      JSON.stringify(dadosFormatados),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error("Erro ao buscar CNPJ:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao buscar dados do CNPJ" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
