import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MenuPermission {
  route: string;
  canView: boolean;
  canManage: boolean;
}

interface UseSidebarPermissionsReturn {
  isLoading: boolean;
  permissionsEnabled: boolean;
  canViewRoute: (route: string) => boolean;
  canManageRoute: (route: string) => boolean;
  allowedRoutes: Set<string>;
}

// Cache global
let sidebarCache: {
  permissionsEnabled: boolean;
  menuPermissions: Map<string, MenuPermission>;
  userId: string;
} | null = null;

export function useSidebarPermissions(): UseSidebarPermissionsReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [permissionsEnabled, setPermissionsEnabled] = useState(false);
  const [menuPermissions, setMenuPermissions] = useState<Map<string, MenuPermission>>(new Map());

  const loadPermissions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Usar cache se disponível
      if (sidebarCache && sidebarCache.userId === user.id) {
        setPermissionsEnabled(sidebarCache.permissionsEnabled);
        setMenuPermissions(sidebarCache.menuPermissions);
        setIsLoading(false);
        return;
      }

      // Buscar dados do manager com perfil
      const { data: managerData } = await supabase
        .from('store_managers')
        .select(`
          network_id,
          access_profile_id,
          store_access_profiles (
            id,
            permissions
          )
        `)
        .eq('user_id', user.id)
        .is('store_id', null)
        .maybeSingle();

      if (!managerData?.network_id) {
        setIsLoading(false);
        return;
      }

      // Verificar se a rede tem permissões habilitadas
      const { data: networkData } = await supabase
        .from('networks')
        .select('permissions_enabled')
        .eq('id', managerData.network_id)
        .single();

      const enabled = networkData?.permissions_enabled || false;
      setPermissionsEnabled(enabled);

      // Se não está habilitado, não precisa carregar permissões detalhadas
      if (!enabled) {
        setIsLoading(false);
        sidebarCache = {
          permissionsEnabled: false,
          menuPermissions: new Map(),
          userId: user.id,
        };
        return;
      }

      // Buscar todos os menus do LevaLoja
      const { data: menus } = await supabase
        .from('system_menus')
        .select('id, route')
        .like('route', '/levaloja%');

      // Extrair permissões do perfil
      const profileData = managerData.store_access_profiles;
      const rawPermissions = (profileData as any)?.permissions || {};

      // Criar mapa de menuId -> route
      const menuIdToRoute = new Map<string, string>();
      menus?.forEach(menu => {
        menuIdToRoute.set(menu.id, menu.route);
      });

      // Verificar se tem alguma permissão configurada
      const hasAnyPermission = Object.values(rawPermissions).some((perm: any) => 
        perm?.view || perm?.manage || perm?.read || perm?.write || perm?.edit || perm?.delete
      );

      // Construir mapa de permissões por rota
      const permMap = new Map<string, MenuPermission>();
      
      menus?.forEach(menu => {
        const perm = rawPermissions[menu.id];
        
        // Se não tem nenhuma permissão configurada no perfil, libera tudo
        if (!hasAnyPermission) {
          permMap.set(menu.route, {
            route: menu.route,
            canView: true,
            canManage: true,
          });
        } else {
          // Converter formato antigo para novo
          const canView = perm?.view ?? perm?.read ?? false;
          const canManage = perm?.manage ?? (perm?.write || perm?.edit || perm?.delete) ?? false;
          
          permMap.set(menu.route, {
            route: menu.route,
            canView,
            canManage,
          });
        }
      });

      setMenuPermissions(permMap);
      
      // Atualizar cache
      sidebarCache = {
        permissionsEnabled: enabled,
        menuPermissions: permMap,
        userId: user.id,
      };

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading sidebar permissions:', error);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const canViewRoute = useCallback((route: string): boolean => {
    // Se permissões não estão habilitadas, libera tudo
    if (!permissionsEnabled) return true;
    
    // Se ainda está carregando, libera temporariamente
    if (isLoading) return true;
    
    // Buscar permissão específica
    const perm = menuPermissions.get(route);
    
    // Se não encontrou permissão para esta rota, pode ser rota não cadastrada - libera
    if (!perm) return true;
    
    return perm.canView;
  }, [permissionsEnabled, isLoading, menuPermissions]);

  const canManageRoute = useCallback((route: string): boolean => {
    if (!permissionsEnabled) return true;
    if (isLoading) return true;
    
    const perm = menuPermissions.get(route);
    if (!perm) return true;
    
    return perm.canManage;
  }, [permissionsEnabled, isLoading, menuPermissions]);

  const allowedRoutes = useMemo(() => {
    if (!permissionsEnabled) {
      // Retorna set vazio para indicar que tudo é permitido
      return new Set<string>();
    }
    
    const allowed = new Set<string>();
    menuPermissions.forEach((perm, route) => {
      if (perm.canView) {
        allowed.add(route);
      }
    });
    return allowed;
  }, [permissionsEnabled, menuPermissions]);

  return useMemo(() => ({
    isLoading,
    permissionsEnabled,
    canViewRoute,
    canManageRoute,
    allowedRoutes,
  }), [isLoading, permissionsEnabled, canViewRoute, canManageRoute, allowedRoutes]);
}

// Função para invalidar o cache
export function invalidateSidebarPermissionsCache() {
  sidebarCache = null;
}
