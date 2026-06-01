import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileText,
  Download,
  Upload
} from "lucide-react";
import { toast } from "sonner";

interface TestItem {
  id: string;
  title: string;
  description: string;
  tested: boolean;
  status: 'pending' | 'passed' | 'failed';
  notes: string;
  manualSection?: string;
}

interface TestCategory {
  id: string;
  title: string;
  description: string;
  items: TestItem[];
}

const TestesSistema = () => {
  const [etapa1Tests, setEtapa1Tests] = useState<TestCategory[]>([
    {
      id: "orcamento-ativacao",
      title: "Fluxo de Orçamento → Ativação de Rede",
      description: "Testar todo o ciclo desde criação do orçamento até geração de cobranças",
      items: [
        {
          id: "criar-orcamento",
          title: "Criar novo orçamento",
          description: "Acessar /adm/orcamentos e criar um orçamento completo com CNPJs, serviços, produtos",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Admin - Gestão Comercial - Orçamentos"
        },
        {
          id: "configurar-billing",
          title: "Configurar dados de cobrança",
          description: "Definir billing_type (per_cnpj ou single_cnpj), billing_day (5, 10 ou 20), financial_email",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Admin - Gestão Comercial - Configuração de Cobrança"
        },
        {
          id: "aprovar-orcamento",
          title: "Aprovar orçamento",
          description: "Aprovar o orçamento e verificar se dados são transferidos para networks",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Admin - Gestão Comercial - Aprovação de Orçamentos"
        },
        {
          id: "verificar-licenca",
          title: "Verificar criação automática de licença",
          description: "Acessar /adm/licencas e confirmar que licença foi criada com max_stores e monthly_fee corretos",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Admin - Gestão Comercial - Licenças"
        },
        {
          id: "verificar-lojas",
          title: "Verificar pré-cadastro de lojas",
          description: "Acessar /adm/lojas e confirmar que lojas foram criadas para cada CNPJ (is_active: false)",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Admin - Gestão Comercial - Cadastro de Lojas"
        },
        {
          id: "verificar-cobranca-implantacao",
          title: "Verificar cobrança de implantação",
          description: "Acessar /adm/financeiro-admin e verificar se cobrança de implantação foi gerada (venc: 3 dias)",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Admin - Financeiro - Cobranças de Implantação"
        },
        {
          id: "verificar-asaas",
          title: "Verificar no Asaas",
          description: "Acessar dashboard Asaas e confirmar que cobrança aparece corretamente",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Admin - Integrações - Asaas"
        }
      ]
    },
    {
      id: "cliente-transacao",
      title: "Fluxo de Cliente → Transação → Pontos",
      description: "Testar cadastro de cliente e acúmulo de pontos",
      items: [
        {
          id: "cadastrar-cliente",
          title: "Cadastrar novo cliente",
          description: "Lojista acessa /loja/clientes e cadastra um novo cliente com CPF, nome, email, telefone",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Lojista - Gestão de Clientes - Cadastro"
        },
        {
          id: "enviar-convite",
          title: "Enviar convite de primeiro acesso",
          description: "Clicar em 'Enviar Convite' no grid de clientes e verificar se email é enviado",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Lojista - Gestão de Clientes - Convite para App"
        },
        {
          id: "primeiro-acesso-cliente",
          title: "Cliente faz primeiro acesso",
          description: "Cliente acessa o link do email e define senha no app",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Cliente - Primeiro Acesso"
        },
        {
          id: "verificar-email-telefone",
          title: "Verificar email e telefone",
          description: "Cliente confirma email e telefone via códigos de verificação",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Cliente - Verificação de Conta"
        },
        {
          id: "simular-transacao-api",
          title: "Simular transação via API",
          description: "Usar /adm/api para enviar transação de teste e verificar acúmulo de pontos",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Admin - Integrações - API de Transações"
        },
        {
          id: "verificar-saldo-cliente",
          title: "Verificar saldo no app do cliente",
          description: "Cliente acessa app e verifica se pontos foram creditados corretamente",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Cliente - Consulta de Saldo"
        }
      ]
    },
    {
      id: "leva-one-subscription",
      title: "Fluxo de Leva+ One (Assinatura → Promoções)",
      description: "Testar assinatura Leva+ One e resgate de promoções",
      items: [
        {
          id: "cliente-assinar-one",
          title: "Cliente assina Leva+ One",
          description: "Cliente acessa /cliente/assinar-leva-one e preenche dados do cartão de crédito",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Cliente - Leva+ One - Assinatura"
        },
        {
          id: "verificar-tokenizacao",
          title: "Verificar tokenização no Asaas",
          description: "Verificar nos logs se cartão foi tokenizado corretamente",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Admin - Integrações - Asaas Tokenização"
        },
        {
          id: "verificar-subscription-asaas",
          title: "Verificar subscription no Asaas",
          description: "Acessar dashboard Asaas e confirmar que subscription foi criada",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Admin - Leva+ One - Assinaturas"
        },
        {
          id: "verificar-card-number",
          title: "Verificar geração do número do cartão",
          description: "Cliente acessa /cliente/meu-cartao-one e verifica cartão 16 dígitos gerado",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Cliente - Leva+ One - Meu Cartão"
        },
        {
          id: "criar-promocao-lojista",
          title: "Lojista cria promoção exclusiva",
          description: "Lojista acessa /loja/leva-one/promocoes e cria nova promoção com estoque",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Lojista - Leva+ One - Gestão de Promoções"
        },
        {
          id: "cliente-resgata-promocao",
          title: "Cliente resgata promoção",
          description: "Cliente acessa /cliente/promocoes-exclusivas e clica em 'Resgatar'",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Cliente - Leva+ One - Resgatar Promoções"
        },
        {
          id: "lojista-confirma-resgate",
          title: "Lojista confirma resgate",
          description: "Lojista acessa /loja/leva-one/resgates e confirma o resgate",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Lojista - Leva+ One - Confirmação de Resgates"
        },
        {
          id: "verificar-historico-resgate",
          title: "Verificar histórico de resgates",
          description: "Cliente verifica histórico em /cliente/promocoes-exclusivas",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Cliente - Leva+ One - Histórico"
        }
      ]
    },
    {
      id: "marketing-comunicacao",
      title: "Fluxo de Marketing (SMS/Notificação → Cliente)",
      description: "Testar envio de comunicações e recebimento pelo cliente",
      items: [
        {
          id: "enviar-notificacao",
          title: "Lojista envia notificação in-app",
          description: "Lojista acessa /loja/notificacoes e envia notificação para clientes selecionados",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Lojista - Marketing - Notificações"
        },
        {
          id: "cliente-recebe-notificacao",
          title: "Cliente recebe notificação",
          description: "Cliente verifica sino de notificações e vê a nova mensagem",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Cliente - Notificações"
        },
        {
          id: "enviar-sms",
          title: "Lojista envia SMS",
          description: "Lojista acessa /loja/disparo-sms e envia SMS de campanha promocional",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Lojista - Marketing - Disparo de SMS"
        },
        {
          id: "verificar-logs-sms",
          title: "Verificar logs de SMS",
          description: "Admin acessa /adm/logs-sms e verifica se SMS foi enviado com sucesso",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Admin - Logs - SMS"
        },
        {
          id: "configurar-sms-automatico",
          title: "Configurar SMS automático",
          description: "Lojista configura mensagens automáticas (aniversário, acúmulo, etc.)",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Lojista - Marketing - SMS Automático"
        },
        {
          id: "enviar-push-notification",
          title: "Testar push notification",
          description: "Verificar se push notifications funcionam com app fechado",
          tested: false,
          status: 'pending',
          notes: '',
          manualSection: "Manual Admin - Integrações - Push Notifications"
        }
      ]
    }
  ]);

  const calculateProgress = (category: TestCategory) => {
    const total = category.items.length;
    const tested = category.items.filter(item => item.tested).length;
    return (tested / total) * 100;
  };

  const calculateOverallProgress = () => {
    const totalItems = etapa1Tests.reduce((sum, cat) => sum + cat.items.length, 0);
    const testedItems = etapa1Tests.reduce((sum, cat) => 
      sum + cat.items.filter(item => item.tested).length, 0
    );
    return (testedItems / totalItems) * 100;
  };

  const getStatusIcon = (status: TestItem['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const handleTestToggle = (categoryId: string, itemId: string, checked: boolean) => {
    setEtapa1Tests(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          items: cat.items.map(item => {
            if (item.id === itemId) {
              return { ...item, tested: checked };
            }
            return item;
          })
        };
      }
      return cat;
    }));
  };

  const handleStatusChange = (categoryId: string, itemId: string, status: TestItem['status']) => {
    setEtapa1Tests(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          items: cat.items.map(item => {
            if (item.id === itemId) {
              return { ...item, status };
            }
            return item;
          })
        };
      }
      return cat;
    }));
  };

  const handleNotesChange = (categoryId: string, itemId: string, notes: string) => {
    setEtapa1Tests(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          items: cat.items.map(item => {
            if (item.id === itemId) {
              return { ...item, notes };
            }
            return item;
          })
        };
      }
      return cat;
    }));
  };

  const exportResults = () => {
    const results = {
      etapa: "Etapa 1 - Fluxos Críticos",
      date: new Date().toISOString(),
      progress: calculateOverallProgress(),
      categories: etapa1Tests
    };
    
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `testes-etapa1-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    toast.success("Resultados exportados com sucesso!");
  };

  const importResults = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setEtapa1Tests(data.categories);
        toast.success("Resultados importados com sucesso!");
      } catch (error) {
        toast.error("Erro ao importar arquivo");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Testes do Sistema</h1>
        <p className="text-muted-foreground">
          Checklist completo de testes de funcionalidades e criação de documentação
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Progresso Geral - Etapa 1</CardTitle>
              <CardDescription>Fluxos Críticos de Negócio</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportResults}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button variant="outline" size="sm" asChild>
                <label htmlFor="import-file" className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  Importar
                  <input
                    id="import-file"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={importResults}
                  />
                </label>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progresso Total</span>
              <span className="font-medium">{calculateOverallProgress().toFixed(0)}%</span>
            </div>
            <Progress value={calculateOverallProgress()} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={etapa1Tests[0]?.id} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          {etapa1Tests.map(category => (
            <TabsTrigger key={category.id} value={category.id}>
              {category.title.split(' ')[0]}
            </TabsTrigger>
          ))}
        </TabsList>

        {etapa1Tests.map(category => (
          <TabsContent key={category.id} value={category.id} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{category.title}</CardTitle>
                <CardDescription>{category.description}</CardDescription>
                <div className="pt-4">
                  <Progress value={calculateProgress(category)} />
                  <p className="text-sm text-muted-foreground mt-2">
                    {category.items.filter(item => item.tested).length} de {category.items.length} testes concluídos
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {category.items.map((item, index) => (
                  <div key={item.id} className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={item.id}
                        checked={item.tested}
                        onCheckedChange={(checked) => 
                          handleTestToggle(category.id, item.id, checked as boolean)
                        }
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor={item.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {index + 1}. {item.title}
                          </label>
                          {getStatusIcon(item.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                        {item.manualSection && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <FileText className="h-3 w-3" />
                            <span>{item.manualSection}</span>
                          </div>
                        )}
                        
                        <div className="flex gap-2 pt-2">
                          <Badge
                            variant={item.status === 'passed' ? 'default' : 'outline'}
                            className="cursor-pointer"
                            onClick={() => handleStatusChange(category.id, item.id, 'passed')}
                          >
                            ✓ Passou
                          </Badge>
                          <Badge
                            variant={item.status === 'failed' ? 'destructive' : 'outline'}
                            className="cursor-pointer"
                            onClick={() => handleStatusChange(category.id, item.id, 'failed')}
                          >
                            ✗ Falhou
                          </Badge>
                          <Badge
                            variant={item.status === 'pending' ? 'secondary' : 'outline'}
                            className="cursor-pointer"
                            onClick={() => handleStatusChange(category.id, item.id, 'pending')}
                          >
                            ⏳ Pendente
                          </Badge>
                        </div>

                        <Textarea
                          placeholder="Notas sobre o teste (erros encontrados, observações, etc.)"
                          value={item.notes}
                          onChange={(e) => handleNotesChange(category.id, item.id, e.target.value)}
                          className="mt-2"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle>Próximas Etapas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Em breve</Badge>
            <span className="text-sm">Etapa 2 - Portal Admin (Gestão Financeira e Comercial)</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Em breve</Badge>
            <span className="text-sm">Etapa 3 - Portal Lojista (Operações Diárias)</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Em breve</Badge>
            <span className="text-sm">Etapa 4 - Portal Cliente (Experiência do Usuário)</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Em breve</Badge>
            <span className="text-sm">Etapa 5 - Portais Colaborador e Revenda</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Em breve</Badge>
            <span className="text-sm">Etapa 6 - Integrações e APIs</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Em breve</Badge>
            <span className="text-sm">Etapa 7 - Análise de Redundâncias e Otimizações</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestesSistema;