import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Store, Banknote, ShowerHead, Flag, ParkingCircle, Droplets, Wrench, PlugZap, Toilet, Fuel } from "lucide-react";

interface StoreCardProps {
  store: {
    id: string;
    name: string;
    address: string;
    flag?: string | null;
    services?: string[] | null;
  };
}

// Remove CEP (formato: 00000-000) from address and clean up extra commas
const formatAddress = (address: string): string => {
  // Remove CEP pattern (5 digits + hyphen + 3 digits)
  let cleaned = address.replace(/\s*-?\s*\d{5}-?\d{3}\s*,?\s*$/g, '').trim();
  // Remove trailing commas
  cleaned = cleaned.replace(/,\s*$/, '');
  // Remove double commas
  cleaned = cleaned.replace(/,\s*,/g, ',');
  return cleaned;
};

const flagColors: Record<string, { bg: string; text: string; border: string; label: string }> = {
  ipiranga: { 
    bg: "bg-blue-600", 
    text: "text-yellow-400", 
    border: "border-blue-700", 
    label: "Ipiranga"
  },
  shell: { 
    bg: "bg-yellow-400", 
    text: "text-red-600", 
    border: "border-yellow-500", 
    label: "Shell"
  },
  vibra: { 
    bg: "bg-green-600", 
    text: "text-white", 
    border: "border-green-700", 
    label: "Vibra" 
  },
  ale: { 
    bg: "bg-blue-600", 
    text: "text-red-500", 
    border: "border-blue-700", 
    label: "Ale"
  },
  branca: { 
    bg: "bg-muted", 
    text: "text-foreground", 
    border: "border-border", 
    label: "Bandeira Própria" 
  },
};

const serviceIcons: Record<string, { icon: React.ReactNode; label: string; order: number }> = {
  conveniencia: { icon: <Store className="h-4 w-4" />, label: "Conveniência", order: 1 },
  totem_eletrico: { icon: <PlugZap className="h-4 w-4" />, label: "Totem Elétrico", order: 2 },
  caixa_24h: { icon: <Banknote className="h-4 w-4" />, label: "Caixa 24h", order: 3 },
  troca_oleo: { icon: <Wrench className="h-4 w-4" />, label: "Troca de Óleo", order: 4 },
  banheiro: { icon: <Toilet className="h-4 w-4" />, label: "Banheiro", order: 5 },
  chuveiro: { icon: <ShowerHead className="h-4 w-4" />, label: "Chuveiro", order: 6 },
  estacionamento: { icon: <ParkingCircle className="h-4 w-4" />, label: "Estacionamento", order: 7 },
  lava_jato: { icon: <Droplets className="h-4 w-4" />, label: "Lava Jato", order: 8 },
};

export function StoreCard({ store }: StoreCardProps) {
  const flagStyle = store.flag && store.flag !== 'none' ? flagColors[store.flag] : null;
  const displayAddress = formatAddress(store.address);
  const isGasStation = store.name.toLowerCase().startsWith('posto');
  const MainIcon = isGasStation ? Fuel : Store;

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <MainIcon className="h-5 w-5 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-2">
            <h3 className="font-semibold text-base flex-1">{store.name}</h3>
            
            {flagStyle && (
              <Badge 
                variant="outline" 
                className={`${flagStyle.bg} ${flagStyle.text} ${flagStyle.border} border flex items-center gap-1.5`}
              >
                <Flag className="h-3 w-3" />
                {flagStyle.label}
              </Badge>
            )}
          </div>
          
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground mb-3">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span className="line-clamp-2">{displayAddress}</span>
          </div>

          {store.services && store.services.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {store.services
                .sort((a, b) => {
                  const orderA = serviceIcons[a]?.order ?? 999;
                  const orderB = serviceIcons[b]?.order ?? 999;
                  return orderA - orderB;
                })
                .map((serviceId) => {
                  const service = serviceIcons[serviceId];
                  if (!service) return null;
                  
                  return (
                    <div
                      key={serviceId}
                      className="group relative"
                    >
                      <div className="h-8 w-8 rounded-md bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors cursor-help">
                        {service.icon}
                      </div>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                        {service.label}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
