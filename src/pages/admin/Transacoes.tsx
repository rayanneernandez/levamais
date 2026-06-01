import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Calendar, Eye } from "lucide-react";
import { format } from "date-fns";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 10;

export default function Transacoes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["admin-transactions", searchTerm, startDate, endDate, currentPage],
    queryFn: async () => {
      let query = supabase
        .from("webposto_transactions")
        .select(`
          *,
          clients (full_name, cpf),
          stores (name, cnpj),
          networks (name)
        `, { count: "exact" })
        .order("created_at", { ascending: false });

      if (searchTerm) {
        query = query.or(`codigo_voucher.ilike.%${searchTerm}%,codigo_venda.ilike.%${searchTerm}%,id_transacao.ilike.%${searchTerm}%`);
      }

      if (startDate) {
        query = query.gte("data_venda", startDate);
      }

      if (endDate) {
        query = query.lte("data_venda", endDate);
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data: webpostoData, error, count } = await query;

      if (error) throw error;

      // Buscar os pontos correspondentes da tabela transactions
      if (webpostoData && webpostoData.length > 0) {
        const idTransacoes = webpostoData.map((tx: any) => tx.id_transacao);
        
        const { data: transactionsData } = await supabase
          .from("transactions")
          .select("id, points, type, description, codigo_colaborador, nome_colaborador")
          .or(idTransacoes.map(id => `description.ilike.%${id}%`).join(','));

        // Mapear os pontos para cada transação
        const enrichedData = webpostoData.map((tx: any) => {
          const matchingTransaction = transactionsData?.find((t: any) => 
            t.description?.includes(tx.id_transacao)
          );
          return {
            ...tx,
            transaction_points: matchingTransaction?.points || null,
            transaction_type: matchingTransaction?.type || null,
            codigoColaborador: matchingTransaction?.codigo_colaborador || null,
            nomeColaborador: matchingTransaction?.nome_colaborador || null
          };
        });

        return { data: enrichedData, count };
      }

      return { data: webpostoData, count };
    },
  });

  const totalPages = transactions?.count ? Math.ceil(transactions.count / ITEMS_PER_PAGE) : 0;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      confirmed: "default",
      pending: "secondary",
      cancelled: "destructive",
    };

    const labels: Record<string, string> = {
      confirmed: "Confirmada",
      pending: "Pendente",
      cancelled: "Cancelada",
    };

    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transações</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie as transações do sistema</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por voucher, venda ou ID transação"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="datetime-local"
                placeholder="Data inicial"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="datetime-local"
                placeholder="Data final"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Transação</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Loja</TableHead>
                <TableHead>Rede</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor da Venda</TableHead>
                <TableHead>Cashback/Resgate</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    Carregando transações...
                  </TableCell>
                </TableRow>
              ) : transactions?.data && transactions.data.length > 0 ? (
                transactions.data.map((transaction: any) => {
                  const totalVenda = transaction.produtos?.reduce((sum: number, p: any) => 
                    sum + (parseFloat(p.valorVenda || 0)), 0
                  ) || 0;
                  // Usar transaction_type da tabela transactions (correto) ao invés de tipo_codigo
                  const isResgate = transaction.transaction_type === 'redemption';
                  // Pegar o valor de cashback/pontos
                  const cashbackValue = transaction.transaction_points 
                    ? Math.abs(parseFloat(transaction.transaction_points))
                    : (transaction.valor_cashback ? Math.abs(parseFloat(transaction.valor_cashback)) : 0);
                  
                  return (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-mono text-sm">{transaction.id_transacao}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{transaction.clients?.full_name || "N/A"}</div>
                          <div className="text-sm text-muted-foreground">{transaction.clients?.cpf || transaction.codigo_voucher}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{transaction.stores?.name || "N/A"}</div>
                          <div className="text-sm text-muted-foreground">{transaction.stores?.cnpj || transaction.codigo_empresa}</div>
                        </div>
                      </TableCell>
                      <TableCell>{transaction.networks?.name || "N/A"}</TableCell>
                      <TableCell>
                        {transaction.data_venda ? format(new Date(transaction.data_venda), "dd/MM/yyyy HH:mm") : "N/A"}
                      </TableCell>
                      <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                      <TableCell>
                        <Badge variant={isResgate ? "destructive" : "default"}>
                          {isResgate ? "Resgate" : "Acúmulo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalVenda)}
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cashbackValue)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedTransaction(transaction)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Nenhuma transação encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = i + 1;
              return (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => setCurrentPage(page)}
                    isActive={currentPage === page}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            {totalPages > 5 && <PaginationEllipsis />}
            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Transação</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (() => {
            const totalVenda = selectedTransaction.produtos?.reduce((sum: number, p: any) => 
              sum + (parseFloat(p.valorVenda || 0)), 0
            ) || 0;
            // Usar transaction_type da tabela transactions (correto) ao invés de tipo_codigo
            const isResgate = selectedTransaction.transaction_type === 'redemption';
            const cashbackValue = selectedTransaction.transaction_points 
              ? Math.abs(parseFloat(selectedTransaction.transaction_points))
              : (selectedTransaction.valor_cashback ? Math.abs(parseFloat(selectedTransaction.valor_cashback)) : 0);
            
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold mb-2">Informações Gerais</h3>
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">ID Transação:</dt>
                        <dd className="font-mono">{selectedTransaction.id_transacao}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Status:</dt>
                        <dd>{getStatusBadge(selectedTransaction.status)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Tipo:</dt>
                        <dd>
                          <Badge variant={isResgate ? "destructive" : "default"}>
                            {isResgate ? "Resgate" : "Acúmulo"}
                          </Badge>
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Data/Hora:</dt>
                        <dd>
                          {selectedTransaction.data_venda
                            ? format(new Date(selectedTransaction.data_venda), "dd/MM/yyyy HH:mm:ss")
                            : "N/A"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                <div>
                  <h3 className="font-semibold mb-2">Cliente</h3>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Nome:</dt>
                      <dd>{selectedTransaction.clients?.full_name || "N/A"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">CPF:</dt>
                      <dd>{selectedTransaction.clients?.cpf || selectedTransaction.codigo_voucher}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {(selectedTransaction.codigoColaborador || selectedTransaction.nomeColaborador) && (
                <div>
                  <h3 className="font-semibold mb-2">Atendente</h3>
                  <dl className="space-y-1 text-sm">
                    {selectedTransaction.codigoColaborador && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Código:</dt>
                        <dd className="font-mono">{selectedTransaction.codigoColaborador}</dd>
                      </div>
                    )}
                    {selectedTransaction.nomeColaborador && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Nome:</dt>
                        <dd>{selectedTransaction.nomeColaborador}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
              </div>

              <div>
                <h3 className="font-semibold mb-2">Loja e Rede</h3>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Loja:</dt>
                    <dd>{selectedTransaction.stores?.name || "N/A"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">CNPJ:</dt>
                    <dd>{selectedTransaction.stores?.cnpj || selectedTransaction.codigo_empresa}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Rede:</dt>
                    <dd>{selectedTransaction.networks?.name || "N/A"}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Valores</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Total da Venda:</dt>
                    <dd className="font-semibold text-lg">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalVenda)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{isResgate ? "Valor Resgatado:" : "Cashback Gerado:"}</dt>
                    <dd className="font-semibold">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cashbackValue)}
                    </dd>
                  </div>
                  {selectedTransaction.valor_desconto_unitario && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Desconto Unitário:</dt>
                      <dd>
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                          selectedTransaction.valor_desconto_unitario
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {selectedTransaction.produtos && Array.isArray(selectedTransaction.produtos) && (
                <div>
                  <h3 className="font-semibold mb-2">Produtos</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Valor Unit.</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTransaction.produtos.map((produto: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">{produto.codigoProduto}</TableCell>
                          <TableCell>{produto.nomeProduto}</TableCell>
                          <TableCell>{produto.quantidade}</TableCell>
                          <TableCell>
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                              parseFloat(produto.valorUnitario || 0)
                            )}
                          </TableCell>
                          <TableCell>
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                              parseFloat(produto.valorVenda || 0)
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {selectedTransaction.pagamentos && Array.isArray(selectedTransaction.pagamentos) && (
                <div>
                  <h3 className="font-semibold mb-2">Pagamentos</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTransaction.pagamentos.map((pagamento: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{pagamento.tipoPagamento}</TableCell>
                          <TableCell>
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                              pagamento.valorPagamento
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
