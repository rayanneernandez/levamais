import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, Eye, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SystemMenu {
  id: string;
  name: string;
  display_name: string;
  description: string;
  icon: string;
  route: string;
  sort_order: number;
}

interface Permission {
  menuId: string;
  view: boolean;
  manage: boolean;
}

interface PermissionsManagerV2Props {
  profileId: string;
  currentPermissions: Record<string, any>;
  onSave: () => void;
}

// Agrupar menus por categoria
const menuCategories = [
  { key: 'inicio', label: 'Início', routes: ['/levaloja/dashboard', '/levaloja/lojas', '/levaloja/financeiro'] },
  { key: 'clientes', label: 'Clientes & Gestão', routes: ['/levaloja/clientes', '/levaloja/engajamento', '/levaloja/agenda-recompra', '/levaloja/gestao-retencao', '/levaloja/relatorios'] },
  { key: 'marketing', label: 'Marketing', routes: ['/levaloja/marketing/dashboard', '/levaloja/acoes', '/levaloja/marketing/notificacoes', '/levaloja/marketing/disparo-sms', '/levaloja/marketing/disparo-whatsapp', '/levaloja/marketing/disparo-email', '/levaloja/marketing/impacto-insights', '/levaloja/marketing/extrato', '/levaloja/marketing/nps'] },
  { key: 'one', label: 'Leva+ One', routes: ['/levaloja/leva-one/dashboard', '/levaloja/leva-one/promocoes', '/levaloja/leva-one/resgates'] },
  { key: 'seguranca', label: 'Segurança & Acesso', routes: ['/levaloja/usuarios', '/levaloja/perfis', '/levaloja/tags', '/levaloja/monitor-anomalias', '/levaloja/configuracoes/logs'] },
  { key: 'configuracoes', label: 'Configurações', routes: ['/levaloja/configuracoes/fidelidade', '/levaloja/produtos', '/levaloja/leva-mais-valoriza', '/levaloja/configuracoes/reajuste', '/levaloja/configuracoes/whatsapp', '/levaloja/configuracoes/integracao-checkout'] },
  { key: 'suporte', label: 'Suporte', routes: ['/levaloja/transacoes', '/levaloja/suporte', '/levaloja/ajuda'] },
];

