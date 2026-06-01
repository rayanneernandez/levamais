import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { Zap, ArrowRight, Check, Sparkles, TrendingUp, Users, BarChart3, Store, User, ShoppingCart, Gift, Headphones, MessageCircle, Globe, Instagram, Mail } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoWhite from "@/assets/logo-white.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const IndexAlt = () => {
  const navigate = useNavigate();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [journeyStep, setJourneyStep] = useState(0);
  const [isJourneyActive, setIsJourneyActive] = useState(false);
  const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = useState(false);
  const [whatsAppName, setWhatsAppName] = useState("");
  const [whatsAppPhone, setWhatsAppPhone] = useState("");
  const [whatsAppEmail, setWhatsAppEmail] = useState("");

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleContactSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      company: formData.get('company') as string,
      stores: formData.get('stores') as string,
      message: formData.get('message') as string,
    };

    try {
      const { data: result, error } = await supabase.functions.invoke('send-contact-email', {
        body: data,
      });

      if (error) throw error;
      
      if (!result?.success) {
        throw new Error("Falha ao enviar email");
      }

      toast({
        title: "Mensagem enviada!",
        description: "Nossa equipe entrará em contato em até 24 horas. Verifique seu email para confirmação.",
      });

      form.reset();
    } catch (error: any) {
      console.error('Error sending contact email:', error);
      toast({
        title: "Erro ao enviar mensagem",
        description: "Por favor, tente novamente ou entre em contato pelo WhatsApp.",
        variant: "destructive",
      });
    }
  };

  const openWhatsApp = () => {
    setIsWhatsAppDialogOpen(true);
  };

  const handleWhatsAppSubmit = async () => {
    // Validação básica
    if (!whatsAppName.trim() || !whatsAppPhone.trim() || !whatsAppEmail.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive",
      });
      return false;
    }

    // Validação de nome (mínimo 3 caracteres)
    if (whatsAppName.trim().length < 3) {
      toast({
        title: "Nome inválido",
        description: "Nome deve ter pelo menos 3 caracteres.",
        variant: "destructive",
      });
      return false;
    }

    // Validação de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(whatsAppEmail.trim())) {
      toast({
        title: "E-mail inválido",
        description: "Por favor, insira um e-mail válido.",
        variant: "destructive",
      });
      return false;
    }

    // Validação de telefone (mínimo 10 dígitos)
    const phoneDigits = whatsAppPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast({
        title: "Telefone inválido",
        description: "Telefone deve ter pelo menos 10 dígitos.",
        variant: "destructive",
      });
      return false;
    }

    console.log("Salvando lead:", { name: whatsAppName, phone: whatsAppPhone, email: whatsAppEmail });

    // Salvar lead em background (não bloqueia)
    supabase
      .from("leads")
      .insert({
        name: whatsAppName.trim(),
        phone: phoneDigits,
        email: whatsAppEmail.trim().toLowerCase(),
        source: "whatsapp_button",
        status: "new",
      })
      .select()
      .then(({ data, error }) => {
        if (error) {
          console.error("Erro ao salvar lead:", error);
        } else {
          console.log("Lead salvo com sucesso:", data);
          toast({
            title: "Dados salvos!",
            description: "Suas informações foram registradas com sucesso.",
          });
        }
      });

    // Limpar campos e fechar modal
    const userName = whatsAppName.trim();
    setWhatsAppName("");
    setWhatsAppPhone("");
    setWhatsAppEmail("");
    setIsWhatsAppDialogOpen(false);
    
    // Redirecionar para WhatsApp
    setTimeout(() => {
      const message = encodeURIComponent(`Olá, vim do site e gostaria de conhecer o Leva+. Meu nome é ${userName}.`);
      window.open(`https://api.whatsapp.com/send/?phone=552139507641&text=${message}&type=phone_number&app_absent=0`, "_blank");
    }, 500);
    
    return true;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden relative">
      {/* Animated gradient background */}
      <div 
        className="fixed inset-0 opacity-20"
        style={{
          background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(0, 255, 255, 0.1), transparent 50%)`,
        }}
      />
      
      {/* Grid overlay */}
      <div 
        className="fixed inset-0 opacity-5"
        style={{
          backgroundImage: 'linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
          transform: `translateY(${scrollY * 0.3}px)`,
        }}
      />

      {/* Header - Minimal */}
      <header className="fixed top-0 w-full z-50 backdrop-blur-xl bg-slate-950/80 border-b border-cyan-500/30">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <img src={logoWhite} alt="Leva+" className="h-12" />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black bg-transparent transition-all duration-300 font-bold"
              >
                ACESSAR
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-black border-cyan-500/50 z-50">
              <DropdownMenuItem 
                className="text-white hover:bg-cyan-500/20 cursor-pointer focus:bg-cyan-500/20 focus:text-white"
                onClick={() => navigate("/levaloja/auth")}
              >
                <Store className="mr-2 h-4 w-4 text-cyan-400" />
                Leva+ Lojista
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-white hover:bg-purple-500/20 cursor-pointer focus:bg-purple-500/20 focus:text-white"
                onClick={() => navigate("/levacliente/auth")}
              >
                <User className="mr-2 h-4 w-4 text-purple-400" />
                Leva+ Cliente
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Hero - Bold Statement */}
      <section className="min-h-screen flex items-center justify-center relative pt-16 bg-slate-950">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-6xl mx-auto">
            {/* Tag + Headline */}
            <div className="text-center space-y-6 mb-12">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] animate-fade-in">
                <span className="block text-white">Fidelize clientes de forma</span>
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600">
                  simples, automática
                </span>
                <span className="block text-white">e sem complicação.</span>
              </h1>

              <p className="text-sm md:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed animate-fade-in mt-6">
                O Leva+ Fidelidade nasceu para ser diferente: <span className="text-cyan-400 font-bold">comprou → pontua → voltou → resgata</span>.
              </p>
            </div>


            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in mt-12">
              <Button 
                size="lg"
                onClick={openWhatsApp}
                className="bg-cyan-400 hover:bg-cyan-500 text-black font-bold text-base px-6 py-5 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(0,255,255,0.5)] w-full sm:w-auto"
              >
                👉 Quero fidelizar meus clientes
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-cyan-400/50 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-cyan-400 rounded-full mt-2 animate-pulse" />
          </div>
        </div>
      </section>

      {/* Why Retention Section */}
      <section className="py-16 md:py-24 relative bg-slate-900 border-y border-cyan-500/20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl md:text-4xl font-black leading-tight">
                <span className="text-white">Reter é mais</span>
                <span className="block text-cyan-400">lucrativo do que conquistar.</span>
              </h2>
              <div className="h-1 w-24 bg-cyan-400 mx-auto" />
              <p className="text-sm md:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed mt-6">
                Você sabia que:
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {[
                { stat: "5x", desc: "Manter um cliente custa até 5x menos do que conquistar um novo" },
                { stat: "95%", desc: "Aumentar sua taxa de retenção em 5% pode elevar o lucro em até 95%" },
                { stat: "67%", desc: "Clientes fiéis gastam em média 67% a mais do que novos clientes" },
                { stat: "80%+", desc: "No varejo, a taxa média de retenção é 63% — os melhores passam dos 80%" },
              ].map((item, i) => (
                <Card 
                  key={i}
                  className="p-6 bg-cyan-500/5 border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300 group"
                >
                  <div className="text-3xl md:text-4xl font-black text-cyan-400 mb-3">{item.stat}</div>
                  <p className="text-slate-300 text-sm leading-relaxed">{item.desc}</p>
                </Card>
              ))}
            </div>

            <p className="text-center text-base md:text-lg text-white font-bold mt-12">
              Esses números mostram uma verdade simples: fidelizar é o melhor investimento que seu posto ou loja pode fazer.
            </p>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-16 md:py-24 relative bg-slate-950 border-y border-red-500/20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl md:text-4xl font-black leading-tight">
                <span className="text-white">O que você já</span>
                <span className="block text-red-500">cansou de ver por aí...</span>
              </h2>
              <div className="h-1 w-24 bg-red-500 mx-auto" />
            </div>

            <div className="flex flex-col items-center gap-6 mb-12">
              {/* Primeira linha - 3 cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
                {[
                  { icon: "🎴", desc: "Cartões de fidelidade que o cliente perde ou esquece" },
                  { icon: "📱", desc: "Apps que ninguém usa, cada um de um fornecedor diferente" },
                  { icon: "🔌", desc: "Falta de integração com o sistema de vendas (ERP)" },
                ].map((item, i) => (
                  <Card 
                    key={i}
                    className="p-6 bg-red-500/5 border-red-500/20 hover:border-red-500/40 transition-all duration-300 hover:scale-105 group"
                  >
                    <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">{item.icon}</div>
                    <p className="text-slate-300 text-sm leading-relaxed">{item.desc}</p>
                  </Card>
                ))}
              </div>
              
              {/* Segunda linha - 2 cards (pirâmide) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
                {[
                  { icon: "📊", desc: "Processos manuais, relatórios confusos e sem controle real" },
                  { icon: "💸", desc: "Custos altos para manter um programa que não gera resultado" },
                ].map((item, i) => (
                  <Card 
                    key={i}
                    className="p-6 bg-red-500/5 border-red-500/20 hover:border-red-500/40 transition-all duration-300 hover:scale-105 group"
                  >
                    <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">{item.icon}</div>
                    <p className="text-slate-300 text-sm leading-relaxed">{item.desc}</p>
                  </Card>
                ))}
              </div>
            </div>

            <div className="text-center">
              <p className="text-xl md:text-2xl text-cyan-400 font-black">
                👉 Nós resolvemos tudo isso.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="como-funciona" className="py-16 md:py-24 relative bg-slate-900 border-y border-cyan-500/20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl md:text-4xl font-black leading-tight">
                <span className="text-white">Nascemos</span>
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600">
                  simples, automáticos e integrados.
                </span>
              </h2>
              <div className="h-1 w-24 bg-gradient-to-r from-cyan-400 to-purple-600 mx-auto" />
            </div>

            {/* Jornada Interativa - "Jogo" */}
            <div className="relative max-w-5xl mx-auto mb-12">
              {!isJourneyActive ? (
                // Estado inicial - Convite para começar
                <div className="text-center py-8">
                  <div className="inline-block mb-4 text-5xl animate-bounce">
                    🎮
                  </div>
                  <h3 className="text-xl md:text-2xl font-black text-white mb-3">
                    Veja na prática como funciona
                  </h3>
                  <p className="text-slate-300 text-sm mb-6 max-w-xl mx-auto">
                    Clique no botão abaixo e acompanhe passo a passo a jornada do seu cliente
                  </p>
                  <Button
                    size="lg"
                    onClick={() => {
                      setIsJourneyActive(true);
                      setJourneyStep(0);
                    }}
                    className="bg-gradient-to-r from-cyan-400 to-purple-600 hover:from-cyan-500 hover:to-purple-700 text-white font-bold px-8 py-4 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(0,255,255,0.4)]"
                  >
                    🚀 INICIAR JORNADA
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ) : (
                // Jornada ativa - Passo a passo
                <div className="space-y-6">
                  {/* Progresso */}
                  <div className="flex items-center justify-center gap-2 mb-4">
                    {[0, 1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-2 rounded-full transition-all duration-500 ${
                          step <= journeyStep
                            ? 'w-12 bg-gradient-to-r from-cyan-400 to-purple-600'
                            : 'w-8 bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Etapa 0: Cliente chega */}
                  {journeyStep === 0 && (
                    <div className="animate-fade-in text-center space-y-4">
                      <div className="text-6xl mb-2 animate-scale-in">🚶‍♂️</div>
                      <h3 className="text-2xl font-black text-white">
                        Cliente chega na conveniência
                      </h3>
                      <p className="text-slate-300 text-sm max-w-xl mx-auto">
                        João precisa fazer compras na loja de conveniência
                      </p>
                      <Button
                        size="lg"
                        onClick={() => setJourneyStep(1)}
                        className="bg-cyan-400 hover:bg-cyan-500 text-black font-bold px-6 py-3 rounded-xl transition-all duration-300 hover:scale-105"
                      >
                        PRÓXIMO →
                      </Button>
                    </div>
                  )}

                  {/* Etapa 1: Realiza a compra */}
                  {journeyStep === 1 && (
                    <div className="animate-fade-in text-center space-y-4">
                      <div className="text-6xl mb-2 animate-scale-in">🛒</div>
                      <h3 className="text-2xl font-black text-white">
                        Realiza a compra
                      </h3>
                      <div className="bg-slate-800/50 border border-cyan-500/30 rounded-xl p-6 max-w-md mx-auto">
                        <p className="text-slate-300 text-sm mb-2">
                          João comprou:
                        </p>
                        <p className="text-4xl font-black text-cyan-400 mb-1">
                          R$ 100,00
                        </p>
                        <p className="text-slate-400 text-xs">
                          Produtos da conveniência
                        </p>
                      </div>
                      <Button
                        size="lg"
                        onClick={() => setJourneyStep(2)}
                        className="bg-cyan-400 hover:bg-cyan-500 text-black font-bold px-6 py-3 rounded-xl transition-all duration-300 hover:scale-105"
                      >
                        PRÓXIMO →
                      </Button>
                    </div>
                  )}

                  {/* Etapa 2: Sistema pontua automaticamente */}
                  {journeyStep === 2 && (
                    <div className="animate-fade-in text-center space-y-3">
                      <div className="text-6xl mb-2 animate-scale-in">⚡</div>
                      <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600">
                        Cashback automático!
                      </h3>
                      <div className="bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 max-w-md mx-auto">
                        <p className="text-slate-300 text-sm mb-1">
                          Nessa loja, o cashback é de 1%
                        </p>
                        <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600 mb-1 animate-pulse">
                          +R$ 1,00
                        </p>
                        <p className="text-slate-400 text-xs mb-2">
                          João acumulou dessa compra
                        </p>
                        <div className="border-t border-white/10 pt-2">
                          <p className="text-slate-400 text-xs mb-1">João é cliente frequente e já tinha:</p>
                          <p className="text-xl font-black text-purple-400">
                            R$ 14,00
                          </p>
                          <p className="text-slate-500 text-xs">de cashback acumulado</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-3 text-xs text-slate-400">
                        <Check className="h-4 w-4 text-cyan-400" />
                        <span>Integrado ao checkout</span>
                        <Check className="h-4 w-4 text-cyan-400" />
                        <span>Sem burocracia</span>
                      </div>
                      <Button
                        size="lg"
                        onClick={() => setJourneyStep(3)}
                        className="bg-purple-400 hover:bg-purple-500 text-black font-bold px-6 py-3 rounded-xl transition-all duration-300 hover:scale-105"
                      >
                        PRÓXIMO →
                      </Button>
                    </div>
                  )}

                  {/* Etapa 3: Cliente volta */}
                  {journeyStep === 3 && (
                    <div className="animate-fade-in text-center space-y-4">
                      <div className="text-6xl mb-2 animate-scale-in">🔄</div>
                      <h3 className="text-2xl font-black text-white">
                        João volta alguns dias depois
                      </h3>
                      <p className="text-slate-300 text-sm max-w-xl mx-auto">
                        Ao chegar no caixa para pagar as novas compras...
                      </p>
                      <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-5 max-w-md mx-auto">
                        <p className="text-slate-400 text-xs mb-1">Saldo de cashback disponível:</p>
                        <p className="text-3xl font-black text-purple-400">
                          R$ 15,00
                        </p>
                        <p className="text-slate-500 text-xs mt-1">(R$ 14,00 anteriores + R$ 1,00 da última compra)</p>
                      </div>
                      <Button
                        size="lg"
                        onClick={() => setJourneyStep(4)}
                        className="bg-purple-400 hover:bg-purple-500 text-black font-bold px-6 py-3 rounded-xl transition-all duration-300 hover:scale-105"
                      >
                        PRÓXIMO →
                      </Button>
                    </div>
                  )}

                  {/* Etapa 4: Resgate e conclusão */}
                  {journeyStep === 4 && (
                    <div className="animate-fade-in text-center space-y-4">
                      <div className="text-6xl mb-2 animate-scale-in">🎉</div>
                      <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600">
                        Desconto automático aplicado!
                      </h3>
                      <div className="bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-cyan-500/10 border border-cyan-500/30 rounded-xl p-6 max-w-md mx-auto">
                        <p className="text-slate-300 text-sm mb-2">
                          João foi ao caixa e recebeu automaticamente:
                        </p>
                        <p className="text-4xl font-black text-cyan-400 mb-2">
                          -R$ 15,00
                        </p>
                        <p className="text-slate-400 text-xs mb-4">
                          de desconto no valor total da compra
                        </p>
                        <div className="border-t border-white/10 pt-3">
                          <p className="text-base font-bold text-white mb-1">
                            Resultado: Cliente fidelizado! 😊
                          </p>
                          <p className="text-xs text-slate-400">
                            Ele vai continuar voltando para usar seu cashback
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button
                          size="lg"
                          onClick={() => {
                            setJourneyStep(0);
                          }}
                          variant="outline"
                          className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black font-bold px-6 py-3 rounded-xl transition-all duration-300"
                        >
                          🔄 VER NOVAMENTE
                        </Button>
                        <Button
                          size="lg"
                          onClick={openWhatsApp}
                          className="bg-gradient-to-r from-cyan-400 to-purple-600 hover:from-cyan-500 hover:to-purple-700 text-white font-bold px-6 py-3 rounded-xl transition-all duration-300 hover:scale-105"
                        >
                          QUERO ISSO PRO MEU NEGÓCIO
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Botão para sair */}
                  {journeyStep < 4 && (
                    <div className="text-center pt-4">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setIsJourneyActive(false);
                          setJourneyStep(0);
                        }}
                        className="text-slate-500 hover:text-white text-sm"
                      >
                        ← Voltar
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>


            {/* Diferenciais */}
            <div className="bg-slate-950/50 rounded-2xl p-6 md:p-10 border border-cyan-500/20">
              <h3 className="text-2xl md:text-3xl font-black text-center mb-10">
                <span className="text-cyan-400">Nossos diferenciais</span>
              </h3>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[
                  { icon: <Users className="h-6 w-6" />, text: "Clientes ilimitados" },
                  { icon: <TrendingUp className="h-6 w-6" />, text: "Transações ilimitadas" },
                  { icon: <BarChart3 className="h-6 w-6" />, text: "Dashboard geral e por CNPJ" },
                  { icon: <Zap className="h-6 w-6" />, text: "Relatórios com projeções" },
                  { icon: <Store className="h-6 w-6" />, text: "Portal do Posto/Loja + Cliente" },
                  { icon: <Headphones className="h-6 w-6" />, text: "Suporte via WhatsApp" },
                  { icon: <Sparkles className="h-6 w-6" />, text: "Rápido para assinar e implantar" },
                  { icon: <Sparkles className="h-6 w-6" />, text: "Em breve: novas integrações" },
                  { icon: <Check className="h-6 w-6" />, text: "Cashback OU Pontos" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-slate-300">
                    <div className="flex-shrink-0 text-cyan-400">
                      {item.icon}
                    </div>
                    <span className="text-sm md:text-base">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center mt-12">
              <Button 
                size="lg"
                onClick={openWhatsApp}
                className="bg-gradient-to-r from-cyan-400 to-purple-600 hover:from-cyan-500 hover:to-purple-700 text-white font-bold text-base px-8 py-5 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(0,255,255,0.4)]"
              >
                QUERO ISSO PRO MEU NEGÓCIO
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>


      <section className="py-16 md:py-24 relative bg-slate-950 border-y border-purple-500/20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-black leading-tight mb-6">
              <span className="text-white">Feito para</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600">
                Postos de Gasolina e Lojas de Conveniência
              </span>
            </h2>
            <div className="h-1 w-24 bg-gradient-to-r from-cyan-400 to-purple-600 mx-auto mb-8" />
            
            <p className="text-sm md:text-base text-slate-300 leading-relaxed mb-6">
              Seu público é recorrente, o fluxo é constante e as compras são repetidas.
            </p>
            <p className="text-base md:text-lg text-white font-bold">
              Fidelizar nesse segmento é o caminho mais rápido para aumentar receita e ticket médio.
            </p>
            <p className="text-sm md:text-base text-slate-400 mt-8">
              O Leva+ foi criado para esse mercado — com <span className="text-cyan-400 font-bold">implantação rápida, visual limpo e controle total</span>.
            </p>
          </div>
        </div>
      </section>



      {/* Pricing - Promoção */}
      <section className="py-12 md:py-16 relative bg-slate-950 border-y border-cyan-500/20" id="planos">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8 space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/20 border border-red-500/50 mb-2">
                <Sparkles className="h-3 w-3 text-red-400" />
                <span className="text-xs font-bold text-red-400">PROMOÇÃO ATÉ MARÇO/2026</span>
              </div>
              
              <h2 className="text-2xl md:text-3xl font-black leading-tight">
                <span className="text-white">Simples até </span>
                <span className="text-cyan-400">no preço.</span>
              </h2>
              <div className="h-1 w-20 bg-cyan-400 mx-auto" />
            </div>

            <div className="relative p-6 md:p-8 rounded-lg bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-2 border-cyan-500/30 overflow-hidden group hover:border-cyan-500/50 transition-all duration-300 shadow-xl">
              <div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                💥 PROMOÇÃO
              </div>
              
              <div className="relative z-10 space-y-4">
                {/* Preços */}
                <div className="grid md:grid-cols-2 gap-4 pb-4">
                  <div className="text-center">
                    <p className="text-sm text-cyan-400 font-bold mb-2 uppercase tracking-wider">Implantação</p>
                    <div className="text-slate-500 line-through text-sm mb-1">De R$ 799,00</div>
                    <div className="text-3xl md:text-4xl font-black text-cyan-400 mb-1">
                      <span className="text-base text-slate-400">por </span>R$ 599
                      <span className="text-base text-slate-400">/único</span>
                    </div>
                    <p className="text-sm text-slate-300 font-bold">por CNPJ</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-cyan-400 font-bold mb-2 uppercase tracking-wider">Assinatura</p>
                    <div className="text-slate-500 line-through text-sm mb-1">De R$ 399,00</div>
                    <div className="text-3xl md:text-4xl font-black text-cyan-400 mb-1">
                      <span className="text-base text-slate-400">por </span>R$ 299
                      <span className="text-base text-slate-400">/mês</span>
                    </div>
                    <p className="text-sm text-slate-300 font-bold">por CNPJ</p>
                  </div>
                </div>

                {/* Inclui */}
                <div className="bg-slate-800/30 border border-cyan-500/20 rounded-xl p-4">
                  <h3 className="text-base font-bold text-cyan-400 mb-4 text-center uppercase tracking-wide">O que inclui</h3>
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-4 max-w-3xl mx-auto">
                    {[
                      ["Clientes ilimitados", "Relatórios e projeções", "Suporte WhatsApp"],
                      ["Transações ilimitadas", "Portal do Posto/Loja", "Integração WebPosto"],
                      ["Dashboard completo", "Portal do Cliente", "Monitoramento de Transações"]
                    ].map((col, colIndex) => (
                      <div key={colIndex} className={`space-y-3 ${colIndex === 0 ? 'ml-12' : ''} ${colIndex === 1 ? 'flex flex-col items-center' : ''} ${colIndex === 2 ? 'ml-auto' : ''}`}>
                        {col.map((item, i) => item && (
                          <div key={i} className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                            <span className="text-base text-slate-300">{item}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <div className="pt-2">
                  <Button 
                    size="lg"
                    onClick={openWhatsApp}
                    className="w-full bg-cyan-400 hover:bg-cyan-500 text-black font-bold text-sm md:text-base py-4 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(0,255,255,0.4)]"
                  >
                    🚀 QUERO IMPLANTAR AGORA
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-red-400 font-bold text-sm">
                💥 Promoção válida até março de 2026
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 relative bg-slate-950 border-y border-cyan-500/20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl md:text-4xl font-black leading-tight">
                <span className="text-cyan-400">Perguntas frequentes</span>
              </h2>
              <div className="h-1 w-24 bg-cyan-400 mx-auto" />
            </div>

            <Accordion type="single" collapsible className="space-y-4">
              {[
                {
                  q: "Posso escolher entre pontos e cashback?",
                  a: "Sim! Você define o modelo ideal para o seu negócio."
                },
                {
                  q: "É compatível com meu sistema?",
                  a: "Atualmente integrado ao WebPosto — novas integrações estão em andamento."
                },
                {
                  q: "Tem limite de clientes ou transações?",
                  a: "Não. Todos os planos têm clientes e transações ilimitadas."
                },
                {
                  q: "Quanto tempo leva para implantar?",
                  a: "De 3 a 5 dias úteis, dependendo da configuração."
                },
                {
                  q: "Como é o suporte?",
                  a: "Direto pelo WhatsApp, sem fila ou espera."
                },
              ].map((faq, i) => (
                <AccordionItem 
                  key={i} 
                  value={`item-${i}`}
                  className="bg-white/5 border border-white/10 hover:border-cyan-500/30 rounded-lg px-5 transition-all duration-300"
                >
                  <AccordionTrigger className="text-sm md:text-base font-bold text-white hover:text-cyan-400 hover:no-underline py-4">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-slate-300 leading-relaxed pb-4">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-16 md:py-24 relative bg-slate-900 border-y border-purple-500/20" id="contato">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-black leading-tight mb-6">
              <span className="text-white">Fidelizar não precisa</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600">
                ser difícil.
              </span>
              <span className="block text-white">É só escolher o simples.</span>
            </h2>
            <div className="h-1 w-24 bg-gradient-to-r from-cyan-400 to-purple-600 mx-auto mb-8" />
            
            <p className="text-sm md:text-base text-slate-300 leading-relaxed mb-12">
              Transforme seu posto ou loja de conveniência em uma <span className="text-white font-bold">máquina de recompra</span>.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Button 
                size="lg"
                onClick={openWhatsApp}
                className="bg-cyan-400 hover:bg-cyan-500 text-black font-bold text-base md:text-lg px-8 py-6 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(0,255,255,0.4)] w-full sm:w-auto"
              >
                🚀 Quero implantar agora
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              
              <Button 
                size="lg"
                onClick={openWhatsApp}
                className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-black font-bold text-base md:text-lg px-8 py-6 rounded-xl transition-all duration-300 w-full sm:w-auto"
              >
                📱 Falar no WhatsApp
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-16 md:py-24 relative bg-slate-950 border-y border-cyan-500/20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12 space-y-4">
              <h2 className="text-2xl md:text-3xl font-black leading-tight">
                <span className="text-white">Ou solicite uma</span>
                <span className="block text-cyan-400">demonstração</span>
              </h2>
              <div className="h-1 w-24 bg-cyan-400 mx-auto" />
            </div>

            {/* Form */}
            <Card className="p-8 md:p-10 bg-white/5 border-white/10">
              <form onSubmit={handleContactSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-white font-bold text-xs uppercase tracking-wide">Nome Completo</Label>
                  <Input 
                    id="name"
                    name="name"
                    required 
                    maxLength={100}
                    className="bg-black/50 border-white/20 text-white focus:border-cyan-400 transition-colors h-10 text-sm"
                    placeholder="João Silva"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white font-bold text-xs uppercase tracking-wide">Email</Label>
                    <Input 
                      id="email"
                      name="email"
                      type="email" 
                      required
                      maxLength={255}
                      className="bg-black/50 border-white/20 text-white focus:border-cyan-400 transition-colors h-10 text-sm"
                      placeholder="joao@empresa.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-white font-bold text-xs uppercase tracking-wide">Telefone</Label>
                    <Input 
                      id="phone"
                      name="phone"
                      required
                      maxLength={20}
                      className="bg-black/50 border-white/20 text-white focus:border-cyan-400 transition-colors h-10 text-sm"
                      placeholder="(21) 99999-9999"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company" className="text-white font-bold text-xs uppercase tracking-wide">Empresa</Label>
                  <Input 
                    id="company"
                    name="company"
                    required
                    maxLength={100}
                    className="bg-black/50 border-white/20 text-white focus:border-cyan-400 transition-colors h-10 text-sm"
                    placeholder="Nome da empresa"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stores" className="text-white font-bold text-xs uppercase tracking-wide">Quantidade de Lojas</Label>
                  <Input 
                    id="stores"
                    name="stores"
                    type="number"
                    min="1"
                    required 
                    className="bg-black/50 border-white/20 text-white focus:border-cyan-400 transition-colors h-10 text-sm"
                    placeholder="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-white font-bold text-xs uppercase tracking-wide">Mensagem</Label>
                  <Textarea 
                    id="message"
                    name="message"
                    required
                    maxLength={1000}
                    rows={5}
                    className="bg-black/50 border-white/20 text-white focus:border-cyan-400 transition-colors resize-none text-sm"
                    placeholder="Conte mais sobre seu negócio e como podemos ajudar..."
                  />
                </div>

                <Button 
                  type="submit"
                  size="lg"
                  className="w-full bg-cyan-400 hover:bg-cyan-500 text-black font-bold text-base md:text-lg py-5 md:py-6 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(0,255,255,0.4)]"
                >
                  ENVIAR MENSAGEM
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </Card>

            {/* Alternative contact */}
            <div className="mt-8 text-center">
              <p className="text-slate-500 text-sm mb-4">Ou fale direto pelo WhatsApp</p>
              <Button 
                variant="outline"
                size="lg"
                onClick={openWhatsApp}
                className="border-white/20 bg-transparent text-white hover:bg-white hover:text-black font-bold text-sm"
              >
                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                CHAMAR NO WHATSAPP
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-white/10 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center mb-4">
                <img src={logoWhite} alt="Leva+" className="h-10" />
              </div>
              
              <div className="flex flex-col items-center justify-center gap-3 text-sm">
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <a href="https://api.whatsapp.com/send/?phone=552139507641&text=Olá&type=phone_number&app_absent=0" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 transition-colors">
                    <MessageCircle className="h-4 w-4 text-green-400" />
                    <span className="text-cyan-400 hover:text-cyan-300 font-semibold">(21) 3950-7641</span>
                  </a>
                  <span className="text-slate-600">•</span>
                  <a href="https://levamais.app" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors">
                    <Globe className="h-4 w-4" />
                    <span>levamais.app</span>
                  </a>
                  <span className="text-slate-600">•</span>
                  <a href="https://www.instagram.com/levamais.app/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors">
                    <Instagram className="h-4 w-4" />
                    <span>@levamais.app</span>
                  </a>
                </div>
                <a href="mailto:contato@levamais.app" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors">
                  <Mail className="h-4 w-4" />
                  <span>contato@levamais.app</span>
                </a>
              </div>

              <div className="pt-4 border-t border-white/10">
                <p className="text-slate-500 text-xs">
                  © 2025 Leva+ by BISW. Todos os direitos reservados.
                </p>
              </div>

              <div className="pt-2">
                <p className="text-slate-400 text-sm italic">
                  "Fazer o simples ser simples é o que nos torna únicos."
                </p>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* WhatsApp Dialog */}
      <Dialog open={isWhatsAppDialogOpen} onOpenChange={setIsWhatsAppDialogOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-cyan-500/30">
          <DialogHeader>
            <DialogTitle className="text-white">Antes de falar conosco...</DialogTitle>
            <DialogDescription className="text-slate-300">
              Por favor, preencha seus dados para que possamos te atender melhor no WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp-name" className="text-white">Nome completo *</Label>
              <Input
                id="whatsapp-name"
                placeholder="Digite seu nome"
                value={whatsAppName}
                onChange={(e) => setWhatsAppName(e.target.value)}
                className="bg-slate-800 border-cyan-500/30 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp-email" className="text-white">E-mail *</Label>
              <Input
                id="whatsapp-email"
                type="email"
                placeholder="seu@email.com"
                value={whatsAppEmail}
                onChange={(e) => setWhatsAppEmail(e.target.value)}
                className="bg-slate-800 border-cyan-500/30 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp-phone" className="text-white">Telefone *</Label>
              <Input
                id="whatsapp-phone"
                placeholder="(00) 00000-0000"
                value={whatsAppPhone}
                onChange={(e) => setWhatsAppPhone(e.target.value)}
                className="bg-slate-800 border-cyan-500/30 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsWhatsAppDialogOpen(false)}
              className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleWhatsAppSubmit}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              Continuar para WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IndexAlt;