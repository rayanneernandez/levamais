import { createContext, useContext, useState, ReactNode } from "react";

interface StoreFilterContextType {
  selectedStore: string;
  setSelectedStore: (store: string) => void;
}

const StoreFilterContext = createContext<StoreFilterContextType | undefined>(undefined);

export function StoreFilterProvider({ children }: { children: ReactNode }) {
  const [selectedStore, setSelectedStore] = useState<string>("all");

  return (
    <StoreFilterContext.Provider value={{ selectedStore, setSelectedStore }}>
      {children}
    </StoreFilterContext.Provider>
  );
}

export function useStoreFilter() {
  const context = useContext(StoreFilterContext);
  if (!context) {
    throw new Error("useStoreFilter must be used within StoreFilterProvider");
  }
  return context;
}
