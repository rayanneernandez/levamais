import { useState, useEffect } from "react";
import { Plus, Eye, Pencil, Key, UserX, ArrowLeft, Search, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LIMITS, trimmedString, trimmedEmail, trimmedOptional, cleanText, cleanEmail } from "@/lib/input-sanitization";

const formSchema = z.object({
  full_name: trimmedString(LIMITS.NAME, { min: 3, minMessage: "Nome deve ter no mínimo 3 caracteres" }),
  email: trimmedEmail(LIMITS.EMAIL),
  cpf: trimmedOptional(LIMITS.CPF_CNPJ),
  phone: trimmedOptional(LIMITS.PHONE),
  access_profile_id: z.string().optional(),
  is_seller: z.boolean().optional(),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(LIMITS.PASSWORD).or(z.literal("")),
});

type FormData = z.infer<typeof formSchema>;

interface User {
  id: string;
  full_name: string;
  email: string;
  cpf?: string;
  phone?: string;
  access_profile_id?: string;
  is_seller?: boolean;
  access_profile?: {
    name: string;
  };
  user_roles?: Array<{ role: string }>;
}

interface AccessProfile {
  id: string;
  name: string;
  description: string;
}

export default function Usuarios() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
  const [isCheckingPassword, setIsCheckingPassword] = useState(false);
  const [passwordCheck, setPasswordCheck] = useState<any>(null);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: "",
      email: "",
      cpf: "",
      phone: "",
      access_profile_id: "",
      is_seller: false,
      password: "",
    },
  });

  const checkPasswordSecurity = async (password: string) => {
    if (!password || password.length < 6) {
      setPasswordCheck(null);
      return;
    }

    setIsCheckingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-pwned-password', {
        body: { password },
      });

      if (error) throw error;
      
      if (data.isPwned) {
        setPasswordCheck(data);
      } else {
        setPasswordCheck(null);
      }
    } catch (error) {
      console.error('Erro ao verificar senha:', error);
    } finally {
      setIsCheckingPassword(false);
    }
  };

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'password' && value.password) {
        checkPasswordSecurity(value.password);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Carregar perfis de acesso
      const { data: profilesData, error: profilesError } = await supabase
        .from("access_profiles")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (profilesError) throw profilesError;
      setProfiles(profilesData || []);

      // Carregar usuários com seus perfis
      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select(`
          *,
          access_profile:access_profiles(name)
        `)
        .order("full_name");

      if (usersError) throw usersError;

      setUsers(usersData || []);
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

  const onSubmit = async (rawData: FormData) => {
    const data: FormData = {
      ...rawData,
      full_name: cleanText(rawData.full_name, LIMITS.NAME),
      email: cleanEmail(rawData.email, LIMITS.EMAIL),
      cpf: cleanText(rawData.cpf, LIMITS.CPF_CNPJ),
      phone: cleanText(rawData.phone, LIMITS.PHONE),
    };
    console.log("onSubmit called", { data, editingUser });
    try {
      if (!editingUser) {
        // Criar novo usuário
        if (!data.password) {
          toast({
            title: "Senha obrigatória",
            description: "Informe uma senha para o novo usuário",
            variant: "destructive",
          });
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              full_name: data.full_name,
            },
          },
        });

        if (authError || !authData.user) throw authError;

        // Atualizar perfil
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            full_name: data.full_name,
            email: data.email,
            cpf: data.cpf || null,
            phone: data.phone || null,
            access_profile_id: data.access_profile_id === "none" ? null : data.access_profile_id,
            is_seller: data.is_seller || false,
          })
          .eq("id", authData.user.id);

        if (profileError) throw profileError;

        toast({
          title: "Usuário criado!",
          description: "O usuário foi cadastrado com sucesso.",
        });
      } else {
        // Atualizar usuário existente
        console.log("Updating user profile", { 
          id: editingUser.id, 
          updateData: {
            full_name: data.full_name,
            email: data.email,
            cpf: data.cpf || null,
            phone: data.phone || null,
            access_profile_id: data.access_profile_id === "none" ? null : data.access_profile_id,
          }
        });
        
        const { data: updateResult, error: profileError } = await supabase
          .from("profiles")
          .update({
            full_name: data.full_name,
            email: data.email,
            cpf: data.cpf || null,
            phone: data.phone || null,
            access_profile_id: data.access_profile_id === "none" ? null : data.access_profile_id,
            is_seller: data.is_seller || false,
          })
          .eq("id", editingUser.id)
          .select();

        console.log("Update result", { updateResult, profileError });
        
        if (profileError) throw profileError;

        toast({
          title: "Usuário atualizado!",
          description: "Os dados do usuário foram atualizados com sucesso.",
        });
      }

      setIsDialogOpen(false);
      form.reset();
      setEditingUser(null);
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.reset({
      full_name: user.full_name,
      email: user.email,
      cpf: user.cpf || "",
      phone: user.phone || "",
      access_profile_id: user.access_profile_id || "none",
      is_seller: user.is_seller || false,
      password: "",
    });
    setIsDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!selectedUserId) return;

    try {
      const user = users.find(u => u.id === selectedUserId);
      if (!user?.email) throw new Error("Email do usuário não encontrado");

      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/adm/auth`,
      });

      if (error) throw error;

      toast({
        title: "Email enviado!",
        description: "Um email com instruções para redefinir a senha foi enviado.",
      });

      setIsResetPasswordOpen(false);
      setSelectedUserId(null);
    } catch (error: any) {
      toast({
        title: "Erro ao enviar email",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeactivate = async () => {
    if (!selectedUserId) return;

    try {
      // Remover perfil de acesso
      const { error } = await supabase
        .from("profiles")
        .update({ access_profile_id: null })
        .eq("id", selectedUserId);

      if (error) throw error;

      toast({
        title: "Usuário inativado!",
        description: "O usuário foi inativado com sucesso.",
      });

      setIsDeactivateOpen(false);
      setSelectedUserId(null);
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao inativar usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setIsDialogOpen(false);
      setEditingUser(null);
      form.reset();
    } else {
      setIsDialogOpen(true);
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.cpf && user.cpf.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerenciamento de usuários do sistema</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? "Editar Usuário" : "Novo Usuário"}
              </DialogTitle>
              <DialogDescription>
                {editingUser
                  ? "Atualize os dados do usuário"
                  : "Cadastre um novo usuário no sistema"}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
                console.log("Form validation errors:", errors);
              })} className="space-y-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="João da Silva" maxLength={LIMITS.NAME} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="joao@exemplo.com" maxLength={LIMITS.EMAIL} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="000.000.000-00" maxLength={LIMITS.CPF_CNPJ} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="(11) 99999-9999" maxLength={LIMITS.PHONE} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="access_profile_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Perfil de Acesso</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione (opcional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Sem perfil</SelectItem>
                            {profiles.map((profile) => (
                              <SelectItem key={profile.id} value={profile.id}>
                                {profile.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {!editingUser && (
                  <>
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha *</FormLabel>
                          <FormControl>
                            <Input {...field} type="password" placeholder="Mínimo 6 caracteres" maxLength={LIMITS.PASSWORD} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {passwordCheck && (
                      <Alert variant="destructive" className="bg-red-900/20 border-red-800">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          ⚠️ Senha comprometida! Esta senha foi encontrada em {passwordCheck.timesFound.toLocaleString()} vazamentos de dados.
                          Por favor, escolha uma senha mais segura.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}

                <FormField
                  control={form.control}
                  name="is_seller"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Este usuário é um vendedor (pode ser atribuído a Leads e Orçamentos)
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      console.log("Cancel clicked");
                      handleDialogClose(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    onClick={(e) => {
                      console.log("Submit button clicked", { 
                        formValues: form.getValues(),
                        formErrors: form.formState.errors,
                        isValid: form.formState.isValid
                      });
                    }}
                  >
                    {editingUser ? "Atualizar" : "Cadastrar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou CPF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Perfil de Acesso</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhum usuário encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {user.access_profile_id ? (
                      <Badge>{user.access_profile?.name || "N/A"}</Badge>
                    ) : (
                      <Badge variant="secondary">Sem perfil</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(user)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setIsResetPasswordOpen(true);
                        }}
                        title="Redefinir senha"
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setIsDeactivateOpen(true);
                        }}
                        title="Inativar"
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redefinir Senha</AlertDialogTitle>
            <AlertDialogDescription>
              Será enviado um email com instruções para o usuário redefinir a senha. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword}>Enviar Email</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeactivateOpen} onOpenChange={setIsDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inativar Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário perderá acesso ao sistema. Esta ação pode ser revertida editando o usuário novamente. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate}>Inativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
