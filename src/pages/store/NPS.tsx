import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Search, Star, MessageSquare, User, Calendar, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NPSAutoReplyConfig } from "@/components/store/NPSAutoReplyConfig";

interface Rating {
  id: string;
  transaction_id: string;
  client_id: string;
  network_id: string;
  rating: number;
  comment: string | null;
  store_reply: string | null;
  reply_at: string | null;
  replied_by: string | null;
  created_at: string;
  updated_at: string;
  client: {
    name: string;
    cpf: string;
  };
  transaction: {
    amount: number;
    codigo_colaborador: string | null;
    nome_colaborador: string | null;
  };
  store: {
    name: string;
  };
}

const NPS = () => {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [filteredRatings, setFilteredRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRating, setSelectedRating] = useState<Rating | null>(null);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [showAutoReplyConfig, setShowAutoReplyConfig] = useState(false);
  const [networkId, setNetworkId] = useState<string>("");
  const itemsPerPage = 10;

  useEffect(() => {
    loadRatings();
  }, []);

  useEffect(() => {
    filterRatings();
  }, [searchTerm, startDate, endDate, ratings]);

  const loadRatings = async () => {
    try {
      setLoading(true);
      
      // Get user's network
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: managerData } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .single();

      if (!managerData?.network_id) return;
      
      setNetworkId(managerData.network_id);

      // Fetch ratings with related data
      const { data, error } = await supabase
        .from("transaction_ratings")
        .select(`
          id,
          transaction_id,
          client_id,
          network_id,
          rating,
          comment,
          store_reply,
          reply_at,
          replied_by,
          created_at,
          updated_at,
          clients (
            full_name,
            cpf
          ),
          transactions (
            amount,
            codigo_colaborador,
            nome_colaborador
          ),
          stores (
            name
          )
        `)
        .eq("network_id", managerData.network_id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedRatings = (data || []).map((r: any) => ({
        id: r.id,
        transaction_id: r.transaction_id,
        client_id: r.client_id,
        network_id: r.network_id,
        rating: r.rating,
        comment: r.comment,
        store_reply: r.store_reply,
        reply_at: r.reply_at,
        replied_by: r.replied_by,
        created_at: r.created_at,
        updated_at: r.updated_at,
        client: {
          name: r.clients?.full_name || "Cliente não encontrado",
          cpf: r.clients?.cpf || "",
        },
        transaction: {
          amount: r.transactions?.amount || 0,
          codigo_colaborador: r.transactions?.codigo_colaborador,
          nome_colaborador: r.transactions?.nome_colaborador,
        },
        store: {
          name: r.stores?.name || "Loja não encontrada",
        },
      }));

      setRatings(formattedRatings);
    } catch (error) {
      console.error("Error loading ratings:", error);
      toast.error("Erro ao carregar avaliações");
    } finally {
      setLoading(false);
    }
  };

  const filterRatings = () => {
    if (!searchTerm && !startDate && !endDate) {
      setFilteredRatings(ratings);
      return;
    }

    const filtered = ratings.filter((rating) => {
      const searchLower = searchTerm.toLowerCase();
      const ratingDate = new Date(rating.created_at);
      const start = startDate ? new Date(startDate + "T00:00:00") : null;
      const end = endDate ? new Date(endDate + "T23:59:59") : null;

      const matchesSearch = !searchTerm || (
        rating.client.name.toLowerCase().includes(searchLower) ||
        rating.store.name.toLowerCase().includes(searchLower) ||
        rating.transaction.nome_colaborador?.toLowerCase().includes(searchLower)
      );

      const matchesDateRange = (!start || ratingDate >= start) && (!end || ratingDate <= end);

      return matchesSearch && matchesDateRange;
    });

    setFilteredRatings(filtered);
    setCurrentPage(1);
  };

  const handleViewComment = (rating: Rating) => {
    setSelectedRating(rating);
    setShowCommentDialog(true);
  };

  const handleReply = (rating: Rating) => {
    setSelectedRating(rating);
    setReplyText(rating.store_reply || "");
    setShowReplyDialog(true);
  };

  const handleSubmitReply = async () => {
    if (!selectedRating || !replyText.trim()) {
      toast.error("Por favor, escreva uma resposta");
      return;
    }

    setSubmittingReply(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Atualizar a avaliação com a resposta
      const { error: updateError } = await supabase
        .from("transaction_ratings")
        .update({
          store_reply: replyText.trim(),
          reply_at: new Date().toISOString(),
          replied_by: user.id
        })
        .eq("id", selectedRating.id);

      if (updateError) throw updateError;

      // Criar notificação para o cliente
      const { data: notificationData, error: notifError } = await supabase
        .from("client_notifications")
        .insert({
          network_id: selectedRating.network_id,
          title: "💬 Nova Resposta na Avaliação",
          message: `A loja respondeu sua avaliação: "${replyText.trim()}"`,
          created_by: user.id
        })
        .select()
        .single();

      if (!notifError && notificationData) {
        await supabase
          .from("client_notification_recipients")
          .insert({
            notification_id: notificationData.id,
            client_id: selectedRating.client_id
          });
      }

      toast.success("Resposta enviada com sucesso!");
      setShowReplyDialog(false);
      setReplyText("");
      loadRatings();
    } catch (error) {
      console.error("Error submitting reply:", error);
      toast.error("Erro ao enviar resposta");
    } finally {
      setSubmittingReply(false);
    }
  };

  // Aplicar resposta automática quando houver uma regra configurada
  useEffect(() => {
    const applyAutoReply = async () => {
      if (!selectedRating || selectedRating.store_reply) return;

      try {
        // Buscar regra ativa para o número de estrelas
        const { data: rule } = await supabase
          .from("nps_auto_reply_rules")
          .select("*")
          .eq("network_id", networkId)
          .eq("stars", selectedRating.rating)
          .eq("is_active", true)
          .single();

        if (rule) {
          // Verificar se a regra requer comentário
          if (rule.require_comment && !selectedRating.comment) {
            // Não aplica a resposta automática se não houver comentário
            return;
          }
          setReplyText(rule.auto_reply_message);
        }
      } catch (error) {
        // Sem regra configurada, não faz nada
      }
    };

    applyAutoReply();
  }, [selectedRating, networkId]);

  // Pagination
  const totalPages = Math.ceil(filteredRatings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRatings = filteredRatings.slice(startIndex, endIndex);

  // Stats
  const averageRating = ratings.length > 0 
    ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
    : "0.0";

  const ratingDistribution = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: ratings.filter(r => r.rating === star).length,
    percentage: ratings.length > 0 
      ? Math.round((ratings.filter(r => r.rating === star).length / ratings.length) * 100)
      : 0,
  }));

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">NPS - Avaliações de Atendimento</h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe a satisfação dos seus clientes
          </p>
        </div>
        <Button
          onClick={() => setShowAutoReplyConfig(true)}
          variant="outline"
          className="flex items-center gap-2"
        >
          <Settings className="h-4 w-4" />
          Configurar Respostas Automáticas
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total de Avaliações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{ratings.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Média Geral</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-3xl font-bold">{averageRating}</div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 ${
                      star <= Math.round(parseFloat(averageRating))
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    }`}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Com Comentários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {ratings.filter(r => r.comment).length}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {ratings.length > 0 
                ? Math.round((ratings.filter(r => r.comment).length / ratings.length) * 100)
                : 0}% do total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rating Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição das Avaliações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {ratingDistribution.map(({ star, count, percentage }) => (
              <div key={star} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-20">
                  <span className="text-sm font-medium">{star}</span>
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                </div>
                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-16 text-right">
                  {count} ({percentage}%)
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-end gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente, loja ou atendente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Data Início</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full md:w-auto"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="endDate">Data Fim</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full md:w-auto"
                  />
                </div>
              </div>
              
              <Button 
                onClick={() => {
                  setSearchTerm("");
                  setStartDate(format(startOfMonth(new Date()), "yyyy-MM-dd"));
                  setEndDate(format(endOfMonth(new Date()), "yyyy-MM-dd"));
                }} 
                variant="outline"
                className="w-full md:w-auto"
              >
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ratings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Avaliações</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : filteredRatings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma avaliação encontrada
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Atendente</TableHead>
                    <TableHead>Avaliação</TableHead>
                    <TableHead>Comentário</TableHead>
                    <TableHead>Resposta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRatings.map((rating) => (
                    <TableRow key={rating.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(rating.created_at), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {rating.client.name}
                        </div>
                      </TableCell>
                      <TableCell>{rating.store.name}</TableCell>
                      <TableCell>
                        {rating.transaction.nome_colaborador || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{renderStars(rating.rating)}</TableCell>
                      <TableCell>
                        {rating.comment ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewComment(rating)}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Ver
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant={rating.store_reply ? "secondary" : "default"}
                          size="sm"
                          onClick={() => handleReply(rating)}
                        >
                          {rating.store_reply ? "Ver Resposta" : "Responder"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
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

      {/* Comment Dialog */}
      <Dialog open={showCommentDialog} onOpenChange={setShowCommentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comentário da Avaliação</DialogTitle>
          </DialogHeader>
          {selectedRating && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Cliente:</p>
                <p className="text-sm text-muted-foreground">{selectedRating.client.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Avaliação:</p>
                {renderStars(selectedRating.rating)}
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Comentário:</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedRating.comment}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Data:</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(selectedRating.created_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={showReplyDialog} onOpenChange={setShowReplyDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRating?.store_reply ? "Resposta da Loja" : "Responder Avaliação"}
            </DialogTitle>
          </DialogHeader>
          {selectedRating && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">Cliente:</p>
                  <p className="text-sm text-muted-foreground">{selectedRating.client.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Avaliação:</p>
                  {renderStars(selectedRating.rating)}
                </div>
              </div>
              
              {selectedRating.comment && (
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-sm font-medium mb-2">Comentário do Cliente:</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedRating.comment}</p>
                </div>
              )}
              
              <div>
                <Label htmlFor="reply">Sua Resposta</Label>
                <Textarea
                  id="reply"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Escreva sua resposta ao cliente..."
                  className="mt-2 min-h-[120px]"
                  disabled={!!selectedRating.store_reply}
                />
                {selectedRating.reply_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Respondido em: {format(new Date(selectedRating.reply_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
              
              {!selectedRating.store_reply && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowReplyDialog(false);
                      setReplyText("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSubmitReply}
                    disabled={submittingReply || !replyText.trim()}
                  >
                    {submittingReply ? "Enviando..." : "Enviar Resposta"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de configuração de respostas automáticas */}
      <NPSAutoReplyConfig
        open={showAutoReplyConfig}
        onOpenChange={setShowAutoReplyConfig}
        networkId={networkId}
      />
    </div>
  );
};

export default NPS;
