import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Smartphone, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPWADialog = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Verifica se já está instalado
    const checkInstalled = () => {
      // Detecta se está rodando como PWA instalado
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      return isStandalone || isIOSStandalone;
    };

    setIsInstalled(checkInstalled());

    // Detecta plataforma
    const userAgent = navigator.userAgent.toLowerCase();
    const iOS = /ipad|iphone|ipod/.test(userAgent);
    setIsIOS(iOS);

    console.log('🔍 PWA Detection:', {
      isInstalled: checkInstalled(),
      isIOS: iOS,
      userAgent: navigator.userAgent,
      standalone: window.matchMedia('(display-mode: standalone)').matches
    });

    // Handler para o evento de instalação (Android/Chrome)
    const handler = (e: Event) => {
      console.log('✅ beforeinstallprompt event captured');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    console.log('🎯 Install button clicked', { 
      hasDeferredPrompt: !!deferredPrompt, 
      isIOS, 
      isInstalled 
    });

    // Se já está instalado, não fazer nada
    if (isInstalled) {
      console.log('✅ PWA já está instalado');
      return;
    }

    // Android/Chrome: usar prompt nativo
    if (deferredPrompt) {
      console.log('📱 Showing native install prompt');
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('👤 User choice:', outcome);
        
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
          setIsInstalled(true);
        }
      } catch (error) {
        console.error('❌ Error showing prompt:', error);
        setShowDialog(true);
      }
      return;
    }

    // iOS ou navegadores sem suporte: mostrar instruções
    console.log('📖 Showing manual instructions');
    setShowDialog(true);
  };

  return (
    <>
      <Button
        onClick={handleInstallClick}
        className="w-full gap-2"
        variant="outline"
      >
        <Smartphone className="h-4 w-4" />
        Adicionar à Tela Inicial
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Como adicionar à tela inicial
            </DialogTitle>
          </DialogHeader>
          
          {isIOS ? (
            <DialogDescription className="space-y-4 text-left">
              <p className="font-medium">No iPhone/iPad:</p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Toque no botão de <strong>Compartilhar</strong> (ícone com seta para cima) no Safari</li>
                <li>Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong></li>
                <li>Toque em <strong>"Adicionar"</strong> no canto superior direito</li>
                <li>O ícone do Leva+ One aparecerá na sua tela inicial!</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-4">
                * Esta função só está disponível no navegador Safari
              </p>
            </DialogDescription>
          ) : (
            <DialogDescription className="space-y-4 text-left">
              <p className="font-medium">No Android:</p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Toque no <strong>menu</strong> (três pontos) no canto superior direito do navegador</li>
                <li>Selecione <strong>"Adicionar à tela inicial"</strong> ou <strong>"Instalar app"</strong></li>
                <li>Confirme tocando em <strong>"Adicionar"</strong></li>
                <li>O ícone do Leva+ One aparecerá na sua tela inicial!</li>
              </ol>
            </DialogDescription>
          )}
          
          <div className="flex justify-center pt-4">
            <Button onClick={() => setShowDialog(false)}>
              Entendi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
