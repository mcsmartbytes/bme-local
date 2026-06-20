'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { FirmProvider } from '@/contexts/FirmContext';
import { UserModeProvider } from '@/contexts/UserModeContext';
import { EntityProvider } from '@/contexts/EntityContext';
import { FeatureToggleProvider } from '@/contexts/FeatureToggleContext';

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <FirmProvider>
        <UserModeProvider>
          <EntityProvider>
            <FeatureToggleProvider>
              {children}
            </FeatureToggleProvider>
          </EntityProvider>
        </UserModeProvider>
      </FirmProvider>
    </AuthProvider>
  );
}