export function PermissionsManagerV2({ profileId, currentPermissions, onSave }: PermissionsManagerV2Props) {
  const [menus, setMenus] = useState<SystemMenu[]>([]);
  const [permissions, setPermissions] = useState<Record<string, Permission>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadMenus();
  }, []);

  useEffect(() => {
    // Converter permissões antigas para novo formato
    const converted: Record<string, Permission> = {};
    Object.entries(currentPermissions || {}).forEach(([menuId, perm]: [string, any]) => {
      converted[menuId] = {
        menuId,
        view: perm?.view ?? perm?.read ?? false,
        manage: perm?.manage ?? (perm?.write || perm?.edit || perm?.delete) ?? false,
      };
    });
    setPermissions(converted);
  }, [currentPermissions]);

  const loadMenus = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('system_menus')
      .select('*')
      .like('route', '/levaloja%')
      .order('sort_order');

    if (data) {
      setMenus(data);
      
      // Inicializar permissões para menus que ainda não têm
      const newPermissions = { ...permissions };
      data.forEach(menu => {
        if (!newPermissions[menu.id]) {
          newPermissions[menu.id] = {
            menuId: menu.id,
            view: false,
            manage: false,
          };
        }
      });
      setPermissions(newPermissions);
    }
    setIsLoading(false);
  };

  const handlePermissionChange = (menuId: string, type: 'view' | 'manage', checked: boolean) => {
    setPermissions(prev => {
      const current = prev[menuId] || { menuId, view: false, manage: false };
      
      // Se marcar "manage", automaticamente marca "view"
      if (type === 'manage' && checked) {
        return {
          ...prev,
          [menuId]: { ...current, view: true, manage: true }
        };
      }
      
      // Se desmarcar "view", automaticamente desmarca "manage"
      if (type === 'view' && !checked) {
        return {
          ...prev,
          [menuId]: { ...current, view: false, manage: false }
        };
      }
      
      return {
        ...prev,
        [menuId]: { ...current, [type]: checked }
      };
    });
  };

  const handleSelectAll = (category: typeof menuCategories[0], type: 'view' | 'manage', checked: boolean) => {
    const categoryMenus = menus.filter(m => category.routes.includes(m.route));
    
    setPermissions(prev => {
      const newPerms = { ...prev };
      categoryMenus.forEach(menu => {
        const current = newPerms[menu.id] || { menuId: menu.id, view: false, manage: false };
        
        if (type === 'manage' && checked) {
          newPerms[menu.id] = { ...current, view: true, manage: true };
        } else if (type === 'view' && !checked) {
          newPerms[menu.id] = { ...current, view: false, manage: false };
        } else {
          newPerms[menu.id] = { ...current, [type]: checked };
        }
      });
      return newPerms;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('store_access_profiles')
        .update({ permissions: JSON.parse(JSON.stringify(permissions)) })
        .eq('id', profileId);

      if (error) throw error;

      toast({
        title: "Permissões atualizadas",
        description: "As permissões foram salvas com sucesso",
      });
      
      onSave();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar permissões",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getMenusByCategory = (category: typeof menuCategories[0]) => {
    return menus.filter(m => category.routes.includes(m.route));
  };

  const getCategoryStats = (category: typeof menuCategories[0]) => {
    const categoryMenus = getMenusByCategory(category);
    const viewCount = categoryMenus.filter(m => permissions[m.id]?.view).length;
    const manageCount = categoryMenus.filter(m => permissions[m.id]?.manage).length;
    return { total: categoryMenus.length, viewCount, manageCount };
  };

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Carregando menus...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span>Visualizar = pode ver o menu</span>
          </div>
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            <span>Gerenciar = pode criar/editar/excluir</span>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving} size="sm">
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Salvando..." : "Salvar Permissões"}
        </Button>
      </div>

      <div className="grid gap-4">
        {menuCategories.map((category) => {
          const categoryMenus = getMenusByCategory(category);
          const stats = getCategoryStats(category);
          
          if (categoryMenus.length === 0) return null;
          
          return (
            <Card key={category.key}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    {category.label}
                    <Badge variant="outline" className="text-xs font-normal">
                      {stats.viewCount}/{stats.total} visualizar • {stats.manageCount}/{stats.total} gerenciar
                    </Badge>
                  </CardTitle>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`${category.key}-all-view`}
                        checked={stats.viewCount === stats.total}
                        onCheckedChange={(checked) => 
                          handleSelectAll(category, 'view', checked as boolean)
                        }
                      />
                      <Label htmlFor={`${category.key}-all-view`} className="text-xs cursor-pointer">
                        Todos Visualizar
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`${category.key}-all-manage`}
                        checked={stats.manageCount === stats.total}
                        onCheckedChange={(checked) => 
                          handleSelectAll(category, 'manage', checked as boolean)
                        }
                      />
                      <Label htmlFor={`${category.key}-all-manage`} className="text-xs cursor-pointer">
                        Todos Gerenciar
                      </Label>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-2">
                  {categoryMenus.map((menu) => (
                    <div 
                      key={menu.id} 
                      className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <span className="text-sm font-medium">{menu.display_name}</span>
                        {menu.description && (
                          <p className="text-xs text-muted-foreground">{menu.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`${menu.id}-view`}
                            checked={permissions[menu.id]?.view || false}
                            onCheckedChange={(checked) => 
                              handlePermissionChange(menu.id, 'view', checked as boolean)
                            }
                          />
                          <Label htmlFor={`${menu.id}-view`} className="text-xs cursor-pointer">
                            Visualizar
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`${menu.id}-manage`}
                            checked={permissions[menu.id]?.manage || false}
                            onCheckedChange={(checked) => 
                              handlePermissionChange(menu.id, 'manage', checked as boolean)
                            }
                          />
                          <Label htmlFor={`${menu.id}-manage`} className="text-xs cursor-pointer">
                            Gerenciar
                          </Label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
