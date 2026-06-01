import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHANGELOG } from "@/config/changelog";
import { APP_VERSION } from "@/config/version";
import { CheckCircle2, AlertCircle, Sparkles, Zap } from "lucide-react";

const typeConfig = {
  feature: { label: "Novo", color: "bg-primary", icon: Sparkles },
  fix: { label: "Correção", color: "bg-destructive", icon: AlertCircle },
  improvement: { label: "Melhoria", color: "bg-secondary", icon: Zap },
  breaking: { label: "Breaking", color: "bg-warning", icon: AlertCircle }
};

export default function Versoes() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Controle de Versões</h1>
          <p className="text-muted-foreground">
            Histórico de atualizações e melhorias da plataforma
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Versão Atual</p>
          <p className="text-2xl font-bold text-primary">{APP_VERSION}</p>
        </div>
      </div>

      <div className="space-y-4">
        {CHANGELOG.map((entry, index) => {
          const isCurrentVersion = entry.version === APP_VERSION;
          
          return (
            <Card 
              key={entry.version} 
              className={isCurrentVersion ? "border-primary shadow-lg" : ""}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-xl">
                      Versão {entry.version}
                    </CardTitle>
                    {isCurrentVersion && (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Atual
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{entry.date}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {entry.changes.map((change, changeIndex) => {
                    const config = typeConfig[change.type];
                    const Icon = config.icon;
                    
                    return (
                      <div 
                        key={changeIndex}
                        className="flex items-start gap-3 p-3 rounded-lg bg-card/50 hover:bg-card transition-colors"
                      >
                        <div className={`p-1.5 rounded ${config.color} text-primary-foreground`}>
                          <Icon className="h-3 w-3" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-foreground">
                            {change.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg">Como atualizar?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            1. No arquivo <code className="bg-background px-2 py-1 rounded">src/config/version.ts</code>, 
            incremente o valor de <code className="bg-background px-2 py-1 rounded">PATCH_VERSION</code>
          </p>
          <p>
            2. No arquivo <code className="bg-background px-2 py-1 rounded">src/config/changelog.ts</code>, 
            adicione uma nova entrada no início do array <code className="bg-background px-2 py-1 rounded">CHANGELOG</code> com as mudanças
          </p>
          <p className="pt-2 text-xs">
            <strong>Nota:</strong> No início de cada mês, o PATCH_VERSION volta para 1 automaticamente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
