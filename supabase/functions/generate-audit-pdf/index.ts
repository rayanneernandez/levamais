import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AuditPDFRequest {
  budget_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { budget_id }: AuditPDFRequest = await req.json();

    // Buscar orçamento com dados de aprovação
    const { data: budget, error: budgetError } = await supabase
      .from("budgets")
      .select(`
        *,
        networks (name, cnpj)
      `)
      .eq("id", budget_id)
      .single();

    if (budgetError || !budget) {
      throw new Error("Orçamento não encontrado");
    }

    if (budget.status !== 'approved') {
      throw new Error("Orçamento ainda não foi aprovado");
    }

    // Buscar itens do orçamento
    const { data: items, error: itemsError } = await supabase
      .from("budget_items")
      .select(`
        *,
        products_services (code, name, type, is_recurring)
      `)
      .eq("budget_id", budget_id);

    if (itemsError) throw itemsError;

    // Gerar HTML do documento de auditoria
    const auditHtml = generateAuditHTML(budget, items || []);

    // Retornar HTML para ser convertido em PDF no frontend
    return new Response(
      JSON.stringify({
        success: true,
        html: auditHtml,
        budget_number: budget.budget_number,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Erro em generate-audit-pdf:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function generateAuditHTML(budget: any, items: any[]): string {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatCNPJ = (cnpj: string) => {
    if (!cnpj) return 'N/A';
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  // Calcular totais
  let totalUnique = 0;
  let totalRecurring = 0;
  
  items.forEach(item => {
    if (item.products_services?.is_recurring) {
      totalRecurring += item.total_value;
    } else {
      totalUnique += item.total_value;
    }
  });

  // Preparar CNPJs - fazer parse das strings JSON
  let cnpjsList: any[] = [];
  if (budget.cnpjs && Array.isArray(budget.cnpjs)) {
    cnpjsList = budget.cnpjs.map((item: any) => {
      if (typeof item === 'string') {
        try {
          return JSON.parse(item);
        } catch (e) {
          return null;
        }
      }
      return item;
    }).filter(Boolean);
  }
  
  const cnpjsText = cnpjsList.length > 0 
    ? cnpjsList.map((item: any) => `${formatCNPJ(item.cnpj)} - ${item.razao_social}`).join('<br>')
    : (budget.networks?.cnpj ? formatCNPJ(budget.networks.cnpj) : 'N/A');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm;
    }
    * { 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box; 
    }
    body { 
      font-family: 'Helvetica', 'Arial', sans-serif; 
      padding: 20px 35px;
      color: #333;
      line-height: 1.4;
      font-size: 12px;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 3px solid #40B9D9;
      page-break-after: avoid;
    }
    .header h1 {
      color: #40B9D9;
      font-size: 22px;
      margin-bottom: 6px;
      line-height: 1.2;
    }
    .header .subtitle {
      font-size: 15px;
      color: #666;
      margin: 4px 0;
    }
    .section {
      margin-bottom: 18px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 14px;
      font-weight: bold;
      color: #40B9D9;
      margin-bottom: 10px;
      padding-bottom: 4px;
      border-bottom: 2px solid #40B9D9;
      page-break-after: avoid;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .info-item {
      padding: 8px;
      background: #f5f5f5;
      border-radius: 3px;
      page-break-inside: avoid;
    }
    .info-item-full {
      grid-column: 1 / -1;
      padding: 10px;
      background: #f0f9fc;
      border-radius: 4px;
      border: 1px solid #40B9D9;
      page-break-inside: avoid;
    }
    .info-label {
      font-weight: bold;
      color: #555;
      font-size: 10px;
      margin-bottom: 3px;
    }
    .info-value {
      color: #333;
      font-size: 12px;
      line-height: 1.3;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 11px;
    }
    thead {
      display: table-header-group;
    }
    tbody {
      display: table-row-group;
    }
    tr {
      page-break-inside: avoid;
    }
    th {
      background: #40B9D9;
      color: white;
      padding: 8px 6px;
      text-align: left;
      font-weight: bold;
      font-size: 11px;
    }
    td {
      padding: 6px;
      border-bottom: 1px solid #ddd;
    }
    tr:nth-child(even) {
      background: #f9f9f9;
    }
    .signature-box {
      margin: 15px 0;
      padding: 12px;
      background: #f0f9fc;
      border: 2px solid #40B9D9;
      border-radius: 5px;
      page-break-inside: avoid;
    }
    .signature-title {
      font-weight: bold;
      color: #40B9D9;
      margin-bottom: 6px;
      font-size: 13px;
    }
    .hash-box {
      font-family: 'Courier New', monospace;
      background: #fff;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 3px;
      margin: 6px 0;
      word-break: break-all;
      font-size: 9px;
      color: #555;
      line-height: 1.3;
    }
    .totals-box {
      background: #f0f9fc;
      padding: 14px;
      border-radius: 5px;
      margin: 12px 0 80px 0;
      border: 2px solid #40B9D9;
      page-break-inside: avoid;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.2;
    }
    .total-row.unique {
      color: #059669;
      padding-bottom: 6px;
      border-bottom: 1px dashed #ccc;
    }
    .total-row.recurring {
      color: #dc2626;
      padding: 6px 0;
      border-bottom: 1px dashed #ccc;
    }
    .total-row.main {
      font-weight: bold;
      font-size: 16px;
      color: #40B9D9;
      border-top: 3px solid #40B9D9;
      padding-top: 10px;
      margin-top: 6px;
      border-bottom: none;
    }
    .footer {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 2px solid #ddd;
      text-align: center;
      font-size: 9px;
      color: #666;
      page-break-inside: avoid;
    }
    .footer p {
      margin: 2px 0;
    }
    .warning-box {
      background: #fff9e6;
      border-left: 4px solid #ffc107;
      padding: 10px;
      margin: 12px 0;
      font-size: 10px;
      page-break-inside: avoid;
    }
    .page-separator {
      height: 297mm;
      page-break-after: always;
      display: block;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>DOCUMENTO DE AUDITORIA E ASSINATURA DIGITAL</h1>
    <div class="subtitle">Proposta Comercial ${budget.budget_number}</div>
    <div style="margin-top: 10px; font-size: 14px; color: #888;">
      Leva+ Fidelidade - BISW Solutions
    </div>
  </div>

  <div class="section">
    <div class="section-title">DADOS DA PROPOSTA</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Número da Proposta</div>
        <div class="info-value">${budget.budget_number}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Empresa</div>
        <div class="info-value">${budget.networks?.name || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Valor Total</div>
        <div class="info-value">${formatCurrency(budget.total_value)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Solicitante</div>
        <div class="info-value">${budget.requester_name}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Email Solicitante</div>
        <div class="info-value">${budget.requester_email}</div>
      </div>
    </div>
    ${cnpjsList.length > 0 ? `
      <div class="info-item-full">
        <div class="info-label">CNPJ(s) / Razão Social</div>
        <div class="info-value">${cnpjsText}</div>
      </div>
    ` : ''}
  </div>

  <div class="section">
    <div class="section-title">ITENS DA PROPOSTA</div>
    <table>
      <thead>
        <tr>
          <th>Produto/Serviço</th>
          <th>Tipo</th>
          <th style="text-align: center;">Qtd</th>
          <th style="text-align: right;">Valor Unit.</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => {
          const product = item.products_services;
          const typeLabel = product?.type === 'product' 
            ? 'Produto' 
            : (product?.is_recurring ? 'Serviço (Recorrente)' : 'Serviço (Único)');
          
          return `
            <tr>
              <td>${product?.code || ''} - ${product?.name || ''}</td>
              <td>${typeLabel}</td>
              <td style="text-align: center;">${item.quantity}</td>
              <td style="text-align: right;">${formatCurrency(item.unit_value)}</td>
              <td style="text-align: right;">${formatCurrency(item.total_value)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <div class="totals-box">
      ${totalUnique > 0 ? `
        <div class="total-row unique">
          <span>💰 Total Único (Investimento Inicial):</span>
          <span><strong>${formatCurrency(totalUnique)}</strong></span>
        </div>
      ` : ''}
      ${totalRecurring > 0 ? `
        <div class="total-row recurring">
          <span>🔄 Total Recorrente (Mensalidade):</span>
          <span><strong>${formatCurrency(totalRecurring)}</strong></span>
        </div>
      ` : ''}
      <div class="total-row main">
        <span>TOTAL GERAL:</span>
        <span>${formatCurrency(budget.total_value)}</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">DADOS DA APROVAÇÃO E ASSINATURA DO CLIENTE</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Nome do Responsável</div>
        <div class="info-value">${budget.approved_by_name || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">CPF</div>
        <div class="info-value">${budget.approved_by_cpf ? formatCPF(budget.approved_by_cpf) : 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Email</div>
        <div class="info-value">${budget.approved_by_email || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Cargo</div>
        <div class="info-value">${budget.approved_by_position || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Data/Hora da Aprovação</div>
        <div class="info-value">${budget.approved_at ? formatDate(budget.approved_at) : 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Endereço IP</div>
        <div class="info-value">${budget.approval_ip || 'N/A'}</div>
      </div>
    </div>

    ${budget.approval_latitude && budget.approval_longitude ? `
      <div class="info-item" style="margin-top: 15px;">
        <div class="info-label">Geolocalização da Aprovação</div>
        <div class="info-value">
          Latitude: ${budget.approval_latitude.toFixed(6)} | 
          Longitude: ${budget.approval_longitude.toFixed(6)}
        </div>
      </div>
    ` : ''}
  </div>

  <div class="signature-box">
    <div class="signature-title">ASSINATURA DIGITAL DO CLIENTE</div>
    <p style="margin-bottom: 15px; font-size: 13px;">
      Esta proposta foi assinada digitalmente pelo cliente. Os dados abaixo garantem a autenticidade e integridade do documento:
    </p>
    
    <div style="margin-bottom: 15px;">
      <strong style="color: #40B9D9;">Hash do Documento (SHA-256):</strong>
      <div class="hash-box">${budget.approval_document_hash || 'N/A'}</div>
    </div>
    
    <div>
      <strong style="color: #40B9D9;">Assinatura Digital:</strong>
      <div class="hash-box">${budget.approval_signature || 'N/A'}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">DADOS DA APROVAÇÃO E ASSINATURA DA BISW SOLUTIONS</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Nome do Responsável</div>
        <div class="info-value">${budget.bisw_approved_by_name || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">CPF</div>
        <div class="info-value">${budget.bisw_approved_by_cpf ? formatCPF(budget.bisw_approved_by_cpf) : 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Email</div>
        <div class="info-value">${budget.bisw_approved_by_email || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Cargo</div>
        <div class="info-value">${budget.bisw_approved_by_position || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Data/Hora da Aprovação</div>
        <div class="info-value">${budget.bisw_approved_at ? formatDate(budget.bisw_approved_at) : 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Endereço IP</div>
        <div class="info-value">${budget.bisw_approval_ip || 'N/A'}</div>
      </div>
    </div>

    ${budget.bisw_approval_latitude && budget.bisw_approval_longitude ? `
      <div class="info-item" style="margin-top: 15px;">
        <div class="info-label">Geolocalização da Aprovação</div>
        <div class="info-value">
          Latitude: ${budget.bisw_approval_latitude.toFixed(6)} | 
          Longitude: ${budget.bisw_approval_longitude.toFixed(6)}
        </div>
      </div>
    ` : ''}
  </div>

  <div class="signature-box">
    <div class="signature-title">ASSINATURA DIGITAL DA BISW SOLUTIONS</div>
    <p style="margin-bottom: 15px; font-size: 13px;">
      Esta proposta foi assinada digitalmente pela BISW Solutions. Os dados abaixo garantem a autenticidade e integridade do documento:
    </p>
    
    <div style="margin-bottom: 15px;">
      <strong style="color: #40B9D9;">Hash do Documento (SHA-256):</strong>
      <div class="hash-box">${budget.bisw_approval_document_hash || 'N/A'}</div>
    </div>
    
    <div>
      <strong style="color: #40B9D9;">Assinatura Digital:</strong>
      <div class="hash-box">${budget.bisw_approval_signature || 'N/A'}</div>
    </div>
  </div>

  <div class="warning-box">
    <strong>⚠️ IMPORTANTE:</strong> Este documento é uma prova digital da aprovação bilateral da proposta comercial. 
    As duas assinaturas digitais (Cliente e BISW Solutions) e seus respectivos hashes garantem que o documento não foi alterado desde sua criação. 
    Qualquer modificação nos dados invalidará as assinaturas.
  </div>

  <div class="section">
    <div class="section-title">INFORMAÇÕES TÉCNICAS DE AUDITORIA</div>
    <div style="font-size: 12px; color: #666; line-height: 1.8;">
      <p><strong>User Agent:</strong> ${budget.approval_user_agent || 'N/A'}</p>
      <p><strong>Timestamp Unix:</strong> ${budget.approved_at ? new Date(budget.approved_at).getTime() : 'N/A'}</p>
      <p><strong>Algoritmo de Hash:</strong> SHA-256</p>
      <p><strong>Método de Assinatura:</strong> Digital Signature (CPF + Timestamp + Hash)</p>
    </div>
  </div>

  <div class="footer">
    <p><strong>BISW Solutions Serviços de Informática LTDA</strong></p>
    <p>CNPJ: 19.404.744/0001-08</p>
    <p>Av. Alm Julio de Sá Bierrenbach, 65 - Barra da Tijuca - Rio de Janeiro/RJ</p>
    <p>Telefone: (21) 3950-7641 | E-mail: comercial@levamais.app</p>
    <p style="margin-top: 15px; font-size: 10px;">
      Documento gerado automaticamente em ${new Date().toLocaleString('pt-BR')}
    </p>
  </div>
</body>
</html>
  `;
}

serve(handler);
