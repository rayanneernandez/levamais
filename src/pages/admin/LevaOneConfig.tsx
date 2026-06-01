import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Percent, Plus, Trash2, Edit } from "lucide-react";

interface Network {
  id: string;
  name: string;
}

interface CommissionConfig {
  id?: string;
  network_id: string;
  network_name?: string;
  commission_type: 'percentage' | 'fixed';
  commission_value: number;
  payment_day_offset: number;
}

const LevaOneConfig = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [configs, setConfigs] = useState<CommissionConfig[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<string>("");
  const [editingNetworkId, setEditingNetworkId] = useState<string | null>(null);
  const [newConfig, setNewConfig] = useState<Omit<CommissionConfig, 'network_name'>>({
    network_id: "",
    commission_type: "percentage",
    commission_value: 0,
    payment_day_offset: 10,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    
    // Carregar redes
    const { data: networksData, error: networksError } = await supabase
      .from("networks")
      .select("id, name")
      .eq("status", "active")
      .order("name");

    if (networksError) {
      toast({
        title: "Erro ao carregar redes",
        description: networksError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setNetworks(networksData || []);

    // Carregar configurações existentes
    const { data: configsData, error: configsError } = await supabase
      .from("network_one_commission_config")
      .select(`
        id,
        network_id,
        commission_type,
        commission_value,
        payment_day_offset
      `);

    if (configsError) {
      toast({
        title: "Erro ao carregar configurações",
        description: configsError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Mapear configs com nomes das redes
    const configsWithNames = (configsData || []).map(config => {
      const network = networksData?.find(n => n.id === config.network_id);
      return {
        ...config,
        network_name: network?.name || 'Rede não encontrada',
        commission_type: (config.commission_type as 'percentage' | 'fixed') || 'percentage',
        commission_value: Number(config.commission_value),
      };
    });

    setConfigs(configsWithNames);
    setLoading(false);
  };

  const handleAddConfig = async () => {
    if (!selectedNetwork) {
      toast({
        title: "Selecione uma rede",
        variant: "destructive",
      });
      return;
    }

    if (newConfig.commission_value <= 0) {
      toast({
        title: "Valor inválido",
        description: "O valor deve ser maior que zero",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const configData = {
        network_id: selectedNetwork,
        commission_type: newConfig.commission_type,
        commission_value: newConfig.commission_value,
        payment_day_offset: newConfig.payment_day_offset,
      };

      // Se estiver editando, deletar a antiga e inserir a nova
      if (editingNetworkId) {
        const { error: deleteError } = await supabase
          .from("network_one_commission_config")
          .delete()
          .eq('network_id', editingNetworkId);

        if (deleteError) throw deleteError;
      } else {
        // Verificar se já existe
        const { data: existing } = await supabase
          .from("network_one_commission_config")
          .select("id")
          .eq('network_id', selectedNetwork)
          .maybeSingle();

        if (existing) {
          toast({
            title: "Rede já configurada",
            description: "Esta rede já possui uma configuração",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
      }

      // Inserir a nova config
      const { error: insertError } = await supabase
        .from("network_one_commission_config")
        .insert([configData]);

      if (insertError) throw insertError;

      toast({
        title: editingNetworkId ? "Configuração atualizada" : "Configuração salva",
        description: "A comissão foi salva com sucesso.",
      });

      setEditingNetworkId(null);
      loadData();

      // Reset form
      setSelectedNetwork("");
      setNewConfig({
        network_id: "",
        commission_type: "percentage",
        commission_value: 0,
        payment_day_offset: 10,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditConfig = (config: CommissionConfig) => {
    setSelectedNetwork(config.network_id);
    setEditingNetworkId(config.network_id);
    setNewConfig({
      network_id: config.network_id,
      commission_type: config.commission_type,
      commission_value: config.commission_value,
      payment_day_offset: config.payment_day_offset,
    });
    
    toast({
      title: "Modo de edição",
      description: "Faça as alterações e clique em 'Atualizar'",
    });
  };

  const handleCancelEdit = () => {
    setEditingNetworkId(null);
    setSelectedNetwork("");
    setNewConfig({
      network_id: "",
      commission_type: "percentage",
      commission_value: 0,
      payment_day_offset: 10,
    });
  };

  const handleRemoveConfig = async (networkId: string) => {
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from("network_one_commission_config")
        .delete()
        .eq('network_id', networkId);

      if (error) throw error;

      toast({
        title: "Configuração removida",
        description: "A comissão foi removida com sucesso.",
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const availableNetworks = networks.filter(
    n => !configs.find(c => c.network_id === n.id) || n.id === editingNetworkId
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Percent className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Comissões Leva+ One</h1>
          <p className="text-muted-foreground">Configure as comissões para cada grupo de lojas</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingNetworkId ? "Editar Comissão" : "Adicionar Comissão"}</CardTitle>
          <CardDescription>
            {editingNetworkId 
              ? "Atualize os valores da comissão e clique em 'Atualizar'"
              : "Defina o tipo e valor da comissão que cada rede receberá pelas assinaturas"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="network">Rede</Label>
              <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
                <SelectTrigger id="network">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {availableNetworks.map((network) => (
                    <SelectItem key={network.id} value={network.id}>
                      {network.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select
                value={newConfig.commission_type}
                onValueChange={(value: 'percentage' | 'fixed') =>
                  setNewConfig({ ...newConfig, commission_type: value })
                }
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Fixo (R$/membro)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">
                {newConfig.commission_type === "percentage" ? "%" : "R$"}
              </Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                min="0"
                value={newConfig.commission_value}
                onChange={(e) =>
                  setNewConfig({ ...newConfig, commission_value: Number(e.target.value) })
                }
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="offset">Dias p/ Pgto</Label>
              <Input
                id="offset"
                type="number"
                min="1"
                max="30"
                value={newConfig.payment_day_offset}
                onChange={(e) =>
                  setNewConfig({ ...newConfig, payment_day_offset: Number(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleAddConfig} disabled={saving} className="flex-1">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : editingNetworkId ? (
                <>
                  <Edit className="mr-2 h-4 w-4" />
                  Atualizar Configuração
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar à Lista
                </>
              )}
            </Button>
            {editingNetworkId && (
              <Button onClick={handleCancelEdit} variant="outline" disabled={saving}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comissões Negociadas</CardTitle>
          <CardDescription>
            {configs.length} configuração(ões) adicionada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma comissão configurada
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rede</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Dias Pgto</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config) => (
                    <TableRow 
                      key={config.network_id}
                      className={editingNetworkId === config.network_id ? "bg-muted/50" : ""}
                    >
                      <TableCell className="font-medium">{config.network_name}</TableCell>
                      <TableCell>
                        {config.commission_type === 'percentage' ? 'Percentual' : 'Fixo'}
                      </TableCell>
                      <TableCell className="text-right">
                        {config.commission_type === 'percentage' 
                          ? `${config.commission_value}%` 
                          : `R$ ${config.commission_value.toFixed(2)}`}
                      </TableCell>
                      <TableCell className="text-right">{config.payment_day_offset} dias</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditConfig(config)}
                            disabled={(editingNetworkId !== null && editingNetworkId !== config.network_id) || saving}
                          >
                            <Edit className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveConfig(config.network_id)}
                            disabled={editingNetworkId !== null || saving}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LevaOneConfig;
