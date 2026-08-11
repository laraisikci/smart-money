import { useState } from 'react';
import { Activity, UserCircle2, Building2, Landmark, BarChart3 } from 'lucide-react';
import { ConvictionTab } from '@/components/ConvictionTab';
import { InsidersTab } from '@/components/InsidersTab';
import { InstitutionsTab } from '@/components/InstitutionsTab';
import { ParliamentTab } from '@/components/ParliamentTab';
import { PolymarketTab } from '@/components/PolymarketTab';
import { DataStatus } from '@/components/DataStatus';

type TabId = 'conviction' | 'insiders' | 'institutions' | 'parliament' | 'polymarket';

const TABS: { id: TabId; label: string; icon: typeof Activity }[] = [
  { id: 'conviction', label: 'Conviction', icon: Activity },
  { id: 'insiders', label: 'Insiders', icon: UserCircle2 },
  { id: 'institutions', label: 'Institutions', icon: Building2 },
  { id: 'parliament', label: 'Parliament', icon: Landmark },
  { id: 'polymarket', label: 'Markets', icon: BarChart3 },
];

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('conviction');

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-ink-950">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-ink-700/40 bg-ink-950/80 px-5 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-400/15">
              <Activity className="h-4.5 w-4.5 text-teal-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-ink-50">Smart Money</h1>
              <p className="text-2xs text-ink-500">Conviction Tracker</p>
            </div>
          </div>
          <DataStatus />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-5 py-5 pb-24">
        {activeTab === 'conviction' && <ConvictionTab />}
        {activeTab === 'insiders' && <InsidersTab />}
        {activeTab === 'institutions' && <InstitutionsTab />}
        {activeTab === 'parliament' && <ParliamentTab />}
        {activeTab === 'polymarket' && <PolymarketTab />}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-md border-t border-ink-700/40 bg-ink-900/90 backdrop-blur-lg">
        <div className="flex items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="tab-icon-btn flex-1 py-1.5"
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-teal-400/15 text-teal-300 shadow-[0_0_12px_-2px_rgba(45,212,191,0.4)]'
                      : 'text-ink-500'
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <span
                  className={`text-2xs font-medium transition-colors ${
                    isActive ? 'text-teal-300' : 'text-ink-500'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default App;
