import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, X } from "lucide-react";

interface TermsOfUseDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onAccept?: () => void;
  showAcceptButton?: boolean;
}

export const TermsOfUseDialog = ({ 
  open, 
  onOpenChange, 
  onAccept,
  showAcceptButton = false 
}: TermsOfUseDialogProps) => {
  const [activeTab, setActiveTab] = useState("terms");

  const handleAccept = () => {
    if (onAccept) {
      onAccept();
    }
    if (onOpenChange) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={showAcceptButton ? undefined : onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1.5">
            <DialogTitle>Termos de Uso e Política de Privacidade</DialogTitle>
            <DialogDescription>
              Por favor, leia atentamente os documentos abaixo
            </DialogDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange?.(false)}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full px-6 pb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="terms">
              Termos de Uso
            </TabsTrigger>
            <TabsTrigger value="privacy">
              Política de Privacidade
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="terms" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Documento atualizado em 22 de outubro de 2025
                </p>
                <a
                  href="/termos-de-uso-leva.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Abrir em nova aba
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <iframe
                src="/termos-de-uso-leva.html"
                className="w-full h-[500px] border rounded-md"
                title="Termos de Uso"
              />
            </div>
          </TabsContent>
          
          <TabsContent value="privacy" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Documento atualizado em 22 de outubro de 2025
                </p>
                <a
                  href="/politica-de-privacidade-leva.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Abrir em nova aba
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <iframe
                src="/politica-de-privacidade-leva.html"
                className="w-full h-[500px] border rounded-md"
                title="Política de Privacidade"
              />
            </div>
          </TabsContent>
        </Tabs>
        
        {showAcceptButton && (
          <DialogFooter className="px-6 pb-6">
            <Button onClick={handleAccept} className="w-full">
              Aceitar Termos e Continuar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
