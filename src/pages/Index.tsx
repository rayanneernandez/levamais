import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { TrendingUp, RefreshCw, Zap, MessageSquare, BarChart3, Headphones, Store, User, ChevronDown, Check, Phone, Mail, Quote, MessageCircle, Globe, Instagram } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import heroImage from "@/assets/hero-loyalty.png";
import logoWhite from "@/assets/logo-white.png";
import logoDark from "@/assets/logo-dark.png";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { z } from "zod";

const Index = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = useState(false);
  const [whatsAppName, setWhatsAppName] = useState("");
  const [whatsAppPhone, setWhatsAppPhone] = useState("");
  const [whatsAppEmail, setWhatsAppEmail] = useState("");

  const handleContactSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      company: formData.get("company") as string,
      stores: formData.get("stores") as string,
      message: formData.get("message") as string || "",
    };

    try {
      const { data: result, error } = await supabase.functions.invoke("send-contact-email", {
        body: data,
      });

      if (error) throw error;
      
      if (!result?.success) {
        throw new Error("Falha ao enviar email");
      }

      toast({
        title: "Mensagem enviada!",
        description: "Nossa equipe entrará em contato em até 24 horas.",
      });
      
      form.reset();
    } catch (error) {
      console.error("Erro ao enviar email:", error);
      toast({
        title: "Erro ao enviar mensagem",
        description: "Por favor, tente novamente ou entre em contato via WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToContact = () => {
    document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" });
  };

  const openWhatsApp = () => {
    setIsWhatsAppDialogOpen(true);
  };

  const handleWhatsAppSubmit = async () => {
    // Validação de campos obrigatórios
    if (!whatsAppName.trim() || !whatsAppPhone.trim() || !whatsAppEmail.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive",
      });
      return;
    }

    // Schema de validação
    const whatsAppSchema = z.object({
      name: z.string()
        .trim()
        .min(3, "Nome deve ter pelo menos 3 caracteres")
        .max(100, "Nome muito longo"),
      email: z.string()
        .trim()
        .email("E-mail inválido")
        .max(255, "E-mail muito longo"),
      phone: z.string()
        .trim()
        .min(10, "Telefone deve ter pelo menos 10 dígitos")
        .refine((val) => val.replace(/\D/g, '').length >= 10, "Telefone deve ter pelo menos 10 dígitos"),
    });

    // Validar dados
    try {
      whatsAppSchema.parse({
        name: whatsAppName,
        email: whatsAppEmail,
        phone: whatsAppPhone,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Dados inválidos",
          description: error.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    // Salvar lead e AGUARDAR o resultado
    try {
      const phoneDigits = whatsAppPhone.replace(/\D/g, '');
      const { data, error } = await supabase
        .from("leads")
        .insert({
          name: whatsAppName.trim(),
          phone: phoneDigits,
          email: whatsAppEmail.trim().toLowerCase(),
          source: "whatsapp_button",
          status: "new",
        })
        .select();

      if (error) {
        console.error("Erro ao salvar lead:", error);
        toast({
          title: "Erro ao salvar dados",
          description: "Não foi possível registrar suas informações. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      console.log("Lead salvo com sucesso:", data);
      
      toast({
        title: "Dados salvos com sucesso!",
        description: "Você será redirecionado para o WhatsApp...",
      });

      // Limpar campos e fechar modal
      const userName = whatsAppName.trim();
      setWhatsAppName("");
      setWhatsAppPhone("");
      setWhatsAppEmail("");
      setIsWhatsAppDialogOpen(false);

      // Redirecionar para WhatsApp APÓS salvar com sucesso
      setTimeout(() => {
        const message = encodeURIComponent(`Olá, vim do site e gostaria de conhecer o Leva+. Meu nome é ${userName}.`);
        window.open(`https://api.whatsapp.com/send/?phone=552139507641&text=${message}&type=phone_number&app_absent=0`, "_blank");
      }, 500);
      
    } catch (error) {
      console.error("Erro inesperado:", error);
      toast({
        title: "Erro inesperado",
        description: "Por favor, tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src={logoDark} alt="Leva+" className="h-12" width="600" height="206" />
          </div>
          <nav className="hidden md:flex gap-6 items-center">
            <a href="#inicio" className="text-slate-300 hover:text-white transition-colors">Início</a>
            <a href="#beneficios" className="text-slate-300 hover:text-white transition-colors">Benefícios</a>
            <a href="#planos" className="text-slate-300 hover:text-white transition-colors">Planos</a>
            <a href="#como-funciona" className="text-slate-300 hover:text-white transition-colors">Como funciona</a>
            <a href="#contato" className="text-slate-300 hover:text-white transition-colors">Contato</a>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-slate-300 hover:text-white transition-colors flex items-center gap-1">
                  Acessar
                  <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-slate-900 border-slate-800 z-50">
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
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section id="inicio" className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="text-left">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Transforme cada compra em{" "}
              <span className="text-cyan-400">vantagem</span>
            </h1>
            <p className="text-xl text-slate-300 mb-8">
              Fidelização inteligente e automatizada para o varejo físico. Aumente o ticket médio,
              traga clientes de volta e tome decisões baseadas em dados reais.
            </p>
          </div>
          
          <div className="flex justify-center">
            <img 
              src={heroImage} 
              alt="Cliente fidelizado fazendo compras"
              className="rounded-2xl shadow-2xl w-full max-w-lg"
            />
          </div>
        </div>
      </section>

      {/* Benefits Section - Fundo Claro */}
      <section id="beneficios" className="bg-slate-100 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Por que escolher o Leva+?</h2>
            <p className="text-slate-700 text-lg">Resultados reais para o seu negócio, sem complicação</p>
          </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="bg-white border-slate-200 p-8 hover:border-cyan-500/30 transition-all shadow-lg">
            <div className="w-16 h-16 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-6">
              <TrendingUp className="w-8 h-8 text-cyan-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">+15% no ticket médio</h3>
            <p className="text-slate-700">Clientes gastam mais quando sabem que vão acumular pontos</p>
          </Card>
          
          <Card className="bg-white border-slate-200 p-8 hover:border-cyan-500/30 transition-all shadow-lg">
            <div className="w-16 h-16 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-6">
              <RefreshCw className="w-8 h-8 text-cyan-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">+25% de recompra</h3>
            <p className="text-slate-700">Clientes voltam com mais frequência em até 90 dias</p>
          </Card>
          
          <Card className="bg-white border-slate-200 p-8 hover:border-cyan-500/30 transition-all shadow-lg">
            <div className="w-16 h-16 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-6">
              <Zap className="w-8 h-8 text-cyan-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">100% automatizado</h3>
            <p className="text-slate-700">Sem cadastros manuais, tudo acontece no momento da compra</p>
          </Card>
          
          <Card className="bg-white border-slate-200 p-8 hover:border-cyan-500/30 transition-all shadow-lg">
            <div className="w-16 h-16 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-6">
              <MessageSquare className="w-8 h-8 text-cyan-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">Comunicação direta</h3>
            <p className="text-slate-700">Envie mensagens personalizadas via WhatsApp</p>
          </Card>
          
          <Card className="bg-white border-slate-200 p-8 hover:border-cyan-500/30 transition-all shadow-lg">
            <div className="w-16 h-16 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-6">
              <BarChart3 className="w-8 h-8 text-cyan-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">Dados em tempo real</h3>
            <p className="text-slate-700">Relatórios automáticos sobre comportamento dos clientes</p>
          </Card>
          
          <Card className="bg-white border-slate-200 p-8 hover:border-cyan-500/30 transition-all shadow-lg">
            <div className="w-16 h-16 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-6">
              <Headphones className="w-8 h-8 text-cyan-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">Suporte dedicado</h3>
            <p className="text-slate-700">Equipe pronta para ajudar sempre que precisar</p>
          </Card>
        </div>
        </div>
      </section>

      {/* Pricing Section - Fundo Escuro */}
      <section id="planos" className="bg-slate-900 py-20">
        <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Escolha o plano ideal</h2>
          <p className="text-slate-400 text-lg">Planos flexíveis para todos os tamanhos de negócio</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="bg-slate-800/50 border-slate-700 p-8 hover:border-cyan-500/30 transition-all">
            <h3 className="text-2xl font-bold text-white mb-2">Leva+ Inicia</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold text-cyan-400">R$ 599</span>
              <span className="text-slate-400">/mês</span>
            </div>
            <p className="text-slate-400 mb-6">1 a 5 lojas</p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-2 text-slate-300">
                <Check className="h-5 w-5 text-cyan-400" />
                Painel Business
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <Check className="h-5 w-5 text-cyan-400" />
                Registro por CPF
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <Check className="h-5 w-5 text-cyan-400" />
                Relatórios básicos
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <Check className="h-5 w-5 text-cyan-400" />
                Suporte por e-mail
              </li>
            </ul>
            <Button className="w-full bg-cyan-500 hover:bg-cyan-600" onClick={openWhatsApp}>
              Começar agora
            </Button>
          </Card>
          
          <Card className="bg-gradient-to-br from-cyan-600/20 via-slate-800 to-slate-900 border-cyan-400 p-8 hover:border-cyan-300 transition-all relative shadow-xl shadow-cyan-500/20">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-cyan-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                Mais Popular
              </span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Leva+ Impulsiona</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold text-cyan-400">R$ 999</span>
              <span className="text-slate-400">/mês</span>
            </div>
            <p className="text-slate-400 mb-6">6 a 20 lojas</p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-2 text-slate-300">
                <Check className="h-5 w-5 text-cyan-400" />
                Tudo do Starter +
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <Check className="h-5 w-5 text-cyan-400" />
                Integração WhatsApp
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <Check className="h-5 w-5 text-cyan-400" />
                Relatórios avançados
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <Check className="h-5 w-5 text-cyan-400" />
                Suporte prioritário
              </li>
            </ul>
            <Button className="w-full bg-cyan-500 hover:bg-cyan-600" onClick={openWhatsApp}>
              Escolher Plano
            </Button>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700 p-8 hover:border-cyan-500/30 transition-all">
            <h3 className="text-2xl font-bold text-white mb-2">Leva+ Expande</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold text-cyan-400">Consulte</span>
            </div>
            <p className="text-slate-400 mb-6">+20 lojas</p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-2 text-slate-300">
                <Check className="h-5 w-5 text-cyan-400" />
                Tudo do Pro +
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <Check className="h-5 w-5 text-cyan-400" />
                App próprio white-label
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <Check className="h-5 w-5 text-cyan-400" />
                IA e insights avançados
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <Check className="h-5 w-5 text-cyan-400" />
                Suporte dedicado 24/7
              </li>
            </ul>
            <Button className="w-full bg-cyan-500 hover:bg-cyan-600" onClick={openWhatsApp}>
              Falar com consultor
            </Button>
          </Card>
        </div>
        
        <p className="text-center text-slate-400 mt-8 text-lg">
          💡 Setup único de R$ 1.500 (treinamento e integração)
        </p>
        </div>
      </section>

      {/* How it Works Section - Fundo Claro */}
      <section id="como-funciona" className="bg-slate-100 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Como funciona?</h2>
            <p className="text-slate-700 text-lg">Simples, rápido e sem complicação</p>
          </div>
        
        <div className="grid md:grid-cols-4 gap-8 max-w-6xl mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-cyan-600 text-2xl font-bold border-2 border-cyan-500/30">
              1
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Cliente informa CPF</h3>
            <p className="text-slate-700">No momento da compra, o cliente fornece o CPF no caixa</p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-cyan-600 text-2xl font-bold border-2 border-cyan-500/30">
              2
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Pontos automáticos</h3>
            <p className="text-slate-700">O sistema registra os pontos automaticamente na conta</p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-cyan-600 text-2xl font-bold border-2 border-cyan-500/30">
              3
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Cliente resgata</h3>
            <p className="text-slate-700">Na próxima compra, usa os pontos para ganhar desconto</p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-cyan-600 text-2xl font-bold border-2 border-cyan-500/30">
              4
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Você acompanha</h3>
            <p className="text-slate-700">Tudo visível no painel em tempo real</p>
          </div>
        </div>
        </div>
      </section>

      {/* Testimonials Section - Fundo Escuro */}
      <section className="bg-slate-900 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Quem usa, recomenda</h2>
            <p className="text-slate-400 text-lg">Redes de lojas de conveniência que confiam no Leva+</p>
          </div>
          
          <div className="max-w-7xl mx-auto px-12">
            <Carousel
              opts={{
                align: "start",
                loop: true,
              }}
              className="w-full"
            >
              <CarouselContent>
                <CarouselItem className="md:basis-1/3">
                  <Card className="bg-slate-800/50 border-slate-700 p-6 relative h-full">
                    <Quote className="absolute top-4 right-4 w-8 h-8 text-cyan-400/20" />
                    <p className="text-slate-300 mb-4 italic">
                      "O Leva+ revolucionou nossa operação. Com mais de 15 lojas, conseguimos ter controle total da fidelização em tempo real. O ticket médio subiu 18% em apenas 2 meses!"
                    </p>
                    <div className="border-t border-slate-700 pt-4">
                      <p className="text-white font-semibold">Rede JB</p>
                      <p className="text-slate-400 text-sm">Rio de Janeiro - RJ</p>
                    </div>
                  </Card>
                </CarouselItem>

                <CarouselItem className="md:basis-1/3">
                  <Card className="bg-slate-800/50 border-slate-700 p-6 relative h-full">
                    <Quote className="absolute top-4 right-4 w-8 h-8 text-cyan-400/20" />
                    <p className="text-slate-300 mb-4 italic">
                      "Nossos clientes adoram a facilidade de acumular pontos apenas com o CPF. A automação do WhatsApp trouxe uma proximidade incrível com nossos consumidores."
                    </p>
                    <div className="border-t border-slate-700 pt-4">
                      <p className="text-white font-semibold">Rede Rio</p>
                      <p className="text-slate-400 text-sm">Rio de Janeiro - RJ</p>
                    </div>
                  </Card>
                </CarouselItem>

                <CarouselItem className="md:basis-1/3">
                  <Card className="bg-slate-800/50 border-slate-700 p-6 relative h-full">
                    <Quote className="absolute top-4 right-4 w-8 h-8 text-cyan-400/20" />
                    <p className="text-slate-300 mb-4 italic">
                      "Implementamos há 4 meses e os resultados são impressionantes. A taxa de retorno dos clientes aumentou 30%. O sistema é intuitivo e o suporte é excelente!"
                    </p>
                    <div className="border-t border-slate-700 pt-4">
                      <p className="text-white font-semibold">Rede Aghora</p>
                      <p className="text-slate-400 text-sm">Rio de Janeiro - RJ</p>
                    </div>
                  </Card>
                </CarouselItem>

                <CarouselItem className="md:basis-1/3">
                  <Card className="bg-slate-800/50 border-slate-700 p-6 relative h-full">
                    <Quote className="absolute top-4 right-4 w-8 h-8 text-cyan-400/20" />
                    <p className="text-slate-300 mb-4 italic">
                      "Como grupo com diversas lojas, precisávamos de uma solução escalável e profissional. O Leva+ entregou exatamente isso. Os relatórios nos ajudam muito na tomada de decisão."
                    </p>
                    <div className="border-t border-slate-700 pt-4">
                      <p className="text-white font-semibold">Grupo FGA</p>
                      <p className="text-slate-400 text-sm">São Paulo - SP</p>
                    </div>
                  </Card>
                </CarouselItem>

                <CarouselItem className="md:basis-1/3">
                  <Card className="bg-slate-800/50 border-slate-700 p-6 relative h-full">
                    <Quote className="absolute top-4 right-4 w-8 h-8 text-cyan-400/20" />
                    <p className="text-slate-300 mb-4 italic">
                      "Investir no Leva+ foi uma das melhores decisões para nossa rede. A plataforma é simples para o operador e poderosa para a gestão. Nossos clientes estão muito mais engajados!"
                    </p>
                    <div className="border-t border-slate-700 pt-4">
                      <p className="text-white font-semibold">Rede Nova Era</p>
                      <p className="text-slate-400 text-sm">Belo Horizonte - MG</p>
                    </div>
                  </Card>
                </CarouselItem>
              </CarouselContent>
              <CarouselPrevious className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700" />
              <CarouselNext className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700" />
            </Carousel>
          </div>
        </div>
      </section>

      {/* Contact Section - Fundo Claro */}
      <section id="contato" className="bg-slate-100 py-20">
        <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Solicite uma demonstração</h2>
            <p className="text-slate-700 text-lg">
              Preencha o formulário e nossa equipe entrará em contato em até 24 horas
            </p>
          </div>
          
          <Card className="bg-white border-slate-200 p-8 shadow-lg">
            <form onSubmit={handleContactSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-900">Nome completo</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    required
                    className="bg-slate-50 border-slate-300 text-slate-900"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-900">E-mail</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="bg-slate-50 border-slate-300 text-slate-900"
                  />
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-900">Telefone / WhatsApp</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    className="bg-slate-50 border-slate-300 text-slate-900"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="company" className="text-slate-900">Nome da empresa</Label>
                  <Input
                    id="company"
                    name="company"
                    type="text"
                    required
                    className="bg-slate-50 border-slate-300 text-slate-900"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="stores" className="text-slate-900">Quantas lojas você tem?</Label>
                <Input
                  id="stores"
                  name="stores"
                  type="number"
                  required
                  min="1"
                  className="bg-slate-50 border-slate-300 text-slate-900"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="message" className="text-slate-900">Mensagem (opcional)</Label>
                <Textarea
                  id="message"
                  name="message"
                  rows={4}
                  className="bg-slate-50 border-slate-300 text-slate-900"
                />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  type="submit" 
                  size="lg" 
                  className="bg-cyan-500 hover:bg-cyan-600 text-white flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Enviando..." : "Solicitar demonstração"}
                </Button>
              </div>
            </form>
          </Card>
          
          <div className="text-center mt-12">
            <p className="text-slate-700 text-lg mb-6">Ou fale diretamente com a gente</p>
            <Button 
              type="button"
              size="lg" 
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
              onClick={openWhatsApp}
            >
              Falar com especialista via WhatsApp
            </Button>
          </div>
        </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-slate-900/80 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <img src={logoDark} alt="Leva+" className="h-8" width="600" height="206" />
            </div>
            
            <p className="text-slate-300 text-lg">
              O app que transforma cada compra em vantagem
            </p>
            
            <div className="flex flex-col items-center justify-center gap-4 text-slate-300">
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
                <a href="https://api.whatsapp.com/send/?phone=552139507641&text=Olá&type=phone_number&app_absent=0" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 transition-colors">
                  <MessageCircle className="h-5 w-5 text-green-400" />
                  <span className="text-cyan-400 hover:text-cyan-300">(21) 3950-7641</span>
                </a>
                <span className="text-slate-600">•</span>
                <a href="https://levamais.app" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors">
                  <Globe className="h-5 w-5" />
                  <span>levamais.app</span>
                </a>
                <span className="text-slate-600">•</span>
                <a href="https://www.instagram.com/levamais.app/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors">
                  <Instagram className="h-5 w-5" />
                  <span>@levamais.app</span>
                </a>
              </div>
              <a href="mailto:contato@levamais.app" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors">
                <Mail className="h-5 w-5" />
                <span>contato@levamais.app</span>
              </a>
            </div>
            
            <div className="border-t border-white/10 pt-6">
              <p className="text-slate-400">
                © 2025 Leva+ by BISW. Todos os direitos reservados.
              </p>
              <p className="text-slate-500 text-sm mt-2 italic">
                "Fazer o simples ser simples é o que nos torna únicos."
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* WhatsApp Dialog */}
      <Dialog open={isWhatsAppDialogOpen} onOpenChange={setIsWhatsAppDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Antes de falar conosco...</DialogTitle>
            <DialogDescription>
              Preencha seus dados para que possamos te atender melhor. Não se preocupe, suas informações estão seguras.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp-name">Nome completo *</Label>
              <Input
                id="whatsapp-name"
                placeholder="Digite seu nome completo"
                value={whatsAppName}
                onChange={(e) => setWhatsAppName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp-email">E-mail *</Label>
              <Input
                id="whatsapp-email"
                type="email"
                placeholder="seu@email.com"
                value={whatsAppEmail}
                onChange={(e) => setWhatsAppEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp-phone">Telefone/WhatsApp *</Label>
              <Input
                id="whatsapp-phone"
                placeholder="(00) 00000-0000"
                value={whatsAppPhone}
                onChange={(e) => setWhatsAppPhone(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsWhatsAppDialogOpen(false)}
              className="w-full sm:w-auto border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleWhatsAppSubmit}
              className="bg-green-500 hover:bg-green-600 text-white w-full sm:w-auto"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Continuar para WhatsApp
            </Button>
            <p className="text-xs text-muted-foreground text-center w-full mt-2">
              Seus dados serão salvos no nosso sistema para melhor atendimento
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
