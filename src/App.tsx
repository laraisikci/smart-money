import { useState } from 'react';
import { Activity, UserCircle2, Building2, HeartPulse, BarChart3 } from 'lucide-react';
import { ConvictionTab } from '@/components/ConvictionTab';
import { InsidersTab } from '@/components/InsidersTab';
import { InstitutionsTab } from '@/components/InstitutionsTab';
import { PulseTab } from '@/components/PulseTab';
import { PolymarketTab } from '@/components/PolymarketTab';
import { DataStatus } from '@/components/DataStatus';

type TabId = 'conviction' | 'insiders' | 'institutions' | 'pulse' | 'polymarket';

const TABS: { id: TabId; label: string; icon: typeof Activity }[] = [
  { id: 'conviction', label: 'Conviction', icon: Activity },
  { id: 'insiders', label: 'Insiders', icon: UserCircle2 },
  { id: 'institutions', label: 'Institutions', icon: Building2 },
  { id: 'pulse', label: 'Pulse', icon: HeartPulse },
  { id: 'polymarket', label: 'Markets', icon: BarChart3 },
];

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('conviction');

  return (
    <div className="min-h-screen bg-ink-950 lg:flex">
      {/* Desktop sidebar — hidden under the lg: breakpoint, bottom nav (below) takes over there */}
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-ink-700/40 lg:bg-ink-900/40 lg:p-4">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-400/15">
            <Activity className="h-4.5 w-4.5 text-teal-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-ink-50">Smart Money</h1>
            <p className="text-2xs text-ink-500">Conviction Tracker</p>
          </div>
        </div>
        <nav className="mt-6 flex flex-col gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-teal-400/15 text-teal-300 shadow-[0_0_12px_-2px_rgba(45,212,191,0.4)]'
                    : 'text-ink-400 hover:bg-ink-800/60 hover:text-ink-100'
                }`}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="mx-auto flex min-h-screen max-w-md flex-col lg:mx-0 lg:max-w-none lg:flex-1">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-ink-700/40 bg-ink-950/80 px-5 py-3 backdrop-blur-md lg:px-8">
          <div className="flex items-center justify-between lg:mx-auto lg:max-w-5xl">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-400/15">
                <Activity className="h-4.5 w-4.5 text-teal-400" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-ink-50">Smart Money</h1>
                <p className="text-2xs text-ink-500">Conviction Tracker</p>
              </div>
            </div>
            <h2 className="hidden text-sm font-semibold text-ink-100 lg:block">
              {TABS.find((t) => t.id === activeTab)?.label}
            </h2>
            <DataStatus />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-5 py-5 pb-24 lg:mx-auto lg:w-full lg:max-w-5xl lg:px-8 lg:py-8 lg:pb-8">
          {activeTab === 'conviction' && <ConvictionTab />}
          {activeTab === 'insiders' && <InsidersTab />}
          {activeTab === 'institutions' && <InstitutionsTab />}
          {activeTab === 'pulse' && <PulseTab />}
          {activeTab === 'polymarket' && <PolymarketTab />}
        </main>

        {/* Bottom navigation — mobile/tablet only, the sidebar above takes over at lg: */}
        <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-ink-700/40 bg-ink-900/90 backdrop-blur-lg lg:hidden">
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
    </div>
  );
}

export default App;
