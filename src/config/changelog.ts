/**
 * Histórico de versões da plataforma
 * 
 * Para adicionar uma nova versão:
 * 1. Incremente PATCH_VERSION em version.ts
 * 2. Adicione uma nova entrada neste array com as mudanças
 */

export interface VersionEntry {
  version: string;
  date: string;
  changes: {
    type: 'feature' | 'fix' | 'improvement' | 'breaking';
    description: string;
  }[];
}

export const CHANGELOG: VersionEntry[] = [
  {
    version: "25.11.5",
    date: "2025-11-15",
    changes: [
      {
        type: "improvement",
        description: "Ícones de serviços nos cards de lojas agora aparecem em ordem consistente"
      },
      {
        type: "improvement",
        description: "Ícone principal alterado para bomba de combustível quando o nome da loja começa com 'Posto'"
      },
      {
        type: "fix",
        description: "Removidas vírgulas extras na formatação de endereços dos cards de lojas"
      },
      {
        type: "fix",
        description: "Label 'Sem Bandeira' alterada para 'Bandeira Própria' no card de lojas"
      }
    ]
  },
  {
    version: "25.11.4",
    date: "2025-11-14",
    changes: [
      {
        type: "improvement",
        description: "Adicionada recomendação de tamanho de imagem (800x600px, proporção 4:3) no upload de recompensas do Leva+ Valoriza"
      },
      {
        type: "fix",
        description: "Corrigida exibição de imagens das recompensas no portal do colaborador"
      }
    ]
  },
  {
    version: "25.11.3",
    date: "2025-11-08",
    changes: [
      {
        type: "feature",
        description: "Sistema completo de Programa de Retenção/Fidelidade com upgrade de planos (6, 9 ou 12 meses)"
      },
      {
        type: "feature",
        description: "Card de programa de retenção que reaparece a cada login até decisão explícita do cliente"
      },
      {
        type: "feature",
        description: "Sistema de notificações in-app com sino, contador de não lidas e popover interativo"
      },
      {
        type: "feature",
        description: "Push notifications nativas via Service Worker para notificações mesmo com app fechado"
      },
      {
        type: "feature",
        description: "Som opcional de notificação com toggle de ativação/desativação"
      },
      {
        type: "feature",
        description: "PWA (Progressive Web App) com possibilidade de adicionar à tela inicial do celular"
      },
      {
        type: "feature",
        description: "Sistema de convites para clientes com primeiro acesso e validação de email"
      },
      {
        type: "feature",
        description: "Página de gerenciamento de notificações para lojistas com seleção de clientes e métricas"
      },
      {
        type: "feature",
        description: "Dashboard de métricas de notificações integrado ao painel de marketing"
      },
      {
        type: "feature",
        description: "Indicador visual de status Leva+ One no perfil do cliente (admin)"
      },
      {
        type: "feature",
        description: "Inclusão de resgates Leva+ One no extrato de transações do cliente"
      },
      {
        type: "feature",
        description: "Geração de fatura PDF mensal do Leva+ One para fechamento de comissões"
      },
      {
        type: "feature",
        description: "Configuração de custos operacionais (taxas, impostos) no dashboard Leva+ One"
      },
      {
        type: "feature",
        description: "Autocompletar endereço baseado em CEP no formulário de cartão de crédito"
      },
      {
        type: "feature",
        description: "Extrato de pagamentos para clientes visualizarem histórico de cobranças Leva+ One"
      },
      {
        type: "improvement",
        description: "Consolidação de webhooks Asaas em endpoint único com validação de token de segurança"
      },
      {
        type: "improvement",
        description: "Redesign completo da página de disparo de SMS com separação de disparos automáticos e campanhas"
      },
      {
        type: "improvement",
        description: "Página de notificações com layout padronizado e melhor organização visual"
      },
      {
        type: "improvement",
        description: "Página de assinatura Leva+ One com design premium e informações de segurança"
      },
      {
        type: "improvement",
        description: "Card de programa de retenção com ocultação por sessão ao clicar no X"
      },
      {
        type: "improvement",
        description: "Período mínimo de cancelamento da assinatura Leva+ One alterado de 3 para 12 meses"
      },
      {
        type: "improvement",
        description: "Melhorado efeito parallax 3D do cartão Leva+ One com animação mais suave e brilho sutil"
      },
      {
        type: "improvement",
        description: "Ícone de estrela maior e com animação pulsante no status ATIVO do cartão"
      },
      {
        type: "improvement",
        description: "Todos os links externos usando domínio customizado portal.levamais.app"
      },
      {
        type: "improvement",
        description: "Display de opções de plano aparece em todos os logins até decisão explícita"
      },
      {
        type: "improvement",
        description: "Variáveis de personalização adicionadas na aba Campanha Promocional do SMS"
      },
      {
        type: "fix",
        description: "Corrigido cálculo de benefício em promoções 'Pague X Leve Y' para refletir valor real do produto gratuito"
      },
      {
        type: "fix",
        description: "Corrigido envio de código de verificação de email para desbloqueio de conta"
      },
      {
        type: "fix",
        description: "Corrigida funcionalidade de verificação SMS para registro e confirmação de telefone"
      },
      {
        type: "fix",
        description: "Corrigido fluxo de recuperação de senha para clientes"
      },
      {
        type: "fix",
        description: "Corrigido redirecionamento de link de convite de primeiro acesso"
      },
      {
        type: "fix",
        description: "Corrigida lógica de reenvio de convite para clientes com email não validado"
      },
      {
        type: "fix",
        description: "Corrigida exibição da página de logs de webhooks Asaas (Financeiro > Asaas)"
      },
      {
        type: "fix",
        description: "Removido prefixo '55' de números de telefone ao enviar para API Asaas"
      }
    ]
  },
  {
    version: "25.11.2",
    date: "2025-11-04",
    changes: [
      {
        type: "fix",
        description: "Corrigido cálculo do NPS para escala 1-5 (promotores=5, detratores≤2)"
      },
      {
        type: "feature",
        description: "Criado ranking NPS separado na página de Engajamento com visualização por loja"
      },
      {
        type: "improvement",
        description: "Melhorado título da seção de avaliações no NPS para 'Histórico de Avaliações'"
      }
    ]
  },
  {
    version: "25.11.1",
    date: "2025-11-02",
    changes: [
      {
        type: "feature",
        description: "Sistema completo de integração WebPosto com API REST para pré-venda, pós-venda e cancelamento"
      },
      {
        type: "feature",
        description: "API de autenticação com bearer tokens para parceiros externos (auth-token, venda-validar, venda-enviar, venda-cancelar)"
      },
      {
        type: "feature",
        description: "Documentação completa da API de integração com exemplos de requisições e respostas (INTEGRACAO-WEBPOSTO.md)"
      },
      {
        type: "feature",
        description: "Integração WebPosto agora captura e armazena código e nome do colaborador em todas as transações"
      },
      {
        type: "feature",
        description: "Sistema de validação Turnstile (CAPTCHA) implementado em todos os portais de autenticação"
      },
      {
        type: "feature",
        description: "Proteção anti-bot com Cloudflare Turnstile nos logins de Cliente, Colaborador, Revendedor e Loja"
      },
      {
        type: "improvement",
        description: "Exibição de código e nome do colaborador no detalhamento de transações no portal administrativo"
      },
      {
        type: "improvement",
        description: "Dados do colaborador persistidos em todas as etapas do fluxo de transação (validação, envio e armazenamento)"
      },
      {
        type: "improvement",
        description: "Segurança reforçada com validação de token em todas as páginas de autenticação antes de permitir login"
      },
      {
        type: "improvement",
        description: "Reset automático do Turnstile em caso de erro de autenticação para melhor UX"
      },
      {
        type: "improvement",
        description: "Suporte a múltiplos tipos de código na API (P=Pontuação, R=Resgate, D=Desconto)"
      },
      {
        type: "improvement",
        description: "Sistema de idempotência na confirmação de vendas para evitar duplicações"
      }
    ]
  },
  {
    version: "25.10.13",
    date: "2025-10-31",
    changes: [
      {
        type: "improvement",
        description: "API venda-validar agora retorna informações de ambos os tipos (P e R) mesmo quando não há cashback disponível"
      },
      {
        type: "feature",
        description: "Novos templates de mensagens da API: confirmação de acúmulo de pontos e cashback"
      },
      {
        type: "feature",
        description: "Template de mensagem para bloqueio de resgate por tempo mínimo configurado (dias/horas)"
      },
      {
        type: "feature",
        description: "Template de mensagem para bloqueio de resgate por limite diário excedido"
      },
      {
        type: "improvement",
        description: "Validação automática de limite diário de resgates na API de integração"
      },
      {
        type: "improvement",
        description: "Atualizada mensagem do template 'CPF não encontrado' para oferecer cadastro"
      }
    ]
  },
  {
    version: "25.10.12",
    date: "2025-10-30",
    changes: [
      {
        type: "feature",
        description: "Prazo para Resgate configurável: permite definir tempo de espera (imediato, horas ou dias) antes de permitir resgate após acumulação"
      },
      {
        type: "improvement",
        description: "Melhorada responsividade mobile dos cards de Programa de Benefícios e Postos/Lojas no portal do cliente"
      },
      {
        type: "improvement",
        description: "Otimizada exibição de detalhes de lojas no modal de Postos e Lojas para dispositivos móveis"
      }
    ]
  },
  {
    version: "25.10.11",
    date: "2025-10-30",
    changes: [
      {
        type: "feature",
        description: "Integração completa com parceiro MEX10 para envio de SMS (consulta saldo, envio e rastreamento)"
      },
      {
        type: "feature",
        description: "Nova página 'Mensagens da API' para configurar mensagens retornadas pela API de validação"
      },
      {
        type: "feature",
        description: "Sistema de tags dinâmicas nas mensagens da API ({cpf}, {nome}, {saldo}) com substituição automática"
      },
      {
        type: "feature",
        description: "Seção de testes MEX10 na página de API para testar saldo, envio e status de SMS"
      },
      {
        type: "improvement",
        description: "Cache de 5 minutos para templates de mensagens da API, melhorando performance"
      },
      {
        type: "improvement",
        description: "Otimizado auto-refresh de saldos de integrações de 30 segundos para 1 hora (alinhado com cache)"
      },
      {
        type: "improvement",
        description: "Loading de saldos só aparece quando não há cache válido, eliminando indicadores desnecessários"
      },
      {
        type: "improvement",
        description: "Simplificado componente LoadingPage, removendo animações pesadas e reduzindo peso da página"
      },
      {
        type: "fix",
        description: "Corrigido valor base de uso MEX10 para 8 no cálculo de saldo disponível"
      }
    ]
  },
  {
    version: "25.10.10",
    date: "2025-10-29",
    changes: [
      {
        type: "feature",
        description: "Sistema de mensagens configuráveis da API com tags dinâmicas no portal administrativo"
      },
      {
        type: "feature",
        description: "Editor de mensagens para API venda-validar com substituição automática de {cpf}, {nome}, {saldo}"
      },
      {
        type: "improvement",
        description: "Simplificação dos loaders em todas as páginas para melhor performance e UX"
      },
      {
        type: "improvement",
        description: "Removido loader complexo, mantendo apenas indicador visual simples (spinner)"
      },
      {
        type: "improvement",
        description: "Cache de 5 minutos para templates de mensagens da API"
      }
    ]
  },
  {
    version: "25.10.8",
    date: "2025-10-27",
    changes: [
      {
        type: "feature",
        description: "Drill-down interativo em 8 cards do dashboard principal da loja"
      },
      {
        type: "feature",
        description: "Detalhamento de Total de Clientes com lista completa e filtros"
      },
      {
        type: "feature",
        description: "Análise de Taxa de Conversão com breakdown de clientes validados e pendentes"
      },
      {
        type: "feature",
        description: "Detalhamento de Ticket Médio com ranking de clientes por valor gasto"
      },
      {
        type: "feature",
        description: "Drill-down de Pontos Ativos mostrando distribuição por cliente"
      },
      {
        type: "feature",
        description: "Análise de Novos Clientes com separação entre validados e pendentes"
      },
      {
        type: "feature",
        description: "Detalhamento de Taxa de Retenção com lista de clientes retidos"
      },
      {
        type: "feature",
        description: "Drill-down de Frequência Média de Compra com dados individuais por cliente"
      },
      {
        type: "feature",
        description: "Detalhamento de Valor Resgatado com histórico completo de resgates"
      }
    ]
  },
  {
    version: "25.10.6",
    date: "2025-10-26",
    changes: [
      {
        type: "feature",
        description: "Sistema completo de comissões automáticas para revendedores com cálculo baseado em regras configuráveis"
      },
      {
        type: "feature",
        description: "Relatório de faturamento mensal no portal revendedor com totais acumulados e previsão de pagamento"
      },
      {
        type: "feature",
        description: "Detalhamento expandível de comissões por cliente/empresa no faturamento mensal"
      },
      {
        type: "improvement",
        description: "Informação clara sobre política de pagamento de comissões (dia 15 do mês seguinte)"
      }
    ]
  },
  {
    version: "25.10.4",
    date: "2025-10-26",
    changes: [
      {
        type: "feature",
        description: "Criado gerenciamento de Regras de Comissão para revendedores"
      },
      {
        type: "feature",
        description: "Interface para configurar comissão de 50% nas 3 primeiras mensalidades e 15% após"
      },
      {
        type: "feature",
        description: "Botão 'Regras' adicionado na tela de Revendas para gestão de comissões"
      },
      {
        type: "feature",
        description: "Cálculo automático de comissões quando cliente é associado a revendedor"
      },
      {
        type: "feature",
        description: "Sistema divide mensalidade pelas licenças e aplica percentual da regra vigente"
      },
      {
        type: "feature",
        description: "Relatório de Faturamento Mensal no portal revendedor com totais, status e data de pagamento"
      },
      {
        type: "improvement",
        description: "Adicionada informação de pagamento no portal revendedor (dia 15 do mês seguinte)"
      }
    ]
  },
  {
    version: "25.10.3",
    date: "2025-10-26",
    changes: [
      {
        type: "feature",
        description: "Implementado Portal do Revendedor completo com autenticação"
      },
      {
        type: "feature",
        description: "Dashboard de revendedor com visualização de comissões e clientes"
      },
      {
        type: "improvement",
        description: "Email de boas-vindas agora envia link direto para criação de senha (removida senha temporária)"
      },
      {
        type: "feature",
        description: "Botão de reenvio de email de boas-vindas no painel administrativo"
      },
      {
        type: "fix",
        description: "Corrigido loop de troca de senha no portal do revendedor"
      },
      {
        type: "improvement",
        description: "Melhorado fluxo de onboarding de revendedores com link de reset de senha"
      }
    ]
  },
  {
    version: "25.10.2",
    date: "2025-10-26",
    changes: [
      {
        type: "feature",
        description: "Adicionado controle de versões no portal administrativo"
      },
      {
        type: "improvement",
        description: "Melhorada a experiência de seleção de relatórios com menu lateral"
      },
      {
        type: "improvement",
        description: "Relatório de transações integrado diretamente na página de relatórios"
      }
    ]
  },
  {
    version: "25.10.1",
    date: "2025-10-26",
    changes: [
      {
        type: "feature",
        description: "Versão inicial do sistema com funcionalidades base"
      }
    ]
  }
];
