import { HelpViewer } from "@/components/help/HelpViewer";
import { Button } from "@/components/ui/button";
import { HeadphonesIcon } from "lucide-react";
import { useSupportTicket } from "@/contexts/SupportTicketContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const ClientHelp = () => {
  const { openSupportDialog } = useSupportTicket();
  const [networkName, setNetworkName] = useState("Cliente");

  useEffect(() => {
    const loadNetworkName = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: clientData } = await supabase
        .from('clients')
        .select('network_id, networks(name)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (clientData?.networks) {
        setNetworkName((clientData.networks as any).name);
      }
    };

    loadNetworkName();
  }, []);

  return (
    <div className="relative">
      <HelpViewer portalType="client" />
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="lg"
          onClick={() => {
            openSupportDialog({
              rede: networkName,
              portal: 'Cliente'
            });
          }}
          className="rounded-full shadow-lg hover:shadow-xl transition-all"
        >
          <HeadphonesIcon className="h-5 w-5 mr-2" />
          Abrir Suporte
        </Button>
      </div>
    </div>
  );
};

export default ClientHelp;
