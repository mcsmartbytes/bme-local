'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useEntity } from './EntityContext';
import { useFirm } from './FirmContext';
import { apiFetch } from '@/utils/apiFetch';

interface FeatureToggle {
  id?: string;
  entity_id: string;
  feature: string;
  is_enabled: boolean;
}

interface FeatureToggleContextType {
  features: FeatureToggle[];
  isFeatureEnabled: (feature: string) => boolean;
  toggleFeature: (feature: string, enabled: boolean) => Promise<void>;
  loading: boolean;
}

const FeatureToggleContext = createContext<FeatureToggleContextType>({
  features: [],
  isFeatureEnabled: () => false,
  toggleFeature: async () => {},
  loading: false,
});

export function FeatureToggleProvider({ children }: { children: ReactNode }) {
  const { currentEntityId } = useEntity();
  const { isBookkeeper } = useFirm();
  const [features, setFeatures] = useState<FeatureToggle[]>([]);
  const [loading, setLoading] = useState(false);

  // Load toggles when entity changes
  useEffect(() => {
    if (!currentEntityId) {
      setFeatures([]);
      return;
    }

    const loadToggles = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/feature-toggles?entity_id=${currentEntityId}`);
        const json = await res.json();

        if (json.success) {
          setFeatures(json.data || []);
        }
      } catch (error) {
        console.error('Failed to load feature toggles:', error);
      } finally {
        setLoading(false);
      }
    };

    loadToggles();
  }, [currentEntityId]);

  const isFeatureEnabled = useCallback(
    (feature: string): boolean => {
      // Bookkeeper version: payroll is always enabled
      if (isBookkeeper && feature === 'payroll') {
        return true;
      }

      const toggle = features.find((f) => f.feature === feature);
      return toggle?.is_enabled ?? false;
    },
    [features, isBookkeeper]
  );

  const toggleFeature = useCallback(
    async (feature: string, enabled: boolean): Promise<void> => {
      if (!currentEntityId) return;

      try {
        const res = await apiFetch('/api/feature-toggles', {
          method: 'POST',
          body: JSON.stringify({
            entity_id: currentEntityId,
            feature,
            is_enabled: enabled,
          }),
        });

        const json = await res.json();

        if (json.success) {
          setFeatures((prev) => {
            const existing = prev.findIndex((f) => f.feature === feature);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = { ...updated[existing], is_enabled: enabled };
              return updated;
            }
            return [...prev, { entity_id: currentEntityId, feature, is_enabled: enabled }];
          });
        }
      } catch (error) {
        console.error('Failed to toggle feature:', error);
        throw error;
      }
    },
    [currentEntityId]
  );

  return (
    <FeatureToggleContext.Provider
      value={{ features, isFeatureEnabled, toggleFeature, loading }}
    >
      {children}
    </FeatureToggleContext.Provider>
  );
}

export function useFeatureToggle() {
  return useContext(FeatureToggleContext);
}
