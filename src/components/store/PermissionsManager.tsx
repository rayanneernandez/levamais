import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

interface SystemMenu {
  id: string;
  name: string;
  display_name: string;
  description: string;
  icon: string;
}

interface Permission {
  menuId: string;
  read: boolean;
  write: boolean;
  edit: boolean;
  delete: boolean;
}

interface PermissionsManagerProps {
  profileId: string;
  currentPermissions: Record<string, Permission>;
  onSave: () => void;
}

export function PermissionsManager({ profileId, currentPermissions, onSave }: PermissionsManagerProps) {
  const [menus, setMenus] = useState<SystemMenu[]>([]);
  const [permissions, setPermissions] = useState<Record<string, Permission>>(currentPermissions);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadMenus();
  }, []);

  useEffect(() => {
    setPermissions(currentPermissions);
  }, [currentPermissions]);

  const loadMenus = async () => {
    const { data } = await supabase
      .from('system_menus')
      .select('*')
      .is('parent_id', null)
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
            read: false,
            write: false,
            edit: false,
            delete: false,
          };
        }
      });
      setPermissions(newPermissions);
    }
  };

  const handlePermissionChange = (menuId: string, type: keyof Omit<Permission, 'menuId'>, checked: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [menuId]: {
        ...prev[menuId],
        menuId,
        [type]: checked,
      }
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Converter para o formato JSON compatível com Supabase
      const permissionsJson = JSON.parse(JSON.stringify(permissions));
      
      const { error } = await supabase
        .from('store_access_profiles')
        .update({ permissions: permissionsJson })
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
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading} size="sm">
          <Save className="h-4 w-4 mr-2" />
          Salvar
        </Button>
      </div>

      <div className="grid gap-3">
        {menus.map((menu) => (
          <Card key={menu.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="text-base font-semibold">{menu.display_name}</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {menu.description}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`${menu.id}-read`}
                    checked={permissions[menu.id]?.read || false}
                    onCheckedChange={(checked) => 
                      handlePermissionChange(menu.id, 'read', checked as boolean)
                    }
                  />
                  <Label htmlFor={`${menu.id}-read`} className="text-sm cursor-pointer">
                    Leitura
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`${menu.id}-write`}
                    checked={permissions[menu.id]?.write || false}
                    onCheckedChange={(checked) => 
                      handlePermissionChange(menu.id, 'write', checked as boolean)
                    }
                  />
                  <Label htmlFor={`${menu.id}-write`} className="text-sm cursor-pointer">
                    Escrita
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`${menu.id}-edit`}
                    checked={permissions[menu.id]?.edit || false}
                    onCheckedChange={(checked) => 
                      handlePermissionChange(menu.id, 'edit', checked as boolean)
                    }
                  />
                  <Label htmlFor={`${menu.id}-edit`} className="text-sm cursor-pointer">
                    Edição
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`${menu.id}-delete`}
                    checked={permissions[menu.id]?.delete || false}
                    onCheckedChange={(checked) => 
                      handlePermissionChange(menu.id, 'delete', checked as boolean)
                    }
                  />
                  <Label htmlFor={`${menu.id}-delete`} className="text-sm cursor-pointer">
                    Exclusão
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
