import { useState, useEffect } from "react";
import { Plus, Pencil, Shield, ArrowLeft, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LIMITS, trimmedString, trimmedOptional, cleanText } from "@/lib/input-sanitization";

const formSchema = z.object({
  name: trimmedString(LIMITS.NAME, { min: 3, minMessage: "Nome deve ter no mínimo 3 caracteres" }),
  description: trimmedOptional(LIMITS.MEDIUM_TEXT),
});

type FormData = z.infer<typeof formSchema>;

interface AccessProfile {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

interface SystemMenu {
  id: string;
  name: string;
  display_name: string;
  description: string;
  icon: string;
}

interface ProfilePermission {
  id: string;
  profile_id: string;
  menu_id: string;
  permissions: string[];
}

const permissionLabels = {
  read: "Visualizar",
  create: "Criar",
  update: "Editar",
  delete: "Excluir",
  export: "Exportar",
};

export default function Perfis() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [menus, setMenus] = useState<SystemMenu[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AccessProfile | null>(null);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Carregar perfis
      const { data: profilesData, error: profilesError } = await supabase
        .from("access_profiles")
        .select("*")
        .order("name");

      if (profilesError) throw profilesError;
      setProfiles(profilesData || []);

      // Carregar menus
      const { data: menusData, error: menusError } = await supabase
        .from("system_menus")
        .select("*")
        .order("sort_order");

      if (menusError) throw menusError;
      setMenus(menusData || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPermissions = async (profileId: string) => {
    try {
      const { data, error } = await supabase
        .from("profile_permissions")
        .select("*")
        .eq("profile_id", profileId);

      if (error) throw error;

      const permissionsMap: Record<string, string[]> = {};
      data?.forEach((perm) => {
        permissionsMap[perm.menu_id] = perm.permissions || [];
      });

      setPermissions(permissionsMap);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar permissões",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      const cleanName = cleanText(data.name, LIMITS.NAME);
      const cleanDescription = cleanText(data.description, LIMITS.MEDIUM_TEXT);

      if (!editingProfile) {
        // Criar novo perfil
        const { data: newProfile, error } = await supabase
          .from("access_profiles")
          .insert({
            name: cleanName,
            description: cleanDescription,
          })
          .select()
          .single();

        if (error) throw error;

        // Salvar permissões
        await savePermissions(newProfile.id);

        toast({
          title: "Perfil criado!",
          description: "O perfil de acesso foi criado com sucesso.",
        });
      } else {
        // Atualizar perfil existente
        const { error } = await supabase
          .from("access_profiles")
          .update({
            name: cleanName,
            description: cleanDescription,
          })
          .eq("id", editingProfile.id);

        if (error) throw error;

        // Salvar permissões
        await savePermissions(editingProfile.id);

        toast({
          title: "Perfil atualizado!",
          description: "O perfil de acesso foi atualizado com sucesso.",
        });
      }

      setIsDialogOpen(false);
      form.reset();
      setEditingProfile(null);
      setPermissions({});
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar perfil",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const savePermissions = async (profileId: string) => {
    try {
      // Deletar permissões existentes
      await supabase
        .from("profile_permissions")
        .delete()
        .eq("profile_id", profileId);

      // Inserir novas permissões
      const permissionsToInsert = Object.entries(permissions)
        .filter(([_, perms]) => perms.length > 0)
        .map(([menuId, perms]) => ({
          profile_id: profileId,
          menu_id: menuId,
          permissions: perms as ("read" | "create" | "update" | "delete" | "export")[],
        }));

      if (permissionsToInsert.length > 0) {
        const { error } = await supabase
          .from("profile_permissions")
          .insert(permissionsToInsert);

        if (error) throw error;
      }
    } catch (error: any) {
      throw new Error("Erro ao salvar permissões: " + error.message);
    }
  };

  const handleEdit = async (profile: AccessProfile) => {
    setEditingProfile(profile);
    form.reset({
      name: profile.name,
      description: profile.description || "",
    });
    await loadPermissions(profile.id);
    setIsDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setIsDialogOpen(false);
      setEditingProfile(null);
      setPermissions({});
      form.reset();
    } else {
      setIsDialogOpen(true);
    }
  };

  const togglePermission = (menuId: string, permission: string) => {
    setPermissions((prev) => {
      const menuPerms = prev[menuId] || [];
      const hasPermission = menuPerms.includes(permission);

      return {
        ...prev,
        [menuId]: hasPermission
          ? menuPerms.filter((p) => p !== permission)
          : [...menuPerms, permission],
      };
    });
  };

  const hasPermission = (menuId: string, permission: string) => {
    return permissions[menuId]?.includes(permission) || false;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Perfis de Acesso</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerenciamento de perfis e permissões do sistema</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Perfil
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {editingProfile ? "Editar Perfil" : "Novo Perfil"}
              </DialogTitle>
              <DialogDescription>
                {editingProfile
                  ? "Atualize as informações e permissões do perfil"
                  : "Configure um novo perfil de acesso com suas permissões"}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Perfil *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: Gerente de Rede" maxLength={LIMITS.NAME} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Descreva o perfil e suas responsabilidades"
                            rows={3}
                            maxLength={LIMITS.MEDIUM_TEXT}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Permissões por Menu</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Selecione as permissões para cada menu do sistema
                    </p>
                  </div>

                  <div className="space-y-3">
                    {menus.map((menu) => (
                      <Card key={menu.id}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            {menu.display_name}
                          </CardTitle>
                          {menu.description && (
                            <CardDescription className="text-sm">
                              {menu.description}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-4">
                            {Object.entries(permissionLabels).map(([key, label]) => (
                              <div key={key} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`${menu.id}-${key}`}
                                  checked={hasPermission(menu.id, key)}
                                  onCheckedChange={() => togglePermission(menu.id, key)}
                                />
                                <label
                                  htmlFor={`${menu.id}-${key}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                  {label}
                                </label>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingProfile ? "Atualizar" : "Criar Perfil"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Perfil</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : profiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum perfil encontrado
                </TableCell>
              </TableRow>
            ) : (
              profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">{profile.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {profile.description || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={profile.is_active ? "default" : "secondary"}>
                      {profile.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(profile.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(profile)}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
