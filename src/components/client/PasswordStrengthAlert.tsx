import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, ShieldAlert, ShieldX } from "lucide-react";

interface PasswordStrengthAlertProps {
  isPwned: boolean;
  timesFound: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export function PasswordStrengthAlert({ isPwned, timesFound, severity }: PasswordStrengthAlertProps) {
  if (!isPwned) return null;

  const getSeverityConfig = () => {
    switch (severity) {
      case 'critical':
        return {
          icon: ShieldX,
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/50',
          textColor: 'text-red-200',
          iconColor: 'text-red-400',
          message: 'CRÍTICO: Esta senha foi exposta em vazamentos massivos de dados',
        };
      case 'high':
        return {
          icon: ShieldAlert,
          bgColor: 'bg-orange-500/10',
          borderColor: 'border-orange-500/50',
          textColor: 'text-orange-200',
          iconColor: 'text-orange-400',
          message: 'ALTO RISCO: Esta senha foi encontrada em múltiplos vazamentos',
        };
      case 'medium':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/50',
          textColor: 'text-yellow-200',
          iconColor: 'text-yellow-400',
          message: 'RISCO MODERADO: Esta senha aparece em vazamentos de dados',
        };
      default:
        return {
          icon: AlertTriangle,
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/50',
          textColor: 'text-yellow-200',
          iconColor: 'text-yellow-400',
          message: 'ATENÇÃO: Esta senha foi encontrada em vazamentos',
        };
    }
  };

  const config = getSeverityConfig();
  const Icon = config.icon;

  return (
    <Alert className={`${config.bgColor} ${config.borderColor}`}>
      <Icon className={`h-4 w-4 ${config.iconColor}`} />
      <AlertDescription className={`text-sm ${config.textColor}`}>
        <strong>{config.message}</strong>
        <br />
        Esta senha apareceu <strong>{timesFound.toLocaleString('pt-BR')}</strong> vezes em vazamentos públicos.
        <br />
        <span className="text-xs">
          ⚠️ Recomendamos fortemente escolher uma senha diferente para sua segurança.
        </span>
      </AlertDescription>
    </Alert>
  );
}
