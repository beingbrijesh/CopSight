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
    <header className="min-h-16 py-2.5 px-6 glass-panel rounded-[2.5rem] flex flex-wrap items-center justify-between gap-4 z-30 select-none mx-auto max-w-[1800px] shadow-lg">
      
      {/* Left: Brand with Official Frontend Logo (Always White Background) */}
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-full bg-white p-1 flex items-center justify-center shrink-0 shadow-md ring-2 ring-white/40 overflow-hidden">
          <img
            src={logoImg}
            alt="CopSight Logo"
            className="w-full h-full object-contain rounded-full"
          />
        </div>
        <div>
          <span className="text-base font-extrabold tracking-tight uppercase text-white block">CopSight AI</span>
          <p className="text-[10px] uppercase tracking-widest opacity-75 text-white">Forensic OS</p>
        </div>
      </div>

      {/* Center: Navigation Menu Bar with Balanced Spacing and Coral Highlighting */}
      <nav className="flex items-center gap-1.5 p-1.5 rounded-full bg-black/25 dark:bg-white/10 border border-white/15 mx-auto shadow-inner">
        {navTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer ${
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

      {/* Right: Quick Officer Profile Avatar (No Theme Toggle in header) */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setActiveTab('settings')}
          className="flex items-center gap-3 cursor-pointer group"
          title="Open Profile & Settings"
        >
          <div className="text-right hidden xl:block">
            <div className="text-xs font-bold text-white group-hover:text-[#FF7A59] transition-colors">
              {officer?.fullName || officer?.username || 'Investigating Officer'}
            </div>
            <div className="text-[9.5px] uppercase tracking-wider opacity-75 text-white">
              {officer?.rank || officer?.role?.replace('_', ' ') || 'Authorized IO'}
            </div>
          </div>

          <div className="w-10 h-10 rounded-full bg-white/20 dark:bg-white/10 border-2 border-white/30 flex items-center justify-center text-white overflow-hidden group-hover:border-[#FF7A59] transition-all shadow-md">
            {officer?.avatarUrl ? (
              <img src={officer.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5" />
            )}
          </div>
        </button>
      </div>

    </header>
  );
};
