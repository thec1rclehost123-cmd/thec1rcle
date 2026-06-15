'use client';

import { useState } from 'react';
import { Settings, UserCircle, Bell, Shield, Info } from 'lucide-react';
import { VenuePageShell } from '@/components/venue-layout/VenuePageShell';
import { HubTabBar } from '@/components/shared/HubTabBar';
import { useHubTab } from '@/lib/hooks/useHubTab';
import GeneralSettings from './PageClient';
import PersonaSettings from '../persona/PageClient';

const SETTINGS_TABS = [
  { key: 'general', label: 'General', icon: Settings },
  { key: 'persona', label: 'Persona', icon: UserCircle },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'security', label: 'Security', icon: Shield },
];

export default function PromoterSettingsHub() {
  const { activeTab, setTab } = useHubTab('general');
  const [actions, setActions] = useState<React.ReactNode>(null);

  return (
    <VenuePageShell
      title="Promoter Settings"
      subtitle="Global configuration for your promoter identity and performance"
      actions={actions}
    >
      <div className="space-y-8">
        <HubTabBar tabs={SETTINGS_TABS} activeTab={activeTab} onTabChange={setTab} />

        <div className="min-h-[600px]">
          {activeTab === 'general' && (
            <GeneralSettings setActions={setActions} activeTab={activeTab} />
          )}
          {activeTab === 'persona' && <PersonaSettings setActions={setActions} />}
          {activeTab === 'notifications' && (
            <GeneralSettings setActions={setActions} activeTab="notifications" />
          )}
          {activeTab === 'security' && (
            <GeneralSettings setActions={setActions} activeTab="security" />
          )}
        </div>
      </div>
    </VenuePageShell>
  );
}
