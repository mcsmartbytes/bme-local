'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from './AuthContext';
import { apiFetch } from '@/utils/apiFetch';

interface Firm {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
}

interface FirmClient {
  id: string;
  firm_id: string;
  organization_id: string;
  status: 'active' | 'inactive' | 'onboarding';
  added_at: string;
  notes: string | null;
  entity_count: number;
  organizations: {
    id: string;
    name: string;
    industry_id: string | null;
    multi_entity: boolean;
    multi_location: boolean;
  } | null;
}

interface FirmContextType {
  firm: Firm | null;
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

const SELECTED_CLIENT_KEY = 'bme_selected_client_id';
const OWN_BOOKS_KEY = 'bme_viewing_own_books';

export function FirmProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [firm, setFirm] = useState<Firm | null>(null);
  const [clients, setClients] = useState<FirmClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<FirmClient | null>(null);
  const [isViewingOwnBooks, setIsViewingOwnBooks] = useState<boolean>(
    typeof window !== 'undefined' && localStorage.getItem(OWN_BOOKS_KEY) === '1'
  );
  const [loading, setLoading] = useState(true);

  const isBookkeeper = !!firm;

  // Load firm data when user is available
  useEffect(() => {
    if (authLoading || !user) {
      setLoading(false);
      return;
    }

    const loadFirm = async () => {
      try {
        const res = await apiFetch('/api/firms');
        const json = await res.json();

        if (json.success && json.data) {
          setFirm(json.data);
          await loadClients();
        } else {
          setFirm(null);
        }
      } catch {
        setFirm(null);
      } finally {
        setLoading(false);
      }
    };

    loadFirm();
  }, [user, authLoading]);

  const loadClients = async () => {
    try {
      const res = await apiFetch('/api/firms/clients');
      const json = await res.json();

      if (json.success) {
        setClients(json.data || []);

        // Restore previously selected client from localStorage
        const savedId = localStorage.getItem(SELECTED_CLIENT_KEY);
        if (savedId && json.data) {
          const saved = json.data.find((c: FirmClient) => c.id === savedId);
          if (saved) setSelectedClient(saved);
        }
      }
    } catch {
      setClients([]);
    }
  };

  const refreshClients = useCallback(async () => {
    await loadClients();
  }, []);

  // Redirect bookkeepers to firm dashboard when no client is selected
  useEffect(() => {
    if (loading || authLoading) return;
    if (!isBookkeeper) return;

    const isDashboardRoute = pathname.startsWith('/dashboard');
    const isFirmRoute = pathname.startsWith('/firm-dashboard');

    if (isDashboardRoute && !selectedClient && !isViewingOwnBooks) {
      router.push('/firm-dashboard');
    }

    if (isFirmRoute && selectedClient) {
      router.push('/dashboard');
    }
  }, [isBookkeeper, selectedClient, isViewingOwnBooks, pathname, loading, authLoading, router]);

  const selectClient = (client: FirmClient) => {
    setSelectedClient(client);
    localStorage.setItem(SELECTED_CLIENT_KEY, client.id);
    setIsViewingOwnBooks(false);
    localStorage.removeItem(OWN_BOOKS_KEY);
    router.push('/dashboard');
  };

  const clearClient = () => {
    setSelectedClient(null);
    localStorage.removeItem(SELECTED_CLIENT_KEY);
    setIsViewingOwnBooks(false);
    localStorage.removeItem(OWN_BOOKS_KEY);
    router.push('/firm-dashboard');
  };

  const viewOwnBooks = () => {
    setSelectedClient(null);
    localStorage.removeItem(SELECTED_CLIENT_KEY);
    setIsViewingOwnBooks(true);
    localStorage.setItem(OWN_BOOKS_KEY, '1');
    router.push('/dashboard');
  };

  return (
    <FirmContext.Provider value={{
      firm, isBookkeeper, clients, selectedClient, isViewingOwnBooks,
      loading, selectClient, clearClient, viewOwnBooks, refreshClients,
    }}>
      {children}
    </FirmContext.Provider>
  );
}

export function useFirm() {
  const context = useContext(FirmContext);
  if (context === undefined) {
    throw new Error('useFirm must be used within a FirmProvider');
  }
  return context;
}
