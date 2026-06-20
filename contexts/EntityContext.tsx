'use client';

import { createContext, useContext, ReactNode } from 'react';

export interface Entity {
  id: string;
  name: string;
  entity_type: string;
}

interface EntityContextType {
  currentEntityId: string | null;
  currentEntity: Entity | null;
  entities: Entity[];
  organization: null;
  setCurrentEntity: (entityId: string | null) => void;
  isConsolidated: boolean;
  loading: boolean;
  refreshEntities: () => Promise<void>;
}

const EntityContext = createContext<EntityContextType>({
  currentEntityId: null,
  currentEntity: null,
  entities: [],
  organization: null,
  setCurrentEntity: () => {},
  isConsolidated: true,
  loading: false,
  refreshEntities: async () => {},
});

export function EntityProvider({ children }: { children: ReactNode }) {
  return (
    <EntityContext.Provider value={{
      currentEntityId: null,
      currentEntity: null,
      entities: [],
      organization: null,
      setCurrentEntity: () => {},
      isConsolidated: true,
      loading: false,
      refreshEntities: async () => {},
    }}>
      {children}
    </EntityContext.Provider>
  );
}

export function useEntity() {
  return useContext(EntityContext);
}