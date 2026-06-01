import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Eye, Pencil, Search, BarChart3, Shield, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, differenceInYears } from "date-fns";
import { LIMITS, cleanEmail, cleanText, trimmedEmail, trimmedOptional, trimmedString } from "@/lib/input-sanitization";

// Listas de estados e países
const ESTADOS_BRASILEIROS = [
  { uf: "AC", nome: "Acre" },
  { uf: "AL", nome: "Alagoas" },
  { uf: "AP", nome: "Amapá" },
  { uf: "AM", nome: "Amazonas" },
  { uf: "BA", nome: "Bahia" },
  { uf: "CE", nome: "Ceará" },
  { uf: "DF", nome: "Distrito Federal" },
  { uf: "ES", nome: "Espírito Santo" },
  { uf: "GO", nome: "Goiás" },
  { uf: "MA", nome: "Maranhão" },
  { uf: "MT", nome: "Mato Grosso" },
  { uf: "MS", nome: "Mato Grosso do Sul" },
  { uf: "MG", nome: "Minas Gerais" },
  { uf: "PA", nome: "Pará" },
  { uf: "PB", nome: "Paraíba" },
  { uf: "PR", nome: "Paraná" },
  { uf: "PE", nome: "Pernambuco" },
  { uf: "PI", nome: "Piauí" },
  { uf: "RJ", nome: "Rio de Janeiro" },
  { uf: "RN", nome: "Rio Grande do Norte" },
  { uf: "RS", nome: "Rio Grande do Sul" },
  { uf: "RO", nome: "Rondônia" },
  { uf: "RR", nome: "Roraima" },
  { uf: "SC", nome: "Santa Catarina" },
  { uf: "SP", nome: "São Paulo" },
  { uf: "SE", nome: "Sergipe" },
  { uf: "TO", nome: "Tocantins" },
];

const PAISES = [
  "Brasil",
  "Argentina",
  "Chile",
  "Colômbia",
  "Estados Unidos",
  "México",
  "Paraguai",
  "Peru",
  "Portugal",
  "Uruguai",
];

interface Client {
  id: string;
  codigo: string | null;
  cpf: string;
  full_name: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  address_country: string | null;
  total_points: number;
  created_at: string;
  last_redeem_date?: string | null;
  favorite_network_id?: string | null;
  network_id?: string | null;
  is_favorite_network?: boolean; // Indica se a rede atual é a favorita
  retention_months?: number | null; // Período de compromisso em meses (null = padrão/sem compromisso)
  is_one_member?: boolean;
  one_member_since?: string | null;
}

interface Transaction {
  id: string;
  amount: number;
  points: number;
  type: string;
  description: string | null;
  created_at: string;
}

const clientSchema = z.object({
  cpf: z.string()
    .min(11, "CPF deve ter 11 dígitos")
    .regex(/^\d{11}$/, "CPF deve conter apenas números")
    .refine((cpf) => {
      // Validação do CPF
      const cpfNumbers = cpf.replace(/\D/g, '');
      
      // Verifica se tem 11 dígitos
      if (cpfNumbers.length !== 11) return false;
      
      // Verifica se todos os dígitos são iguais
      if (/^(\d)\1{10}$/.test(cpfNumbers)) return false;
      
      // Valida primeiro dígito verificador
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        sum += parseInt(cpfNumbers.charAt(i)) * (10 - i);
      }
      let digit = 11 - (sum % 11);
      if (digit >= 10) digit = 0;
      if (digit !== parseInt(cpfNumbers.charAt(9))) return false;
      
      // Valida segundo dígito verificador
      sum = 0;
      for (let i = 0; i < 10; i++) {
        sum += parseInt(cpfNumbers.charAt(i)) * (11 - i);
      }
      digit = 11 - (sum % 11);
      if (digit >= 10) digit = 0;
      if (digit !== parseInt(cpfNumbers.charAt(10))) return false;
      
      return true;
    }, "CPF inválido"),
  full_name: trimmedString(LIMITS.NAME, { min: 3, minMessage: "Nome completo é obrigatório" }),
  birth_date: z.string().refine((date) => {
    const birthDate = new Date(date);
    const age = differenceInYears(new Date(), birthDate);
    return age >= 18;
  }, "Cliente deve ter pelo menos 18 anos"),
  phone: z.string().trim().min(10, "Telefone é obrigatório").max(LIMITS.PHONE, `Telefone deve ter no máximo ${LIMITS.PHONE} caracteres`),
  email: trimmedEmail(LIMITS.EMAIL),
  address_street: trimmedOptional(LIMITS.ADDRESS),
  address_number: trimmedOptional(LIMITS.SHORT_CODE),
  address_complement: trimmedOptional(LIMITS.SHORT_TEXT),
  address_neighborhood: trimmedOptional(LIMITS.CITY),
  address_city: trimmedString(LIMITS.CITY, { min: 1, minMessage: "Cidade é obrigatória" }),
  address_state: z.string().min(2, "Estado é obrigatório"),
  address_zip: trimmedOptional(LIMITS.CEP),
  address_country: trimmedString(LIMITS.CITY, { min: 1, minMessage: "País é obrigatório" }),
});

