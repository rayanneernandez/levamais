import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Imagem não fornecida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY não configurada");
      return new Response(
        JSON.stringify({ error: "Configuração de API inválida" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Iniciando OCR do cupom fiscal...");

    // Usar Gemini Flash para OCR (multimodal)
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em extrair dados de cupons fiscais brasileiros (NFC-e, NF-e, cupom fiscal).
Analise a imagem e extraia APENAS os seguintes dados no formato JSON:
{
  "totalValue": número decimal do valor total (ex: 150.50),
  "cnpj": string com 14 dígitos do CNPJ (só números),
  "razaoSocial": nome/razão social do estabelecimento,
  "accessKey": chave de acesso de 44 dígitos se visível,
  "documentNumber": número do documento/nota,
  "date": data da emissão no formato YYYY-MM-DD,
  "items": array de objetos {descricao, quantidade, valorTotal} dos produtos (máximo 10 itens)
}
IMPORTANTE: 
- Retorne APENAS o JSON válido, sem explicações
- Use null para campos não encontrados
- O valor total é geralmente o maior valor no final do cupom
- Não invente dados que não estão visíveis`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extraia os dados deste cupom fiscal:"
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:") 
                    ? imageBase64 
                    : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1, // Baixa temperatura para respostas mais precisas
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro na API Lovable AI:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes para OCR." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Erro ao processar imagem" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content;

    if (!content) {
      console.error("Resposta vazia da IA");
      return new Response(
        JSON.stringify({ error: "Não foi possível extrair dados da imagem" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Resposta da IA:", content);

    // Tentar parsear o JSON da resposta
    let extractedData;
    try {
      // Remover possíveis markdown code blocks
      const cleanContent = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      extractedData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Erro ao parsear resposta:", parseError, "Content:", content);
      return new Response(
        JSON.stringify({ 
          error: "Não foi possível interpretar os dados do cupom",
          rawContent: content 
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Dados extraídos:", extractedData);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          totalValue: extractedData.totalValue || null,
          cnpj: extractedData.cnpj?.replace(/\D/g, "") || null,
          razaoSocial: extractedData.razaoSocial || null,
          accessKey: extractedData.accessKey?.replace(/\D/g, "") || null,
          documentNumber: extractedData.documentNumber || null,
          date: extractedData.date || null,
          items: Array.isArray(extractedData.items) ? extractedData.items.slice(0, 10) : [],
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro no OCR:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
