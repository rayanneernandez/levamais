import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Building2, LogOut, Plus, QrCode, TrendingUp, Users, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Network {
  id: string;
  name: string;
  email: string;
  max_stores: number;
  total_licenses: number;
}

interface Store {
  id: string;
  name: string;
  cnpj: string;
  loyalty_type: string;
  points_per_real: number;
  cashback_percentage: number;
}

const Store = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [network, setNetwork] = useState<Network | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/levaloja/auth");
        return;
      }

      // Verificar se precisa trocar senha
      const { data: managerData } = await supabase
        .from('store_managers')
        .select('must_change_password')
        .eq('user_id', session.user.id)
        .is('store_id', null)
        .maybeSingle();

      if (managerData?.must_change_password === true) {
        navigate("/levaloja/trocar-senha");
        return;
      }

      // Primeiro, buscar o network_id do usuário
      const { data: managerNetworkData, error: managerError } = await supabase
        .from('store_managers')
        .select('network_id')
        .eq('user_id', session.user.id)
        .is('store_id', null)
        .maybeSingle();

      if (managerError) {
        console.error('Erro ao buscar gerente:', managerError);
        throw new Error('Erro ao verificar permissões');
      }

      if (!managerNetworkData || !managerNetworkData.network_id) {
        throw new Error('Você não está associado a nenhuma empresa');
      }

      // Buscar dados da rede
      const { data: networkData, error: networkError } = await supabase
        .from('networks')
        .select('*')
        .eq('id', managerNetworkData.network_id)
        .single();

      if (networkError || !networkData) {
        console.error('Erro ao buscar empresa:', networkError);
        throw new Error('Empresa não encontrada');
      }

      setNetwork(networkData);

      // Buscar lojas da rede
      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select('*')
        .eq('network_id', networkData.id)
        .eq('status', 'active');

      if (storesError) {
        console.error('Erro ao buscar lojas:', storesError);
        throw storesError;
      }
      
      setStores(storesData || []);
    } catch (error: any) {
      console.error('Erro geral:', error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
      // Não redirecionar automaticamente para evitar loop
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/levaloja/auth");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Leva+ Loja</h1>
              <p className="text-xs text-muted-foreground">{network?.name || 'Carregando...'}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Lojas</p>
                <h3 className="text-3xl font-bold mt-2">{stores.length}</h3>
                <p className="text-xs text-muted-foreground mt-1">de {network?.max_stores || 0} licenças</p>
              </div>
              <Building2 className="h-12 w-12 text-secondary/20" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Clientes</p>
                <h3 className="text-3xl font-bold mt-2">1.2k</h3>
              </div>
              <TrendingUp className="h-12 w-12 text-primary/20" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pontos Ativos</p>
                <h3 className="text-3xl font-bold mt-2">45k</h3>
              </div>
              <TrendingUp className="h-12 w-12 text-accent/20" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resgates/Mês</p>
                <h3 className="text-3xl font-bold mt-2">234</h3>
              </div>
              <TrendingUp className="h-12 w-12 text-secondary/20" />
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Suas Lojas</h2>
            <p className="text-muted-foreground">Gerencie lojas e regras de fidelidade</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/levaloja/usuarios")}>
              <Users className="h-4 w-4 mr-2" />
              Usuários
            </Button>
            <Button variant="secondary" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nova Loja
            </Button>
          </div>
        </div>

        {/* Stores List */}
        <div className="grid gap-4">
          {stores.length === 0 ? (
            <Card className="p-12 text-center">
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma loja cadastrada</h3>
              <p className="text-muted-foreground mb-4">Adicione sua primeira loja para começar</p>
              <Button variant="secondary">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Loja
              </Button>
            </Card>
          ) : (
            stores.map((store) => (
              <Card key={store.id} className="p-6 hover:shadow-lg transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-14 w-14 rounded-lg bg-secondary/10 flex items-center justify-center">
                      <Building2 className="h-7 w-7 text-secondary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold">{store.name}</h3>
                      <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                        <span>CNPJ: {store.cnpj}</span>
                        <span>•</span>
                        <span className="text-secondary">
                          {store.loyalty_type === 'points' ? 'Pontos' : 'Cashback'}
                        </span>
                        <span>•</span>
                        <span>
                          {store.loyalty_type === 'points' 
                            ? `${store.points_per_real} ponto = R$ 1,00`
                            : `${store.cashback_percentage}% de volta`
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <QrCode className="h-4 w-4 mr-2" />
                      QR Code
                    </Button>
                    <Button variant="outline" size="sm">
                      Editar Regras
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Store;
