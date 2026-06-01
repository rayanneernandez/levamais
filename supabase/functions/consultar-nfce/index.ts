import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface NFCeData {
  cpf?: string;
  cnpj?: string;
  razaoSocial?: string;
  totalValue?: number;
  items?: Array<{
    descricao: string;
    quantidade: number;
    unidade: string;
    valorUnitario: number;
    valorTotal: number;
  }>;
  dataEmissao?: string;
  numeroNota?: string;
  chaveAcesso?: string;
  serie?: string;
  modelo?: string;
  uf?: string;
  ambiente?: string;
  fromCache?: boolean;
  error?: string;
}

// Extrai dados diretamente da chave de acesso (44 dígitos)
// Formato: UUAAMM CNPJ14 MOD SERIE NUM TEMISSÃO CNUMERICO DV
// Posições: 0-1 UF | 2-5 AAMM | 6-19 CNPJ | 20-21 Modelo | 22-24 Série | 25-33 Número | 34 Tipo | 35-42 Código | 43 DV
function parseAccessKey(chaveAcesso: string): Partial<NFCeData> {
  if (!chaveAcesso || chaveAcesso.length !== 44) {
    return {};
  }

  const ufCode = chaveAcesso.substring(0, 2);
  const aamm = chaveAcesso.substring(2, 6);
  const cnpj = chaveAcesso.substring(6, 20);
  const modelo = chaveAcesso.substring(20, 22);
  const serie = chaveAcesso.substring(22, 25);
  const numero = chaveAcesso.substring(25, 34);

  // Mapeia código UF para sigla
  const ufMap: Record<string, string> = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA",
    "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE",
    "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE",
    "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
    "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT",
    "52": "GO", "53": "DF",
  };

  return {
    chaveAcesso,
    uf: ufMap[ufCode] || ufCode,
    dataEmissao: `20${aamm.substring(0, 2)}-${aamm.substring(2, 4)}`,
    cnpj,
    modelo: modelo === "65" ? "NFC-e" : modelo === "55" ? "NF-e" : modelo,
    serie: parseInt(serie, 10).toString(),
    numeroNota: parseInt(numero, 10).toString(),
  };
}

// Extrai chave de acesso de uma URL de QR Code
function extractAccessKeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pParam = urlObj.searchParams.get("p") || urlObj.searchParams.get("P") || "";
    const parts = pParam.split("|");
    
    if (parts.length > 0) {
      const key = parts[0].replace(/\D/g, "");
      if (key.length === 44) {
        return key;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Extrai ambiente e versão do QR Code
function extractQRCodeMetadata(url: string): { ambiente?: string; versao?: string } {
  try {
    const urlObj = new URL(url);
    const pParam = urlObj.searchParams.get("p") || urlObj.searchParams.get("P") || "";
    const parts = pParam.split("|");
    
    // Formato: chave|versao|ambiente|csc|hash
    if (parts.length >= 3) {
      const versao = parts[1];
      const ambiente = parts[2] === "1" ? "Produção" : parts[2] === "2" ? "Homologação" : parts[2];
      return { versao, ambiente };
    }
    return {};
  } catch {
    return {};
  }
}

// Cache em memória simples (em produção, usar Redis ou Supabase)
const cache = new Map<string, { data: NFCeData; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // consultas por minuto
const RATE_WINDOW = 60 * 1000; // 1 minuto

function checkRateLimit(clientId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(clientId);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(clientId, { count: 1, resetAt: now + RATE_WINDOW });
    return { allowed: true };
  }

  if (record.count >= RATE_LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
  }

  record.count++;
  return { allowed: true };
}

function getCached(chaveAcesso: string): NFCeData | null {
  const entry = cache.get(chaveAcesso);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(chaveAcesso);
    return null;
  }
  
  return { ...entry.data, fromCache: true };
}

function setCache(chaveAcesso: string, data: NFCeData): void {
  cache.set(chaveAcesso, { data, timestamp: Date.now() });
  
  // Limpa entradas antigas (máximo 1000 entradas)
  if (cache.size > 1000) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, chaveAcesso, clientId = "anonymous" } = await req.json();

    // Rate limiting
    const rateCheck = checkRateLimit(clientId);
    if (!rateCheck.allowed) {
      console.log(`Rate limit exceeded for ${clientId}`);
      return new Response(
        JSON.stringify({ 
          error: `Limite de consultas excedido. Tente novamente em ${rateCheck.retryAfter} segundos.`,
          retryAfter: rateCheck.retryAfter,
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": String(rateCheck.retryAfter),
          } 
        }
      );
    }

    // Extrai chave de acesso
    let accessKey = chaveAcesso;
    if (!accessKey && url) {
      accessKey = extractAccessKeyFromUrl(url);
    }

    if (!accessKey || accessKey.length !== 44) {
      return new Response(
        JSON.stringify({ 
          error: "Chave de acesso inválida. A chave deve ter 44 dígitos.",
          chaveAcesso: accessKey,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Consultando NFC-e: ${accessKey.substring(0, 10)}...`);

    // Verifica cache
    const cached = getCached(accessKey);
    if (cached) {
      console.log("Retornando dados do cache");
      return new Response(
        JSON.stringify(cached),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extrai dados da chave de acesso
    const keyData = parseAccessKey(accessKey);
    
    // Extrai metadados do QR Code (se URL foi fornecida)
    const qrMetadata = url ? extractQRCodeMetadata(url) : {};

    // Monta resposta com dados extraídos da chave
    // NOTA: O valor total NÃO está disponível na chave de acesso
    // Precisa ser informado manualmente ou via integração com WebService SEFAZ
    const nfceData: NFCeData = {
      ...keyData,
      ambiente: qrMetadata.ambiente,
      // totalValue: undefined - não disponível sem WebService oficial
    };

    // Armazena no cache
    setCache(accessKey, nfceData);

    console.log("Dados extraídos da chave:", JSON.stringify(nfceData, null, 2));

    return new Response(
      JSON.stringify({
        ...nfceData,
        message: "Dados extraídos da chave de acesso. O valor total deve ser informado manualmente.",
        requiresManualInput: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro ao processar NFC-e:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro ao processar NFC-e",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
