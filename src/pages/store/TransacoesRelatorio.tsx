import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { FileDown, FileSpreadsheet, Search, Receipt } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

const ITEMS_PER_PAGE = 10;

const TransacoesRelatorio = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Buscar lojas do usuário
  const { data: stores = [] } = useQuery({
    queryKey: ["user-stores"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data, error } = await supabase
        .from("store_managers")
        .select("store_id, stores(id, name, network_id)")
        .eq("user_id", user.id)
        .not("store_id", "is", null);

      if (error) throw error;
      return data.map(sm => sm.stores).filter(Boolean);
    },
  });

  // Buscar transações
  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ["transactions-report", selectedStore, startDate, endDate, startTime, endTime, searchTerm, currentPage],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Buscar IDs das lojas do usuário
      const storeIds = stores.map(s => s?.id).filter(Boolean);
      
      if (storeIds.length === 0) {
        return { transactions: [], total: 0 };
      }

      let query = supabase
        .from("transactions")
        .select(`
          id,
          created_at,
          type,
          points,
          amount,
          description,
          clients(cpf, full_name),
          stores(id, name)
        `, { count: "exact" });

      // Filtrar por lojas
      if (selectedStore === "all") {
        query = query.in("store_id", storeIds);
      } else {
        query = query.eq("store_id", selectedStore);
      }

      // Filtrar por data e hora
      if (startDate && endDate) {
        const startDateTime = `${startDate}T${startTime}:00`;
        const endDateTime = `${endDate}T${endTime}:59`;
        query = query.gte("created_at", startDateTime).lte("created_at", endDateTime);
      }

      // Busca por termo
      if (searchTerm) {
        query = query.or(`
          external_transaction_id.ilike.%${searchTerm}%,
          clients.cpf.ilike.%${searchTerm}%,
          clients.full_name.ilike.%${searchTerm}%
        `);
      }

      // Ordenar e paginar
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        transactions: data || [],
        total: count || 0,
      };
    },
    enabled: stores.length > 0,
  });

  const totalPages = Math.ceil((transactionsData?.total || 0) / ITEMS_PER_PAGE);

  const handleExportPDF = () => {
    if (!transactionsData?.transactions.length) {
      toast.error("Nenhuma transação para exportar");
      return;
    }

    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(16);
    doc.text("Relatório de Transações", 14, 15);
    
    // Filtros aplicados
    doc.setFontSize(10);
    let yPos = 25;
    if (startDate && endDate) {
      doc.text(`Período: ${format(new Date(startDate), "dd/MM/yyyy")} ${startTime} - ${format(new Date(endDate), "dd/MM/yyyy")} ${endTime}`, 14, yPos);
      yPos += 6;
    }
    if (selectedStore !== "all") {
      const store = stores.find(s => s?.id === selectedStore);
      doc.text(`Loja: ${store?.name || ""}`, 14, yPos);
      yPos += 6;
    }

    // Calcular totais
    const totalAcumulo = transactionsData.transactions
      .filter(t => t.type === "accumulation")
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalResgate = transactionsData.transactions
      .filter(t => t.type === "redemption")
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
    const totalGeral = transactionsData.transactions
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    // Dados da tabela
    const tableData = transactionsData.transactions.map(t => [
      t.id.substring(0, 8),
      t.description || "-",
      t.clients?.cpf || "-",
      t.clients?.full_name || "-",
      format(new Date(t.created_at), "dd/MM/yyyy HH:mm"),
      t.stores?.name || "-",
      t.type === "accumulation" ? "Acúmulo" : t.type === "redemption" ? "Resgate" : "Cashback",
      `R$ ${t.amount?.toFixed(2) || "0.00"}`,
    ]);

    // Adicionar linha de totais
    tableData.push([
      "TOTAIS",
      `${transactionsData.transactions.length} transações`,
      "-",
      "-",
      "-",
      "-",
      `Acúm: R$ ${totalAcumulo.toFixed(2)} | Resg: R$ ${totalResgate.toFixed(2)}`,
      `R$ ${totalGeral.toFixed(2)}`,
    ]);
    
    // Tabela
    autoTable(doc, {
      startY: yPos + 5,
      head: [["ID Trans.", "ID Venda", "CPF", "Cliente", "Data/Hora", "Loja", "Tipo", "Valor"]],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      didParseCell: (hookData) => {
        // Estilizar linha de totais
        if (hookData.row.index === tableData.length - 1) {
          hookData.cell.styles.fontStyle = "bold";
          hookData.cell.styles.fillColor = [229, 231, 235];
        }
      },
    });

    doc.save(`transacoes_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf`);
    toast.success("PDF exportado com sucesso!");
  };

  const handleExportExcel = () => {
    if (!transactionsData?.transactions.length) {
      toast.error("Nenhuma transação para exportar");
      return;
    }

    // Calcular totais
    const totalAcumulo = transactionsData.transactions
      .filter(t => t.type === "accumulation")
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalResgate = transactionsData.transactions
      .filter(t => t.type === "redemption")
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
    const totalGeral = transactionsData.transactions
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const headers = ["ID Transação", "ID Venda", "CPF", "Cliente", "Data", "Hora", "Loja", "Tipo", "Valor Total"];
    const rows = transactionsData.transactions.map(t => [
      t.id,
      t.description || "-",
      t.clients?.cpf || "-",
      t.clients?.full_name || "-",
      format(new Date(t.created_at), "dd/MM/yyyy"),
      format(new Date(t.created_at), "HH:mm:ss"),
      t.stores?.name || "-",
      t.type === "accumulation" ? "Acúmulo" : t.type === "redemption" ? "Resgate" : "Cashback",
      t.amount?.toFixed(2) || "0.00",
    ]);

    // Adicionar linha de totais
    rows.push([
      "TOTAIS",
      `${transactionsData.transactions.length} transações`,
      "",
      "",
      "",
      "",
      "",
      `Acúm: ${totalAcumulo.toFixed(2)} | Resg: ${totalResgate.toFixed(2)}`,
      totalGeral.toFixed(2),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `transacoes_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
    link.click();
    
    toast.success("Excel exportado com sucesso!");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Receipt className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Relatório de Transações</h1>
            <p className="text-muted-foreground">Visualize e exporte todas as transações</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Configure os filtros para buscar transações específicas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Linha 1: Datas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="start-date">Data Inicial</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="start-time">Hora Inicial</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end-date">Data Final</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end-time">Hora Final</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            {/* Linha 2: Loja e Busca */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="store">Loja</Label>
                <Select value={selectedStore} onValueChange={setSelectedStore}>
                  <SelectTrigger id="store">
                    <SelectValue placeholder="Selecione a loja" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as lojas</SelectItem>
                    {stores.map(store => store && (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="search">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="ID, CPF ou nome do cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Botões de exportação */}
            <div className="flex gap-2">
              <Button onClick={handleExportPDF} variant="outline">
                <FileDown className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
              <Button onClick={handleExportExcel} variant="outline">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Transações ({transactionsData?.total || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Carregando transações...</div>
            ) : !transactionsData?.transactions.length ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma transação encontrada com os filtros aplicados
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID Transação</TableHead>
                        <TableHead>ID Venda</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactionsData.transactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-mono text-xs">
                            {transaction.id.substring(0, 8)}...
                          </TableCell>
                          <TableCell>{transaction.description || "-"}</TableCell>
                          <TableCell>{transaction.clients?.cpf || "-"}</TableCell>
                          <TableCell>{transaction.clients?.full_name || "-"}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{formatInTimeZone(new Date(transaction.created_at), "America/Sao_Paulo", "dd/MM/yyyy")}</div>
                              <div className="text-muted-foreground text-xs">
                                {formatInTimeZone(new Date(transaction.created_at), "America/Sao_Paulo", "HH:mm:ss")}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{transaction.stores?.name || "-"}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                transaction.type === "accumulation"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : transaction.type === "redemption"
                                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                              }`}
                            >
                              {transaction.type === "accumulation" ? "Acúmulo" : transaction.type === "redemption" ? "Resgate" : "Cashback"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            R$ {transaction.amount?.toFixed(2) || "0.00"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="mt-4">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(page => {
                            // Mostrar primeira, última e páginas próximas à atual
                            return page === 1 || 
                                   page === totalPages || 
                                   (page >= currentPage - 1 && page <= currentPage + 1);
                          })
                          .map((page, index, array) => (
                            <>
                              {index > 0 && array[index - 1] !== page - 1 && (
                                <PaginationItem key={`ellipsis-${page}`}>
                                  <span className="px-4">...</span>
                                </PaginationItem>
                              )}
                              <PaginationItem key={page}>
                                <PaginationLink
                                  onClick={() => setCurrentPage(page)}
                                  isActive={currentPage === page}
                                  className="cursor-pointer"
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            </>
                          ))}
                        
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
  );
};

export default TransacoesRelatorio;
