import React from 'react';
import { User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import logoImg from '../assets/logo.jpeg';

export type WorkspaceTab = 'dashboard' | 'devices' | 'acquisition' | 'evidence' | 'settings';

interface ContextHeaderProps {
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;
}

export const ContextHeader: React.FC<ContextHeaderProps> = ({
  activeTab,
  setActiveTab,
}) => {
  const { officer } = useAuthStore();

  const navTabs: { id: WorkspaceTab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'devices', label: 'Devices' },
    { id: 'acquisition', label: 'Acquisition' },
    { id: 'evidence', label: 'Evidence' },
    { id: 'settings', label: 'Profile & Settings' },
  ];

  return (
    <header className="h-14 py-2 px-3 sm:px-5 pl-20 sm:pl-24 glass-panel rounded-full flex items-center justify-between gap-3 z-40 select-none w-full shadow-lg titlebar-drag-region">
      
      {/* Left: Brand with Official Frontend Logo (Shifted right of traffic light buttons with pl-20) */}
      <div className="flex items-center gap-2.5 shrink-0 no-drag">
        <div className="w-8 h-8 rounded-full bg-white p-1 flex items-center justify-center shrink-0 shadow-md ring-2 ring-white/40 overflow-hidden">
          <img
            src={logoImg}
            alt="CopSight Logo"
            className="w-full h-full object-contain rounded-full"
          />
        </div>
        <div className="hidden sm:block shrink-0">
          <span className="text-sm font-extrabold tracking-tight uppercase text-white block leading-tight">CopSight AI</span>
          <p className="text-[9px] uppercase tracking-widest opacity-75 text-white leading-tight">Forensic OS</p>
        </div>
      </div>

      {/* Center: Navigation Menu Bar with Balanced Spacing and Coral Highlighting */}
      <nav className="flex items-center gap-1 p-1 rounded-full bg-black/25 dark:bg-white/10 border border-white/15 shadow-inner overflow-x-auto no-drag shrink">
        {navTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-[#FF7A59] text-white shadow-md font-bold scale-[1.02] dark:bg-white dark:text-black'
                  : 'text-white/80 hover:text-white hover:bg-white/10 dark:text-white/70 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Right: Quick Officer Profile Avatar */}
      <div className="flex items-center gap-2.5 shrink-0 no-drag">
        <button
          onClick={() => setActiveTab('settings')}
          className="flex items-center gap-2.5 cursor-pointer group"
          title="Open Profile & Settings"
        >
          <div className="text-right hidden xl:block">
            <div className="text-xs font-bold text-white group-hover:text-[#FF7A59] transition-colors leading-tight">
              {officer?.fullName || officer?.username || 'Officer'}
            </div>
            <div className="text-[9px] font-mono text-white opacity-75 leading-tight">
              #{officer?.badgeNumber || '7482'}
            </div>
          </div>

          <div className="w-8 h-8 rounded-full bg-white/20 dark:bg-white/10 border-2 border-white/30 flex items-center justify-center text-white overflow-hidden group-hover:border-[#FF7A59] transition-all shadow-md">
            {officer?.avatarUrl ? (
              <img src={officer.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4" />
            )}
          </div>
        </button>
      </div>

    </header>
  );
};
