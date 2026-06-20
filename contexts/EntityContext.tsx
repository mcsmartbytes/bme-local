'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useFirm } from './FirmContext';
import { apiFetch } from '@/utils/apiFetch';

interface Entity {
  id: string;
  name: string;
  legal_name: string;
  entity_type: string;
  tax_id: string;
  is_active: number;
  organization_id: string;
  state?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  zip?: string | null;
}

interface Organization {
  id: string;
  name: string;
}

interface EntityContextType {
  currentEntityId: string | null;
  currentEntity: Entity | null;
  entities: Entity[];
  organization: Organization | null;
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

const STORAGE_KEY = 'bme_selected_entity_id';

export function EntityProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isBookkeeper, selectedClient } = useFirm();
  const [currentEntityId, setCurrentEntityId] = useState<string | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const currentEntity = currentEntityId
    ? entities.find((e) => e.id === currentEntityId) || null
    : null;

  const isConsolidated = currentEntityId === null;

  // Only load entities once session is authenticated
  // Reload entities when auth is ready, or when bookkeeper switches clients
  useEffect(() => {
    if (authLoading || !user) return;
    // For bookkeepers: only load when a client is selected
    if (isBookkeeper && !selectedClient) {
      setEntities([]);
      setOrganization(null);
      setLoaded(true);
      return;
    }

    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored && stored !== 'all') {
      setCurrentEntityId(stored);
    }
    setLoaded(false); // reset to force reload
    loadEntities();
  }, [authLoading, user, isBookkeeper, selectedClient]);

  const loadEntities = async () => {
    const userId = user?.id;
    if (!userId) return;

    setLoading(true);
    try {
      // For bookkeepers, use the selected client's organization directly
      let org;
      if (isBookkeeper && selectedClient?.organizations) {
        org = selectedClient.organizations;
      } else {
        const orgRes = await apiFetch('/api/organizations');
        const orgResult = await orgRes.json();

        if (!orgResult.success || !orgResult.data?.length) {
          setLoaded(true);
          setLoading(false);
          return;
        }
        org = orgResult.data[0];
      }
      setOrganization(org);

      const entRes = await apiFetch(`/api/entities?organization_id=${org.id}`);
      const entResult = await entRes.json();

      if (entResult.success) {
        const entityList = entResult.data || [];
        setEntities(entityList);

        const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        if (stored && stored !== 'all') {
          const exists = entityList.some((e: Entity) => e.id === stored);
          if (!exists && entityList.length > 0) {
            // Stored entity no longer valid for this org — auto-select first
            setCurrentEntityId(entityList[0].id);
            localStorage.setItem(STORAGE_KEY, entityList[0].id);
          }
        } else if (entityList.length > 0 && (!stored || stored === 'all')) {
          // No entity was previously selected — default to first
          setCurrentEntityId(entityList[0].id);
          localStorage.setItem(STORAGE_KEY, entityList[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load entities:', error);
    } finally {
      setLoaded(true);
      setLoading(false);
    }
  };

  const setCurrentEntity = (entityId: string | null) => {
    setCurrentEntityId(entityId);
    if (entityId) {
      localStorage.setItem(STORAGE_KEY, entityId);
    } else {
      localStorage.setItem(STORAGE_KEY, 'all');
    }
  };

  const refreshEntities = async () => {
    setLoaded(false);
    await loadEntities();
  };

  return (
    <EntityContext.Provider
      value={{
        currentEntityId,
        currentEntity,
        entities,
        organization,
        setCurrentEntity,
        isConsolidated,
        loading,
        refreshEntities,
      }}
    >
      {children}
    </EntityContext.Provider>
  );
}

export function useEntity() {
  return useContext(EntityContext);
}
