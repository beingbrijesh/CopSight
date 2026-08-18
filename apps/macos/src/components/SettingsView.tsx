import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  FolderKey,
  Server,
  RefreshCw,
  LogOut,
  Camera,
  CheckCircle2,
  Sun,
  Moon,
  Laptop,
  Palette,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useCaseStore } from '../store/caseStore';
import { useDaemonStore } from '../store/daemonStore';
import { daemonClient } from '../lib/daemonClient';
import { loggerService } from '../lib/loggerService';

interface SettingsViewProps {
  onSwitchCase: () => void;
  onOpenAdminAudit?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onSwitchCase, onOpenAdminAudit }) => {
  const { officer, updateOfficer, logout } = useAuthStore();
  const { selectedCase } = useCaseStore();
  const { isDaemonConnected, isScanning } = useDaemonStore();

  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>('system');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [fullName, setFullName] = useState(officer?.fullName || '');
  const [rank, setRank] = useState(officer?.rank || 'Forensic Inspector');
  const [badgeNumber, setBadgeNumber] = useState(officer?.badgeNumber || '7482');
  const [unit, setUnit] = useState(officer?.unit || 'Cyber Crime Division');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'online' | 'offline'>('idle');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTestDaemon = async () => {
    setTestStatus('testing');
    loggerService.event('DAEMON', 'Test Socket Connection', 'INITIATED', 'Testing RPC socket communication on 127.0.0.1:54322...');
    const isOnline = await daemonClient.checkHealth();
    if (isOnline) {
      setTestStatus('online');
      loggerService.event('DAEMON', 'Test Socket Connection', 'SUCCESS', 'Socket responded with HTTP 200 OK (Daemon healthy).');
    } else {
      setTestStatus('offline');
      loggerService.event('DAEMON', 'Test Socket Connection', 'FAILED', 'Daemon connection failed on 127.0.0.1:54322.');
    }
    setTimeout(() => setTestStatus('idle'), 3500);
  };

  useEffect(() => {
    const saved = localStorage.getItem('copsight_theme');
    if (saved === 'dark' || saved === 'light' || saved === 'system') {
      setThemeMode(saved);
    } else {
      setThemeMode('system');
    }
  }, []);

  const handleSetTheme = (mode: 'system' | 'light' | 'dark') => {
    setThemeMode(mode);
    localStorage.setItem('copsight_theme', mode);
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (mode === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    loggerService.event('UI', 'Theme Customization', 'SUCCESS', `Station theme configured to "${mode}".`);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateOfficer({
      fullName,
      rank,
      badgeNumber,
      unit,
    });
    setSaveSuccess(true);
    loggerService.event('AUTH', 'Save Investigator Profile', 'SUCCESS', `Persisted updated officer profile: ${fullName} (${rank}, #${badgeNumber}, ${unit})`);
    setTimeout(() => setSaveSuccess(false), 3000);
    setIsEditingProfile(false);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        updateOfficer({ avatarUrl: base64 });
        loggerService.event('AUTH', 'Upload Avatar', 'SUCCESS', `Updated profile avatar image (${(file.size / 1024).toFixed(1)} KB).`);
      };
      reader.readAsDataURL(file);
    }
  };

  const avatarPresets = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-fadeIn pb-10">
      
      {/* Title */}
      <div>
        <h2 className="text-3xl font-light text-white tracking-tight">Investigator Profile & Station Settings</h2>
        <p className="text-xs opacity-75 text-white mt-1">
          Manage officer credentials, active case assignment, theme customization, and forensic daemon state.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2 shadow-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Profile credentials updated and cryptographically persisted successfully.</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Column (Span 6): Officer Profile Card */}
        <div className="xl:col-span-6 glass-panel rounded-[2rem] p-6 sm:p-8 space-y-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                {/* Avatar with Camera Trigger */}
                <div className="relative group">
                  <div className="w-20 h-20 rounded-full bg-white/20 dark:bg-white/10 border-2 border-white/40 flex items-center justify-center text-white overflow-hidden shadow-xl">
                    {officer?.avatarUrl ? (
                      <img src={officer.avatarUrl} alt="Officer Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 opacity-80" />
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2 rounded-full bg-[#FF7A59] text-white shadow-md hover:bg-[#ff6540] transition-all cursor-pointer"
                    title="Upload Custom Photo"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white">{officer?.fullName || officer?.username || 'Investigating Officer'}</h3>
                  <p className="text-xs text-[#FF7A59] dark:text-white font-mono font-bold mt-0.5">
                    {officer?.rank || 'Forensic Inspector'} • #{officer?.badgeNumber || '7482'}
                  </p>
                  <span className="inline-block mt-2 px-3 py-1 rounded-full bg-white/10 text-white/90 text-[10px] font-mono border border-white/15">
                    {officer?.unit || 'Cyber Crime Division'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition-all cursor-pointer"
              >
                {isEditingProfile ? 'Cancel' : 'Edit Details'}
              </button>
            </div>

            {/* Avatar Quick Presets */}
            <div className="mb-6 p-4 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10">
              <label className="text-[10px] font-mono uppercase tracking-wider opacity-75 block mb-2 text-white">
                Choose Avatar Preset:
              </label>
              <div className="flex gap-3">
                {avatarPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => updateOfficer({ avatarUrl: preset })}
                    className="w-10 h-10 rounded-full border-2 border-white/30 hover:border-[#FF7A59] overflow-hidden transition-all cursor-pointer shadow-sm"
                  >
                    <img src={preset} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Edit Profile Form or View Profile Details */}
            {isEditingProfile ? (
              <form onSubmit={handleSaveProfile} className="space-y-3 font-mono text-xs">
                <div>
                  <label className="text-[10px] opacity-70 block mb-1 text-white">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-black/30 dark:bg-black/50 border border-white/20 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#FF7A59]"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] opacity-70 block mb-1 text-white">Rank / Designation</label>
                    <input
                      type="text"
                      value={rank}
                      onChange={(e) => setRank(e.target.value)}
                      className="w-full bg-black/30 dark:bg-black/50 border border-white/20 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#FF7A59]"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] opacity-70 block mb-1 text-white">Badge Number</label>
                    <input
                      type="text"
                      value={badgeNumber}
                      onChange={(e) => setBadgeNumber(e.target.value)}
                      className="w-full bg-black/30 dark:bg-black/50 border border-white/20 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#FF7A59]"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] opacity-70 block mb-1 text-white">Station / Unit</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full bg-black/30 dark:bg-black/50 border border-white/20 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#FF7A59]"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full mt-2 py-3 rounded-xl bg-[#FF7A59] hover:bg-[#ff6540] text-white font-bold uppercase tracking-wider text-xs shadow-md transition-all cursor-pointer"
                >
                  Save Profile Changes
                </button>
              </form>
            ) : (
              <div className="space-y-2.5 font-mono text-xs">
                <div className="p-3.5 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 flex justify-between">
                  <span className="opacity-70 text-white">Username</span>
                  <span className="text-white font-bold">{officer?.username || 'officer'}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 flex justify-between">
                  <span className="opacity-70 text-white">Email Address</span>
                  <span className="text-white font-bold">{officer?.email || 'io@copsight.gov.in'}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 flex justify-between">
                  <span className="opacity-70 text-white">Authorization Role</span>
                  <span className="text-emerald-400 font-bold uppercase">{officer?.role || 'Investigating Officer'}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 flex justify-between">
                  <span className="opacity-70 text-white">E2E Session Key</span>
                  <span className="text-[#FF7A59] dark:text-white font-bold">SHA-256 Protected</span>
                </div>
              </div>
            )}
          </div>

          {/* Logout Action */}
          <div className="pt-4 border-t border-white/10">
            <button
              onClick={logout}
              className="w-full py-3.5 px-4 rounded-2xl btn-danger text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out of CopSight Station</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Workstation Preferences, Case Assignment & Daemon */}
        <div className="xl:col-span-6 space-y-6">
          
          {/* Card 1: Appearance & Theme Selector */}
          <div className="glass-panel rounded-[2rem] p-6 space-y-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FF7A59]/20 dark:bg-white/10 flex items-center justify-center text-[#FF7A59] dark:text-white">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Workstation Aesthetics</h3>
                <p className="text-[10px] uppercase opacity-70 text-white">Visual Presentation & Mode</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* macOS System Theme Option */}
              <button
                type="button"
                onClick={() => handleSetTheme('system')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  themeMode === 'system'
                    ? 'bg-white/20 border-white ring-2 ring-white/50 shadow-md'
                    : 'bg-black/20 hover:bg-black/30 border-white/10'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white shadow-sm shrink-0">
                    <Laptop className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block truncate">macOS Default</span>
                    <span className="text-[9.5px] opacity-70 text-white font-mono">System Sync</span>
                  </div>
                </div>
                {themeMode === 'system' && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#FF7A59] dark:text-white shrink-0 ml-1" />
                )}
              </button>

              {/* Oceanic Blue Light Theme Option */}
              <button
                type="button"
                onClick={() => handleSetTheme('light')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  themeMode === 'light'
                    ? 'bg-[#2475B5]/60 border-[#FF7A59] ring-2 ring-[#FF7A59]/50 shadow-md'
                    : 'bg-black/20 hover:bg-black/30 border-white/10'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#2475B5] border border-white/40 flex items-center justify-center text-white shadow-sm shrink-0">
                    <Sun className="w-4 h-4 text-amber-300" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block truncate">Oceanic Blue</span>
                    <span className="text-[9.5px] opacity-70 text-white font-mono">Light Mode</span>
                  </div>
                </div>
                {themeMode === 'light' && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#FF7A59] shrink-0 ml-1" />
                )}
              </button>

              {/* Minimal Dark Theme Option */}
              <button
                type="button"
                onClick={() => handleSetTheme('dark')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  themeMode === 'dark'
                    ? 'bg-black/70 border-white ring-2 ring-white/50 shadow-md'
                    : 'bg-black/20 hover:bg-black/30 border-white/10'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#111111] border border-white/20 flex items-center justify-center text-white shadow-sm shrink-0">
                    <Moon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block truncate">Minimal Dark</span>
                    <span className="text-[9.5px] opacity-70 text-white font-mono">Dark Mode</span>
                  </div>
                </div>
                {themeMode === 'dark' && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0 ml-1" />
                )}
              </button>
            </div>
          </div>

          {/* Card 2: Assigned Case Management */}
          <div className="glass-panel rounded-[2rem] p-6 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FF7A59]/20 dark:bg-white/10 flex items-center justify-center text-[#FF7A59] dark:text-white">
                  <FolderKey className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Active Case Assignment</h3>
                  <p className="text-[10px] uppercase opacity-70 text-white">Legal Scope & Jurisdiction</p>
                </div>
              </div>

              <button
                onClick={onSwitchCase}
                className="px-4 py-2 rounded-full bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white font-bold text-xs font-mono shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>Switch Case</span>
              </button>
            </div>

            {selectedCase ? (
              <div className="p-4 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 space-y-2.5 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="opacity-70 text-white">Case / FIR Number:</span>
                  <span className="font-bold text-[#FF7A59] dark:text-white text-sm">
                    {selectedCase.caseNumber || (selectedCase as any).fir_number}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="opacity-70 text-white">Case Title:</span>
                  <span className="font-bold text-white">{selectedCase.title || 'Digital Device Forensics'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="opacity-70 text-white">Created Date:</span>
                  <span className="text-white">{(selectedCase as any).createdAt?.slice(0, 10) || '2026-08-18'}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-200 text-xs font-mono text-center">
                <span>No active case currently loaded. Click "Switch Case" to select an assigned case.</span>
              </div>
            )}
          </div>

          {/* Card 3: Forensic Daemon Server Diagnostics */}
          <div className="glass-panel rounded-[2rem] p-6 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FF7A59]/20 dark:bg-white/10 flex items-center justify-center text-[#FF7A59] dark:text-white">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Forensic Daemon Engine</h3>
                  <p className="text-[10px] uppercase opacity-70 text-white">Hardware Bridge & RPC State</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isDaemonConnected ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-[#EF4444] dark:bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]'}`} />
                <span className={`text-xs font-mono font-bold ${isDaemonConnected ? 'text-emerald-400' : 'text-white'}`}>
                  {isDaemonConnected ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 space-y-2.5 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="opacity-70 text-white">RPC Socket:</span>
                <span className="text-white font-bold">127.0.0.1:54322</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="opacity-70 text-white">WebSocket Stream:</span>
                <span className={isDaemonConnected ? 'text-emerald-400 font-bold' : 'text-white/80'}>
                  {isDaemonConnected ? 'Active (Live Telemetry)' : 'Disconnected'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="opacity-70 text-white">Hardware Drivers:</span>
                <span className="text-white font-bold">MediaTek BROM / EDL / ADB / iOS Mux</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                onClick={handleTestDaemon}
                disabled={testStatus === 'testing'}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-mono font-bold flex items-center justify-center gap-2 border border-white/15 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
                <span>
                  {testStatus === 'testing'
                    ? 'Testing Socket...'
                    : testStatus === 'online'
                    ? '✓ Connected (200 OK)'
                    : testStatus === 'offline'
                    ? '✕ Daemon Offline'
                    : 'Test Connection'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => daemonClient.scanDevices()}
                disabled={isScanning}
                className="flex-1 py-2.5 rounded-xl bg-[#FF7A59] hover:bg-[#ff6540] text-white dark:bg-white dark:text-black text-xs font-mono font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                <span>Probe USB Bus</span>
              </button>
              {onOpenAdminAudit && (
                <button
                  type="button"
                  onClick={onOpenAdminAudit}
                  className="py-2.5 px-4 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-mono font-bold flex items-center justify-center gap-2 border border-red-500/30 transition-all cursor-pointer shadow-sm"
                  title="Open Diagnostic Log Dossier"
                >
                  <span>Diagnostic Logs</span>
                </button>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
