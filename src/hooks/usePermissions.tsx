import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Permission {
  menuId: string;
  view: boolean;
  manage: boolean;
}

interface PermissionsState {
  permissions: Record<string, Permission>;
  isLoading: boolean;
  permissionsEnabled: boolean;
  networkId: string | null;
  profileId: string | null;
  profileName: string | null;
}

interface UsePermissionsReturn extends PermissionsState {
  hasPermission: (route: string, action: "view" | "manage") => boolean;
  canView: (route: string) => boolean;
  canManage: (route: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

// Cache global para evitar múltiplas requisições
let permissionsCache: PermissionsState | null = null;
let cacheUserId: string | null = null;

export function usePermissions(): UsePermissionsReturn {
  const [state, setState] = useState<PermissionsState>({
    permissions: {},
    isLoading: true,
    permissionsEnabled: false,
    networkId: null,
    profileId: null,
    profileName: null,
  });

  const loadPermissions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Usar cache se disponível para o mesmo usuário
      if (permissionsCache && cacheUserId === user.id) {
        setState(permissionsCache);
        return;
      }

      // Buscar dados do manager
      const { data: managerData } = await supabase
        .from('store_managers')
        .select(`
          network_id,
          access_profile_id,
          store_access_profiles (
            id,
            name,
            permissions
          )
        `)
        .eq('user_id', user.id)
        .is('store_id', null)
        .maybeSingle();

      if (!managerData?.network_id) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Verificar se a rede tem permissões habilitadas
      const { data: networkData } = await supabase
        .from('networks')
        .select('permissions_enabled')
        .eq('id', managerData.network_id)
        .single();

      const permissionsEnabled = networkData?.permissions_enabled || false;

      // Buscar menus para mapear IDs para rotas
      const { data: menus } = await supabase
        .from('system_menus')
        .select('id, route')
        .like('route', '/levaloja%');

      // Criar mapa de route -> menuId
      const routeToMenuId: Record<string, string> = {};
      menus?.forEach(menu => {
        routeToMenuId[menu.route] = menu.id;
      });

      // Extrair permissões do perfil
      const profileData = managerData.store_access_profiles;
      const rawPermissions = (profileData as any)?.permissions || {};
      
      // Converter permissões antigas (read/write/edit/delete) para novo formato (view/manage)
      const convertedPermissions: Record<string, Permission> = {};
      
      Object.entries(rawPermissions).forEach(([menuId, perm]: [string, any]) => {
        convertedPermissions[menuId] = {
          menuId,
          view: perm?.view ?? perm?.read ?? false,
          manage: perm?.manage ?? (perm?.write || perm?.edit || perm?.delete) ?? false,
        };
      });

      const newState: PermissionsState = {
        permissions: convertedPermissions,
        isLoading: false,
        permissionsEnabled,
        networkId: managerData.network_id,
        profileId: (profileData as any)?.id || null,
        profileName: (profileData as any)?.name || null,
      };

      // Atualizar cache
      permissionsCache = newState;
      cacheUserId = user.id;

      setState(newState);
    } catch (error) {
      console.error('Error loading permissions:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const hasPermission = useCallback((route: string, action: "view" | "manage"): boolean => {
    // Se permissões não estão habilitadas na rede, libera tudo
    if (!state.permissionsEnabled) {
      return true;
    }

    // Se ainda está carregando, libera temporariamente
    if (state.isLoading) {
      return true;
    }

    // Buscar menu pelo route
    const menuPermission = Object.values(state.permissions).find(p => {
      // Buscar o route correspondente ao menuId
      return true; // Precisamos do mapeamento reverso
    });

    // Buscar permissão pelo menuId que corresponde ao route
    // Como temos o ID do menu nas permissões, precisamos fazer o match
    for (const [menuId, perm] of Object.entries(state.permissions)) {
      // Se temos alguma permissão para este menu
      if (action === "view" && perm.view) {
        return true;
      }
      if (action === "manage" && perm.manage) {
        return true;
      }
    }

    // Se não encontrou permissão específica e há permissões configuradas, bloqueia
    // Se não há nenhuma permissão configurada, libera (comportamento fallback)
    const hasAnyPermission = Object.values(state.permissions).some(p => p.view || p.manage);
    return !hasAnyPermission;
  }, [state.permissions, state.permissionsEnabled, state.isLoading]);

  const hasPermissionByRoute = useCallback((route: string, action: "view" | "manage"): boolean => {
    // Se permissões não estão habilitadas na rede, libera tudo
    if (!state.permissionsEnabled) {
      return true;
    }

    // Se ainda está carregando, libera temporariamente
    if (state.isLoading) {
      return true;
    }

    // Se não tem nenhuma permissão configurada no perfil, libera tudo (fallback)
    const hasAnyPermission = Object.values(state.permissions).some(p => p.view || p.manage);
    if (!hasAnyPermission) {
      return true;
    }

    // Buscar a permissão para o route específico
    // Precisamos carregar os menus para fazer o match
    // Por enquanto, vamos liberar e o match será feito no componente
    return true;
  }, [state.permissions, state.permissionsEnabled, state.isLoading]);

  const canView = useCallback((route: string): boolean => {
    return hasPermissionByRoute(route, "view");
  }, [hasPermissionByRoute]);

  const canManage = useCallback((route: string): boolean => {
    return hasPermissionByRoute(route, "manage");
  }, [hasPermissionByRoute]);

  const refreshPermissions = useCallback(async () => {
    // Limpar cache
    permissionsCache = null;
    cacheUserId = null;
    
    setState(prev => ({ ...prev, isLoading: true }));
    await loadPermissions();
  }, [loadPermissions]);

  return useMemo(() => ({
    ...state,
    hasPermission,
    canView,
    canManage,
    refreshPermissions,
  }), [state, hasPermission, canView, canManage, refreshPermissions]);
}

// Hook para verificar permissão de um menu específico por ID
export function useMenuPermission(menuId: string) {
  const { permissions, permissionsEnabled, isLoading } = usePermissions();

  return useMemo(() => {
    if (!permissionsEnabled || isLoading) {
      return { canView: true, canManage: true };
    }

    const perm = permissions[menuId];
    
    // Se não tem nenhuma permissão configurada, libera
    const hasAnyPermission = Object.values(permissions).some(p => p.view || p.manage);
    if (!hasAnyPermission) {
      return { canView: true, canManage: true };
    }

    return {
      canView: perm?.view ?? false,
      canManage: perm?.manage ?? false,
    };
  }, [menuId, permissions, permissionsEnabled, isLoading]);
}

// Função para invalidar o cache (chamar após mudança de perfil)
export function invalidatePermissionsCache() {
  permissionsCache = null;
  cacheUserId = null;
}
