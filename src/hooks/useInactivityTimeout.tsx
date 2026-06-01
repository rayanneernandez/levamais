import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseInactivityTimeoutProps {
  timeoutMinutes: number;
  warningMinutes?: number;
  redirectPath: string;
}

export const useInactivityTimeout = ({ 
  timeoutMinutes, 
  warningMinutes = 2,
  redirectPath 
}: UseInactivityTimeoutProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showWarning, setShowWarning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const resetTimers = () => {
    // Limpar timers existentes
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    setShowWarning(false);

    // Timer de aviso (X minutos antes do logout)
    const warningMs = (timeoutMinutes - warningMinutes) * 60 * 1000;
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true);
      toast({
        title: "⚠️ Inatividade Detectada",
        description: `Você será desconectado em ${warningMinutes} minutos por inatividade.`,
        duration: 10000,
      });
    }, warningMs);

    // Timer de logout (tempo total)
    const timeoutMs = timeoutMinutes * 60 * 1000;
    timeoutRef.current = setTimeout(async () => {
      console.log('🔒 Logout automático por inatividade');
      
      toast({
        title: "🔒 Sessão Encerrada",
        description: "Você foi desconectado por inatividade.",
        variant: "destructive",
      });

      await supabase.auth.signOut();
      navigate(redirectPath);
    }, timeoutMs);
  };

  useEffect(() => {
    // Eventos que resetam o timer
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Adicionar listeners
    events.forEach(event => {
      document.addEventListener(event, resetTimers);
    });

    // Iniciar timers
    resetTimers();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimers);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, [timeoutMinutes, warningMinutes, redirectPath]);

  return { showWarning, resetTimers };
};
