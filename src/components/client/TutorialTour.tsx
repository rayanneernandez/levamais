import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Award, Zap, History, Store, ChevronRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TutorialTourProps {
  open: boolean;
  onComplete: () => void;
  userId: string;
}

interface TutorialStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  details: string[];
}

const tutorialSteps: TutorialStep[] = [
  {
    title: "Bem-vindo ao seu Portal!",
    description: "Vamos fazer um tour rápido pelas principais funcionalidades",
    icon: <Award className="h-12 w-12 text-primary" />,
    details: [
      "Este tour vai te ajudar a conhecer todas as funcionalidades",
      "São apenas 4 passos rápidos",
      "Você pode pular o tour a qualquer momento"
    ]
  },
  {
    title: "Seu Saldo de Cashback",
    description: "Acompanhe quanto você acumulou",
    icon: <Award className="h-12 w-12 text-primary" />,
    details: [
      "No topo da página você vê seu saldo total de cashback",
      "O cashback é acumulado automaticamente em cada compra",
      "Pontos próximos de expirar aparecem com destaque"
    ]
  },
  {
    title: "Resgate Ativo",
    description: "Configure o resgate automático",
    icon: <Zap className="h-12 w-12 text-amber-500" />,
    details: [
      "Ative para usar seu cashback automaticamente no PDV",
      "Quando atingir o valor mínimo, é descontado na sua compra",
      "Desative se preferir controlar manualmente seus resgates"
    ]
  },
  {
    title: "Histórico de Transações",
    description: "Veja todas as suas movimentações",
    icon: <History className="h-12 w-12 text-blue-500" />,
    details: [
      "Acompanhe cada acúmulo e resgate de cashback",
      "Veja em qual loja cada transação foi realizada",
      "Use os filtros para encontrar transações específicas"
    ]
  },
  {
    title: "Lojas da Rede",
    description: "Encontre onde usar seu cashback",
    icon: <Store className="h-12 w-12 text-green-500" />,
    details: [
      "Veja todas as lojas onde você pode acumular e resgatar",
      "Clique em 'Ver no mapa' para localizar lojas próximas",
      "Todas as lojas da rede aceitam seu cashback"
    ]
  }
];

export function TutorialTour({ open, onComplete, userId }: TutorialTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const { toast } = useToast();

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = async () => {
    await markTutorialAsCompleted();
    onComplete();
  };

  const handleComplete = async () => {
    await markTutorialAsCompleted();
    onComplete();
  };

  const markTutorialAsCompleted = async () => {
    setIsCompleting(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ tutorial_completed: true })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Tutorial concluído!",
        description: "Agora você conhece todas as funcionalidades principais.",
      });
    } catch (error: any) {
      console.error('Error marking tutorial as completed:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  const currentStepData = tutorialSteps[currentStep];
  const isLastStep = currentStep === tutorialSteps.length - 1;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            {currentStepData.icon}
          </div>
          <DialogTitle className="text-center text-2xl">
            {currentStepData.title}
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            {currentStepData.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {currentStepData.details.map((detail, index) => (
            <div key={index} className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">{detail}</p>
            </div>
          ))}
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {tutorialSteps.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all ${
                index === currentStep
                  ? "w-8 bg-primary"
                  : index < currentStep
                  ? "w-2 bg-primary"
                  : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={isCompleting}
          >
            Pular tour
          </Button>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={() => setCurrentStep(currentStep - 1)}
                disabled={isCompleting}
              >
                Voltar
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={isCompleting}
              className="gap-2"
            >
              {isLastStep ? "Concluir" : "Próximo"}
              {!isLastStep && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
