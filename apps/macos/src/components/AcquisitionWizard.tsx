import React from 'react';
import { Layers, FileText, Film, Trash2, Play, AlertCircle, CheckCircle2, Circle } from 'lucide-react';
import { useDaemonStore } from '../store/daemonStore';
import { useCaseStore } from '../store/caseStore';
import { useAuthStore } from '../store/authStore';
import { daemonClient } from '../lib/daemonClient';
import { loggerService } from '../lib/loggerService';

export const AcquisitionWizard: React.FC = () => {
  const {
    selectedDevice,
    extractionLevel,
    setExtractionLevel,
    extractionProfile,
    setExtractionProfile,
    outputDirectory,
    isAcquiring,
  } = useDaemonStore();

  const { selectedCase } = useCaseStore();
  const { token, sessionEncryptionKey, officer } = useAuthStore();

  const handleLevelSelect = (levelId: string) => {
    setExtractionLevel(levelId as any);
    loggerService.event('ACQUISITION', 'Select Extraction Level', 'SUCCESS', `Configured acquisition depth to: ${levelId.toUpperCase()}`);
  };

  const handleProfileSelect = (profileId: string) => {
    setExtractionProfile(profileId as any);
    loggerService.event('ACQUISITION', 'Select Extraction Profile', 'SUCCESS', `Configured data scope filter to: ${profileId.toUpperCase()}`);
  };

  const handleStartAcquisition = async () => {
    if (!selectedCase || !selectedDevice || isAcquiring) return;
    try {
      await daemonClient.startAcquisition({
        caseInfo: {
          id: selectedCase.id,
          caseNumber: selectedCase.caseNumber || (selectedCase as any).fir_number,
          title: selectedCase.title,
          officerName: officer?.fullName || officer?.username || 'IO',
        },
        deviceId: selectedDevice.device_id,
        level: extractionLevel,
        profile: extractionProfile,
        outputDir: outputDirectory,
        token: token || undefined,
        sessionEncryptionKey: sessionEncryptionKey || undefined,
      });
    } catch (e) {
      console.error('Failed to launch acquisition:', e);
    }
  };

  const levels = [
    {
      id: 'logical',
      title: 'Logical Acquisition',
      desc: 'Standard triage: DBs, Chats, SMS, Contacts & Call Logs',
      tag: 'Fast & Standard',
    },
    {
      id: 'file_system',
      title: 'File System Dump',
      desc: 'App sandboxes, system databases, cached data & logs',
      tag: 'Deep Inspect',
    },
    {
      id: 'physical',
      title: 'Physical Bitstream',
      desc: 'Raw partition dump & unallocated space carving',
      tag: 'Full Dump',
    },
  ];

  const profiles = [
    {
      id: 'all',
      label: 'All Data',
      desc: 'Full acquisition of all available artifacts',
      icon: Layers,
    },
    {
      id: 'textual',
      label: 'Textual Only',
      desc: 'SMS, WhatsApp, chats & call records',
      icon: FileText,
    },
    {
      id: 'media',
      label: 'Media Files',
      desc: 'Photos, videos, voice notes & docs',
      icon: Film,
    },
    {
      id: 'deleted',
      label: 'Carve Deleted',
      desc: 'Deep freelist carving for purged records',
      icon: Trash2,
    },
  ];

  const currentLevelIndex = levels.findIndex((l) => l.id === extractionLevel);

  return (
    <div className="glass-panel rounded-[2rem] p-6 h-full flex flex-col justify-between overflow-hidden relative shadow-lg">
      
      {/* Top Header */}
      <div className="flex items-start justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#FF7A59]/20 dark:bg-white/10 flex items-center justify-center text-[#FF7A59] dark:text-white shadow-sm">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-wide text-white">Acquisition Parameters</h2>
            <p className="text-[11px] uppercase tracking-wider opacity-75 text-white">Depth & Target Scope Filters</p>
          </div>
        </div>

        <div className="flex items-center justify-center px-3.5 py-1.5 rounded-full bg-black/25 dark:bg-white/10 border border-white/15 text-xs sm:text-sm font-mono font-bold text-[#FF7A59] dark:text-white shrink-0 leading-none shadow-sm">
          Step {currentLevelIndex >= 0 ? currentLevelIndex + 1 : 1} of 3
        </div>
      </div>

      {/* Main Parameters Scope Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
        
        {/* Step 1: Depth Levels */}
        <div>
          <label className="text-[11px] uppercase font-bold tracking-wider opacity-80 block mb-2 text-white">
            1. Select Extraction Depth:
          </label>
          <div className="space-y-2">
            {levels.map((level) => {
              const isSelected = extractionLevel === level.id;
              return (
                <button
                  key={level.id}
                  onClick={() => handleLevelSelect(level.id)}
                  disabled={isAcquiring}
                  className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl transition-all text-left cursor-pointer border ${
                    isSelected
                      ? 'bg-black/25 dark:bg-white/15 border-[#FF7A59] dark:border-white shadow-md ring-2 ring-[#FF7A59]/40'
                      : 'bg-black/10 dark:bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      isSelected
                        ? 'bg-[#FF7A59] text-white dark:bg-white dark:text-black shadow-md'
                        : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {isSelected ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold tracking-wide text-white truncate">
                        {level.title}
                      </span>
                      <span className="text-[9.5px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/90">
                        {level.tag}
                      </span>
                    </div>
                    <p className="text-[10.5px] opacity-70 truncate font-mono mt-0.5 text-white">
                      {level.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Target Scope Filters (Properly Sized & Prominent) */}
        <div>
          <label className="text-[11px] uppercase font-bold tracking-wider opacity-80 block mb-2 text-white">
            2. Targeted Scope Filters:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {profiles.map((prof) => {
              const Icon = prof.icon;
              const isSelected = extractionProfile === prof.id;
              return (
                <button
                  key={prof.id}
                  onClick={() => handleProfileSelect(prof.id)}
                  disabled={isAcquiring}
                  className={`p-3.5 rounded-2xl flex items-start gap-3 text-left transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#FF7A59]/20 dark:bg-white/15 border-[#FF7A59] dark:border-white shadow-md ring-2 ring-[#FF7A59]/40'
                      : 'bg-black/15 dark:bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                      isSelected
                        ? 'bg-[#FF7A59] text-white dark:bg-white dark:text-black shadow-sm'
                        : 'bg-white/10 text-white/70'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-white block truncate">
                      {prof.label}
                    </span>
                    <p className="text-[10px] opacity-70 text-white leading-tight mt-0.5">
                      {prof.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Action Footer */}
      <div className="pt-3 shrink-0">
        {!selectedDevice ? (
          <div className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 text-xs text-white/80 text-center">
            <AlertCircle className="w-4 h-4 text-[#FF7A59] dark:text-white shrink-0" />
            <span>Please select a target mobile device from the Devices tab</span>
          </div>
        ) : (
          <button
            onClick={handleStartAcquisition}
            disabled={isAcquiring}
            className={`w-full py-4 px-5 rounded-2xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg ${
              isAcquiring
                ? 'bg-black/30 dark:bg-white/10 text-white/50 cursor-not-allowed border border-white/10'
                : 'bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-black active:scale-[0.99]'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>
              {isAcquiring
                ? 'Extraction In Progress...'
                : `Initiate Acquisition (${(selectedDevice as any).model || selectedDevice.device_id})`}
            </span>
          </button>
        )}
      </div>

    </div>
  );
};
