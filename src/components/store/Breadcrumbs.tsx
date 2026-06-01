import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbConfig {
  [key: string]: {
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    nonClickable?: boolean; // For parent routes that don't have their own page
  };
}

const breadcrumbConfig: BreadcrumbConfig = {
  "/levaloja": { label: "Início", icon: Home },
  "/levaloja/dashboard": { label: "Dashboard" },
  "/levaloja/clientes": { label: "Clientes" },
  "/levaloja/lojas": { label: "Lojas" },
  "/levaloja/fidelidade": { label: "Fidelidade" },
  "/levaloja/financeiro": { label: "Financeiro" },
  "/levaloja/relatorios": { label: "Relatórios" },
  "/levaloja/notificacoes": { label: "Notificações" },
  "/levaloja/perfis": { label: "Perfis" },
  "/levaloja/tags": { label: "Tags" },
  "/levaloja/acoes": { label: "Ações" },
  "/levaloja/engajamento": { label: "Engajamento" },
  "/levaloja/nps": { label: "NPS" },
  "/levaloja/disparo-sms": { label: "Disparos SMS" },
  "/levaloja/disparo-email": { label: "Disparos E-mail" },
  "/levaloja/disparo-whatsapp": { label: "Disparos WhatsApp" },
  "/levaloja/marketing-dashboard": { label: "Dashboard Marketing" },
  "/levaloja/extrato-marketing": { label: "Extrato Marketing" },
  "/levaloja/analise-combustivel": { label: "Análise de Combustível" },
  "/levaloja/dashboard-combustivel": { label: "Dashboard Combustível" },
  "/levaloja/leva-mais-valoriza": { label: "Leva+ Valoriza" },
  "/levaloja/reajuste": { label: "Reajuste" },
  "/levaloja/gestao-retencao": { label: "Gestão de Retenção" },
  "/levaloja/integracao-checkout": { label: "Integração Checkout" },
  "/levaloja/agenda-recompra": { label: "Agenda de Recompra" },
  "/levaloja/impacto-insights": { label: "Impacto Insights" },
  "/levaloja/monitor-anomalias": { label: "Monitor de Anomalias" },
  "/levaloja/analise-detalhada": { label: "Análise Detalhada" },
  "/levaloja/transacoes-relatorio": { label: "Relatório de Transações" },
  "/levaloja/audit-logs": { label: "Logs de Auditoria" },
  "/levaloja/ajuda": { label: "Ajuda" },
  "/levaloja/suporte": { label: "Suporte" },
  "/levaloja/leva-one-promotions": { label: "Promoções Leva One" },
  "/levaloja/leva-one-resgates": { label: "Resgates Leva One" },
  "/levaloja/leva-one-financial": { label: "Financeiro Leva One" },
  "/levaloja/configuracoes": { label: "Configurações", nonClickable: true },
  "/levaloja/configuracoes/fidelidade": { label: "Fidelidade" },
  "/levaloja/configuracoes/reajuste": { label: "Reajuste" },
  "/levaloja/configuracoes/integracao": { label: "Integração" },
  "/levaloja/configuracoes/logs": { label: "Logs de Auditoria" },
};

export function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  // If we're on the root /levaloja or /levaloja/dashboard (same page), show just home
  if (location.pathname === "/levaloja" || location.pathname === "/levaloja/dashboard") {
    return (
      <div className="flex items-center gap-2 px-6 py-3 bg-muted/30 border-b">
        <Home className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Início</span>
      </div>
    );
  }

  // Build breadcrumb items (skip first level as it's already shown as Home)
  const breadcrumbItems = pathnames
    .slice(1) // Skip 'levaloja' as it's the home link
    .map((_, index) => {
      const adjustedIndex = index + 1; // Adjust index since we skipped first item
      const path = `/${pathnames.slice(0, adjustedIndex + 1).join("/")}`;
      const config = breadcrumbConfig[path];
      
      return {
        path,
        label: config?.label || pathnames[adjustedIndex],
        icon: config?.icon,
        isLast: adjustedIndex === pathnames.length - 1,
        nonClickable: config?.nonClickable || false,
      };
    });

  return (
    <nav className="flex items-center gap-2 px-6 py-3 bg-muted/30 border-b">
      {/* Home link */}
      <Link
        to="/levaloja"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
        <span>Início</span>
      </Link>

      {/* Breadcrumb items */}
      {breadcrumbItems.map((item, index) => (
        <div key={item.path} className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          
          {item.isLast || item.nonClickable ? (
            <div className="flex items-center gap-1.5">
              {item.icon && <item.icon className="h-4 w-4 text-primary" />}
              <span className={cn(
                "text-sm",
                item.isLast ? "font-medium text-foreground" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </div>
          ) : (
            <Link
              to={item.path}
              className={cn(
                "flex items-center gap-1.5 text-sm transition-colors",
                "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.icon && <item.icon className="h-4 w-4" />}
              <span>{item.label}</span>
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
