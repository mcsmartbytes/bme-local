'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

/** Local single-bookkeeper mode — firm multi-client UI deferred to Sprint 4. */
interface FirmClient {
  id: string;
  firm_id: string;
  organization_id: string;
  status: 'active' | 'inactive' | 'onboarding';
  added_at: string;
  notes: string | null;
  entity_count: number;
  organizations: { id: string; name: string; industry_id: string | null; multi_entity: boolean; multi_location: boolean } | null;
}

interface FirmContextType {
  firm: null;
  isBookkeeper: boolean;
  clients: FirmClient[];
  selectedClient: FirmClient | null;
  isViewingOwnBooks: boolean;
  loading: boolean;
  selectClient: (client: FirmClient) => void;
  clearClient: () => void;
  viewOwnBooks: () => void;
  refreshClients: () => Promise<void>;
}

const FirmContext = createContext<FirmContextType | undefined>(undefined);

export function FirmProvider({ children }: { children: ReactNode }) {
  const [selectedClient] = useState<FirmClient | null>(null);

  return (
    <FirmContext.Provider value={{
      firm: null,
      isBookkeeper: false,
      clients: [],
      selectedClient,
      isViewingOwnBooks: true,
      loading: false,
      selectClient: () => {},
      clearClient: () => {},
      viewOwnBooks: () => {},
      refreshClients: async () => {},
    }}>
      {children}
    </FirmContext.Provider>
  );
}

export function useFirm() {
  const ctx = useContext(FirmContext);
  if (!ctx) throw new Error('useFirm must be used within FirmProvider');
  return ctx;
}