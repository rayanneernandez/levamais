import { useState, useEffect } from "react";
import { Upload, FileSpreadsheet, Download, Trash2, Eye, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import * as XLSX from 'xlsx';

interface Import {
  id: string;
  file_name: string;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  import_date: string;
  status: string;
  imported_by_profile?: {
    full_name: string;
    email: string;
  };
}

export default function PrecoCombustivel() {
  const [imports, setImports] = useState<Import[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [currentFile, setCurrentFile] = useState("");
  const [totalFiles, setTotalFiles] = useState(0);
  const [processedFiles, setProcessedFiles] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    loadImports();
  }, []);

  const loadImports = async () => {
    try {
      const { data, error } = await supabase
        .from("fuel_price_imports")
        .select("*")
        .order("import_date", { ascending: false });

      if (error) throw error;

      const userIds = [...new Set(data?.map(imp => imp.imported_by) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const importsWithProfiles = data?.map(imp => ({
        ...imp,
        imported_by_profile: profiles?.find(p => p.id === imp.imported_by),
      })) || [];

      setImports(importsWithProfiles);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar importações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    setTotalFiles(files.length);
    setProcessedFiles(0);

    const results = {
      success: 0,
      failed: 0,
      totalRows: 0,
    };

    try {
      // Processar arquivos em sequência
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setCurrentFile(file.name);
        setProcessedFiles(i);

        try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Configurar para começar a ler da linha 10 (índice 9), usando ela como cabeçalho
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          range: 9 // Começa da linha 10 (0-indexed), que contém os nomes das colunas
        });

        console.log(`[${file.name}] Total de linhas processadas: ${jsonData.length}`);

        if (jsonData.length === 0) {
          throw new Error("A planilha está vazia ou contém apenas cabeçalhos");
        }

        const firstRow = jsonData[0] as any;
        const foundColumns = Object.keys(firstRow);
        console.log(`[${file.name}] Colunas encontradas:`, foundColumns);
        
        const requiredColumns = ['CNPJ', 'PRODUTO'];
        const missingColumns = requiredColumns.filter(col => !foundColumns.includes(col));
        
        if (missingColumns.length > 0) {
          throw new Error(`Colunas obrigatórias faltando: ${missingColumns.join(', ')}. Encontradas: ${foundColumns.join(', ')}`);
        }

        let successCount = 0;
        let failCount = 0;
        const errors: any[] = [];

        // Processar dados em lotes maiores e com retry
        const BATCH_SIZE = 250;
        const MAX_RETRIES = 3;
        const DELAY_BETWEEN_BATCHES = 100; // ms
        
        setUploadTotal(jsonData.length);
        setUploadProgress(0);

        // Preparar todos os dados primeiro
        const allFuelPrices: any[] = [];
        
        for (const row of jsonData) {
          const rowData: any = row;
          
          try {
            let dataColeta: string = new Date().toISOString().split('T')[0];
            
            if (rowData['DATA DA COLETA']) {
              if (typeof rowData['DATA DA COLETA'] === 'number') {
                const date = XLSX.SSF.parse_date_code(rowData['DATA DA COLETA']);
                dataColeta = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
              } else {
                const dateStr = String(rowData['DATA DA COLETA']).trim();
                if (dateStr.includes('/')) {
                  const [day, month, year] = dateStr.split('/');
                  dataColeta = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                } else if (dateStr.includes('-')) {
                  dataColeta = dateStr;
                }
              }
            }

            const fuelPrice = {
              cnpj: String(rowData['CNPJ'] || '').replace(/[^\d]/g, ''),
              razao_social: rowData['RAZÃO'] || rowData['RAZAO'] || null,
              nome_fantasia: rowData['FANTASIA'] || null,
              endereco: rowData['ENDEREÇO'] || rowData['ENDERECO'] || null,
              numero: rowData['NÚMERO'] || rowData['NUMERO'] ? String(rowData['NÚMERO'] || rowData['NUMERO']) : null,
              complemento: rowData['COMPLEMENTO'] || null,
              bairro: rowData['BAIRRO'] || null,
              cep: rowData['CEP'] ? String(rowData['CEP']).replace(/[^\d]/g, '') : null,
              municipio: rowData['MUNICÍPIO'] || rowData['MUNICIPIO'] || null,
              estado: rowData['ESTADO'] || null,
              bandeira: rowData['BANDEIRA'] || null,
              produto: String(rowData['PRODUTO']).toUpperCase().trim(),
              unidade_medida: rowData['UNIDADE DE MEDIDA'] || null,
              preco_revenda: rowData['PREÇO DE REVENDA'] || rowData['PRECO DE REVENDA'] 
                ? parseFloat(String(rowData['PREÇO DE REVENDA'] || rowData['PRECO DE REVENDA']).replace(',', '.')) 
                : null,
              data_coleta: dataColeta,
            };

            allFuelPrices.push(fuelPrice);
          } catch (error: any) {
            failCount++;
            errors.push({ row: rowData, error: error.message });
          }
        }

        // Dividir em lotes
        const batches: any[] = [];
        for (let i = 0; i < allFuelPrices.length; i += BATCH_SIZE) {
          batches.push(allFuelPrices.slice(i, i + BATCH_SIZE));
        }

        // Função auxiliar para inserir lote com retry
        const insertBatchWithRetry = async (batch: any[], batchIndex: number): Promise<boolean> => {
          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
              const { error } = await supabase
                .from("fuel_prices")
                .insert(batch);

              if (error) throw error;
              return true;
            } catch (error: any) {
              console.error(`[${file.name}] Erro no lote ${batchIndex}, tentativa ${attempt}/${MAX_RETRIES}:`, error.message);
              
              if (attempt === MAX_RETRIES) {
                return false;
              }
              
              // Aguardar antes de tentar novamente (backoff exponencial)
              await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            }
          }
          return false;
        };

        // Criar registro de importação ANTES de inserir os dados
        const { data: { user } } = await supabase.auth.getUser();
        const { data: importRecord, error: importError } = await supabase
          .from("fuel_price_imports")
          .insert({
            imported_by: user?.id,
            file_name: file.name,
            total_rows: jsonData.length,
            successful_rows: 0,
            failed_rows: 0,
            status: 'processing',
            error_log: null,
          })
          .select()
          .single();

        if (importError || !importRecord) {
          throw new Error('Erro ao criar registro de importação');
        }

        const importId = importRecord.id;

        // Verificar duplicatas antes de inserir
        const checkDuplicates = async (batch: any[]): Promise<any[]> => {
          const keys = batch.map(item => 
            `${item.cnpj}-${item.produto}-${item.data_coleta}`
          );
          
          const { data: existing } = await supabase
            .from("fuel_prices")
            .select("cnpj, produto, data_coleta")
            .in("cnpj", [...new Set(batch.map(b => b.cnpj))]);
          
          const existingKeys = new Set(
            existing?.map(e => `${e.cnpj}-${e.produto}-${e.data_coleta}`) || []
          );
          
          return batch.filter((_, idx) => !existingKeys.has(keys[idx]));
        };

        // Adicionar import_id a todos os registros
        const batchesWithImportId = batches.map(batch => 
          batch.map(item => ({ ...item, import_id: importId }))
        );

        // Função auxiliar para inserir lote com retry e import_id
        const insertBatchWithRetryAndImportId = async (batch: any[], batchIndex: number): Promise<boolean> => {
          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
              const { error } = await supabase
                .from("fuel_prices")
                .insert(batch);

              if (error) throw error;
              return true;
            } catch (error: any) {
              console.error(`[${file.name}] Erro no lote ${batchIndex}, tentativa ${attempt}/${MAX_RETRIES}:`, error.message);
              
              if (attempt === MAX_RETRIES) {
                return false;
              }
              
              await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            }
          }
          return false;
        };

        // Inserir lotes sequencialmente com delay e verificação de duplicatas
        for (let i = 0; i < batchesWithImportId.length; i++) {
          const batch = batchesWithImportId[i];
          
          // Filtrar duplicatas
          const uniqueBatch = await checkDuplicates(batch);
          const skipped = batch.length - uniqueBatch.length;
          
          if (uniqueBatch.length > 0) {
            const success = await insertBatchWithRetryAndImportId(uniqueBatch, i);
            
            if (success) {
              successCount += uniqueBatch.length;
            } else {
              failCount += uniqueBatch.length;
              errors.push({ 
                batch: i, 
                error: `Falha após ${MAX_RETRIES} tentativas`,
                records: uniqueBatch.length 
              });
            }
          }
          
          if (skipped > 0) {
            console.log(`[${file.name}] Lote ${i}: ${skipped} registros duplicados ignorados`);
          }
          
          setUploadProgress(successCount + failCount + skipped);
          
          if (i < batchesWithImportId.length - 1) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
          }
        }

        // Atualizar registro de importação com resultado final
        const { error: updateError } = await supabase
          .from("fuel_price_imports")
          .update({
            successful_rows: successCount,
            failed_rows: failCount,
            status: failCount === 0 ? 'completed' : 'completed_with_errors',
            error_log: errors.length > 0 ? errors : null,
          })
          .eq('id', importId);

        if (updateError) {
          console.error(`[${file.name}] Erro ao atualizar registro de importação:`, updateError);
        }

        results.success += successCount;
        results.failed += failCount;
        results.totalRows += jsonData.length;

        console.log(`[${file.name}] Concluído: ${successCount} sucesso, ${failCount} falhas`);

      } catch (fileError: any) {
        console.error(`[${file.name}] Erro:`, fileError);
        results.failed += 1;
        toast({
          title: `Erro ao processar ${file.name}`,
          description: fileError.message,
          variant: "destructive",
        });
      }
    }

    // Toast final com resumo de todos os arquivos
    toast({
      title: `${files.length} arquivo(s) processado(s)!`,
      description: `${results.success} registros importados com sucesso.${results.failed > 0 ? ` ${results.failed} com erros.` : ''}`,
    });

    loadImports();
  } catch (error: any) {
    console.error('Erro geral na importação:', error);
    toast({
      title: "Erro na importação",
      description: error.message,
      variant: "destructive",
    });
  } finally {
    setIsUploading(false);
    setUploadProgress(0);
    setUploadTotal(0);
    setCurrentFile("");
    setTotalFiles(0);
    setProcessedFiles(0);
    event.target.value = '';
  }
};

  const handlePreview = async () => {
    try {
      const { count, error } = await supabase
        .from("fuel_prices")
        .select("*", { count: 'exact', head: true });

      if (error) throw error;

      toast({
        title: "Dados no banco",
        description: `Total de ${count || 0} registros de preços armazenados.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao consultar dados",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleClearData = async () => {
    if (!confirm("Tem certeza que deseja limpar TODOS os dados de preços de combustível? Esta ação não pode ser desfeita.")) return;

    try {
      const { error } = await supabase
        .from("fuel_prices")
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

      if (error) throw error;

      toast({
        title: "Dados limpos!",
        description: "Todos os registros de preços foram removidos do banco de dados.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao limpar dados",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteImport = async (importId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta importação? Todos os registros importados nesta planilha serão removidos permanentemente.")) return;

    try {
      setIsLoading(true);
      
      // Contar quantos registros serão deletados
      const { count } = await supabase
        .from("fuel_prices")
        .select("*", { count: 'exact', head: true })
        .eq("import_id", importId);

      // Deletar os registros de fuel_prices primeiro
      const { error: pricesError } = await supabase
        .from("fuel_prices")
        .delete()
        .eq("import_id", importId);

      if (pricesError) throw pricesError;

      // Deletar o registro de importação
      const { error: importError } = await supabase
        .from("fuel_price_imports")
        .delete()
        .eq("id", importId);

      if (importError) throw importError;

      toast({
        title: "Importação excluída!",
        description: `Registro e ${count || 0} preços de combustível foram removidos.`,
      });

      loadImports();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        'CNPJ': '12.345.678/0001-90',
        'RAZÃO': 'Posto Exemplo LTDA',
        'FANTASIA': 'Posto Exemplo',
        'ENDEREÇO': 'Rua Exemplo',
        'NÚMERO': '123',
        'COMPLEMENTO': 'Loja A',
        'BAIRRO': 'Centro',
        'CEP': '12345-678',
        'MUNICÍPIO': 'São Paulo',
        'ESTADO': 'SP',
        'BANDEIRA': 'Shell',
        'PRODUTO': 'GASOLINA COMUM',
        'UNIDADE DE MEDIDA': 'R$/L',
        'PREÇO DE REVENDA': 5.99,
        'DATA DA COLETA': '2024-01-15',
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_precos_combustivel.xlsx");
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Preço Combustível</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Importar planilhas de preços ANP para análise de mercado
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Baixar Template
          </Button>
          <Button variant="outline" onClick={handlePreview}>
            <Eye className="h-4 w-4 mr-2" />
            Ver Total de Registros
          </Button>
          <Button variant="destructive" onClick={handleClearData}>
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar Todos os Dados
          </Button>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Formato esperado:</strong> Planilha Excel (.xlsx) com as colunas: CNPJ, RAZÃO, FANTASIA, 
          ENDEREÇO, NÚMERO, COMPLEMENTO, BAIRRO, CEP, MUNICÍPIO, ESTADO, BANDEIRA, PRODUTO, 
          UNIDADE DE MEDIDA, PREÇO DE REVENDA, DATA DA COLETA
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Planilha
          </CardTitle>
          <CardDescription>
            Envie a planilha com os dados de preços de combustíveis da ANP
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center border-2 border-dashed rounded-lg p-12">
            <div className="text-center w-full max-w-md">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Arraste um arquivo ou clique para selecionar
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  multiple
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload">
                  <Button asChild disabled={isUploading}>
                    <span>
                      {isUploading ? "Processando..." : "Selecionar Arquivo"}
                    </span>
                  </Button>
                </label>
                
                {isUploading && (
                  <div className="space-y-3 mt-4">
                    {totalFiles > 1 && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">
                          Processando arquivo {processedFiles + 1} de {totalFiles}
                        </p>
                        <p className="text-xs text-muted-foreground">{currentFile}</p>
                      </div>
                    )}
                    {uploadTotal > 0 && (
                      <div className="space-y-2">
                        <Progress value={(uploadProgress / uploadTotal) * 100} className="w-full" />
                        <p className="text-sm text-muted-foreground">
                          {uploadProgress} de {uploadTotal} registros
                          ({Math.round((uploadProgress / uploadTotal) * 100)}%)
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Importações</CardTitle>
          <CardDescription>Registro de todas as importações realizadas</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : imports.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma importação realizada ainda
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Sucesso</TableHead>
                  <TableHead>Falhas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Importado por</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((imp) => (
                  <TableRow key={imp.id}>
                    <TableCell className="font-medium">{imp.file_name}</TableCell>
                    <TableCell>{formatDate(imp.import_date)}</TableCell>
                    <TableCell>{imp.total_rows}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-50">
                        {imp.successful_rows}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {imp.failed_rows > 0 ? (
                        <Badge variant="destructive">{imp.failed_rows}</Badge>
                      ) : (
                        <Badge variant="outline">0</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={imp.status === 'completed' ? 'default' : 'secondary'}>
                        {imp.status === 'completed' ? 'Concluído' : 'Com Erros'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {imp.imported_by_profile?.full_name || 'Sistema'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteImport(imp.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}