// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extrair token do header Authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: "Token de autenticação não fornecido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("Validating token:", token.substring(0, 10) + "...");

    // Validar token e obter network_id
    const { data: tokenData, error: tokenError } = await supabase
      .from("external_api_tokens")
      .select("network_id, is_active, id")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (tokenError || !tokenData) {
      console.log("Invalid token:", tokenError);
      return new Response(
        JSON.stringify({ error: "Token inválido ou expirado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Token validated for network:", tokenData.network_id);

    // Atualizar last_used_at do token
    await supabase
      .from("external_api_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenData.id);

    // Obter parâmetros de query
    const url = new URL(req.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const status = url.searchParams.get("status");

    console.log("Query params:", { startDate, endDate, status });

    // Buscar transações
    let query = supabase
      .from("webposto_transactions")
      .select(`
        *,
        stores!inner(
          name,
          cnpj,
          address,
          networks!inner(
            name
          )
        ),
        clients(
          full_name,
          cpf,
          address_street,
          address_number,
          address_neighborhood,
          address_city,
          address_state,
          address_zip
        )
      `)
      .eq("stores.network_id", tokenData.network_id)
      .order("data_venda", { ascending: false });

    // Aplicar filtros
    if (startDate) {
      query = query.gte("data_venda", startDate);
    }
    if (endDate) {
      query = query.lte("data_venda", endDate);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data: transactions, error: transactionsError } = await query;

    if (transactionsError) {
      console.error("Error fetching transactions:", transactionsError);
      throw transactionsError;
    }

    console.log("Found transactions:", transactions?.length || 0);

    // Formatar dados de resposta
    const formattedData = transactions?.map((tx) => {
      const produtos = Array.isArray(tx.produtos) ? tx.produtos : [];
      
      return {
        codigoVenda: tx.codigo_venda,
        dataHora: tx.data_venda,
        produtos: produtos.map((p: any) => ({
          codigoProduto: p.codigoProduto,
          nomeProduto: p.nomeProduto,
          valorCusto: null, // Custo não é armazenado nas transações
          valorVenda: parseFloat(p.valorUnitario || 0),
          quantidade: parseFloat(p.quantidade || 0),
        })),
        cliente: {
          nome: tx.clients?.full_name || null,
          cpf: tx.clients?.cpf || tx.codigo_voucher,
          endereco: tx.clients ? {
            rua: tx.clients.address_street,
            numero: tx.clients.address_number,
            bairro: tx.clients.address_neighborhood,
            cidade: tx.clients.address_city,
            estado: tx.clients.address_state,
            cep: tx.clients.address_zip,
          } : null,
        },
        loja: {
          nome: tx.stores?.name,
          cnpj: tx.stores?.cnpj,
          endereco: tx.stores?.address,
        },
        status: tx.status,
        valorCashback: parseFloat(tx.valor_cashback || 0),
        valorTotal: produtos.reduce((sum: number, p: any) => 
          sum + (parseFloat(p.valorTotal || 0)), 0
        ),
        idTransacao: tx.id_transacao,
      };
    }) || [];

    return new Response(
      JSON.stringify({
        success: true,
        data: formattedData,
        total: formattedData.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in api-transactions:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
