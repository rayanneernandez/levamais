import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

interface ProductImporterProps {
  networkId: string;
  onImportComplete: () => void;
}

interface ImportRow {
  nome: string;
  codigo_barras?: string;
  custo?: number;
  preco: number;
  estoque?: number;
  estoque_minimo?: number;
  resgate?: boolean;
  valor_cashback?: number;
  valor_pontos?: number;
}

interface ImportResult {
  row: number;
  name: string;
  status: "created" | "updated" | "skipped" | "error";
  message: string;
}

const TEMPLATE_COLUMNS = [
  { header: "nome", description: "Nome do produto (obrigatório)", required: true },
  { header: "codigo_barras", description: "Código EAN-13 (opcional)", required: false },
  { header: "custo", description: "Custo unitário (opcional)", required: false },
  { header: "preco", description: "Preço de venda (obrigatório)", required: true },
  { header: "estoque", description: "Estoque atual (opcional, lança ajuste)", required: false },
  { header: "estoque_minimo", description: "Estoque mínimo (opcional, padrão: 0)", required: false },
  { header: "resgate", description: "Produto de resgate (sim/não)", required: false },
  { header: "valor_cashback", description: "Valor em cashback para resgate", required: false },
  { header: "valor_pontos", description: "Valor em pontos para resgate", required: false },
];

