import { useState, useEffect, useRef } from "react";
import { Sparkles, X, Send, Calendar, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface InsightsChatProps {
  networkId: string;
}

export default function InsightsChat({ networkId }: InsightsChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasPackage, setHasPackage] = useState(false);
  const [creditsInfo, setCreditsInfo] = useState({ limit: 0, used: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkPackage();
  }, [networkId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const checkPackage = async () => {
    try {
      const { data, error } = await supabase
        .from("networks")
        .select("ai_credits_limit, ai_credits_used")
        .eq("id", networkId)
        .single();

      if (error) throw error;

      const hasCredits = (data.ai_credits_limit || 0) > 0;
      setHasPackage(hasCredits);
      setCreditsInfo({
        limit: data.ai_credits_limit || 0,
        used: data.ai_credits_used || 0,
      });
    } catch (error: any) {
      console.error("Erro ao verificar pacote:", error);
    }
  };

  const handleQuickReport = async (reportType: string, label: string) => {
    const reportMessage = `Gerar resumo: ${label}`;
    const userMessage: Message = { role: "user", content: reportMessage };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const timezoneOffset = new Date().getTimezoneOffset();
      
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "chat-insights",
        {
          body: {
            messages: [...messages, userMessage],
            networkId: networkId,
            timezoneOffset: timezoneOffset,
            reportType: reportType, // Novo parâmetro
          },
        }
      );

      if (functionError) throw functionError;

      if (functionData.error) {
        if (functionData.error.includes("créditos insuficientes")) {
          toast({
            title: "Créditos Insuficientes",
            description: "Seus créditos de IA acabaram. Entre em contato com o suporte para renovar.",
            variant: "destructive",
          });
        } else if (functionData.error.includes("Rate limit")) {
          toast({
            title: "Muitas requisições",
            description: "Você fez muitas perguntas em pouco tempo. Aguarde um momento.",
            variant: "destructive",
          });
        } else {
          throw new Error(functionData.error);
        }
        return;
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: functionData.response,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (functionData.creditsUsed) {
        setCreditsInfo((prev) => ({
          ...prev,
          used: prev.used + functionData.creditsUsed,
        }));
      }
    } catch (error: any) {
      console.error("Erro no chat:", error);
      toast({
        title: "Erro ao processar",
        description: "Não foi possível processar sua mensagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const timezoneOffset = new Date().getTimezoneOffset();
      
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "chat-insights",
        {
          body: {
            messages: [...messages, userMessage],
            networkId: networkId,
            timezoneOffset: timezoneOffset,
          },
        }
      );

      if (functionError) throw functionError;

      if (functionData.error) {
        if (functionData.error.includes("créditos insuficientes")) {
          toast({
            title: "Créditos Insuficientes",
            description: "Seus créditos de IA acabaram. Entre em contato com o suporte para renovar.",
            variant: "destructive",
          });
        } else if (functionData.error.includes("Rate limit")) {
          toast({
            title: "Muitas requisições",
            description: "Você fez muitas perguntas em pouco tempo. Aguarde um momento.",
            variant: "destructive",
          });
        } else {
          throw new Error(functionData.error);
        }
        return;
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: functionData.response,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Atualizar créditos
      if (functionData.creditsUsed) {
        setCreditsInfo((prev) => ({
          ...prev,
          used: prev.used + functionData.creditsUsed,
        }));
      }
    } catch (error: any) {
      console.error("Erro no chat:", error);
      toast({
        title: "Erro ao processar",
        description: "Não foi possível processar sua mensagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!hasPackage) return null;

  const creditsRemaining = creditsInfo.limit - creditsInfo.used;
  const creditsPercentage = (creditsInfo.used / creditsInfo.limit) * 100;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-glow shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-50"
        aria-label="Abrir Assistente de Insights"
      >
        <Sparkles className="h-6 w-6 text-primary-foreground" />
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl h-[600px] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Assistente de Insights
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={creditsPercentage > 80 ? "destructive" : "secondary"}>
                  {creditsRemaining} +Coins restantes
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
            <div className="space-y-4 py-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 text-primary opacity-50" />
                  <p className="text-lg font-medium mb-2">
                    Olá! Sou seu assistente de insights inteligente.
                  </p>
                  <p className="text-sm mb-4">
                    Tenho acesso completo aos dados da sua rede e posso responder sobre vendas, clientes, campanhas, combustível, indicações, retenção e muito mais!
                  </p>
                  
                  {/* Resumos Rápidos */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 justify-center mb-3">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">Resumos Rápidos</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-left max-w-2xl mx-auto">
                      <button
                        onClick={() => handleQuickReport("yesterday", "Dia Anterior")}
                        disabled={isLoading}
                        className="p-2 rounded-lg border border-border hover:bg-primary/10 hover:border-primary transition-colors text-xs font-medium disabled:opacity-50"
                      >
                        📅 Dia Anterior
                      </button>
                      <button
                        onClick={() => handleQuickReport("today", "Hoje até Agora")}
                        disabled={isLoading}
                        className="p-2 rounded-lg border border-border hover:bg-primary/10 hover:border-primary transition-colors text-xs font-medium disabled:opacity-50"
                      >
                        🕐 Hoje até Agora
                      </button>
                      <button
                        onClick={() => handleQuickReport("last7days", "Últimos 7 Dias")}
                        disabled={isLoading}
                        className="p-2 rounded-lg border border-border hover:bg-primary/10 hover:border-primary transition-colors text-xs font-medium disabled:opacity-50"
                      >
                        📊 Últimos 7 Dias
                      </button>
                      <button
                        onClick={() => handleQuickReport("last15days", "Últimos 15 Dias")}
                        disabled={isLoading}
                        className="p-2 rounded-lg border border-border hover:bg-primary/10 hover:border-primary transition-colors text-xs font-medium disabled:opacity-50"
                      >
                        📈 Últimos 15 Dias
                      </button>
                      <button
                        onClick={() => handleQuickReport("last30days", "Últimos 30 Dias")}
                        disabled={isLoading}
                        className="p-2 rounded-lg border border-border hover:bg-primary/10 hover:border-primary transition-colors text-xs font-medium disabled:opacity-50"
                      >
                        📉 Últimos 30 Dias
                      </button>
                      <button
                        onClick={() => handleQuickReport("lastmonth", "Último Mês Fechado")}
                        disabled={isLoading}
                        className="p-2 rounded-lg border border-border hover:bg-primary/10 hover:border-primary transition-colors text-xs font-medium disabled:opacity-50"
                      >
                        🗓️ Mês Anterior
                      </button>
                    </div>
                  </div>

                  {/* Perguntas Sugeridas */}
                  <div>
                    <div className="flex items-center gap-2 justify-center mb-3">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">Perguntas Sugeridas</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-left max-w-md mx-auto">
                      <button
                        onClick={() => setInput("Quantas vendas tivemos hoje?")}
                        className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-sm"
                      >
                        📊 Quantas vendas hoje?
                      </button>
                      <button
                        onClick={() => setInput("Como estão nossas campanhas de marketing?")}
                        className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-sm"
                      >
                        📢 Status das campanhas?
                      </button>
                      <button
                        onClick={() => setInput("Quantos clientes estão inativos?")}
                        className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-sm"
                      >
                        👥 Clientes inativos?
                      </button>
                      <button
                        onClick={() => setInput("Como está o programa de indicação?")}
                        className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-sm"
                      >
                        🎁 Programa de indicação?
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`rounded-lg px-4 py-2 max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-primary-foreground font-semibold text-xs">
                      Você
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                  </div>
                  <div className="rounded-lg px-4 py-2 bg-muted">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex gap-2 pt-4 border-t">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Pergunte algo sobre seus dados..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
