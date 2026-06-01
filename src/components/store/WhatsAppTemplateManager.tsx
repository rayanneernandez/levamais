import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, RefreshCw, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WhatsAppTemplate {
  name: string;
  status: string;
  category?: string;
  language?: string;
  components?: any[];
}

interface WhatsAppTemplateManagerProps {
  networkId: string;
}

export function WhatsAppTemplateManager({ networkId }: WhatsAppTemplateManagerProps) {
  const { toast } = useToast();

  const { data: templates, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["whatsapp-templates-api", networkId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('list-whatsapp-templates');

      if (error) throw error;
      return data?.templates || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: any }> = {
      PENDING: { variant: "secondary", label: "Pendente", icon: Clock },
      APPROVED: { variant: "outline", label: "Aprovado", icon: CheckCircle2 },
      REJECTED: { variant: "destructive", label: "Rejeitado", icon: XCircle },
      pending: { variant: "secondary", label: "Pendente", icon: Clock },
      approved: { variant: "outline", label: "Aprovado", icon: CheckCircle2 },
      rejected: { variant: "destructive", label: "Rejeitado", icon: XCircle },
    };

    const config = variants[status] || { variant: "outline" as const, label: status, icon: Clock };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getCategoryBadge = (category?: string) => {
    if (!category) return null;
    
    const colors: Record<string, string> = {
      MARKETING: "bg-blue-100 text-blue-800",
      UTILITY: "bg-green-100 text-green-800",
      AUTHENTICATION: "bg-purple-100 text-purple-800",
    };

    return (
      <Badge className={colors[category] || ""}>
        {category}
      </Badge>
    );
  };

  const getBodyText = (template: WhatsAppTemplate) => {
    if (!template.components) return '-';
    const bodyComponent = template.components.find((c: any) => c.type === 'BODY');
    return bodyComponent?.text || '-';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Templates do WhatsApp</CardTitle>
            <CardDescription>
              Templates aprovados pela Meta disponíveis no Zap Responder
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open('https://business.facebook.com/wa/manage/message-templates', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Gerenciar na Meta
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando templates do Zap Responder...</div>
        ) : !templates || templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum template encontrado.</p>
            <p className="text-sm mt-2">
              Crie templates no painel do Meta Business e aguarde aprovação.
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Idioma</TableHead>
                  <TableHead>Texto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template: WhatsAppTemplate, index: number) => (
                  <TableRow key={template.name || index}>
                    <TableCell className="font-medium font-mono">
                      {template.name}
                    </TableCell>
                    <TableCell>
                      {getCategoryBadge(template.category)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(template.status)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{template.language || 'pt_BR'}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[400px] truncate text-sm text-muted-foreground">
                      {getBodyText(template)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
