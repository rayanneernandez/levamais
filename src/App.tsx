import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { StoreFilterProvider } from "@/contexts/StoreFilterContext";
import { SupportTicketProvider } from "@/contexts/SupportTicketContext";
import { LoadingPage } from "@/components/ui/loading-page";
import { AdminLayout } from "./components/admin/AdminLayout";
import { StoreLayout } from "./components/store/StoreLayout";

// Lazy load all page components for better code splitting
const Index = lazy(() => import("./pages/Index"));
const IndexAlt = lazy(() => import("./pages/IndexAlt"));
const AdminAuth = lazy(() => import("./pages/AdminAuth"));
const StoreAuth = lazy(() => import("./pages/StoreAuth"));
const StoreChangePassword = lazy(() => import("./pages/StoreChangePassword"));
const ClientAuth = lazy(() => import("./pages/ClientAuth"));
const ClientSignup = lazy(() => import("./pages/ClientSignup"));
const CollaboratorAuth = lazy(() => import("./pages/CollaboratorAuth"));
const CollaboratorDashboard = lazy(() => import("./pages/CollaboratorDashboard"));
const Admin = lazy(() => import("./pages/Admin"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Empresas = lazy(() => import("./pages/admin/Empresas"));
const Licencas = lazy(() => import("./pages/admin/Licencas"));
const Lojas = lazy(() => import("./pages/admin/Lojas"));
const Usuarios = lazy(() => import("./pages/admin/Usuarios"));
const Perfis = lazy(() => import("./pages/admin/Perfis"));
const AdminClientes = lazy(() => import("./pages/admin/Clientes"));
const TransferenciasRede = lazy(() => import("./pages/admin/TransferenciasRede"));
const Revendas = lazy(() => import("./pages/admin/Revendas"));
const LogsAuditoria = lazy(() => import("./pages/admin/LogsAuditoria"));
const AdminProfile = lazy(() => import("./pages/admin/AdminProfile"));
const AdminChangePassword = lazy(() => import("./pages/admin/AdminChangePassword"));
const ProdutosServicos = lazy(() => import("./pages/admin/ProdutosServicos"));
const Categorias = lazy(() => import("./pages/admin/Categorias"));
const Orcamentos = lazy(() => import("./pages/admin/Orcamentos"));
const Transacoes = lazy(() => import("./pages/admin/Transacoes"));
const Vendas = lazy(() => import("./pages/admin/Vendas"));
const DashboardComercial = lazy(() => import("./pages/admin/DashboardComercial"));
const FinanceiroAdmin = lazy(() => import("./pages/admin/FinanceiroAdmin"));
const Leads = lazy(() => import("./pages/admin/Leads"));
const API = lazy(() => import("./pages/admin/API"));
const SwaggerDocs = lazy(() => import("./pages/admin/SwaggerDocs"));
const ApiDocsPortal = lazy(() => import("./pages/admin/ApiDocsPortal"));
const LogsSMS = lazy(() => import("./pages/admin/LogsSMS"));
const MonitorAnomalias = lazy(() => import("./pages/admin/MonitorAnomalias"));
const Monitoramento = lazy(() => import("./pages/admin/Monitoramento"));
const TestesEmail = lazy(() => import("./pages/admin/TestesEmail"));
const Store = lazy(() => import("./pages/Store"));
const StoreUsers = lazy(() => import("./pages/StoreUsers"));
const Client = lazy(() => import("./pages/Client"));
const NotFound = lazy(() => import("./pages/NotFound"));
const StoreDashboard = lazy(() => import("./pages/store/Dashboard"));
const StoreLojas = lazy(() => import("./pages/store/Lojas"));
const StoreFinanceiro = lazy(() => import("./pages/store/Financeiro"));
const StoreClientes = lazy(() => import("./pages/store/Clientes"));
const ClienteDetalhes = lazy(() => import("./pages/store/ClienteDetalhes"));
const StorePerfis = lazy(() => import("./pages/store/Perfis"));
const StoreTags = lazy(() => import("./pages/store/Tags"));
const StoreRelatorios = lazy(() => import("./pages/store/Relatorios"));
const StoreFidelidade = lazy(() => import("./pages/store/Fidelidade"));
const StoreIntegracaoCheckout = lazy(() => import("./pages/store/IntegracaoCheckout"));
const StoreAcoes = lazy(() => import("./pages/store/Acoes"));
const StoreEngajamento = lazy(() => import("./pages/store/Engajamento"));
const StoreReajuste = lazy(() => import("./pages/store/Reajuste"));
const StoreAuditLogs = lazy(() => import("./pages/store/AuditLogs"));
const AgendaRecompra = lazy(() => import("./pages/store/AgendaRecompra"));
const GestaoRetencao = lazy(() => import("./pages/store/GestaoRetencao"));
const ImpactoInsights = lazy(() => import("./pages/store/ImpactoInsights"));
const AnaliseDetalhada = lazy(() => import("./pages/store/AnaliseDetalhada"));
const StoreMonitorAnomalias = lazy(() => import("./pages/store/MonitorAnomalias"));
const MarketingDashboard = lazy(() => import("./pages/store/MarketingDashboard"));
const DisparoEmail = lazy(() => import("./pages/store/DisparoEmail"));
const DisparoWhatsApp = lazy(() => import("./pages/store/DisparoWhatsApp"));
const DisparoSMS = lazy(() => import("./pages/store/DisparoSMS"));
const ExtratoMarketing = lazy(() => import("./pages/store/ExtratoMarketing"));
const Notificacoes = lazy(() => import("./pages/store/Notificacoes"));
const Manual = lazy(() => import("./pages/admin/Manual"));
const Suporte = lazy(() => import("./pages/admin/Suporte"));
const Projetos = lazy(() => import("./pages/admin/Projetos"));
const ProjetoDetalhes = lazy(() => import("./pages/admin/ProjetoDetalhes"));
const StoreAjuda = lazy(() => import("./pages/store/Ajuda"));
const StoreSuporte = lazy(() => import("./pages/store/Suporte"));
const ClientHelp = lazy(() => import("./pages/help/ClientHelp"));
const CollaboratorAjuda = lazy(() => import("./pages/collaborator/Ajuda"));
const CollaboratorSuporte = lazy(() => import("./pages/collaborator/Suporte"));
const ResellerAuth = lazy(() => import("./pages/ResellerAuth"));
const ResellerChangePassword = lazy(() => import("./pages/ResellerChangePassword"));
const ResellerDashboard = lazy(() => import("./pages/ResellerDashboard"));
const LevaMaisValoriza = lazy(() => import("./pages/store/LevaMaisValoriza"));
const BudgetApproval = lazy(() => import("./pages/BudgetApproval"));
const TransacoesRelatorio = lazy(() => import("./pages/store/TransacoesRelatorio"));
const PrecoCombustivel = lazy(() => import("./pages/admin/PrecoCombustivel"));
const Versoes = lazy(() => import("./pages/admin/Versoes"));
const MensagensAPI = lazy(() => import("./pages/admin/MensagensAPI"));
const AdminDisparoWhatsApp = lazy(() => import("./pages/admin/DisparoWhatsApp"));
const AnaliseCombustivel = lazy(() => import("./pages/store/AnaliseCombustivel"));
const DashboardCombustivel = lazy(() => import("./pages/store/DashboardCombustivel"));
const NPS = lazy(() => import("./pages/store/NPS"));
const AsaasConfig = lazy(() => import("./pages/admin/AsaasConfig"));
const AsaasTests = lazy(() => import("./pages/admin/AsaasTests"));
const Planos = lazy(() => import("./pages/admin/Planos"));
const DashboardFinanceiro = lazy(() => import("./pages/admin/DashboardFinanceiro"));
const OneMarketplace = lazy(() => import("./pages/client/OneMarketplace"));
const MeuCartaoOne = lazy(() => import("./pages/client/MeuCartaoOne"));
const AssinarLevaOne = lazy(() => import("./pages/client/AssinarLevaOne"));
const OnePromotions = lazy(() => import("./pages/client/OnePromotions"));
const ProgramaBeneficios = lazy(() => import("./pages/client/ProgramaBeneficios"));
const LevaOnePromotions = lazy(() => import("./pages/store/LevaOnePromotions"));
const LevaOneFinancial = lazy(() => import("./pages/store/LevaOneFinancial"));
const AssinaturasOne = lazy(() => import("./pages/admin/AssinaturasOne"));
const DashboardOne = lazy(() => import("./pages/admin/DashboardOne"));
const LevaOneConfig = lazy(() => import("./pages/admin/LevaOneConfig"));
const LevaOneResgates = lazy(() => import("./pages/store/LevaOneResgates"));
const ResgatesOne = lazy(() => import("./pages/admin/ResgatesOne"));
const AssinaturasPagamentos = lazy(() => import("./pages/admin/AssinaturasPagamentos"));
const PromocoesOnePDV = lazy(() => import("./pages/admin/PromocoesOnePDV"));
const AsaasWebhookLogs = lazy(() => import("./pages/admin/AsaasWebhookLogs"));
const TestesSistema = lazy(() => import("./pages/admin/TestesSistema"));
const LevaRegistroAuth = lazy(() => import("./pages/LevaRegistroAuth"));
const LevaRegistroLancamentos = lazy(() => import("./pages/LevaRegistroLancamentos"));
const StoreProdutos = lazy(() => import("./pages/store/Produtos"));
const PublicApiDocs = lazy(() => import("./pages/PublicApiDocs"));

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <SupportTicketProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider>
            <Toaster />
          <Sonner />
          <BrowserRouter>
            <StoreFilterProvider>
              <Suspense fallback={<LoadingPage />}>
                <Routes>
                  <Route path="/" element={<IndexAlt />} />
                  <Route path="/lp1" element={<Index />} />
                  <Route path="/proposta/aprovacao" element={<BudgetApproval />} />
                  <Route path="/adm/auth" element={<AdminAuth />} />
                  <Route path="/adm" element={<Admin />} />
                  <Route path="/adm/dashboard" element={<AdminLayout><Dashboard /></AdminLayout>} />
                  <Route path="/adm/empresas" element={<AdminLayout><Empresas /></AdminLayout>} />
                  <Route path="/adm/licencas" element={<AdminLayout><Licencas /></AdminLayout>} />
                  <Route path="/adm/lojas" element={<AdminLayout><Lojas /></AdminLayout>} />
                  <Route path="/adm/clientes" element={<AdminLayout><AdminClientes /></AdminLayout>} />
                  <Route path="/adm/transferencias-rede" element={<AdminLayout><TransferenciasRede /></AdminLayout>} />
                  <Route path="/adm/revendas" element={<AdminLayout><Revendas /></AdminLayout>} />
                  <Route path="/adm/usuarios" element={<AdminLayout><Usuarios /></AdminLayout>} />
                  <Route path="/adm/perfis" element={<AdminLayout><Perfis /></AdminLayout>} />
                  <Route path="/adm/logs" element={<AdminLayout><LogsAuditoria /></AdminLayout>} />
                  <Route path="/adm/perfil" element={<AdminLayout><AdminProfile /></AdminLayout>} />
                  <Route path="/adm/senha" element={<AdminLayout><AdminChangePassword /></AdminLayout>} />
                  <Route path="/adm/produtos-servicos" element={<AdminLayout><ProdutosServicos /></AdminLayout>} />
                  <Route path="/adm/categorias" element={<AdminLayout><Categorias /></AdminLayout>} />
                  <Route path="/adm/orcamentos" element={<AdminLayout><Orcamentos /></AdminLayout>} />
                  <Route path="/adm/dashboard-comercial" element={<AdminLayout><DashboardComercial /></AdminLayout>} />
                  <Route path="/adm/leads" element={<AdminLayout><Leads /></AdminLayout>} />
                  <Route path="/adm/orcamentos" element={<AdminLayout><Orcamentos /></AdminLayout>} />
                  <Route path="/adm/transacoes" element={<AdminLayout><Transacoes /></AdminLayout>} />
                  <Route path="/adm/vendas" element={<AdminLayout><Vendas /></AdminLayout>} />
                  <Route path="/adm/api" element={<AdminLayout><API /></AdminLayout>} />
                  <Route path="/adm/api-docs" element={<AdminLayout><SwaggerDocs /></AdminLayout>} />
                  <Route path="/adm/api-docs-portal" element={<AdminLayout><ApiDocsPortal /></AdminLayout>} />
                  <Route path="/adm/logs-sms" element={<AdminLayout><LogsSMS /></AdminLayout>} />
                  <Route path="/adm/mensagens-api" element={<AdminLayout><MensagensAPI /></AdminLayout>} />
                  <Route path="/adm/whatsapp" element={<AdminLayout><AdminDisparoWhatsApp /></AdminLayout>} />
                  <Route path="/adm/monitor-anomalias" element={<AdminLayout><MonitorAnomalias /></AdminLayout>} />
                  <Route path="/adm/monitoramento" element={<AdminLayout><Monitoramento /></AdminLayout>} />
                  <Route path="/adm/testes-email" element={<AdminLayout><TestesEmail /></AdminLayout>} />
                  <Route path="/adm/manual" element={<AdminLayout><Manual /></AdminLayout>} />
                  <Route path="/adm/suporte" element={<AdminLayout><Suporte /></AdminLayout>} />
                  <Route path="/adm/projetos" element={<AdminLayout><Projetos /></AdminLayout>} />
                  <Route path="/adm/projetos/:id" element={<AdminLayout><ProjetoDetalhes /></AdminLayout>} />
                  <Route path="/adm/versoes" element={<AdminLayout><Versoes /></AdminLayout>} />
                  <Route path="/adm/preco-combustivel" element={<AdminLayout><PrecoCombustivel /></AdminLayout>} />
                  <Route path="/adm/configuracoes/asaas" element={<AdminLayout><AsaasConfig /></AdminLayout>} />
                  <Route path="/adm/configuracoes/asaas-tests" element={<AdminLayout><AsaasTests /></AdminLayout>} />
                  <Route path="/adm/financeiro" element={<AdminLayout><FinanceiroAdmin /></AdminLayout>} />
                  <Route path="/adm/financeiro/planos" element={<AdminLayout><Planos /></AdminLayout>} />
                  <Route path="/adm/financeiro/dashboard" element={<AdminLayout><DashboardFinanceiro /></AdminLayout>} />
                  <Route path="/adm/leva-one/dashboard" element={<AdminLayout><DashboardOne /></AdminLayout>} />
                  <Route path="/adm/leva-one/assinaturas" element={<AdminLayout><AssinaturasOne /></AdminLayout>} />
                  <Route path="/adm/leva-one/pagamentos" element={<AdminLayout><AssinaturasPagamentos /></AdminLayout>} />
                  <Route path="/adm/leva-one/webhook-logs" element={<AdminLayout><AsaasWebhookLogs /></AdminLayout>} />
                  <Route path="/adm/leva-one/resgates" element={<AdminLayout><ResgatesOne /></AdminLayout>} />
                  <Route path="/adm/leva-one/promocoes-pdv" element={<AdminLayout><PromocoesOnePDV /></AdminLayout>} />
                  <Route path="/adm/leva-one/config" element={<AdminLayout><LevaOneConfig /></AdminLayout>} />
                  <Route path="/adm/testes-sistema" element={<AdminLayout><TestesSistema /></AdminLayout>} />
                  <Route path="/levaloja/auth" element={<StoreAuth />} />
                  <Route path="/levaloja/trocar-senha" element={<StoreChangePassword />} />
                  
                  {/* Rotas aninhadas - StoreLayout é renderizado uma vez */}
                  <Route path="/levaloja" element={<StoreLayout />}>
                    <Route index element={<StoreDashboard />} />
                    <Route path="dashboard" element={<StoreDashboard />} />
                    <Route path="lojas" element={<StoreLojas />} />
                    <Route path="financeiro" element={<StoreFinanceiro />} />
                    <Route path="clientes" element={<StoreClientes />} />
                    <Route path="clientes/:id" element={<ClienteDetalhes />} />
                    <Route path="perfis" element={<StorePerfis />} />
                    <Route path="tags" element={<StoreTags />} />
                    <Route path="usuarios" element={<StoreUsers />} />
                    <Route path="acoes" element={<StoreAcoes />} />
                    <Route path="engajamento" element={<StoreEngajamento />} />
                    <Route path="relatorios" element={<StoreRelatorios />} />
                    <Route path="relatorios/transacoes" element={<TransacoesRelatorio />} />
                    <Route path="agenda-recompra" element={<AgendaRecompra />} />
                    <Route path="gestao-retencao" element={<GestaoRetencao />} />
                    <Route path="configuracoes/fidelidade" element={<StoreFidelidade />} />
                    <Route path="configuracoes/reajuste" element={<StoreReajuste />} />
                    <Route path="configuracoes/integracao" element={<StoreIntegracaoCheckout />} />
                    <Route path="configuracoes/logs" element={<StoreAuditLogs />} />
                    <Route path="monitor-anomalias" element={<StoreMonitorAnomalias />} />
                    <Route path="marketing/dashboard" element={<MarketingDashboard />} />
                    <Route path="marketing/disparo-email" element={<DisparoEmail />} />
                    <Route path="marketing/disparo-whatsapp" element={<DisparoWhatsApp />} />
                    <Route path="marketing/disparo-sms" element={<DisparoSMS />} />
                    <Route path="marketing/extrato" element={<ExtratoMarketing />} />
                    <Route path="marketing/notificacoes" element={<Notificacoes />} />
                    <Route path="marketing/nps" element={<NPS />} />
                    <Route path="marketing/impacto-insights" element={<ImpactoInsights />} />
                    <Route path="marketing/analise-detalhada" element={<AnaliseDetalhada />} />
                    <Route path="combustivel/dashboard" element={<DashboardCombustivel />} />
                    <Route path="combustivel/analise" element={<AnaliseCombustivel />} />
                    <Route path="leva-mais-valoriza" element={<LevaMaisValoriza />} />
                    <Route path="leva-one/dashboard" element={<LevaOneFinancial />} />
                    <Route path="leva-one/promocoes" element={<LevaOnePromotions />} />
                    <Route path="leva-one/resgates" element={<LevaOneResgates />} />
                    <Route path="leva-one/financeiro" element={<LevaOneFinancial />} />
                    <Route path="produtos" element={<StoreProdutos />} />
                  </Route>
                  
                  <Route path="/levaloja/ajuda" element={<StoreAjuda />} />
                  <Route path="/levaloja/suporte" element={<StoreSuporte />} />
                  <Route path="/levacliente" element={<Client />} />
                  <Route path="/levacliente/auth" element={<ClientAuth />} />
                  <Route path="/levacliente/cadastro" element={<ClientSignup />} />
                  <Route path="/cadastro" element={<ClientSignup />} />
                  <Route path="/cadastro-cliente" element={<ClientSignup />} />
                  <Route path="/levacliente/meu-cartao" element={<MeuCartaoOne />} />
                  <Route path="/levacliente/assinar-one" element={<AssinarLevaOne />} />
                  <Route path="/levacliente/programa-beneficios" element={<ProgramaBeneficios />} />
                  <Route path="/levacliente/marketplace" element={<OneMarketplace />} />
                  <Route path="/levacliente/promocoes-one" element={<OnePromotions />} />
                  <Route path="/levacliente/ajuda" element={<ClientHelp />} />
                  <Route path="/levacolaborador/auth" element={<CollaboratorAuth />} />
                  <Route path="/levacolaborador/dashboard" element={<CollaboratorDashboard />} />
                  <Route path="/levacolaborador/suporte" element={<CollaboratorSuporte />} />
                  <Route path="/levacolaborador/ajuda" element={<CollaboratorAjuda />} />
                  <Route path="/levaregistro" element={<LevaRegistroAuth />} />
                  <Route path="/levaregistro/lancamentos" element={<LevaRegistroLancamentos />} />
                  <Route path="/levarevendedor/auth" element={<ResellerAuth />} />
                  <Route path="/levarevendedor/trocar-senha" element={<ResellerChangePassword />} />
                  <Route path="/levarevendedor/dashboard" element={<ResellerDashboard />} />
                  {/* <Route path="/api-docs" element={<PublicApiDocs />} /> */}
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </StoreFilterProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </SupportTicketProvider>
  </QueryClientProvider>
);
};

export default App;
