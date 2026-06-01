import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Loader2 } from "lucide-react";
import { LIMITS, trimmedString, trimmedEmail } from "@/lib/input-sanitization";

const contactSchema = z.object({
  name: trimmedString(LIMITS.NAME, { min: 3, minMessage: "Nome deve ter no mínimo 3 caracteres" }),
  email: trimmedEmail(),
  phone: trimmedString(LIMITS.PHONE, { min: 10, minMessage: "Telefone inválido" }),
  company: trimmedString(LIMITS.NAME, { min: 3, minMessage: "Nome da empresa obrigatório" }),
  stores: trimmedString(10, { min: 1, minMessage: "Número de lojas obrigatório" }),
  message: trimmedString(LIMITS.LONG_TEXT, { min: 10, minMessage: "Mensagem deve ter no mínimo 10 caracteres" }),
});

const verificationSchema = z.object({
  email: trimmedEmail(),
});

const welcomeSchema = z.object({
  name: trimmedString(LIMITS.NAME, { min: 3, minMessage: "Nome deve ter no mínimo 3 caracteres" }),
  email: trimmedEmail(),
  cpf: trimmedString(LIMITS.CPF_CNPJ, { min: 11, minMessage: "CPF inválido" }),
});

export default function TestesEmail() {
  const [loadingContact, setLoadingContact] = useState(false);
  const [loadingVerification, setLoadingVerification] = useState(false);
  const [loadingWelcome, setLoadingWelcome] = useState(false);

  const contactForm = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "João da Silva",
      email: "teste@exemplo.com",
      phone: "(21) 99999-9999",
      company: "Empresa Teste",
      stores: "5",
      message: "Esta é uma mensagem de teste do sistema de emails.",
    },
  });

  const verificationForm = useForm<z.infer<typeof verificationSchema>>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      email: "teste@exemplo.com",
    },
  });

  const welcomeForm = useForm<z.infer<typeof welcomeSchema>>({
    resolver: zodResolver(welcomeSchema),
    defaultValues: {
      name: "Maria Santos",
      email: "teste@exemplo.com",
      cpf: "12345678900",
    },
  });

  const onSubmitContact = async (data: z.infer<typeof contactSchema>) => {
    setLoadingContact(true);
    try {
      const { error } = await supabase.functions.invoke('send-contact-email', {
        body: data,
      });

      if (error) throw error;

      toast({
        title: "✅ Email de contato enviado!",
        description: "Verifique a caixa de entrada de comercial@levamais.app e o email do cliente.",
      });
    } catch (error: any) {
      toast({
        title: "❌ Erro ao enviar email",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingContact(false);
    }
  };

  const onSubmitVerification = async (data: z.infer<typeof verificationSchema>) => {
    setLoadingVerification(true);
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      const { error } = await supabase.functions.invoke('send-verification-email', {
        body: { email: data.email, code },
      });

      if (error) throw error;

      toast({
        title: "✅ Email de verificação enviado!",
        description: `Código de teste: ${code}. Verifique a caixa de entrada.`,
      });
    } catch (error: any) {
      toast({
        title: "❌ Erro ao enviar email",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingVerification(false);
    }
  };

  const onSubmitWelcome = async (data: z.infer<typeof welcomeSchema>) => {
    setLoadingWelcome(true);
    try {
      const { error } = await supabase.functions.invoke('send-welcome-email', {
        body: data,
      });

      if (error) throw error;

      toast({
        title: "✅ Email de boas-vindas enviado!",
        description: "Verifique a caixa de entrada do email informado.",
      });
    } catch (error: any) {
      toast({
        title: "❌ Erro ao enviar email",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingWelcome(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Mail className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Testes de Email</h1>
          <p className="text-muted-foreground">
            Teste os envios de email do sistema usando o domínio updates.levamais.app
          </p>
        </div>
      </div>

      {/* Email de Contato */}
      <Card>
        <CardHeader>
          <CardTitle>📧 Email de Contato</CardTitle>
          <CardDescription>
            Testa o formulário de contato da landing page. Envia para comercial@levamais.app
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...contactForm}>
            <form onSubmit={contactForm.handleSubmit(onSubmitContact)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={contactForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={LIMITS.NAME} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} maxLength={LIMITS.EMAIL} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={LIMITS.PHONE} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empresa</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={LIMITS.NAME} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="stores"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de lojas</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={10} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={contactForm.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensagem</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={4} maxLength={LIMITS.LONG_TEXT} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={loadingContact}>
                {loadingContact && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar Email de Contato
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Email de Verificação */}
      <Card>
        <CardHeader>
          <CardTitle>🔐 Email de Verificação</CardTitle>
          <CardDescription>
            Testa o envio de código de verificação para validação de email do cliente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...verificationForm}>
            <form onSubmit={verificationForm.handleSubmit(onSubmitVerification)} className="space-y-4">
              <FormField
                control={verificationForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} maxLength={LIMITS.EMAIL} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={loadingVerification}>
                {loadingVerification && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar Email de Verificação
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Email de Boas-vindas */}
      <Card>
        <CardHeader>
          <CardTitle>🎉 Email de Boas-vindas</CardTitle>
          <CardDescription>
            Testa o email enviado quando um novo cliente se cadastra no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...welcomeForm}>
            <form onSubmit={welcomeForm.handleSubmit(onSubmitWelcome)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={welcomeForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={LIMITS.NAME} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={welcomeForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} maxLength={LIMITS.EMAIL} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={welcomeForm.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Apenas números" maxLength={LIMITS.CPF_CNPJ} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={loadingWelcome}>
                {loadingWelcome && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar Email de Boas-vindas
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
