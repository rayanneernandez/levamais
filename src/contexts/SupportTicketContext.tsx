import { createContext, useContext, useState, ReactNode } from "react";
import { NewTicketDialog } from "@/components/admin/NewTicketDialog";

interface SupportTicketContextType {
  openSupportDialog: (prefilled?: { rede?: string; portal?: string }) => void;
}

const SupportTicketContext = createContext<SupportTicketContextType | undefined>(undefined);

export function SupportTicketProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefilledData, setPrefilledData] = useState<{ rede?: string; portal?: string }>({});

  const openSupportDialog = (prefilled?: { rede?: string; portal?: string }) => {
    if (prefilled) {
      setPrefilledData(prefilled);
    }
    setIsOpen(true);
  };

  return (
    <SupportTicketContext.Provider value={{ openSupportDialog }}>
      {children}
      <NewTicketDialog 
        open={isOpen} 
        onOpenChange={setIsOpen}
        prefilledData={prefilledData}
      />
    </SupportTicketContext.Provider>
  );
}

export function useSupportTicket() {
  const context = useContext(SupportTicketContext);
  if (!context) {
    throw new Error("useSupportTicket must be used within SupportTicketProvider");
  }
  return context;
}
