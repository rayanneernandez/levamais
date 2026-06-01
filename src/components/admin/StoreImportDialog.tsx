import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Download, Upload, Loader2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Network {
  id: string;
  name: string;
  max_stores: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  networks: Network[];
  onImported: () => void;
}

const COLUMNS = [
  "cnpj",
  "razao_social",
  "nome_fantasia",
  "apelido",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "municipio",
  "uf",
  "cep",
  "contact_name",
  "contact_phone",
  "contact_email",
] as const;

export function StoreImportDialog({ open, onOpenChange, networks, onImported }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [networkId, setNetworkId] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const handleDownloadTemplate = () => {
    const example = {
      cnpj: "00000000000000",
      razao_social: "Posto Exemplo LTDA",
      nome_fantasia: "Posto Exemplo",
      apelido: "Posto Centro",
      logradouro: "Av Brasil",
      numero: "1000",
      complemento: "",
      bairro: "Centro",
      municipio: "São Paulo",
      uf: "SP",
      cep: "01000000",
      contact_name: "João Silva",
      contact_phone: "11999999999",
      contact_email: "contato@exemplo.com.br",
    };
    const ws = XLSX.utils.json_to_sheet([example], { header: [...COLUMNS] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lojas");
    XLSX.writeFile(wb, "template-importacao-lojas.xlsx");
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!networkId) {
      toast({ title: "Selecione a empresa", variant: "destructive" });
      e.target.value = "";
      return;
    }

    try {
      setImporting(true);
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

      if (!rows.length) {
        toast({ title: "Planilha vazia", variant: "destructive" });
        return;
      }

      // Validate required columns
      const cleanRows = rows
        .map((r) => {
          const obj: Record<string, string> = {};
          for (const c of COLUMNS) {
            obj[c] = String(r[c] ?? "").trim();
          }
          return obj;
        })
        .filter((r) => r.cnpj && r.apelido && r.razao_social);

      if (!cleanRows.length) {
        toast({
          title: "Nenhuma linha válida",
          description: "CNPJ, razão social e apelido são obrigatórios",
          variant: "destructive",
        });
        return;
      }

      // Validate limit
      const network = networks.find((n) => n.id === networkId);
      const { count } = await supabase
        .from("stores")
        .select("*", { count: "exact", head: true })
        .eq("network_id", networkId)
        .eq("status", "active");

      const used = count || 0;
      if (network && used + cleanRows.length > network.max_stores) {
        toast({
          title: "Limite excedido",
          description: `A empresa tem ${network.max_stores} licença(s) e já usa ${used}. Você está tentando importar ${cleanRows.length}.`,
          variant: "destructive",
        });
        return;
      }

      // Get loyalty defaults from existing store of network
      const { data: networkStore } = await supabase
        .from("stores")
        .select("*")
        .eq("network_id", networkId)
        .limit(1)
        .maybeSingle();

      // Existing CNPJs to skip duplicates
      const cnpjs = cleanRows.map((r) => r.cnpj.replace(/\D/g, ""));
      const { data: existing } = await supabase
        .from("stores")
        .select("cnpj")
        .in("cnpj", cnpjs);
      const existingSet = new Set((existing || []).map((s: any) => s.cnpj));

      const toInsert = cleanRows
        .filter((r) => !existingSet.has(r.cnpj.replace(/\D/g, "")))
        .map((r) => {
          const endereco = [
            r.logradouro,
            r.numero,
            r.complemento,
            r.bairro,
            r.municipio,
            r.uf,
            r.cep,
          ].join(", ");
          const base: any = {
            network_id: networkId,
            cnpj: r.cnpj.replace(/\D/g, ""),
            name: r.apelido,
            razao_social: r.razao_social || null,
            nome_fantasia: r.nome_fantasia || null,
            contact_name: r.contact_name || null,
            contact_phone: r.contact_phone || null,
            contact_email: r.contact_email || null,
            address: endereco || null,
            status: "active",
          };
          if (networkStore) {
            base.loyalty_type = networkStore.loyalty_type;
            base.points_per_real = networkStore.points_per_real;
            base.real_per_point = networkStore.real_per_point;
            base.cashback_type = networkStore.cashback_type;
            base.cashback_percentage = networkStore.cashback_percentage;
            base.cashback_fixed_value = networkStore.cashback_fixed_value;
            base.signup_bonus_points = networkStore.signup_bonus_points;
            base.signup_bonus_cashback = networkStore.signup_bonus_cashback;
            base.points_validity_days = networkStore.points_validity_days;
            base.min_redeem_cashback = networkStore.min_redeem_cashback;
            base.max_redeem_cashback = networkStore.max_redeem_cashback;
            base.min_redeem_points = networkStore.min_redeem_points;
            base.max_redeem_points = networkStore.max_redeem_points;
            base.max_redemptions_24h = networkStore.max_redemptions_24h;
            base.enable_cashback_accumulation_block = networkStore.enable_cashback_accumulation_block;
            base.block_accumulation_cashback_limit = networkStore.block_accumulation_cashback_limit;
            base.enable_points_accumulation_block = networkStore.enable_points_accumulation_block;
            base.block_accumulation_points_limit = networkStore.block_accumulation_points_limit;
          } else {
            base.loyalty_type = "points";
            base.points_per_real = 1;
            base.points_validity_days = 365;
          }
          return base;
        });

      if (!toInsert.length) {
        toast({
          title: "Nada para importar",
          description: "Todas as lojas já estavam cadastradas",
        });
        return;
      }

      // Insert in batches of 50
      setProgress({ done: 0, total: toInsert.length });
      const batchSize = 50;
      let inserted = 0;
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const batch = toInsert.slice(i, i + batchSize);
        const { error } = await supabase.from("stores").insert(batch);
        if (error) throw error;
        inserted += batch.length;
        setProgress({ done: inserted, total: toInsert.length });
      }

      const skipped = cleanRows.length - toInsert.length;
      toast({
        title: "Importação concluída",
        description: `${inserted} loja(s) cadastrada(s)${skipped ? `, ${skipped} ignorada(s) (CNPJ duplicado)` : ""}.`,
      });
      onImported();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Import error:", err);
      toast({
        title: "Erro ao importar",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar lojas em lote
          </DialogTitle>
          <DialogDescription>
            Baixe o template, preencha com as lojas e faça o upload. Lojas com CNPJ já cadastrado serão ignoradas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Empresa de destino *</Label>
            <Select value={networkId} onValueChange={setNetworkId} disabled={importing}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {networks.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name} (Máx: {n.max_stores})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Colunas da planilha:</p>
            <p><b>Obrigatórias:</b> cnpj, razao_social, apelido</p>
            <p><b>Opcionais:</b> nome_fantasia, logradouro, numero, complemento, bairro, municipio, uf, cep, contact_name, contact_phone, contact_email</p>
          </div>

          {progress && (
            <div className="text-sm text-muted-foreground">
              Importando... {progress.done} / {progress.total}
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileSelected}
          />
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={handleDownloadTemplate} disabled={importing}>
            <Download className="h-4 w-4 mr-2" />
            Baixar template
          </Button>
          <Button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={importing || !networkId}
          >
            {importing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Selecionar planilha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
