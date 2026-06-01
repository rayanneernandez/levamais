import { Building2, Users, Shield, LayoutDashboard, FileText, Settings, Sparkles, TrendingUp, DollarSign, Plug, ScrollText, CalendarClock, AlertTriangle, HelpCircle, Receipt, HeartHandshake, Lightbulb, Gift, Fuel, Tag, MessageCircle, Megaphone, Bell, Wallet, Package } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { ChevronDown } from "lucide-react";
import { useSidebarPermissions } from "@/hooks/useSidebarPermissions";

export function StoreSidebar() {
  const { state } = useSidebar();
  const [fuelAnalysisEnabled, setFuelAnalysisEnabled] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const { canViewRoute, permissionsEnabled, isLoading: permissionsLoading } = useSidebarPermissions();
  
  // Estado persistente para cada seção
  const getStoredState = (key: string, defaultValue: boolean) => {
    const stored = localStorage.getItem(`sidebar-${key}`);
    return stored !== null ? stored === 'true' : defaultValue;
  };

  const [openSections, setOpenSections] = useState({
    clientes: getStoredState('clientes', true),
    marketing: getStoredState('marketing', false),
    levaone: getStoredState('levaone', false),
    combustivel: getStoredState('combustivel', false),
    seguranca: getStoredState('seguranca', false),
    configuracoes: getStoredState('configuracoes', false),
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => {
      const newState = { ...prev, [section]: !prev[section] };
      localStorage.setItem(`sidebar-${section}`, String(newState[section]));
      return newState;
    });
  };

  // Função helper para verificar se deve mostrar item do menu
  const shouldShowMenuItem = (route: string) => {
    if (!permissionsEnabled) return true;
    return canViewRoute(route);
  };

  // Verificar se algum item da seção está visível
  const hasSectionItems = (routes: string[]) => {
    if (!permissionsEnabled) return true;
    return routes.some(route => canViewRoute(route));
  };

  useEffect(() => {
    async function checkFuelAnalysisAndManualMode() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: managerData } = await supabase
          .from("store_managers")
          .select("network_id")
          .eq("user_id", user.id)
          .single();

        if (!managerData?.network_id) return;

        const { data: networkData } = await supabase
          .from("networks")
          .select("fuel_analysis_enabled")
          .eq("id", managerData.network_id)
          .single();
        
        setFuelAnalysisEnabled(networkData?.fuel_analysis_enabled || false);

        // Verificar se alguma loja da rede está em modo manual
        const { data: storeData } = await supabase
          .from("stores")
          .select("is_manual_mode")
          .eq("network_id", managerData.network_id)
          .eq("is_manual_mode", true)
          .limit(1);
        
        setIsManualMode(storeData && storeData.length > 0);
      } catch (error) {
        console.error("Error checking fuel analysis and manual mode:", error);
      }
    }
    
    checkFuelAnalysisAndManualMode();
  }, []);

  return (
    <Sidebar collapsible="icon" className="pt-16">
      <SidebarContent className="gap-0">
        {/* Início */}
        <SidebarGroup className="py-1 mt-4">
          <SidebarGroupContent>
            <SidebarMenu>
              {shouldShowMenuItem('/levaloja/dashboard') && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/levaloja/dashboard" end>
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Dashboard</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              
              {shouldShowMenuItem('/levaloja/lojas') && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/levaloja/lojas">
                      <Building2 className="h-4 w-4" />
                      <span>Minhas Lojas</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              
              {shouldShowMenuItem('/levaloja/financeiro') && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/levaloja/financeiro">
                      <Wallet className="h-4 w-4" />
                      <span>Assinatura Leva+</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Clientes & Gestão */}
        {hasSectionItems(['/levaloja/clientes', '/levaloja/engajamento', '/levaloja/agenda-recompra', '/levaloja/gestao-retencao', '/levaloja/relatorios']) && (
          <SidebarGroup className="py-1">
            <Collapsible 
              open={openSections.clientes} 
              onOpenChange={() => toggleSection('clientes')}
              className="group/collapsible"
            >
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between text-base font-semibold text-foreground">
                  Clientes & Gestão
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {shouldShowMenuItem('/levaloja/clientes') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/clientes">
                            <Users className="h-4 w-4" />
                            <span>Clientes</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    
                    {shouldShowMenuItem('/levaloja/engajamento') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/engajamento">
                            <TrendingUp className="h-4 w-4" />
                            <span>Engajamento</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    
                    {shouldShowMenuItem('/levaloja/agenda-recompra') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/agenda-recompra">
                            <CalendarClock className="h-4 w-4" />
                            <span>Agenda de Recompra</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    
                    {shouldShowMenuItem('/levaloja/gestao-retencao') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/gestao-retencao">
                            <HeartHandshake className="h-4 w-4" />
                            <span>Gestão de Retenção</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    
                    {shouldShowMenuItem('/levaloja/relatorios') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/relatorios">
                            <FileText className="h-4 w-4" />
                            <span>Relatórios</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Marketing */}
        {hasSectionItems(['/levaloja/marketing/dashboard', '/levaloja/acoes', '/levaloja/marketing/notificacoes', '/levaloja/marketing/disparo-sms', '/levaloja/marketing/disparo-whatsapp', '/levaloja/marketing/impacto-insights', '/levaloja/marketing/extrato', '/levaloja/marketing/nps']) && (
          <SidebarGroup className="py-1">
            <Collapsible 
              open={openSections.marketing} 
              onOpenChange={() => toggleSection('marketing')}
              className="group/collapsible"
            >
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between text-base font-semibold text-foreground">
                  Marketing
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {shouldShowMenuItem('/levaloja/marketing/dashboard') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/marketing/dashboard">
                            <LayoutDashboard className="h-4 w-4" />
                            <span>Dashboard</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    
                    {shouldShowMenuItem('/levaloja/acoes') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/acoes">
                            <Megaphone className="h-4 w-4" />
                            <span>Ações e Promoções</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}

                    {shouldShowMenuItem('/levaloja/marketing/notificacoes') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/marketing/notificacoes">
                            <Bell className="h-4 w-4" />
                            <span>Notificações</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}

                    {shouldShowMenuItem('/levaloja/marketing/disparo-sms') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/marketing/disparo-sms">
                            <MessageCircle className="h-4 w-4" />
                            <span>Disparo de SMS</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}

                    {shouldShowMenuItem('/levaloja/marketing/disparo-whatsapp') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/marketing/disparo-whatsapp">
                            <MessageCircle className="h-4 w-4" />
                            <span>Disparo de WhatsApp</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}

                    {shouldShowMenuItem('/levaloja/marketing/impacto-insights') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/marketing/impacto-insights">
                            <Lightbulb className="h-4 w-4" />
                            <span>Impacto e Insights</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}

                    {shouldShowMenuItem('/levaloja/marketing/extrato') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/marketing/extrato">
                            <Receipt className="h-4 w-4" />
                            <span>Extrato de Marketing</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}

                    {shouldShowMenuItem('/levaloja/marketing/nps') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/marketing/nps">
                            <Gift className="h-4 w-4" />
                            <span>NPS</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Leva+ One */}
        {hasSectionItems(['/levaloja/leva-one/dashboard', '/levaloja/leva-one/promocoes', '/levaloja/leva-one/resgates']) && (
          <SidebarGroup className="py-1">
            <Collapsible 
              open={openSections.levaone} 
              onOpenChange={() => toggleSection('levaone')}
              className="group/collapsible"
            >
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between text-base font-semibold text-foreground">
                  Leva+ One
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {shouldShowMenuItem('/levaloja/leva-one/dashboard') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/leva-one/dashboard">
                            <LayoutDashboard className="h-4 w-4" />
                            <span>Dashboard</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    
                    {shouldShowMenuItem('/levaloja/leva-one/promocoes') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/leva-one/promocoes">
                            <Gift className="h-4 w-4" />
                            <span>Promoções</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}

                    {shouldShowMenuItem('/levaloja/leva-one/resgates') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/leva-one/resgates">
                            <Tag className="h-4 w-4" />
                            <span>Resgates</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Combustível - Ocultado temporariamente */}

        {/* Segurança & Acesso */}
        {hasSectionItems(['/levaloja/usuarios', '/levaloja/perfis', '/levaloja/tags', '/levaloja/monitor-anomalias', '/levaloja/configuracoes/logs']) && (
          <SidebarGroup className="py-1">
            <Collapsible 
              open={openSections.seguranca} 
              onOpenChange={() => toggleSection('seguranca')}
              className="group/collapsible"
            >
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between text-base font-semibold text-foreground">
                  Segurança & Acesso
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {shouldShowMenuItem('/levaloja/usuarios') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/usuarios">
                            <Users className="h-4 w-4" />
                            <span>Usuários</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    
                    {shouldShowMenuItem('/levaloja/perfis') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/perfis">
                            <Shield className="h-4 w-4" />
                            <span>Perfis de Acesso</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    
                    {shouldShowMenuItem('/levaloja/tags') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/tags">
                            <Tag className="h-4 w-4" />
                            <span>Tags</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    
                    {shouldShowMenuItem('/levaloja/monitor-anomalias') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/monitor-anomalias">
                            <AlertTriangle className="h-4 w-4" />
                            <span>Monitor de Anomalias</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    
                    {shouldShowMenuItem('/levaloja/configuracoes/logs') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/configuracoes/logs">
                            <ScrollText className="h-4 w-4" />
                            <span>Logs de Auditoria</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Configurações */}
        {hasSectionItems(['/levaloja/configuracoes/fidelidade', '/levaloja/produtos', '/levaloja/leva-mais-valoriza', '/levaloja/configuracoes/reajuste', '/levaloja/configuracoes/integracao']) && (
          <SidebarGroup className="py-1">
            <Collapsible 
              open={openSections.configuracoes} 
              onOpenChange={() => toggleSection('configuracoes')}
              className="group/collapsible"
            >
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between text-base font-semibold text-foreground">
                  Configurações
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {shouldShowMenuItem('/levaloja/configuracoes/fidelidade') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/configuracoes/fidelidade">
                            <Settings className="h-4 w-4" />
                            <span>Fidelidade</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    
                    {isManualMode && shouldShowMenuItem('/levaloja/produtos') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/produtos">
                            <Package className="h-4 w-4" />
                            <span>Produtos</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    
                    {shouldShowMenuItem('/levaloja/leva-mais-valoriza') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/leva-mais-valoriza">
                            <Gift className="h-4 w-4" />
                            <span>Leva+Valoriza</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    
                    {shouldShowMenuItem('/levaloja/configuracoes/reajuste') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/configuracoes/reajuste">
                            <DollarSign className="h-4 w-4" />
                            <span>Reajuste</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    
                    {shouldShowMenuItem('/levaloja/configuracoes/integracao-checkout') && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink to="/levaloja/configuracoes/integracao">
                            <Plug className="h-4 w-4" />
                            <span>Integração Checkout</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        <SidebarGroup className="py-1 mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {shouldShowMenuItem('/levaloja/ajuda') && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/levaloja/ajuda">
                      <HelpCircle className="h-4 w-4" />
                      <span>Ajuda</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
