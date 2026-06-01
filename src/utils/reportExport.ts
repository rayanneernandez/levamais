import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ExportPDFOptions {
  title: string;
  headers: string[];
  data: (string | number)[][];
  totals?: (string | number)[];
  filename: string;
  subtitle?: string;
}

interface ExportExcelOptions {
  headers: string[];
  data: (string | number)[][];
  totals?: (string | number)[];
  filename: string;
}

/**
 * Exporta dados para PDF com totalizadores
 */
export function exportToPDFWithTotals({
  title,
  headers,
  data,
  totals,
  filename,
  subtitle,
}: ExportPDFOptions): void {
  const doc = new jsPDF();

  // Título
  doc.setFontSize(18);
  doc.text(title, 14, 22);

  // Subtítulo / Data de geração
  doc.setFontSize(11);
  let yPos = 30;
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, yPos);
  
  if (subtitle) {
    yPos += 6;
    doc.text(subtitle, 14, yPos);
  }

  // Preparar body com totais
  const bodyWithTotals = [...data];
  if (totals && totals.length > 0) {
    bodyWithTotals.push(totals.map(t => String(t)));
  }

  // Tabela
  autoTable(doc, {
    head: [headers],
    body: bodyWithTotals,
    startY: yPos + 10,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
    footStyles: { fillColor: [229, 231, 235], fontStyle: "bold" },
    didParseCell: (hookData) => {
      // Estilizar linha de totais
      if (totals && hookData.row.index === bodyWithTotals.length - 1) {
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.fillColor = [229, 231, 235];
      }
    },
  });

  doc.save(filename);
}

/**
 * Exporta dados para Excel/CSV com totalizadores
 */
export function exportToExcelWithTotals({
  headers,
  data,
  totals,
  filename,
}: ExportExcelOptions): void {
  const rows = data.map(row => 
    row.map(cell => {
      const cellStr = String(cell);
      // Escapar aspas e envolver em aspas se contiver vírgula ou aspas
      if (cellStr.includes(",") || cellStr.includes('"') || cellStr.includes("\n")) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(",")
  );

  // Adicionar linha de totais
  if (totals && totals.length > 0) {
    const totalsRow = totals.map(cell => {
      const cellStr = String(cell);
      if (cellStr.includes(",") || cellStr.includes('"') || cellStr.includes("\n")) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(",");
    rows.push(totalsRow);
  }

  const csvContent = [
    headers.join(","),
    ...rows
  ].join("\n");

  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

/**
 * Formata número para exibição
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

/**
 * Formata moeda brasileira
 */
export function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

/**
 * Formata percentual
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
