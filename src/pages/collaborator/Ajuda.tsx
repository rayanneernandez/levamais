import { HelpViewer } from "@/components/help/HelpViewer";
import { Button } from "@/components/ui/button";
import { HeadphonesIcon } from "lucide-react";
import { useSupportTicket } from "@/contexts/SupportTicketContext";

const Ajuda = () => {
  const { openSupportDialog } = useSupportTicket();

  return (
    <div className="relative">
      <HelpViewer portalType="collaborator" />
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="lg"
          onClick={() => {
            openSupportDialog({
              rede: "Portal Colaborador",
              portal: 'Colaborador'
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

export default Ajuda;
