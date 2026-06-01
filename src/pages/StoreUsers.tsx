import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Users, Eye, Edit, KeyRound, Power, MoreVertical, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LIMITS, trimmedString, trimmedEmail } from "@/lib/input-sanitization";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Store {
  id: string;
  name: string;
}

interface AccessProfile {
  id: string;
  name: string;
  description: string;
}

interface UserTag {
  id: string;
  name: string;
  color: string;
}

interface StoreUser {
  id: string;
  manager_id: string;
  user_id: string;
  user_reference_code: string | null;
  is_active: boolean;
  access_profile_id: string | null;
  is_attendant: boolean;
  attendant_code: string | null;
  codigo_funcionario_pdv: string | null;
  profiles: {
    full_name: string;
    email: string;
    phone?: string | null;
  };
  store_access_profiles: {
    name: string;
  } | null;
  assigned_stores: Store[];
  tags?: UserTag[];
}

const normalizePhone = (value: string) => value.replace(/\D/g, "");

const formatPhone = (value?: string | null) => {
  const digits = normalizePhone(value || "").slice(0, 11);

  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

type SortField = "user_reference_code" | "full_name" | "email" | "profile";
type SortDirection = "asc" | "desc";

const SORT_STORAGE_KEY = "store-users-sort";

const userSchema = z.object({
  name: trimmedString(LIMITS.NAME, { min: 3, minMessage: "Nome deve ter no mínimo 3 caracteres" }),
  email: trimmedEmail(LIMITS.EMAIL),
  phone: z.string()
    .trim()
    .max(LIMITS.PHONE, `Telefone deve ter no máximo ${LIMITS.PHONE} caracteres`)
    .refine((value) => {
      if (!value) return true;
      const digits = normalizePhone(value);
      return digits.length === 10 || digits.length === 11;
    }, "Telefone inválido"),
  access_profile_id: z.string().min(1, "Selecione um perfil de acesso"),
  is_attendant: z.boolean().optional(),
  codigo_funcionario_pdv: z.string().trim().max(LIMITS.SHORT_CODE, `Máximo de ${LIMITS.SHORT_CODE} caracteres`).optional(),
  store_ids: z.array(z.string()).min(1, "Selecione pelo menos uma loja"),
  tag_ids: z.array(z.string()).optional(),
}).refine((data) => {
  // Se for atendente/frentista, não pode ter mais de uma loja
  if (data.is_attendant && data.store_ids && data.store_ids.length > 1) {
    return false;
  }
  return true;
}, {
  message: "Atendentes/Frentistas só podem ser associados a uma única loja",
  path: ["store_ids"],
});

type UserFormData = z.infer<typeof userSchema>;

const PREPOSICOES_NOME = new Set(["de", "da", "do", "das", "dos", "e", "del", "di", "du", "van", "von", "la", "le"]);

function getShortName(fullName: string | null | undefined): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || "";
  const result: string[] = [parts[0]];
  for (let i = 1; i < parts.length; i++) {
    const word = parts[i];
    if (PREPOSICOES_NOME.has(word.toLowerCase())) {
      result.push(word);
    } else {
      result.push(word);
      break;
    }
  }
  return result.join(" ");
}