type ClientFormData = z.infer<typeof clientSchema>;

const StoreClientes = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showTransactions, setShowTransactions] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [selectedState, setSelectedState] = useState<string>("");
  const [cities, setCities] = useState<string[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [loyaltyType, setLoyaltyType] = useState<'points' | 'cashback'>('points');
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      cpf: "",
      full_name: "",
      birth_date: "",
      phone: "",
      email: "",
      address_street: "",
      address_number: "",
      address_complement: "",
      address_neighborhood: "",
      address_city: "",
      address_state: "",
      address_zip: "",
      address_country: "Brasil",
    },
  });

  useEffect(() => {
    checkAuth();
    loadClients();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = clients.filter(
        (client) =>
          client.cpf.includes(searchTerm) ||
          client.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.phone?.includes(searchTerm)
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients(clients);
    }
  }, [searchTerm, clients]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/levaloja/auth");
    }
  };

  const loadClients = async () => {
    try {
      // Buscar network_id do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: managerData } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .is("store_id", null)
        .maybeSingle();

      if (!managerData) throw new Error("Network não encontrada");
      const userNetworkId = managerData.network_id;

      // Buscar informações da rede incluindo tipo de fidelidade
      const { data: networkData } = await supabase
        .from('networks')
        .select('loyalty_type')
        .eq('id', userNetworkId)
        .single();

      if (networkData?.loyalty_type) {
        const type = networkData.loyalty_type as 'points' | 'cashback';
        setLoyaltyType(type);
      }

      // Buscar TODOS os clientes da rede (incluindo os sem transações)
      const { data: allClients, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .eq("network_id", userNetworkId)
        .order("created_at", { ascending: false });

      if (clientsError) throw clientsError;

      console.log("✅ Clientes encontrados:", allClients?.length || 0);

      if (!allClients || allClients.length === 0) {
        console.log("⚠️ Nenhum cliente encontrado");
        setClients([]);
        setFilteredClients([]);
        return;
      }

      // Para cada cliente, buscar a última transação de resgate e verificar se é rede favorita
      const clientsWithLastRedeem = await Promise.all(
        allClients.map(async (client) => {
          const { data: lastRedeem } = await supabase
            .from("transactions")
            .select("created_at")
            .eq("client_id", client.id)
            .eq("type", "redemption")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Verifica se a rede atual é a rede favorita do cliente
          const isFavoriteNetwork = client.favorite_network_id === userNetworkId;

          // Buscar compromisso ativo de retenção
          const { data: commitment } = await supabase
            .from("client_retention_commitments")
            .select("commitment_months")
            .eq("client_id", client.id)
            .eq("status", "active")
            .gt("expires_at", new Date().toISOString())
            .maybeSingle();

          return {
            ...client,
            last_redeem_date: lastRedeem?.created_at || null,
            is_favorite_network: isFavoriteNetwork,
            retention_months: commitment?.commitment_months || null,
            // Se não for rede favorita, ocultar email e telefone
            email: isFavoriteNetwork ? client.email : null,
            phone: isFavoriteNetwork ? client.phone : null,
          };
        })
      );

      setClients(clientsWithLastRedeem);
      setFilteredClients(clientsWithLastRedeem);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar clientes",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadTransactions = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
      setShowTransactions(true);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar transações",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCepChange = async (cep: string) => {
    // Remove caracteres não numéricos
    const cleanCep = cep.replace(/\D/g, "");
    form.setValue("address_zip", cleanCep);

    // Só busca se tiver 8 dígitos
    if (cleanCep.length === 8) {
      setIsLoadingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();

        if (data.erro) {
          toast({
            title: "CEP não encontrado",
            description: "Verifique o CEP digitado e tente novamente.",
            variant: "destructive",
          });
          return;
        }

        // Preenche os campos automaticamente
        form.setValue("address_street", data.logradouro);
        form.setValue("address_neighborhood", data.bairro);
        form.setValue("address_city", data.localidade);
        form.setValue("address_state", data.uf);
        
        // Carrega as cidades do estado
        setSelectedState(data.uf);
        loadCities(data.uf);

        toast({
          title: "Endereço encontrado!",
          description: "Os campos foram preenchidos automaticamente.",
        });
      } catch (error) {
        toast({
          title: "Erro ao buscar CEP",
          description: "Não foi possível consultar o CEP. Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers.slice(0, 11);
  };

  const loadCities = async (uf: string) => {
    setIsLoadingCities(true);
    try {
      const response = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
      );
      const data = await response.json();
      const cityNames = data.map((city: any) => city.nome).sort();
      setCities(cityNames);
    } catch (error) {
      toast({
        title: "Erro ao carregar cidades",
        description: "Não foi possível carregar as cidades.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCities(false);
    }
  };

  const handleStateChange = (uf: string) => {
    setSelectedState(uf);
    form.setValue("address_state", uf);
    form.setValue("address_city", ""); // Limpa cidade ao mudar estado
    loadCities(uf);
  };

  const handleCreateOrUpdateClient = async (data: ClientFormData) => {
    try {
      const sanitizedData = {
        ...data,
        cpf: data.cpf.replace(/\D/g, "").slice(0, 11),
        full_name: cleanText(data.full_name, LIMITS.NAME),
        phone: cleanText(data.phone, LIMITS.PHONE),
        email: cleanEmail(data.email, LIMITS.EMAIL),
        address_street: cleanText(data.address_street, LIMITS.ADDRESS),
        address_number: cleanText(data.address_number, LIMITS.SHORT_CODE),
        address_complement: cleanText(data.address_complement, LIMITS.SHORT_TEXT),
        address_neighborhood: cleanText(data.address_neighborhood, LIMITS.CITY),
        address_city: cleanText(data.address_city, LIMITS.CITY),
        address_state: cleanText(data.address_state, 2).toUpperCase(),
        address_zip: cleanText(data.address_zip, LIMITS.CEP),
        address_country: cleanText(data.address_country, LIMITS.CITY),
      };

      // Buscar network_id do usuário
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: managerData } = await supabase
        .from("store_managers")
        .select("network_id")
        .eq("user_id", user.id)
        .is("store_id", null)
        .single();

      if (!managerData) throw new Error("Network não encontrada");

      if (selectedClient) {
        // Update
        const { error } = await supabase
          .from("clients")
          .update({
            full_name: sanitizedData.full_name,
            birth_date: sanitizedData.birth_date,
            phone: sanitizedData.phone,
            email: sanitizedData.email,
            address_street: sanitizedData.address_street,
            address_number: sanitizedData.address_number,
            address_complement: sanitizedData.address_complement,
            address_neighborhood: sanitizedData.address_neighborhood,
            address_city: sanitizedData.address_city,
            address_state: sanitizedData.address_state,
            address_zip: sanitizedData.address_zip,
            address_country: sanitizedData.address_country,
          })
          .eq("id", selectedClient.id);

        if (error) throw error;

        toast({
          title: "Cliente atualizado com sucesso!",
        });
      } else {
        // Create
        const { error } = await supabase.from("clients").insert([
          {
            cpf: sanitizedData.cpf,
            full_name: sanitizedData.full_name,
            birth_date: sanitizedData.birth_date,
            phone: sanitizedData.phone,
            email: sanitizedData.email,
            address_street: sanitizedData.address_street,
            address_number: sanitizedData.address_number,
            address_complement: sanitizedData.address_complement,
            address_neighborhood: sanitizedData.address_neighborhood,
            address_city: sanitizedData.address_city,
            address_state: sanitizedData.address_state,
            address_zip: sanitizedData.address_zip,
            address_country: sanitizedData.address_country,
            network_id: managerData.network_id,
          },
        ]);

        if (error) throw error;

        toast({
          title: "Cliente cadastrado com sucesso!",
        });
      }

      setIsDialogOpen(false);
      form.reset();
      setSelectedClient(null);
      loadClients();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar cliente",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleViewClient = (client: Client) => {
    setSelectedClient(client);
    setIsViewMode(true);
    form.reset({
      cpf: client.cpf,
      full_name: client.full_name || "",
      birth_date: client.birth_date || "",
      phone: client.phone || "",
      email: client.email || "",
      address_street: client.address_street || "",
      address_number: client.address_number || "",
      address_complement: client.address_complement || "",
      address_neighborhood: client.address_neighborhood || "",
      address_city: client.address_city || "",
      address_state: client.address_state || "",
      address_zip: client.address_zip || "",
      address_country: client.address_country || "Brasil",
    });
    if (client.address_state) {
      setSelectedState(client.address_state);
      loadCities(client.address_state);
    }
    loadTransactions(client.id);
    setShowTransactions(false);
    setIsDialogOpen(true);
  };

  const handleEditClient = (client: Client) => {
    // Se não for rede favorita, não permite edição
    if (!client.is_favorite_network) {
      toast({
        title: "Acesso restrito",
        description: "Apenas a rede favorita do cliente pode editar seus dados.",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedClient(client);
    setIsViewMode(false);
    form.reset({
      cpf: client.cpf,
      full_name: client.full_name || "",
      birth_date: client.birth_date || "",
      phone: client.phone || "",
      email: client.email || "",
      address_street: client.address_street || "",
      address_number: client.address_number || "",
      address_complement: client.address_complement || "",
      address_neighborhood: client.address_neighborhood || "",
      address_city: client.address_city || "",
      address_state: client.address_state || "",
      address_zip: client.address_zip || "",
      address_country: client.address_country || "Brasil",
    });
    if (client.address_state) {
      setSelectedState(client.address_state);
      loadCities(client.address_state);
    }
    setShowTransactions(false);
    setIsDialogOpen(true);
  };

  const handleNewClient = () => {
    setSelectedClient(null);
    setIsViewMode(false);
    setShowTransactions(false);
    setSelectedState("");
    setCities([]);
    form.reset({
      cpf: "",
      full_name: "",
      birth_date: "",
      phone: "",
      email: "",
      address_street: "",
      address_number: "",
      address_complement: "",
      address_neighborhood: "",
      address_city: "",
      address_state: "",
      address_zip: "",
      address_country: "Brasil",
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm">Gerencie os clientes cadastrados</p>
        </div>
        {/* Botão temporariamente oculto - pode ser reativado futuramente */}
        {/* <Button onClick={handleNewClient} size="sm">
          <Plus className="mr-2 h-4 w-4" /> Novo Cliente
        </Button> */}
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por CPF, nome, e-mail ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            maxLength={LIMITS.SHORT_TEXT}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CPF</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>
                  {loyaltyType === 'cashback' ? 'Saldo Cashback' : 'Saldo (Pontos)'}
                </TableHead>
                <TableHead>One</TableHead>
                <TableHead>Retenção</TableHead>
                <TableHead>Último Resgate</TableHead>
                <TableHead>Data Cadastro</TableHead>
                <TableHead>Acesso</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {filteredClients.map((client) => {
              // Pega os 3 primeiros nomes
              const shortName = client.full_name 
                ? client.full_name.split(" ").slice(0, 3).join(" ")
                : "-";
              
              return (
                <TableRow key={client.id}>
                  <TableCell>{client.cpf}</TableCell>
                  <TableCell>{shortName}</TableCell>
                  <TableCell>
                    {loyaltyType === 'cashback' 
                      ? `R$ ${(client.total_points || 0).toFixed(2)}`
                      : (client.total_points || 0)
                    }
                  </TableCell>
                  <TableCell>
                    {client.is_one_member ? (
                      <Badge className="bg-yellow-500 text-white">
                        <Star className="h-3 w-3 mr-1 fill-white" />
                        ONE
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {client.retention_months === 6 && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                        <Shield className="h-3 w-3 mr-1" />
                        6 meses
                      </Badge>
                    )}
                    {client.retention_months === 9 && (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800">
                        <Shield className="h-3 w-3 mr-1" />
                        9 meses
                      </Badge>
                    )}
                    {client.retention_months === 12 && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                        <Shield className="h-3 w-3 mr-1" />
                        12 meses
                      </Badge>
                    )}
                    {!client.retention_months && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
                        Padrão
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {client.last_redeem_date 
                      ? format(new Date(client.last_redeem_date), "dd/MM/yyyy")
                      : "-"
                    }
                  </TableCell>
                  <TableCell>{format(new Date(client.created_at), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    {client.is_favorite_network ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        ✓ Completo
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        🔒 Limitado
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/levaloja/clientes/${client.id}`)}
                        title="Saldo e Extrato"
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewClient(client)}
                        title="Visualizar"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClient(client)}
                        title={client.is_favorite_network ? "Editar" : "Edição restrita (cliente de outra rede)"}
                        disabled={!client.is_favorite_network}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isViewMode ? "Detalhes do Cliente" : selectedClient ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
            <DialogDescription>
              {isViewMode
                ? "Visualize os dados e histórico do cliente"
                : selectedClient
                ? "Atualize os dados do cliente"
                : "Preencha os dados para cadastrar um novo cliente"}
            </DialogDescription>
          </DialogHeader>


          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateOrUpdateClient)} className="space-y-4">
              {selectedClient && (
                <div className="flex justify-between items-start mb-4">
                  {!selectedClient.is_favorite_network && (
                    <div className="bg-amber-500/10 px-4 py-3 rounded-lg border border-amber-500/20 flex-1 mr-4">
                      <div className="flex items-start gap-2">
                        <span className="text-xl">ℹ️</span>
                        <div>
                          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                            Acesso Limitado aos Dados
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Este cliente está vinculado a outra rede. Você pode visualizar apenas: Nome, CPF e Endereço.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="bg-primary/10 px-6 py-3 rounded-lg border border-primary/20">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-medium text-muted-foreground uppercase">Código do Cliente</span>
                      <span className="text-2xl font-bold font-mono text-primary">{selectedClient.codigo || "-"}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          disabled={isViewMode || !!selectedClient} 
                          maxLength={11}
                          placeholder="00000000000"
                          onChange={(e) => field.onChange(formatCpf(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo *</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={LIMITS.NAME} disabled={isViewMode} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="birth_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Nascimento *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} disabled={isViewMode} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone Celular *</FormLabel>
                      <FormControl>
                        {selectedClient && !selectedClient.is_favorite_network ? (
                          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                            <span className="text-sm text-muted-foreground">
                              🔒 Acesso restrito (cliente de outra rede)
                            </span>
                          </div>
                        ) : (
                          <Input {...field} maxLength={LIMITS.PHONE} disabled={isViewMode} />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail *</FormLabel>
                      <FormControl>
                        {selectedClient && !selectedClient.is_favorite_network ? (
                          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                            <span className="text-sm text-muted-foreground">
                              🔒 Acesso restrito (cliente de outra rede)
                            </span>
                          </div>
                        ) : (
                          <Input type="email" maxLength={LIMITS.EMAIL} {...field} disabled={isViewMode} />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address_zip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            disabled={isViewMode || isLoadingCep}
                            onChange={(e) => handleCepChange(e.target.value)}
                            maxLength={LIMITS.CEP}
                            placeholder="00000000"
                          />
                          {isLoadingCep && (
                            <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin" />
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address_street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rua</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={LIMITS.ADDRESS} disabled={isViewMode} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={LIMITS.SHORT_CODE} disabled={isViewMode} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address_complement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complemento</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={LIMITS.SHORT_TEXT} disabled={isViewMode} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address_neighborhood"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairro</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={LIMITS.CITY} disabled={isViewMode} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address_state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado (UF) *</FormLabel>
                      <Select
                        disabled={isViewMode}
                        onValueChange={(value) => {
                          field.onChange(value);
                          handleStateChange(value);
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="z-50 bg-popover">
                          {ESTADOS_BRASILEIROS.map((estado) => (
                            <SelectItem key={estado.uf} value={estado.uf}>
                              {estado.nome} ({estado.uf})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address_city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade *</FormLabel>
                      <Select
                        disabled={isViewMode || !selectedState || isLoadingCities}
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={
                              isLoadingCities 
                                ? "Carregando cidades..." 
                                : selectedState 
                                ? "Selecione a cidade" 
                                : "Selecione primeiro o estado"
                            } />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="z-50 bg-popover max-h-[300px]">
                          {cities.map((city) => (
                            <SelectItem key={city} value={city}>
                              {city}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address_country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>País *</FormLabel>
                      <Select
                        disabled={isViewMode}
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o país" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="z-50 bg-popover">
                          {PAISES.map((pais) => (
                            <SelectItem key={pais} value={pais}>
                              {pais}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                {isViewMode ? (
                  <Button type="button" onClick={() => setIsDialogOpen(false)}>
                    Fechar
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {selectedClient ? "Salvar Alterações" : "Cadastrar Cliente"}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoreClientes;
