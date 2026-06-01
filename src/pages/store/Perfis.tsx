import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Shield, Settings, Trash2, MoreVertical, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PermissionsManagerV2 } from "@/components/store/PermissionsManagerV2";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { invalidatePermissionsCache } from "@/hooks/usePermissions";
import { invalidateSidebarPermissionsCache } from "@/hooks/useSidebarPermissions";

interface AccessProfile {
  id: string;
  name: string;
  description: string;
  permissions: any;
  users_count?: number;
}

export default function StorePerfis() {
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<AccessProfile | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [permissionsEnabled, setPermissionsEnabled] = useState(false);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [isTogglingPermissions, setIsTogglingPermissions] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: managerData } = await supabase
      .from('store_managers')
      .select('network_id')
      .eq('user_id', user.id)
      .is('store_id', null)
      .maybeSingle();

    if (!managerData?.network_id) return;
    
    setNetworkId(managerData.network_id);

    // Buscar estado das permissões na rede
    const { data: networkData } = await supabase
      .from('networks')
      .select('permissions_enabled')
      .eq('id', managerData.network_id)
      .single();
    
    setPermissionsEnabled(networkData?.permissions_enabled || false);

    // Buscar perfis com contagem de usuários
    const { data: profilesData } = await supabase
      .from('store_access_profiles')
      .select('*')
      .eq('network_id', managerData.network_id);

    // Buscar contagem de usuários por perfil
    const profilesWithCount = await Promise.all(
      (profilesData || []).map(async (profile) => {
        const { count } = await supabase
          .from('store_managers')
          .select('*', { count: 'exact', head: true })
          .eq('access_profile_id', profile.id);
        
        return { ...profile, users_count: count || 0 };
      })
    );

    setProfiles(profilesWithCount);
    setIsLoading(false);
  };

  const handleTogglePermissions = async (enabled: boolean) => {
    if (!networkId) return;
    
    setIsTogglingPermissions(true);
    try {
      const { error } = await supabase
        .from('networks')
        .update({ permissions_enabled: enabled })
        .eq('id', networkId);

      if (error) throw error;

      setPermissionsEnabled(enabled);
      invalidatePermissionsCache();
      invalidateSidebarPermissionsCache();
      
      toast({
        title: enabled ? "Permissões ativadas" : "Permissões desativadas",
        description: enabled 
          ? "Agora os menus serão filtrados conforme o perfil de cada usuário"
          : "Todos os usuários têm acesso total ao sistema",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao alterar configuração",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTogglingPermissions(false);
    }
  };

  const handleSubmit = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: managerData } = await supabase
      .from('store_managers')
      .select('network_id')
      .eq('user_id', user.id)
      .is('store_id', null)
      .maybeSingle();

    if (!managerData?.network_id) return;

    const { error } = await supabase
      .from('store_access_profiles')
      .insert({
        network_id: managerData.network_id,
        name: formData.name,
        description: formData.description,
        permissions: {},
      });

    if (error) {
      toast({
        title: "Erro ao criar perfil",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Perfil criado com sucesso",
      });
      setDialogOpen(false);
      setFormData({ name: "", description: "" });
      loadProfiles();
    }
  };

  const handleEditPermissions = (profile: AccessProfile) => {
    setSelectedProfile(profile);
    setPermissionsDialogOpen(true);
  };

  const handleDeleteProfile = async (profileId: string) => {
    try {
      const { error } = await supabase
        .from('store_access_profiles')
        .delete()
        .eq('id', profileId);

      if (error) throw error;

      toast({
        title: "Perfil excluído com sucesso",
      });
      
      loadProfiles();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir perfil",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getPermissionsCount = (permissions: any) => {
    if (!permissions || typeof permissions !== 'object') return 0;
    
    return Object.values(permissions).filter((perm: any) => 
      perm?.view || perm?.manage || perm?.read || perm?.write || perm?.edit || perm?.delete
    ).length;
  };

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Perfis de Acesso</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie os perfis de acesso e permissões dos colaboradores
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Novo Perfil
        </Button>
      </div>

      {/* Card de ativação de permissões */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                Controle de Permissões
                <Badge variant={permissionsEnabled ? "default" : "secondary"}>
                  {permissionsEnabled ? "Ativo" : "Inativo"}
                </Badge>
              </CardTitle>
              <CardDescription>
                Quando ativado, os menus serão filtrados de acordo com as permissões do perfil de cada usuário
              </CardDescription>
            </div>
            <Switch
              checked={permissionsEnabled}
              onCheckedChange={handleTogglePermissions}
              disabled={isTogglingPermissions}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {!permissionsEnabled ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Permissões desativadas</AlertTitle>
              <AlertDescription>
                Todos os usuários da rede têm acesso total ao sistema. Configure os perfis abaixo e ative as permissões quando estiver pronto.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-primary/20 bg-primary/5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary">Permissões ativas</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                Os menus do sistema estão sendo filtrados de acordo com as permissões configuradas em cada perfil.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Perfis Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Nome</TableHead>
                <TableHead className="text-xs">Descrição</TableHead>
                <TableHead className="text-xs">Usuários</TableHead>
                <TableHead className="text-xs">Permissões</TableHead>
                <TableHead className="text-right text-xs">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground text-xs py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Shield className="h-12 w-12 text-muted-foreground/20" />
                      <p>Nenhum perfil cadastrado</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                profiles.map((profile) => {
                  const permCount = getPermissionsCount(profile.permissions);
                  return (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium text-sm">{profile.name}</TableCell>
                      <TableCell className="text-sm max-w-md">
                        <p className="line-clamp-2">{profile.description || "-"}</p>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline" className="text-xs">
                          {profile.users_count || 0} {(profile.users_count || 0) === 1 ? 'usuário' : 'usuários'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant={permCount > 0 ? "default" : "secondary"} className="text-xs">
                          {permCount} {permCount === 1 ? 'permissão' : 'permissões'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditPermissions(profile)}>
                              <Settings className="h-4 w-4 mr-2" />
                              Configurar Permissões
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteProfile(profile.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Perfil de Acesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Gerente de Loja"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva as responsabilidades"
              />
            </div>
            <Button onClick={handleSubmit} className="w-full">
              Criar Perfil
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Configurar Permissões - {selectedProfile?.name}
            </DialogTitle>
            <DialogDescription>
              Defina quais menus este perfil pode visualizar e gerenciar
            </DialogDescription>
          </DialogHeader>
          {selectedProfile && (
            <PermissionsManagerV2
              profileId={selectedProfile.id}
              currentPermissions={selectedProfile.permissions || {}}
              onSave={() => {
                setPermissionsDialogOpen(false);
                loadProfiles();
                invalidatePermissionsCache();
                invalidateSidebarPermissionsCache();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