const StoreUsers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<StoreUser[]>([]);
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [tags, setTags] = useState<UserTag[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [viewingUser, setViewingUser] = useState<StoreUser | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [sortField, setSortField] = useState<SortField>(() => {
    if (typeof window === "undefined") return "user_reference_code";

    try {
      const stored = window.localStorage.getItem(SORT_STORAGE_KEY);
      if (!stored) return "user_reference_code";
      const parsed = JSON.parse(stored) as { field?: SortField };
      return parsed.field || "user_reference_code";
    } catch {
      return "user_reference_code";
    }
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    if (typeof window === "undefined") return "asc";

    try {
      const stored = window.localStorage.getItem(SORT_STORAGE_KEY);
      if (!stored) return "asc";
      const parsed = JSON.parse(stored) as { direction?: SortDirection };
      return parsed.direction || "asc";
    } catch {
      return "asc";
    }
  });
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      store_ids: [],
      is_attendant: false,
      tag_ids: [],
    }
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      SORT_STORAGE_KEY,
      JSON.stringify({ field: sortField, direction: sortDirection }),
    );
  }, [sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection("asc");
  };

  const filteredAndSortedUsers = useMemo(() => {
    const filtered = users.filter((u) => {
      if (statusFilter === 'active') return u.is_active;
      if (statusFilter === 'inactive') return !u.is_active;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const valueA =
        sortField === "full_name"
          ? a.profiles.full_name
          : sortField === "email"
            ? a.profiles.email
            : sortField === "profile"
              ? a.store_access_profiles?.name || ""
              : a.user_reference_code || "";

      const valueB =
        sortField === "full_name"
          ? b.profiles.full_name
          : sortField === "email"
            ? b.profiles.email
            : sortField === "profile"
              ? b.store_access_profiles?.name || ""
              : b.user_reference_code || "";

      const comparison = valueA.localeCompare(valueB, "pt-BR", { numeric: true, sensitivity: "base" });
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [users, sortDirection, sortField, statusFilter]);

  const counts = useMemo(() => ({
    active: users.filter((u) => u.is_active).length,
    inactive: users.filter((u) => !u.is_active).length,
    all: users.length,
  }), [users]);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/levaloja/auth");
        return;
      }

      // Buscar rede do usuário
      const { data: managerData } = await supabase
        .from('store_managers')
        .select('network_id')
        .eq('user_id', session.user.id)
        .is('store_id', null)
        .single();

      if (!managerData) {
        throw new Error('Empresa não encontrada');
      }

      setNetworkId(managerData.network_id);

      // Buscar lojas da rede
      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select('id, name')
        .eq('network_id', managerData.network_id);

      if (storesError) {
        throw storesError;
      }

      setStores(storesData || []);

      // Buscar perfis de acesso
      const { data: profilesData, error: profilesError } = await supabase
        .from('store_access_profiles')
        .select('*')
        .eq('network_id', managerData.network_id);

      if (profilesError) {
        throw profilesError;
      }

      setProfiles(profilesData || []);

      // Buscar tags da rede
      const { data: tagsData, error: tagsError } = await supabase
        .from('user_tags')
        .select('*')
        .eq('network_id', managerData.network_id)
        .order('name');

      if (tagsError) {
        throw tagsError;
      }

      setTags(tagsData || []);

      // Buscar todos os store_managers da rede (sem filtro de user_id)
      const { data: managersData, error: managersError } = await supabase
        .from('store_managers')
        .select('id, user_id, access_profile_id, is_attendant, attendant_code, codigo_funcionario_pdv, store_id, user_reference_code, is_active')
        .eq('network_id', managerData.network_id)
        .is('store_id', null); // Apenas network managers

      if (managersError) {
        console.error('Error loading managers:', managersError);
        throw managersError;
      }

      console.log('All managers:', managersData);

      if (managersData && managersData.length > 0) {
        // Agrupar lojas por usuário
        const userStoresMap = new Map<string, string[]>();
        
        // Buscar associações de lojas
         const { data: userStoresData, error: userStoresError } = await supabase
          .from('store_managers')
          .select('user_id, store_id, stores(id, name)')
          .eq('network_id', managerData.network_id)
          .not('store_id', 'is', null);

         if (userStoresError) {
           throw userStoresError;
         }

        userStoresData?.forEach(us => {
          if (!userStoresMap.has(us.user_id)) {
            userStoresMap.set(us.user_id, []);
          }
          if (us.store_id) {
            userStoresMap.get(us.user_id)!.push(us.store_id);
          }
        });

        // Buscar perfis dos usuários
        const userIds = [...new Set(managersData.map(m => m.user_id))];
         const { data: userProfilesData, error: userProfilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone')
          .in('id', userIds);

         if (userProfilesError) {
           throw userProfilesError;
         }

        console.log('User Profiles loaded:', userProfilesData);

        // Buscar tags dos usuários
        const managerIds = managersData.map(m => m.id);
         const { data: userTagsData, error: userTagsError } = await supabase
          .from('store_manager_tags')
           .select('store_manager_id, tag_id')
          .in('store_manager_id', managerIds);

         if (userTagsError) {
           throw userTagsError;
         }

         const tagsById = new Map((tagsData || []).map((tag) => [tag.id, tag]));

        const userTagsMap = new Map<string, UserTag[]>();
        userTagsData?.forEach(ut => {
          if (!userTagsMap.has(ut.store_manager_id)) {
            userTagsMap.set(ut.store_manager_id, []);
          }
           const tag = tagsById.get(ut.tag_id);
           if (tag) {
             userTagsMap.get(ut.store_manager_id)!.push(tag);
          }
        });

        // Combinar dados e remover o usuário logado
        const combinedUsers = managersData
          .filter(manager => manager.user_id !== session.user.id)
          .map(manager => {
            const userProfile = userProfilesData?.find(p => p.id === manager.user_id);
            const accessProfile = profilesData?.find(p => p.id === manager.access_profile_id);
            const assignedStoreIds = userStoresMap.get(manager.user_id) || [];
            const assignedStores = storesData?.filter(s => assignedStoreIds.includes(s.id)) || [];
            const userTags = userTagsMap.get(manager.id) || [];

            return {
              id: manager.user_id,
              manager_id: manager.id,
              user_id: manager.user_id,
              user_reference_code: manager.user_reference_code,
              is_active: manager.is_active ?? true,
              access_profile_id: manager.access_profile_id,
              is_attendant: manager.is_attendant,
              attendant_code: manager.attendant_code,
              codigo_funcionario_pdv: manager.codigo_funcionario_pdv,
              profiles: {
                full_name: userProfile?.full_name || 'Sem nome',
                email: userProfile?.email || 'Sem email',
                phone: formatPhone(userProfile?.phone)
              },
              store_access_profiles: accessProfile ? { name: accessProfile.name } : null,
              assigned_stores: assignedStores,
              tags: userTags
            };
          });

        console.log('Combined users:', combinedUsers);
        setUsers(combinedUsers);
      } else {
        setUsers([]);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmitUser = async (data: UserFormData) => {
    try {
      if (!networkId) return;

      const sanitizedPhone = normalizePhone(data.phone);
      const normalizedPhone = sanitizedPhone || null;

      if (isEditMode && editingUserId) {
        // Atualizar usuário existente
        console.log('Updating user with data:', data);

        const { error } = await supabase.functions.invoke('update-store-user', {
          body: {
            user_id: editingUserId,
            name: data.name,
            email: data.email,
            phone: normalizedPhone,
            access_profile_id: data.access_profile_id,
            is_attendant: data.is_attendant || false,
            codigo_funcionario_pdv: data.codigo_funcionario_pdv || null,
            store_ids: data.store_ids,
            tag_ids: data.tag_ids || []
          }
        });

        if (error) {
          console.error('Error from edge function:', error);
          throw error;
        }

        toast({
          title: "Usuário atualizado!",
          description: "As informações foram atualizadas com sucesso",
        });
      } else {
        // Criar novo usuário
        console.log('Creating user with data:', data);

        const { data: result, error } = await supabase.functions.invoke('create-store-user', {
          body: {
            name: data.name,
            email: data.email,
            phone: normalizedPhone,
            access_profile_id: data.access_profile_id,
            network_id: networkId,
            is_attendant: data.is_attendant || false,
            codigo_funcionario_pdv: data.codigo_funcionario_pdv || null,
            store_ids: data.store_ids,
            tag_ids: data.tag_ids || []
          }
        });

        // Tratar erro do invoke (erros de rede/sistema)
        if (error) {
          console.error('Error from edge function:', error);

          // Tentar extrair a mensagem real do corpo da resposta (FunctionsHttpError)
          let backendMessage: string | null = null;
          try {
            const ctx: any = (error as any).context;
            if (ctx) {
              if (typeof ctx.json === 'function') {
                const parsed = await ctx.json();
                if (parsed?.error) backendMessage = parsed.error;
              } else if (ctx.body) {
                const bodyText = typeof ctx.body === 'string'
                  ? ctx.body
                  : await new Response(ctx.body).text();
                if (bodyText) {
                  const parsed = JSON.parse(bodyText);
                  if (parsed?.error) backendMessage = parsed.error;
                }
              }
            }
          } catch (parseError) {
            console.warn('Não foi possível extrair mensagem do edge function:', parseError);
          }

          if (backendMessage) {
            // Mensagens mais amigáveis para casos comuns
            if (backendMessage.includes('Este email já está cadastrado')) {
              throw new Error('Este e-mail já está cadastrado no sistema. Utilize outro e-mail ou peça para um administrador vincular o usuário existente.');
            }
            if (backendMessage.toLowerCase().includes('attendant_code') || backendMessage.toLowerCase().includes('duplicate key')) {
              throw new Error('Já existe um atendente com esse código nesta rede. Tente novamente em alguns segundos ou desmarque/altere o código.');
            }
            throw new Error(backendMessage);
          }

          if (error.message?.includes('Este email já está cadastrado')) {
            throw new Error('Este e-mail já está cadastrado no sistema. Utilize outro e-mail.');
          }
          throw new Error(error.message || 'Erro ao criar usuário');
        }

        // Tratar erro retornado no corpo da resposta (validação)
        if (result?.error) {
          console.error('Error in result:', result.error);
          throw new Error(result.error);
        }

        console.log('User created successfully:', result);

        // Mostrar senha temporária em dialog
        setTempPassword(result.temp_password);
        setShowPasswordDialog(true);

        toast({
          title: "Usuário criado com sucesso!",
          description: "O usuário foi criado e a senha temporária foi gerada.",
        });
      }

      setIsDialogOpen(false);
      await loadData();
    } catch (error: any) {
      console.error('Error submitting user:', error);
      toast({
        title: isEditMode ? "Erro ao atualizar usuário" : "Erro ao criar usuário",
        description: error.message || "Ocorreu um erro",
        variant: "destructive",
      });
    }
  };

  const handleToggleUserStatus = async (userId: string, currentlyActive: boolean, userName: string) => {
    const action = currentlyActive ? 'desativar' : 'ativar';
    const message = currentlyActive
      ? `Tem certeza que deseja desativar ${userName}?\n\nO usuário não conseguirá mais acessar o portal, mas todo o histórico (vendas, pontuações, auditoria) será preservado. Você pode reativá-lo a qualquer momento.`
      : `Tem certeza que deseja reativar ${userName}?\n\nO usuário voltará a ter acesso ao portal com as mesmas configurações.`;

    if (!confirm(message)) {
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('toggle-store-user-status', {
        body: { user_id: userId, is_active: !currentlyActive }
      });

      if (error) throw error;

      toast({
        title: currentlyActive ? "Usuário desativado" : "Usuário ativado",
        description: currentlyActive
          ? "O usuário não terá mais acesso, mas o histórico foi preservado."
          : "O usuário voltou a ter acesso ao portal.",
      });

      loadData();
    } catch (error: any) {
      toast({
        title: `Erro ao ${action} usuário`,
        description: error.message || `Ocorreu um erro ao ${action} o usuário`,
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async (userId: string, userEmail: string) => {
    if (!confirm(`Deseja redefinir a senha de ${userEmail}?`)) {
      return;
    }

    try {
      const { data: result, error } = await supabase.functions.invoke('reset-user-password', {
        body: { user_id: userId }
      });

      if (error) throw error;

      if (result?.error) {
        throw new Error(result.error);
      }

      // Mostrar senha temporária em dialog
      setTempPassword(result.temp_password);
      setShowPasswordDialog(true);

      toast({
        title: "Senha redefinida",
        description: "Uma nova senha temporária foi gerada com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao redefinir senha",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditUser = (user: StoreUser) => {
    setIsEditMode(true);
    setEditingUserId(user.user_id);
    setShowViewDialog(false);
    form.reset({
      name: user.profiles.full_name,
      email: user.profiles.email,
      phone: formatPhone(user.profiles.phone) || '',
      access_profile_id: user.access_profile_id || '',
      is_attendant: user.is_attendant,
      codigo_funcionario_pdv: user.codigo_funcionario_pdv || '',
      store_ids: user.assigned_stores.map(s => s.id),
      tag_ids: user.tags?.map(t => t.id) || [],
    });
    setIsDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      // Só reseta quando fechar
      setIsEditMode(false);
      setEditingUserId(null);
      form.reset({
        store_ids: [],
        is_attendant: false,
        tag_ids: [],
      });
    }
  };

  const handleViewUser = (user: StoreUser) => {
    setViewingUser(user);
    setShowViewDialog(true);
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5" />;
    }

    return sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  };

  const openUserDetails = (user: StoreUser) => {
    handleViewUser(user);
  };

  return (
    <div className="space-y-6">
      {/* Dialog de Visualização do Usuário */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Usuário</DialogTitle>
            <DialogDescription>
              Visualize os dados cadastrados deste usuário
            </DialogDescription>
          </DialogHeader>
          {viewingUser && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Código de Referência</Label>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-sm font-mono font-semibold">{viewingUser.user_reference_code || '—'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Telefone</Label>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-sm font-medium">{viewingUser.profiles.phone || 'Não informado'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Nome</Label>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">{viewingUser.profiles.full_name}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">E-mail</Label>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium break-all">{viewingUser.profiles.email}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Perfil de Acesso</Label>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">{viewingUser.store_access_profiles?.name || 'Sem perfil'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">{viewingUser.is_active ? 'Ativo' : 'Inativo'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Tags</Label>
                <div className="rounded-lg bg-muted p-3">
                  {viewingUser.tags && viewingUser.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {viewingUser.tags.map((tag) => (
                        <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#fff' }} className="text-xs">
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem tags</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Lojas com Acesso</Label>
                <div className="rounded-lg bg-muted p-3">
                  {viewingUser.assigned_stores.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {viewingUser.assigned_stores.map((store) => (
                        <Badge key={store.id} variant="outline" className="text-xs">
                          {store.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem lojas vinculadas</p>
                  )}
                </div>
              </div>
              {viewingUser.is_attendant && (
                <>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Código de Acesso</Label>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-lg font-mono font-bold text-primary text-center">
                    {viewingUser.attendant_code || 'Não gerado'}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Este é o código que o atendente deve usar para fazer login no Portal do Colaborador
                </p>
              </div>

              {viewingUser.codigo_funcionario_pdv && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Código no PDV</Label>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-mono font-medium">{viewingUser.codigo_funcionario_pdv}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium">Senha Padrão</Label>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-mono font-bold text-center">
                    Leva+2025
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Senha padrão que deve ser alterada no primeiro acesso
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Portal de Acesso</Label>
                <div className="p-3 bg-muted rounded-lg">
                  <a 
                    href="https://portal.levamais.app/levacolaborador/auth" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline break-all"
                  >
                    https://portal.levamais.app/levacolaborador/auth
                  </a>
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={() => {
                  const text = `Código: ${viewingUser.attendant_code}\nSenha: Leva+2025\nPortal: https://portal.levamais.app/levacolaborador/auth`;
                  navigator.clipboard.writeText(text);
                  toast({
                    title: "Copiado!",
                    description: "Informações copiadas para a área de transferência.",
                  });
                }}
              >
                Copiar Informações
              </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuário Criado com Sucesso!</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>O usuário foi criado com sucesso. Anote a senha temporária abaixo:</p>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-mono font-bold text-foreground text-center text-lg">
                  {tempPassword}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                ⚠️ Esta senha só será exibida uma vez. O usuário deverá alterá-la no primeiro acesso.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              // Copiar senha para clipboard
              if (tempPassword) {
                navigator.clipboard.writeText(tempPassword);
                toast({
                  title: "Senha copiada!",
                  description: "A senha foi copiada para a área de transferência.",
                });
              }
              setShowPasswordDialog(false);
              setTempPassword(null);
            }}>
              Copiar e Fechar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuários e Acessos
          </h1>
          <p className="text-muted-foreground text-sm">
            Gerencie usuários e perfis de acesso
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">
                {isEditMode ? 'Editar Usuário' : 'Criar Novo Usuário'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isEditMode 
                  ? 'Atualize as informações do usuário'
                  : 'O usuário receberá uma senha temporária que deverá ser alterada no primeiro acesso'
                }
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleSubmitUser)} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs">Nome Completo</Label>
                <Input id="name" maxLength={LIMITS.NAME} className="text-sm h-8" {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">E-mail</Label>
                <Input id="email" type="email" maxLength={LIMITS.EMAIL} className="text-sm h-8" {...form.register("email")} />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs">Telefone</Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  className="text-sm h-8"
                  placeholder="(00) 00000-0000"
                  value={form.watch("phone") || ""}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                    let formatted = digits;
                    if (digits.length > 0) formatted = `(${digits.slice(0, 2)}`;
                    if (digits.length >= 3) formatted += `) ${digits.slice(2, 7)}`;
                    if (digits.length >= 8) formatted += `-${digits.slice(7, 11)}`;
                    form.setValue("phone", formatted, { shouldValidate: true });
                  }}
                />
                {form.formState.errors.phone && (
                  <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="access_profile_id" className="text-xs">Perfil de Acesso</Label>
                <Select 
                  value={form.watch("access_profile_id")} 
                  onValueChange={(value) => form.setValue("access_profile_id", value)}
                >
                  <SelectTrigger className="text-sm h-8">
                    <SelectValue placeholder="Selecione um perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id} className="text-sm">
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.access_profile_id && (
                  <p className="text-xs text-destructive">{form.formState.errors.access_profile_id.message}</p>
                )}
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Lojas com Acesso
                  {form.watch("is_attendant") && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (Atendentes só podem ter 1 loja)
                    </span>
                  )}
                </Label>
                <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                  {stores.map((store) => (
                    <div key={store.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`store-${store.id}`}
                        checked={form.watch("store_ids")?.includes(store.id)}
                        onCheckedChange={(checked) => {
                          const current = form.getValues("store_ids") || [];
                          const isAttendant = form.watch("is_attendant");
                          
                          if (checked) {
                            // Se é atendente, substitui a loja ao invés de adicionar
                            if (isAttendant) {
                              form.setValue("store_ids", [store.id]);
                            } else {
                              form.setValue("store_ids", [...current, store.id]);
                            }
                          } else {
                            form.setValue("store_ids", current.filter(id => id !== store.id));
                          }
                        }}
                      />
                      <Label
                        htmlFor={`store-${store.id}`}
                        className="text-xs font-normal cursor-pointer"
                      >
                        {store.name}
                      </Label>
                    </div>
                  ))}
                </div>
                {form.formState.errors.store_ids && (
                  <p className="text-xs text-destructive">{form.formState.errors.store_ids.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Tags</Label>
                <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                  {tags.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma tag cadastrada. Crie tags em Acesso → Tags.
                    </p>
                  ) : (
                    tags.map((tag) => (
                      <div key={tag.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`tag-${tag.id}`}
                          checked={form.watch("tag_ids")?.includes(tag.id)}
                          onCheckedChange={(checked) => {
                            const current = form.getValues("tag_ids") || [];
                            if (checked) {
                              form.setValue("tag_ids", [...current, tag.id]);
                            } else {
                              form.setValue("tag_ids", current.filter(id => id !== tag.id));
                            }
                          }}
                        />
                        <Label
                          htmlFor={`tag-${tag.id}`}
                          className="text-xs font-normal cursor-pointer flex items-center gap-1"
                        >
                          <Badge style={{ backgroundColor: tag.color, color: '#fff' }} className="text-xs">
                            {tag.name}
                          </Badge>
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_attendant"
                  checked={form.watch("is_attendant")}
                  onCheckedChange={(checked) => {
                    form.setValue("is_attendant", checked === true);
                    if (!checked) {
                      form.setValue("codigo_funcionario_pdv", "");
                    }
                  }}
                />
                <Label
                  htmlFor="is_attendant"
                  className="text-xs font-normal cursor-pointer"
                >
                  Este usuário é um atendente/frentista (gera cadastros via QRCode)
                </Label>
              </div>

              {form.watch("is_attendant") && (
                <div className="space-y-1.5 pl-6 border-l-2 border-primary/20">
                  <Label htmlFor="codigo_funcionario_pdv" className="text-xs">
                    Código do Funcionário no PDV (Opcional)
                  </Label>
                  <Input 
                    id="codigo_funcionario_pdv" 
                    placeholder="Ex: F001, FUNC123, etc..."
                    maxLength={LIMITS.SHORT_CODE}
                    className="text-sm h-8" 
                    {...form.register("codigo_funcionario_pdv")} 
                  />
                  <p className="text-xs text-muted-foreground">
                    Código usado para identificar vendas deste funcionário no PDV. 
                    <br />
                    <strong>Diferente</strong> do código do Portal Colaborador que é gerado automaticamente.
                  </p>
                </div>
              )}

              <Button type="submit" size="sm" className="w-full text-sm" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isEditMode ? 'Atualizando...' : 'Criando...'}
                  </>
                ) : (
                  isEditMode ? 'Atualizar Usuário' : 'Criar Usuário'
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Usuários Cadastrados</CardTitle>
            <div className="flex items-center gap-1 rounded-lg border p-1 self-start sm:self-auto">
              <Button
                size="sm"
                variant={statusFilter === 'active' ? 'default' : 'ghost'}
                className="h-7 px-3 text-xs"
                onClick={() => setStatusFilter('active')}
              >
                Ativos ({counts.active})
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'inactive' ? 'default' : 'ghost'}
                className="h-7 px-3 text-xs"
                onClick={() => setStatusFilter('inactive')}
              >
                Inativos ({counts.inactive})
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'all' ? 'default' : 'ghost'}
                className="h-7 px-3 text-xs"
                onClick={() => setStatusFilter('all')}
              >
                Todos ({counts.all})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">
                  <button type="button" onClick={() => handleSort("user_reference_code")} className="flex items-center gap-1 font-medium">
                    Ref.
                    {renderSortIcon("user_reference_code")}
                  </button>
                </TableHead>
                <TableHead className="text-xs">
                  <button type="button" onClick={() => handleSort("full_name")} className="flex items-center gap-1 font-medium">
                    Nome
                    {renderSortIcon("full_name")}
                  </button>
                </TableHead>
                <TableHead className="text-xs">
                  <button type="button" onClick={() => handleSort("email")} className="flex items-center gap-1 font-medium">
                    E-mail
                    {renderSortIcon("email")}
                  </button>
                </TableHead>
                
                <TableHead className="text-xs">
                  <button type="button" onClick={() => handleSort("profile")} className="flex items-center gap-1 font-medium">
                    Perfil
                    {renderSortIcon("profile")}
                  </button>
                </TableHead>
                <TableHead className="text-xs">Tags</TableHead>
                <TableHead className="text-xs">Lojas</TableHead>
                <TableHead className="text-xs">Código</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-right text-xs">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground text-xs py-8">
                    {statusFilter === 'inactive' ? 'Nenhum usuário inativo' : statusFilter === 'active' ? 'Nenhum usuário ativo' : 'Nenhum usuário cadastrado'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedUsers.map((user) => (
                  <TableRow key={user.id} className={`cursor-pointer ${!user.is_active ? 'opacity-60' : ''}`} onClick={() => openUserDetails(user)}>
                    <TableCell className="text-sm font-mono">{user.user_reference_code || '-'}</TableCell>
                    <TableCell className="font-medium text-sm">{getShortName(user.profiles.full_name)}</TableCell>
                    <TableCell className="text-sm">{user.profiles.email}</TableCell>
                    
                    <TableCell className="text-sm">{user.store_access_profiles?.name || 'Sem perfil'}</TableCell>
                    <TableCell className="text-sm">
                      {user.tags && user.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.tags.map(tag => (
                            <Badge 
                              key={tag.id} 
                              style={{ backgroundColor: tag.color, color: '#fff' }} 
                              className="text-xs"
                            >
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm" onClick={(e) => e.stopPropagation()}>
                      {user.assigned_stores.length > 0 ? (
                        <HoverCard openDelay={100} closeDelay={100}>
                          <HoverCardTrigger asChild>
                            <Badge variant="outline" className="text-xs cursor-default">
                              {user.assigned_stores.length} {user.assigned_stores.length === 1 ? 'loja' : 'lojas'}
                            </Badge>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-64 p-3" align="start">
                            <p className="text-xs font-semibold mb-2 text-muted-foreground">
                              Lojas vinculadas
                            </p>
                            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                              {user.assigned_stores.map(store => (
                                <div key={store.id} className="text-sm">
                                  • {store.name}
                                </div>
                              ))}
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      ) : (
                        <span className="text-muted-foreground text-xs">Sem lojas</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {user.is_attendant && user.attendant_code ? (
                        <Badge variant="secondary" className="text-xs font-mono">
                          {user.attendant_code}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "secondary"} className="text-xs">
                        {user.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={(event) => event.stopPropagation()}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onSelect={() => handleViewUser(user)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => handleEditUser(user)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleResetPassword(user.user_id, user.profiles.email)}>
                            <KeyRound className="h-4 w-4 mr-2" />
                            Redefinir Senha
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => handleToggleUserStatus(user.user_id, user.is_active, user.profiles.full_name)}
                            className={user.is_active ? "text-destructive" : ""}
                          >
                            <Power className="h-4 w-4 mr-2" />
                            {user.is_active ? "Desativar" : "Ativar"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default StoreUsers;
