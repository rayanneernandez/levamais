import { useState } from "react";

export type DrillDownType = 
  | 'totalClients' 
  | 'conversionRate' 
  | 'averageTicket' 
  | 'activePoints'
  | 'newClients'
  | 'retentionRate'
  | 'purchaseFrequency'
  | 'redeemedValue'
  | null;

export const useDrillDown = () => {
  const [drillDownCard, setDrillDownCard] = useState<DrillDownType>(null);
  const [drillDownLoading, setDrillDownLoading] = useState(false);

  const openDrillDown = (type: DrillDownType) => {
    setDrillDownCard(type);
  };

  const closeDrillDown = () => {
    setDrillDownCard(null);
  };

  return {
    drillDownCard,
    drillDownLoading,
    setDrillDownLoading,
    openDrillDown,
    closeDrillDown,
  };
};
