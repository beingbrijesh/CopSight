import React, { useEffect, useState } from 'react';
import { ContextHeader, WorkspaceTab } from '../components/ContextHeader';
import { DeviceRadar } from '../components/DeviceRadar';
import { AcquisitionWizard } from '../components/AcquisitionWizard';
import { LiveConsole } from '../components/LiveConsole';
import { EvidenceViewer } from '../components/EvidenceViewer';
import { SettingsView } from '../components/SettingsView';
import { daemonClient } from '../lib/daemonClient';
import { useCaseStore } from '../store/caseStore';
import { useAuthStore } from '../store/authStore';
import { useDaemonStore } from '../store/daemonStore';
import {
  Smartphone,
  ArrowRight,
  FileArchive,
  Activity,
  CheckCircle2,
} from 'lucide-react';

export const Workspace: React.FC = () => {
  const { clearSelection, selectedCase } = useCaseStore();
  const { officer } = useAuthStore();
  const {
    detectedDevices,
    selectedDevice,
    isAcquiring,
    currentSpeedMbps,
    totalArtifactsExtracted,
    lastCompletedResult,
  } = useDaemonStore();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');

  useEffect(() => {
    daemonClient.checkHealth();
    daemonClient.connectWebSocket();
    daemonClient.scanDevices();
    return () => daemonClient.disconnect();
  }, []);

  const activeDevice = selectedDevice || detectedDevices[0];

  return (
    <div className="min-h-screen w-full flex flex-col select-none overflow-y-auto pb-10 transition-colors duration-300">
      
      {/* Top Floating Navigation Bar (Aligned in same line with traffic light controls) */}
      <div className="pt-2 px-2 sm:px-4 w-full sticky top-0 z-40">
        <ContextHeader
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      </div>

      <main className="flex-1 px-2 sm:px-4 pt-4 w-full mx-auto max-w-[1800px]">
        
        {/* ========================================================================= */}
        {/* VIEW 1: SIMPLIFIED, INTUITIVE FORENSIC DASHBOARD                          */}
        {/* ========================================================================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Header Greeting & High Level Stats */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-white mb-1.5">
                  Welcome in, <span className="font-bold text-white">{officer?.fullName || officer?.username || 'Officer'}</span>
                </h1>
                <div className="flex items-center gap-3">
                  <div className="bg-black/20 dark:bg-white/10 rounded-full px-3.5 py-1 flex items-center gap-2 border border-white/15">
                    <span className="text-[10px] uppercase font-bold text-[#FF7A59] dark:text-white">Active Case</span>
                    <span className="font-mono text-xs text-white font-semibold">
                      {selectedCase?.caseNumber || (selectedCase as any)?.fir_number || 'Demo Case'}
                    </span>
                  </div>
                  <span className="text-xs opacity-75 text-white">CopSight AI Digital Forensics Station</span>
                </div>
              </div>

              {/* Stats Counters */}
              <div className="flex gap-8 sm:gap-10">
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="w-2 h-2 rounded-full bg-[#FF7A59] dark:bg-white shadow-[0_0_8px_#FF7A59]" />
                    <p className="text-2xl sm:text-3xl font-light text-white font-mono">
                      {String(detectedDevices.length).padStart(2, '0')}
                    </p>
                  </div>
                  <p className="text-[9.5px] uppercase tracking-wider opacity-75 text-white">Devices</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    <p className="text-2xl sm:text-3xl font-light text-white font-mono">
                      {isAcquiring ? '01' : '00'}
                    </p>
                  </div>
                  <p className="text-[9.5px] uppercase tracking-wider opacity-75 text-white">Running Tasks</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
                    <p className="text-2xl sm:text-3xl font-light text-white font-mono">
                      {totalArtifactsExtracted || 842}
                    </p>
                  </div>
                  <p className="text-[9.5px] uppercase tracking-wider opacity-75 text-white">Indexed Evidence</p>
                </div>
              </div>
            </div>

            {/* STEP-BY-STEP GUIDANCE / REAL-TIME ACTION BANNER */}
            {!isAcquiring && detectedDevices.length === 0 && (
              <div className="glass-panel rounded-[2rem] p-5 border-l-4 border-l-[#FF7A59] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#FF7A59]/20 dark:bg-white/10 flex items-center justify-center text-[#FF7A59] dark:text-white shrink-0">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-white/10 text-white">
                      Step 1: Connect Evidence Target
                    </span>
                    <h3 className="text-base font-bold text-white mt-1">Connect Target Mobile Device via USB</h3>
                    <p className="text-xs opacity-75 text-white mt-0.5">
                      Ensure device is unlocked. Tap "Trust This Computer" (iOS) or enable "USB Debugging" (Android).
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('devices')}
                  className="px-5 py-2.5 rounded-full bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white font-bold text-xs font-mono flex items-center gap-2 shadow-md transition-all cursor-pointer shrink-0"
                >
                  <span>Open Device Radar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {!isAcquiring && detectedDevices.length > 0 && (
              <div className="glass-panel rounded-[2rem] p-5 border-l-4 border-l-emerald-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Step 2: Device Ready For Extraction
                    </span>
                    <h3 className="text-base font-bold text-white mt-1">
                      {(activeDevice as any)?.model || activeDevice?.device_id} Linked & Ready
                    </h3>
                    <p className="text-xs opacity-75 text-white mt-0.5">
                      Hardware handshake successful. Configure extraction parameters to initiate forensic bitstream acquisition.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('acquisition')}
                  className="px-5 py-2.5 rounded-full bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white font-bold text-xs font-mono flex items-center gap-2 shadow-md transition-all cursor-pointer shrink-0"
                >
                  <span>Configure & Extract</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {isAcquiring && (
              <div className="glass-panel rounded-[2rem] p-5 border-l-4 border-l-[#FF7A59] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#FF7A59] text-white flex items-center justify-center shrink-0 shadow-md">
                    <Activity className="w-6 h-6 animate-spin" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-white/20 text-white">
                      Step 3: Live Execution In Progress
                    </span>
                    <h3 className="text-base font-bold text-white mt-1">
                      Streaming Bitstream Telemetry ({currentSpeedMbps.toFixed(2)} MB/s)
                    </h3>
                    <p className="text-xs opacity-75 text-white mt-0.5">
                      {totalArtifactsExtracted} artifacts acquired and hashed in real-time. Do not disconnect USB cable.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('acquisition')}
                  className="px-5 py-2.5 rounded-full bg-white text-black font-bold text-xs font-mono flex items-center gap-2 shadow-md hover:bg-slate-100 transition-all cursor-pointer shrink-0"
                >
                  <span>View Live Stream</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Dashboard 3-Card Core Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6">
              
              {/* Card 1: Connected Device Summary & Radar */}
              <div className="md:col-span-12 xl:col-span-4 min-h-[380px] lg:h-[420px]">
                <DeviceRadar />
              </div>

              {/* Card 2: Live Stream & Forensic Telemetry */}
              <div className="md:col-span-12 lg:col-span-6 xl:col-span-4 min-h-[380px] lg:h-[420px]">
                <LiveConsole />
              </div>

              {/* Card 3: Quick Acquisition Task Scope */}
              <div className="md:col-span-12 lg:col-span-6 xl:col-span-4 min-h-[380px] lg:h-[420px]">
                <AcquisitionWizard />
              </div>

              {/* Bottom Card: Evidence & Deliverables Quick Summary */}
              <div className="md:col-span-12 xl:col-span-12 glass-panel rounded-[2rem] p-6 space-y-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#FF7A59]/20 dark:bg-white/10 flex items-center justify-center text-[#FF7A59] dark:text-white">
                      <FileArchive className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Forensic Evidence & Deliverables</h3>
                      <p className="text-[10px] uppercase opacity-75 text-white">UFDR Archives, DFXML Manifests & Decryption</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('evidence')}
                    className="px-4 py-2 rounded-full bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white font-bold text-xs font-mono shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Open Full Evidence Center</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="p-4 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-white font-bold block">UFDR Container (.ufdr)</span>
                      <span className="opacity-70 text-[10px]">Universal Evidence Package</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-white/10 text-white text-[10px] font-bold">
                      {lastCompletedResult ? 'Ready' : 'Standby'}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-white font-bold block">Forensic PDF Report</span>
                      <span className="opacity-70 text-[10px]">Court-Admissible Dossier</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-white/10 text-white text-[10px] font-bold">
                      {lastCompletedResult ? 'Compiled' : 'Standby'}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-white font-bold block">DFXML Manifest v1.2</span>
                      <span className="opacity-70 text-[10px]">SHA-256 Hash Digest</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-white/10 text-white text-[10px] font-bold">
                      {lastCompletedResult ? 'Hashed' : 'Standby'}
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: DEDICATED DEVICE RADAR & HARDWARE DIAGNOSTICS                     */}
        {/* ========================================================================= */}
        {activeTab === 'devices' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-light text-white tracking-tight">USB Hardware & Device Center</h2>
                <p className="text-xs opacity-75 text-white mt-1">Real-time USB bus controller interrogation and connected mobile endpoints</p>
              </div>
              <span className="px-4 py-1.5 rounded-full bg-[#FF7A59] text-white dark:bg-white dark:text-black text-xs font-bold font-mono">
                {detectedDevices.length} Connected
              </span>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-[580px]">
              <div className="xl:col-span-6 h-[540px]">
                <DeviceRadar />
              </div>
              <div className="xl:col-span-6 glass-panel rounded-[2rem] p-6 sm:p-8 flex flex-col justify-between shadow-lg">
                <div>
                  <h3 className="text-xl font-bold text-white mb-4">Hardware Diagnostic Parameters</h3>
                  <div className="space-y-3 font-mono text-xs text-white/90">
                    <div className="p-3.5 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 flex justify-between">
                      <span className="opacity-70">Daemon RPC Interface</span>
                      <span className="text-emerald-400 font-bold">127.0.0.1:54322 (Active)</span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 flex justify-between">
                      <span className="opacity-70">USB Host Controller Driver</span>
                      <span className="text-white font-bold">AppleUSBLib / libusb-1.0</span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 flex justify-between">
                      <span className="opacity-70">Android Debug Bridge (ADB)</span>
                      <span className="text-[#FF7A59] dark:text-white font-bold">Auto-Handshake Enabled</span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 flex justify-between">
                      <span className="opacity-70">Apple MobileDevice Framework</span>
                      <span className="text-cyan-400 font-bold">Pairing Record Active</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 mt-4">
                  <div className="flex items-center gap-2 mb-1.5 text-[#FF7A59] dark:text-white font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Continuous Hardware Polling</span>
                  </div>
                  <p className="text-[11px] opacity-75 leading-relaxed text-white">
                    The USB bus is actively probed every 6 seconds to capture hot-plugged iOS (DFU/Recovery/Normal) and Android (EDL/Fastboot/ADB/MTP) targets.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: DEDICATED ACQUISITION STUDIO                                     */}
        {/* ========================================================================= */}
        {activeTab === 'acquisition' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-3xl font-light text-white tracking-tight">Forensic Acquisition Studio</h2>
              <p className="text-xs opacity-75 text-white mt-1">Configure extraction scope and monitor live bitstream telemetry</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-[580px]">
              <div className="xl:col-span-6 h-[540px]">
                <AcquisitionWizard />
              </div>
              <div className="xl:col-span-6 h-[540px]">
                <LiveConsole />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 4: DEDICATED EVIDENCE & REPORT CENTER                                */}
        {/* ========================================================================= */}
        {activeTab === 'evidence' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-3xl font-light text-white tracking-tight">Evidence & Forensic Triage Center</h2>
              <p className="text-xs opacity-75 text-white mt-1">Inspect decoded chats, extracted database entities, DFXML manifests, and cryptographic seal</p>
            </div>

            <div className="w-full min-h-[600px]">
              <EvidenceViewer />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 5: INVESTIGATOR PROFILE & STATION SETTINGS                           */}
        {/* ========================================================================= */}
        {activeTab === 'settings' && (
          <SettingsView onSwitchCase={clearSelection} />
        )}

      </main>
    </div>
  );
};
