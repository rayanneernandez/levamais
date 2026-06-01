import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Filter, Users, X, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface Client {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  address_city?: string;
  address_state?: string;
  address_neighborhood?: string;
  birth_date?: string;
  total_points?: number;
}

interface ClientSelectorProps {
  networkId: string;
  selectedClients: string[];
  onSelectionChange: (clientIds: string[]) => void;
  filterType?: "expiring_points" | "expiring_plan" | "all";
  daysThreshold?: number;
}

export function ClientSelector({ 
  networkId, 
  selectedClients, 
  onSelectionChange,
  filterType = "all",
  daysThreshold = 7
}: ClientSelectorProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterState, setFilterState] = useState<string>("all");
  const [filterCity, setFilterCity] = useState<string>("all");
  const [filterNeighborhood, setFilterNeighborhood] = useState<string>("all");
  const [ageMin, setAgeMin] = useState<string>("");
  const [ageMax, setAgeMax] = useState<string>("");
  const [balanceMin, setBalanceMin] = useState<string>("");
  const [balanceMax, setBalanceMax] = useState<string>("");

  // Opções de filtro
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);

  useEffect(() => {
    loadClients();
  }, [networkId, filterType, daysThreshold]);

  useEffect(() => {
    applyFilters();
  }, [clients, searchTerm, filterState, filterCity, filterNeighborhood, ageMin, ageMax, balanceMin, balanceMax]);

  const loadClients = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("clients")
        .select("*")
        .eq("favorite_network_id", networkId); // Apenas clientes com esta rede como favorita

      // Aplicar filtro específico baseado no tipo
      if (filterType === "expiring_points") {
        // Buscar clientes com saldo maior que zero
        query = query.gt("total_points", 0);
      } else if (filterType === "expiring_plan") {
        // Buscar clientes com plano expirando
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + daysThreshold);

        const { data: commitments } = await supabase
          .from("client_retention_commitments")
          .select("client_id")
          .eq("network_id", networkId)
          .eq("status", "active")
          .lte("expires_at", expirationDate.toISOString());

        const clientIds = commitments?.map(c => c.client_id) || [];
        if (clientIds.length === 0) {
          setClients([]);
          setFilteredClients([]);
          setIsLoading(false);
          return;
        }

        query = query.in("id", clientIds);
      }

      const { data, error } = await query.order("full_name");

      if (error) throw error;

      setClients(data || []);

      // Extrair opções únicas para filtros
      const uniqueStates = [...new Set(data?.map(c => c.address_state).filter(Boolean))];
      const uniqueCities = [...new Set(data?.map(c => c.address_city).filter(Boolean))];
      const uniqueNeighborhoods = [...new Set(data?.map(c => c.address_neighborhood).filter(Boolean))];

      setStates(uniqueStates as string[]);
      setCities(uniqueCities as string[]);
      setNeighborhoods(uniqueNeighborhoods as string[]);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar clientes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...clients];

    // Busca por nome/email/telefone
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.full_name?.toLowerCase().includes(search) ||
        c.email?.toLowerCase().includes(search) ||
        c.phone?.includes(search)
      );
    }

    // Filtro de estado
    if (filterState && filterState !== "all") {
      filtered = filtered.filter(c => c.address_state === filterState);
    }

    // Filtro de cidade
    if (filterCity && filterCity !== "all") {
      filtered = filtered.filter(c => c.address_city === filterCity);
    }

    // Filtro de bairro
    if (filterNeighborhood && filterNeighborhood !== "all") {
      filtered = filtered.filter(c => c.address_neighborhood === filterNeighborhood);
    }

    // Filtro de idade
    if (ageMin || ageMax) {
      const now = new Date();
      filtered = filtered.filter(c => {
        if (!c.birth_date) return false;
        const birthDate = new Date(c.birth_date);
        let age = now.getFullYear() - birthDate.getFullYear();
        const monthDiff = now.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
          age--;
        }
        
        if (ageMin && age < parseInt(ageMin)) return false;
        if (ageMax && age > parseInt(ageMax)) return false;
        return true;
      });
    }

    // Filtro de saldo
    if (balanceMin || balanceMax) {
      filtered = filtered.filter(c => {
        const balance = c.total_points || 0;
        if (balanceMin && balance < parseFloat(balanceMin)) return false;
        if (balanceMax && balance > parseFloat(balanceMax)) return false;
        return true;
      });
    }

    setFilteredClients(filtered);
  };

  const toggleClient = (clientId: string) => {
    const newSelection = selectedClients.includes(clientId)
      ? selectedClients.filter(id => id !== clientId)
      : [...selectedClients, clientId];
    onSelectionChange(newSelection);
  };

  const selectAll = () => {
    if (selectedClients.length === filteredClients.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(filteredClients.map(c => c.id));
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterState("all");
    setFilterCity("all");
    setFilterNeighborhood("all");
    setAgeMin("");
    setAgeMax("");
    setBalanceMin("");
    setBalanceMax("");
  };

  const calculateAge = (birthDate: string) => {
    const now = new Date();
    const birth = new Date(birthDate);
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <div className="flex items-center justify-center py-4">
              <LoadingSpinner size="md" text="Carregando clientes..." />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Selecionar Clientes
            </CardTitle>
            <CardDescription>
              {filteredClients.length} clientes disponíveis • {selectedClients.length} selecionados
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
            <Button variant="outline" size="sm" onClick={selectAll}>
              {selectedClients.length === filteredClients.length ? "Desmarcar" : "Selecionar"} Todos
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="search" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="search">
              <Search className="h-4 w-4 mr-2" />
              Busca
            </TabsTrigger>
            <TabsTrigger value="location">
              <Filter className="h-4 w-4 mr-2" />
              Localização
            </TabsTrigger>
            <TabsTrigger value="profile">
              <Filter className="h-4 w-4 mr-2" />
              Perfil
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            <div className="space-y-2">
              <Label>Buscar por Nome, E-mail ou Telefone</Label>
              <Input
                placeholder="Digite para buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </TabsContent>

          <TabsContent value="location" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={filterState} onValueChange={setFilterState}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {states.map(state => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cidade</Label>
                <Select value={filterCity} onValueChange={setFilterCity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {cities.map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Bairro</Label>
                <Select value={filterNeighborhood} onValueChange={setFilterNeighborhood}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {neighborhoods.map(neighborhood => (
                      <SelectItem key={neighborhood} value={neighborhood}>{neighborhood}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="profile" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Idade Mínima</Label>
                <Input
                  type="number"
                  placeholder="Ex: 18"
                  value={ageMin}
                  onChange={(e) => setAgeMin(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Idade Máxima</Label>
                <Input
                  type="number"
                  placeholder="Ex: 65"
                  value={ageMax}
                  onChange={(e) => setAgeMax(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Saldo Mínimo</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 10.00"
                  value={balanceMin}
                  onChange={(e) => setBalanceMin(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Saldo Máximo</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 500.00"
                  value={balanceMax}
                  onChange={(e) => setBalanceMax(e.target.value)}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Lista de Clientes */}
        <div className="border rounded-lg">
          <div className="max-h-[400px] overflow-y-auto p-4 space-y-2">
            {filteredClients.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Nenhum cliente encontrado com os filtros aplicados
              </div>
            ) : (
              <>
                <div className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/50">
                  <Checkbox
                    checked={selectedClients.length === filteredClients.length && filteredClients.length > 0}
                    onCheckedChange={selectAll}
                  />
                  <p className="font-medium">Selecionar Todos ({filteredClients.length})</p>
                </div>
                {filteredClients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedClients.includes(client.id)}
                    onCheckedChange={() => toggleClient(client.id)}
                  />
                  <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{client.full_name.split(' ')[0]}</p>
                    {client.birth_date && (
                      <Badge variant="secondary" className="text-xs">
                        {calculateAge(client.birth_date)} anos
                      </Badge>
                    )}
                    {client.address_city && (
                      <Badge variant="outline" className="text-xs">
                        {client.address_city} - {client.address_state}
                      </Badge>
                    )}
                    {client.address_neighborhood && (
                      <Badge variant="outline" className="text-xs">
                        {client.address_neighborhood}
                      </Badge>
                    )}
                    {client.total_points && client.total_points > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        Saldo: {client.total_points} pts
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