export function ProductImporter({ networkId, onImportComplete }: ProductImporterProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const downloadTemplate = () => {
    const templateData = [
      {
        nome: "Produto Exemplo 1",
        codigo_barras: "7891234567890",
        custo: 10.50,
        preco: 19.90,
        estoque: 100,
        estoque_minimo: 5,
        resgate: "não",
        valor_cashback: 0,
        valor_pontos: 0,
      },
      {
        nome: "Produto Resgate Exemplo",
        codigo_barras: "",
        custo: 15.00,
        preco: 25.00,
        estoque: 20,
        estoque_minimo: 5,
        resgate: "sim",
        valor_cashback: 20.00,
        valor_pontos: 200,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");
    
    // Add column widths
    ws["!cols"] = [
      { wch: 30 }, // nome
      { wch: 15 }, // codigo_barras
      { wch: 12 }, // custo
      { wch: 12 }, // preco
      { wch: 12 }, // estoque
      { wch: 15 }, // estoque_minimo
      { wch: 10 }, // resgate
      { wch: 15 }, // valor_cashback
      { wch: 12 }, // valor_pontos
    ];

    XLSX.writeFile(wb, "template_produtos.xlsx");
    toast({ title: "Template baixado!", description: "Use este arquivo como modelo para importar seus produtos." });
  };

  const validateBarcode = (code: string): boolean => {
    if (!code) return true;
    const ean13Regex = /^\d{13}$/;
    if (!ean13Regex.test(code)) return false;
    
    const digits = code.split("").map(Number);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += digits[i] * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === digits[12];
  };

  const parseFile = async (file: File): Promise<ImportRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
          
          const rows: ImportRow[] = jsonData.map((row) => {
            const resgateValue = String(row.resgate || row.Resgate || row.RESGATE || "").toLowerCase();
            const isRedemption = resgateValue === "sim" || resgateValue === "s" || resgateValue === "yes" || resgateValue === "true" || resgateValue === "1";
            
            return {
              nome: String(row.nome || row.Nome || row.NOME || "").trim(),
              codigo_barras: String(row.codigo_barras || row["codigo de barras"] || row.Codigo_Barras || row.barcode || "").trim() || undefined,
              custo: parseFloat(String(row.custo || row.Custo || row.CUSTO || 0).replace(",", ".")) || 0,
              preco: parseFloat(String(row.preco || row.Preco || row.PRECO || row.preço || row.Preço || 0).replace(",", ".")) || 0,
              estoque: row.estoque !== undefined && row.estoque !== "" ? parseInt(String(row.estoque || row.Estoque || row.ESTOQUE || 0)) : undefined,
              estoque_minimo: parseInt(String(row.estoque_minimo || row.Estoque_Minimo || row["estoque minimo"] || 0)) || 0,
              resgate: isRedemption,
              valor_cashback: parseFloat(String(row.valor_cashback || row.Valor_Cashback || row["valor cashback"] || 0).replace(",", ".")) || 0,
              valor_pontos: parseInt(String(row.valor_pontos || row.Valor_Pontos || row["valor pontos"] || 0)) || 0,
            };
          });
          
          resolve(rows);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
      reader.readAsBinaryString(file);
    });
  };

  const processImport = async (rows: ImportRow[]) => {
    const results: ImportResult[] = [];
    
    // Get current user for stock movements
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user?.id)
      .single();
    
    // Fetch existing products to compare
    const { data: existingProducts } = await supabase
      .from("store_products")
      .select("id, name, barcode, cost, price, stock, min_stock, is_redemption_product, cashback_value, points_value")
      .eq("network_id", networkId);
    
    const existingByName = new Map(existingProducts?.map(p => [p.name.toLowerCase(), p]) || []);
    const existingByBarcode = new Map(
      existingProducts?.filter(p => p.barcode).map(p => [p.barcode, p]) || []
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 for header row and 0-index
      
      setProgress(Math.round(((i + 1) / rows.length) * 100));
      
      // Validate required fields
      if (!row.nome) {
        results.push({ row: rowNum, name: "(vazio)", status: "error", message: "Nome é obrigatório" });
        continue;
      }
      
      if (!row.preco || row.preco <= 0) {
        results.push({ row: rowNum, name: row.nome, status: "error", message: "Preço deve ser maior que zero" });
        continue;
      }
      
      // Validate barcode if provided
      if (row.codigo_barras && !validateBarcode(row.codigo_barras)) {
        results.push({ row: rowNum, name: row.nome, status: "error", message: "Código de barras inválido (deve ser EAN-13)" });
        continue;
      }
      
      // Check if product already exists
      let existingProduct = existingByBarcode.get(row.codigo_barras || "") || 
                            existingByName.get(row.nome.toLowerCase());
      
      try {
        if (existingProduct) {
          // Check if any field changed (excluding stock which is handled separately)
          const hasChanges = 
            existingProduct.name !== row.nome ||
            (existingProduct.barcode || "") !== (row.codigo_barras || "") ||
            existingProduct.cost !== row.custo ||
            existingProduct.price !== row.preco ||
            existingProduct.min_stock !== (row.estoque_minimo || 0) ||
            existingProduct.is_redemption_product !== (row.resgate || false) ||
            existingProduct.cashback_value !== (row.valor_cashback || 0) ||
            existingProduct.points_value !== (row.valor_pontos || 0);
          
          const stockChanged = row.estoque !== undefined && existingProduct.stock !== row.estoque;
          
          if (hasChanges || stockChanged) {
            // Update product fields
            const updateData: any = {
              name: row.nome,
              barcode: row.codigo_barras || null,
              cost: row.custo || 0,
              price: row.preco,
              min_stock: row.estoque_minimo || 0,
              is_redemption_product: row.resgate || false,
              cashback_value: row.valor_cashback || 0,
              points_value: row.valor_pontos || 0,
            };
            
            // If stock is being updated, add it to update
            if (stockChanged) {
              updateData.stock = row.estoque;
              
              // Create stock movement record as adjustment
              await supabase.from("store_product_stock_movements").insert({
                product_id: existingProduct.id,
                movement_type: "ajuste",
                quantity: row.estoque! - existingProduct.stock,
                previous_stock: existingProduct.stock,
                new_stock: row.estoque,
                observation: "Ajuste via importação de planilha",
                user_id: user?.id,
                user_name: profile?.full_name || null,
              });
            }
            
            const { error } = await supabase
              .from("store_products")
              .update(updateData)
              .eq("id", existingProduct.id);
            
            if (error) throw error;
            
            const message = stockChanged && hasChanges 
              ? "Produto e estoque atualizados" 
              : stockChanged 
                ? "Estoque ajustado" 
                : "Produto atualizado";
            results.push({ row: rowNum, name: row.nome, status: "updated", message });
          } else {
            results.push({ row: rowNum, name: row.nome, status: "skipped", message: "Nenhuma alteração necessária" });
          }
        } else {
          // Create new product
          const initialStock = row.estoque || 0;
          
          const { data: newProduct, error } = await supabase
            .from("store_products")
            .insert({
              network_id: networkId,
              name: row.nome,
              internal_code: "", // Auto-generated by trigger
              barcode: row.codigo_barras || null,
              cost: row.custo || 0,
              price: row.preco,
              stock: initialStock,
              min_stock: row.estoque_minimo || 0,
              is_redemption_product: row.resgate || false,
              cashback_value: row.valor_cashback || 0,
              points_value: row.valor_pontos || 0,
            })
            .select("id")
            .single();
          
          if (error) throw error;
          
          // If stock > 0, create initial stock movement
          if (initialStock > 0 && newProduct) {
            await supabase.from("store_product_stock_movements").insert({
              product_id: newProduct.id,
              movement_type: "ajuste",
              quantity: initialStock,
              previous_stock: 0,
              new_stock: initialStock,
              observation: "Estoque inicial via importação de planilha",
              user_id: user?.id,
              user_name: profile?.full_name || null,
            });
          }
          results.push({ row: rowNum, name: row.nome, status: "created", message: "Produto criado" });
        }
      } catch (error: any) {
        results.push({ row: rowNum, name: row.nome, status: "error", message: error.message });
      }
    }
    
    return results;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    
    if (!validTypes.includes(file.type) && !file.name.endsWith(".csv") && !file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast({ title: "Erro", description: "Apenas arquivos Excel (.xlsx, .xls) ou CSV são aceitos", variant: "destructive" });
      return;
    }
    
    setFileName(file.name);
    setIsProcessing(true);
    setProgress(0);
    setResults([]);
    setShowDialog(true);
    
    try {
      const rows = await parseFile(file);
      
      if (rows.length === 0) {
        toast({ title: "Erro", description: "Nenhum dado encontrado no arquivo", variant: "destructive" });
        setIsProcessing(false);
        return;
      }
      
      const importResults = await processImport(rows);
      setResults(importResults);
      
      const created = importResults.filter(r => r.status === "created").length;
      const updated = importResults.filter(r => r.status === "updated").length;
      const errors = importResults.filter(r => r.status === "error").length;
      
      if (errors === 0) {
        toast({ title: "Importação concluída!", description: `${created} criados, ${updated} atualizados` });
      } else {
        toast({ title: "Importação com erros", description: `${created} criados, ${updated} atualizados, ${errors} erros`, variant: "destructive" });
      }
      
      onImportComplete();
    } catch (error: any) {
      console.error("Erro na importação:", error);
      toast({ title: "Erro na importação", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const getStatusIcon = (status: ImportResult["status"]) => {
    switch (status) {
      case "created": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "updated": return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
      case "skipped": return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "error": return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusBadge = (status: ImportResult["status"]) => {
    switch (status) {
      case "created": return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">Criado</Badge>;
      case "updated": return <Badge className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20">Atualizado</Badge>;
      case "skipped": return <Badge className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20">Ignorado</Badge>;
      case "error": return <Badge variant="destructive">Erro</Badge>;
    }
  };

  const summaryStats = {
    created: results.filter(r => r.status === "created").length,
    updated: results.filter(r => r.status === "updated").length,
    skipped: results.filter(r => r.status === "skipped").length,
    errors: results.filter(r => r.status === "error").length,
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileChange}
        className="hidden"
      />
      
      <div className="flex gap-2">
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-2" />
          Template
        </Button>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4 mr-2" />
          Importar
        </Button>
      </div>
      
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importação de Produtos
            </DialogTitle>
            <DialogDescription>
              {fileName && `Arquivo: ${fileName}`}
            </DialogDescription>
          </DialogHeader>
          
          {isProcessing ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span>Processando importação...</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-center text-sm text-muted-foreground">{progress}%</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-green-500/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{summaryStats.created}</p>
                  <p className="text-xs text-muted-foreground">Criados</p>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{summaryStats.updated}</p>
                  <p className="text-xs text-muted-foreground">Atualizados</p>
                </div>
                <div className="bg-yellow-500/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{summaryStats.skipped}</p>
                  <p className="text-xs text-muted-foreground">Ignorados</p>
                </div>
                <div className="bg-destructive/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-destructive">{summaryStats.errors}</p>
                  <p className="text-xs text-muted-foreground">Erros</p>
                </div>
              </div>
              
              {/* Details */}
              <ScrollArea className="h-[300px] rounded-md border">
                <div className="p-2 space-y-1">
                  {results.map((result, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                      {getStatusIcon(result.status)}
                      <span className="text-sm text-muted-foreground w-12">Linha {result.row}</span>
                      <span className="flex-1 text-sm font-medium truncate">{result.name}</span>
                      {getStatusBadge(result.status)}
                      {result.status === "error" && (
                        <span className="text-xs text-destructive max-w-[150px] truncate" title={result.message}>
                          {result.message}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="py-8 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Selecione um arquivo para importar</p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
