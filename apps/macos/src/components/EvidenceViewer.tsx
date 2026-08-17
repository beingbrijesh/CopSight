import React, { useEffect, useState } from 'react';
import { FileArchive, FileCode, FileText, Download, ShieldCheck, MessageSquare, RefreshCw, FolderX, Key, Unlock, Bell, FolderOpen, CheckCircle, AlertTriangle, Cpu, HardDrive, Terminal, UploadCloud, Lock, Square, XCircle } from 'lucide-react';
import { useDaemonStore } from '../store/daemonStore';
import { useCaseStore } from '../store/caseStore';
import { caseService } from '../lib/api';

export const EvidenceViewer: React.FC = () => {
  const { lastCompletedResult, selectedDevice } = useDaemonStore();
  const { selectedCase } = useCaseStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'decrypt' | 'messages' | 'calls'>('overview');
  const [chats, setChats] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [isLoadingEvidence, setIsLoadingEvidence] = useState(false);

  // Decryption & Fallback Toolkit state
  const [hexKey, setHexKey] = useState('');
  const [keyFilePath, setKeyFilePath] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptionStatus, setDecryptionStatus] = useState<string | null>(null);
  const [isScrapingNotifications, setIsScrapingNotifications] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);
  const [isDumpingHeap, setIsDumpingHeap] = useState(false);
  const [heapStatus, setHeapStatus] = useState<string | null>(null);
  const [heapResult, setHeapResult] = useState<any | null>(null);
  const [isInspectingPhysical, setIsInspectingPhysical] = useState(false);
  const [physicalInfo, setPhysicalInfo] = useState<any | null>(null);
  const [physicalStatus, setPhysicalStatus] = useState<string | null>(null);
  const [isScrapingLiveUi, setIsScrapingLiveUi] = useState(false);
  const [liveUiStatus, setLiveUiStatus] = useState<string | null>(null);
  const [isHarvestingMedia, setIsHarvestingMedia] = useState(false);
  const [mediaHarvestStatus, setMediaHarvestStatus] = useState<string | null>(null);
  const [isUploadingCloud, setIsUploadingCloud] = useState(false);
  const [cloudUploadStatus, setCloudUploadStatus] = useState<string | null>(null);

  // Vector 6 Wizard State
  const [v6Step, setV6Step] = useState<number>(0);
  const [v6Logs, setV6Logs] = useState<string>('');

  useEffect(() => {
    if (selectedCase?.id) {
      loadCaseEvidence(selectedCase.id);
    }
  }, [selectedCase]);

  useEffect(() => {
    let interval: any;
    if (v6Step === 4) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('http://127.0.0.1:54322/api/acquire/physical/mtk-status');
          const data = await res.json();
          if (data.success) {
            setV6Logs(data.logs);
            if (!data.running && data.logs) {
              if (data.logs.includes('Access denied') || data.logs.includes('Error') || data.logs.includes('Traceback')) {
                setV6Step(6); // Error step
              } else if (data.logs.length > 200) {
                setV6Step(5); // Success step
              }
              clearInterval(interval);
            }
          }
        } catch (e) {
          // ignore network errors on polling
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [v6Step, v6Logs]);

  const loadCaseEvidence = async (caseId: number) => {
    setIsLoadingEvidence(true);
    try {
      const [fetchedChats, fetchedEntities] = await Promise.all([
        caseService.getCaseChats(caseId),
        caseService.getCaseEntities(caseId),
      ]);
      setChats(Array.isArray(fetchedChats) ? fetchedChats : []);
      setEntities(Array.isArray(fetchedEntities) ? fetchedEntities : []);
    } catch (e) {
      console.error('Error fetching case evidence from backend:', e);
    } finally {
      setIsLoadingEvidence(false);
    }
  };

  const handleDecryptWhatsApp = async () => {
    if (!hexKey && !keyFilePath) {
      setDecryptionStatus('Error: Please provide a 64-character hex key or key file path.');
      return;
    }
    setIsDecrypting(true);
    setDecryptionStatus('Decrypting WhatsApp database with provided key vector...');
    try {
      const res = await fetch('http://127.0.0.1:54322/api/decrypt/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseNumber: selectedCase?.caseNumber || (selectedCase as any)?.fir_number || 'Demo',
          hexKey: hexKey || undefined,
          keyFilePath: keyFilePath || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDecryptionStatus(`Success: ${data.message}`);
        if (selectedCase?.id) loadCaseEvidence(selectedCase.id);
      } else {
        setDecryptionStatus(`Decryption failed: ${data.message || data.error}`);
      }
    } catch (e: any) {
      setDecryptionStatus(`Error connecting to daemon: ${e.message}`);
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleDumpHeap = async () => {
    setIsDumpingHeap(true);
    setHeapStatus('Running 6-method volatile RAM extraction chain...');
    setHeapResult(null);
    try {
      const res = await fetch('http://127.0.0.1:54322/api/acquire/heap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseNumber: selectedCase?.caseNumber || (selectedCase as any)?.fir_number || 'Demo',
          packageName: 'com.whatsapp',
          deviceSerial: selectedDevice?.serial || '',
        }),
      });
      const data = await res.json();
      setHeapResult(data);
      if (data.success) {
        setHeapStatus(`Success: ${data.message}`);
        // Auto-populate hex key if a candidate was found
        if (data.decrypted?.key) setHexKey(data.decrypted.key);
        else if (data.candidates?.length > 0) setHexKey(data.candidates[0]);
        if (selectedCase?.id) loadCaseEvidence(selectedCase.id);
      } else {
        setHeapStatus(data.message || data.error || 'All extraction methods blocked by device security.');
      }
    } catch (e: any) {
      setHeapStatus(`RAM Dump error: ${e.message}`);
    } finally {
      setIsDumpingHeap(false);
    }
  };

  const handleInspectPhysical = async () => {
    setIsInspectingPhysical(true);
    setPhysicalStatus('Querying chipset bootloader & physical partition state...');
    try {
      const res = await fetch('http://127.0.0.1:54322/api/acquire/physical-inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceSerial: selectedDevice?.serial || '' }),
      });
      const data = await res.json();
      if (data.success) {
        setPhysicalInfo(data);
        setPhysicalStatus(`Chipset: ${data.chipFamily} (${data.chipset}) | Bootloader: ${data.bootloaderLocked ? 'Locked' : 'Unlocked'}`);
        if (data.chipFamily === 'MediaTek') {
          setV6Step(1);
        } else {
          setPhysicalStatus(`Only MediaTek automated physical extraction is currently implemented. Chipset is ${data.chipFamily}.`);
        }
      } else {
        setPhysicalStatus(`Physical inspection error: ${data.error}`);
      }
    } catch (e: any) {
      setPhysicalStatus(`Physical connection error: ${e.message}`);
    } finally {
      setIsInspectingPhysical(false);
    }
  };

  const handleV6Setup = async () => {
    setPhysicalStatus('Downloading and setting up MediaTek exploit tools (mtkclient)...');
    try {
      const res = await fetch('http://127.0.0.1:54322/api/acquire/physical/vendor-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor: 'mtkclient' }),
      });
      const data = await res.json();
      if (data.success) {
        setPhysicalStatus('Success: mtkclient exploit framework initialized.');
        setV6Step(2);
      } else {
        setPhysicalStatus(`Setup error: ${data.error}`);
      }
    } catch (e: any) {
      setPhysicalStatus(`Setup error: ${e.message}`);
    }
  };

  const handleV6Extract = async () => {
    setPhysicalStatus('Sending exploit payload. Ensure device is in BROM mode...');
    setV6Step(4);
    try {
      const res = await fetch('http://127.0.0.1:54322/api/acquire/physical/mtk-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseNumber: selectedCase?.caseNumber || (selectedCase as any)?.fir_number || 'Demo',
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setPhysicalStatus(`Extraction failed to start: ${data.error}`);
        setV6Step(2);
      }
    } catch (e: any) {
      setPhysicalStatus(`Extraction error: ${e.message}`);
      setV6Step(2);
    }
  };


  const handleOpenDevSettings = async () => {
    try {
      setHeapStatus('Opening Developer Options directly on device screen...');
      const res = await fetch('http://127.0.0.1:54322/api/acquire/open-dev-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceSerial: selectedDevice?.serial || '' }),
      });
      const data = await res.json();
      if (data.success) {
        setHeapStatus('Opened Developer Settings on phone screen. Turn "USB Debugging (Security settings)" ON to authorize RAM capture.');
      }
    } catch (e: any) {
      setHeapStatus(`Notice: ${e.message}`);
    }
  };

  const handleScrapeNotifications = async () => {
    setIsScrapingNotifications(true);
    setNotificationStatus('Scraping Android system notification caches...');
    try {
      const res = await fetch('http://127.0.0.1:54322/api/acquire/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceSerial: selectedDevice?.serial || '' }),
      });
      const data = await res.json();
      if (data.success) {
        setNotificationStatus(`Success: Extracted ${data.count} unencrypted notification message records.`);
        if (selectedCase?.id) loadCaseEvidence(selectedCase.id);
      } else {
        setNotificationStatus(`Notification triage notice: ${data.error || 'No records found'}`);
      }
    } catch (e: any) {
      setNotificationStatus(`Daemon notice: ${e.message}`);
    } finally {
      setIsScrapingNotifications(false);
    }
  };

  const handleScrapeLiveUi = async () => {
    setIsScrapingLiveUi(true);
    setLiveUiStatus('Starting deep UI crawler: Opening conversations, scrolling history, and harvesting records...');
    try {
      const res = await fetch('http://127.0.0.1:54322/api/acquire/whatsapp-ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseNumber: selectedCase?.caseNumber || (selectedCase as any)?.fir_number || 'Demo',
          deviceSerial: selectedDevice?.serial || '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLiveUiStatus(`Success: ${data.message}`);
        if (data.records && Array.isArray(data.records)) {
          setChats(prev => [...data.records, ...prev]);
        }
        if (selectedCase?.id) loadCaseEvidence(selectedCase.id);
      } else {
        setLiveUiStatus(`Crawler notice: ${data.message || data.error || 'No chats detected'}`);
      }
    } catch (e: any) {
      setLiveUiStatus(`Error: ${e.message}`);
    } finally {
      setIsScrapingLiveUi(false);
    }
  };

  const handleCancelCrawler = async () => {
    setIsScrapingLiveUi(false);
    setLiveUiStatus('Stopping crawler immediately...');
    try {
      await fetch('http://127.0.0.1:54322/api/acquire/whatsapp-ui/cancel', { method: 'POST' });
      setLiveUiStatus('Crawler stopped by user.');
    } catch (e: any) {
      console.error('Error cancelling crawler:', e);
    }
  };

  const handleHarvestMedia = async () => {
    setIsHarvestingMedia(true);
    setMediaHarvestStatus('Pulling unencrypted WhatsApp voice notes, audio, and documents...');
    try {
      const res = await fetch('http://127.0.0.1:54322/api/acquire/whatsapp-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseNumber: selectedCase?.caseNumber || (selectedCase as any)?.fir_number || 'Demo',
          deviceSerial: selectedDevice?.serial || '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMediaHarvestStatus(`Success: ${data.message}`);
      } else {
        setMediaHarvestStatus(`Media notice: ${data.message || data.error || 'No media found'}`);
      }
    } catch (e: any) {
      setMediaHarvestStatus(`Error: ${e.message}`);
    } finally {
      setIsHarvestingMedia(false);
    }
  };

  const handleUploadToCloud = async () => {
    setIsUploadingCloud(true);
    setCloudUploadStatus('Syncing evidence records to central cloud database...');
    try {
      const res = await fetch('http://127.0.0.1:54322/api/cases/upload-to-cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: selectedCase?.id || 1,
          caseNumber: selectedCase?.caseNumber || (selectedCase as any)?.fir_number || 'Demo',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCloudUploadStatus(`Uploaded: ${data.message}`);
        if (selectedCase?.id) loadCaseEvidence(selectedCase.id);
      } else {
        setCloudUploadStatus(`Upload notice: ${data.message || data.error}`);
      }
    } catch (e: any) {
      setCloudUploadStatus(`Upload error: ${e.message}`);
    } finally {
      setIsUploadingCloud(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await fetch('http://127.0.0.1:54322/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseNumber: selectedCase?.caseNumber || (selectedCase as any)?.fir_number || 'Demo',
        }),
      });
    } catch (e) {
      console.error('Error opening folder:', e);
    }
  };

  return (
    <div className="glass-panel rounded-[2rem] p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-xl font-light tracking-wide mb-1">Evidence Center</h2>
          <p className="text-xs opacity-70 uppercase tracking-wider">Analysis & Decryption</p>
        </div>

        {/* Evidence Sync Control */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/20 dark:bg-white/10 border border-white/10 text-[11px] font-mono text-white">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Local Storage Only</span>
          </div>
          <button
            type="button"
            onClick={handleUploadToCloud}
            disabled={isUploadingCloud}
            className="px-3.5 py-1.5 rounded-full bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-black text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-sm"
          >
            {isUploadingCloud ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
            <span>Sync to Cloud</span>
          </button>
        </div>
      </div>

      {cloudUploadStatus && (
        <div className="mb-3 px-3.5 py-2 rounded-xl bg-black/20 dark:bg-white/10 border border-white/15 text-xs font-mono text-white flex items-center justify-between">
          <span>{cloudUploadStatus}</span>
          <button type="button" onClick={() => setCloudUploadStatus(null)} className="opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* View Switcher Tabs with High-Contrast Coral Accent */}
      <div className="flex items-center gap-1 p-1 rounded-full bg-black/20 dark:bg-white/5 border border-white/10 text-xs font-mono w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-[#FF7A59] text-white font-bold shadow-md dark:bg-white dark:text-black'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
          Reports & UFDR
        </button>
        <button
          onClick={() => setActiveTab('decrypt')}
          className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
            activeTab === 'decrypt'
              ? 'bg-[#FF7A59] text-white font-bold shadow-md dark:bg-white dark:text-black'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
          Decryption Toolkit
        </button>
        <button
          onClick={() => setActiveTab('messages')}
          className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
            activeTab === 'messages'
              ? 'bg-[#FF7A59] text-white font-bold shadow-md dark:bg-white dark:text-black'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
          Chats ({chats.length})
        </button>
        <button
          onClick={() => setActiveTab('calls')}
          className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
            activeTab === 'calls'
              ? 'bg-[#FF7A59] text-white font-bold shadow-md dark:bg-white dark:text-black'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
          Entities ({entities.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto mt-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Generated Deliverables Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* UFDR Package */}
              <div className="p-5 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/15 hover:border-white/30 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#FF7A59]/20 dark:bg-white/10 flex items-center justify-center text-[#FF7A59] dark:text-white">
                      <FileArchive className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-white/10 text-white border border-white/15">
                      Standard
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white">UFDR Archive (.ufdr)</h3>
                  <p className="text-[11px] font-mono opacity-70 mt-1 leading-relaxed">
                    Universal Forensic Data Repository container with embedded integrity hashes.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[10px] font-mono opacity-75">
                    {lastCompletedResult ? 'Generated' : 'Ready on Extract'}
                  </span>
                  <button
                    disabled={!lastCompletedResult}
                    className="p-2.5 rounded-full bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white disabled:opacity-30 transition-all cursor-pointer shadow-md"
                    title="Download UFDR"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Court PDF Report */}
              <div className="p-5 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/15 hover:border-white/30 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#FF7A59]/20 dark:bg-white/10 flex items-center justify-center text-[#FF7A59] dark:text-white">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-white/10 text-white border border-white/15">
                      Court Grade
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white">Forensic Report (PDF)</h3>
                  <p className="text-[11px] font-mono opacity-70 mt-1 leading-relaxed">
                    Formal law enforcement forensic summary with examiner authorization sign-off.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[10px] font-mono opacity-75">
                    {lastCompletedResult ? 'Compiled' : 'Ready on Extract'}
                  </span>
                  <button
                    disabled={!lastCompletedResult}
                    className="p-2.5 rounded-full bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white disabled:opacity-30 transition-all cursor-pointer shadow-md"
                    title="Export PDF Report"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* DFXML File */}
              <div className="p-5 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/15 hover:border-white/30 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#FF7A59]/20 dark:bg-white/10 flex items-center justify-center text-[#FF7A59] dark:text-white">
                      <FileCode className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-white/10 text-white border border-white/15">
                      NIST XML
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white">Digital Forensics XML</h3>
                  <p className="text-[11px] font-mono opacity-70 mt-1 leading-relaxed">
                    Standardized DFXML 1.2 manifest containing all file metadata and SHA-256 hashes.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[10px] font-mono opacity-75">
                    {lastCompletedResult ? 'Exported' : 'Ready on Extract'}
                  </span>
                  <button
                    disabled={!lastCompletedResult}
                    className="p-2.5 rounded-full bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white disabled:opacity-30 transition-all cursor-pointer shadow-md"
                    title="Export DFXML"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Cryptographic Verification Card & Finder button */}
            <div className="p-5 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/15 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Cryptographic Chain-of-Custody Verification</h4>
                  <p className="text-[11px] font-mono opacity-75 mt-0.5">
                    Case: <span className="text-[#FF7A59] dark:text-white font-bold">{selectedCase?.caseNumber || (selectedCase as any)?.fir_number || 'Demo'}</span> | Root Hash: <span className="text-white">{lastCompletedResult?.rootHash || 'SHA-256 Chained'}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleOpenFolder}
                  className="px-4 py-2 rounded-full bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Reveal in Finder</span>
                </button>
                <span className="text-[10px] font-mono px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  {lastCompletedResult ? 'SEALED & VERIFIED' : 'ACTIVE CUSTODY'}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'decrypt' && (
          <div className="space-y-4">
            {/* Header Banner */}
            <div className="p-4 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/15 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-[#FF7A59]/20 dark:bg-white/10 flex items-center justify-center text-[#FF7A59] dark:text-white shrink-0">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Investigating Officer Forensic Decryption & Triage Suite</h3>
                <p className="text-[11px] font-mono text-white mt-0.5">
                  If direct database extraction encounters encryption, use these multi-vector fallback methods to decrypt app databases or harvest unencrypted system caches.
                </p>
              </div>
            </div>

            {/* Vector 1: WhatsApp Crypt14/15 Decryption */}
            <div className="p-4 rounded-xl bg-black/20 dark:bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Unlock className="w-4 h-4 text-white" />
                  <h4 className="text-xs font-bold text-white">Vector 1: WhatsApp Crypt14/15 AES-GCM Decryption</h4>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 dark:bg-black/20 text-white border border-white/15">
                  Key Vector
                </span>
              </div>
              <p className="text-[11px] font-mono opacity-70">
                Enter the 64-character E2E backup hex key or the path to a 158-byte WhatsApp <code className="text-white">key</code> file.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono opacity-70 block mb-1">64-Hex Passphrase / Backup Key</label>
                  <input
                    type="text"
                    value={hexKey}
                    onChange={(e) => setHexKey(e.target.value)}
                    placeholder="e.g. 4a8b...64 hex characters"
                    className="w-full bg-black/30 dark:bg-black/50 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-white/40 focus:outline-none focus:border-[#FF7A59]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono opacity-70 block mb-1">Or Path to Key File</label>
                  <input
                    type="text"
                    value={keyFilePath}
                    onChange={(e) => setKeyFilePath(e.target.value)}
                    placeholder="e.g. /path/to/extracted/key"
                    className="w-full bg-black/30 dark:bg-black/50 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-white/40 focus:outline-none focus:border-[#FF7A59]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleDecryptWhatsApp}
                  disabled={isDecrypting}
                  className="px-4 py-2.5 rounded-xl bg-[#FF7A59] hover:bg-[#ff6540] text-white dark:bg-white dark:text-black font-bold shadow-md font-bold text-xs font-mono flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isDecrypting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                  <span>Decrypt Databases & Index Chats</span>
                </button>
                {decryptionStatus && (
                  <span className={`text-[11px] font-mono ${decryptionStatus.startsWith('Success') ? 'text-emerald-400' : 'text-white'}`}>
                    {decryptionStatus}
                  </span>
                )}
              </div>
            </div>

            {/* Vector 2: Live Android Notification Scraper */}
            <div className="p-4 rounded-xl bg-black/20 dark:bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-xs font-bold text-white">Vector 2: Android System Notification Cache Triage</h4>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white border border-white/15">
                  Unencrypted Cache
                </span>
              </div>
              <p className="text-[11px] font-mono opacity-70">
                Extracts unencrypted chat previews, sender phone numbers, and incoming message texts logged in Android OS memory without touching encrypted databases.
              </p>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleScrapeNotifications}
                  disabled={isScrapingNotifications}
                  className="px-4 py-2.5 rounded-xl bg-[#FF7A59] hover:bg-[#ff6540] text-white dark:bg-white dark:text-black border-transparent shadow-md font-bold text-xs font-mono flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isScrapingNotifications ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" /> : <Bell className="w-3.5 h-3.5" />}
                  <span>Harvest Notification Caches</span>
                </button>
                {notificationStatus && (
                  <span className={`text-[11px] font-mono ${notificationStatus.startsWith('Success') ? 'text-emerald-400' : 'text-white'}`}>
                    {notificationStatus}
                  </span>
                )}
              </div>
            </div>

            {/* Vector 3: Automated Deep UI Chat Crawler (Scroll & Harvest) */}
            <div className="p-4 rounded-xl bg-black/20 dark:bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-white" />
                  <h4 className="text-xs font-bold text-white">Vector 3: Automated Deep UI Chat Crawler (Scroll & Harvest)</h4>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 dark:bg-black/20 text-white border border-white/15">
                  Zero Decryption Needed
                </span>
              </div>
              <p className="text-[11px] font-mono opacity-70">
                Automatically opens each contact's chat conversation, scrolls bottom-to-top to extract full historical dialogue trees, and catalogs all records locally without database decryption.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleScrapeLiveUi}
                  disabled={isScrapingLiveUi}
                  className="px-4 py-2.5 rounded-xl bg-[#FF7A59] hover:bg-[#ff6540] text-white dark:bg-white dark:text-black font-bold text-xs font-mono flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer transition-all"
                >
                  {isScrapingLiveUi ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" /> : <MessageSquare className="w-3.5 h-3.5" />}
                  <span>Deep Crawl & Extract WhatsApp Chats</span>
                </button>
                {isScrapingLiveUi && (
                  <button
                    type="button"
                    onClick={handleCancelCrawler}
                    className="px-3.5 py-2 rounded-xl btn-danger font-bold text-xs font-mono flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Square className="w-3.5 h-3.5 fill-current text-white" />
                    <span>Stop Crawl</span>
                  </button>
                )}
                {liveUiStatus && (
                  <span className={`text-[11px] font-mono ${liveUiStatus.startsWith('Success') ? 'text-emerald-400' : 'text-white'}`}>
                    {liveUiStatus}
                  </span>
                )}
              </div>
            </div>

            {/* Vector 4: Unencrypted WhatsApp Media & Voice Note Harvester */}
            <div className="p-4 rounded-xl bg-black/20 dark:bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-white" />
                  <h4 className="text-xs font-bold text-white">Vector 4: Unencrypted Voice Notes & Media Harvester</h4>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white border border-white/15">
                  Direct Storage Triage
                </span>
              </div>
              <p className="text-[11px] font-mono opacity-70">
                Pulls all unencrypted WhatsApp Voice Notes (<code className="text-white">.opus</code>), audio files, sent PDFs, and documents directly from Android media storage with cryptographic hashes.
              </p>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleHarvestMedia}
                  disabled={isHarvestingMedia}
                  className="px-4 py-2.5 rounded-xl bg-[#FF7A59] hover:bg-[#ff6540] text-white dark:bg-white dark:text-black border-transparent shadow-md font-bold text-xs font-mono flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isHarvestingMedia ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" /> : <Download className="w-3.5 h-3.5" />}
                  <span>Harvest Voice Notes & Media</span>
                </button>
                {mediaHarvestStatus && (
                  <span className={`text-[11px] font-mono ${mediaHarvestStatus.startsWith('Success') ? 'text-emerald-400' : 'text-white'}`}>
                    {mediaHarvestStatus}
                  </span>
                )}
              </div>
            </div>

            {/* Vector 5: Process RAM / Heap Memory Key Extraction */}
            <div className="p-4 rounded-xl bg-black/20 dark:bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white">Vector 5: Process RAM / Heap Memory Capture & Key Extraction</h4>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-white/15">
                  6-Method Fallback Chain
                </span>
              </div>
              <p className="text-[11px] font-mono opacity-70">
                Runs a 6-method extraction chain: managed heap → native heap → run-as sandbox → /proc/fd scan → ADB backup → pm dump intelligence. Cross-brand compatible (MIUI, OneUI, ColorOS, EMUI, Stock AOSP).
              </p>

              {/* Device Profile Badge */}
              {heapResult?.deviceProfile && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 dark:bg-black/20 text-white border border-white/15">
                    {heapResult.deviceProfile.manufacturer} {heapResult.deviceProfile.model}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 dark:bg-white/5 text-white border border-white/15">
                    {heapResult.deviceProfile.skin}
                  </span>
                  {heapResult.deviceProfile.security_patch && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 dark:bg-white/5 opacity-70 border border-white/15">
                      Patch: {heapResult.deviceProfile.security_patch}
                    </span>
                  )}
                  {heapResult.pid && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-white/15">
                      PID: {heapResult.pid}
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDumpHeap}
                  disabled={isDumpingHeap}
                  className="px-4 py-2.5 rounded-xl bg-[#FF7A59] hover:bg-[#ff6540] text-white dark:bg-white dark:text-black border-transparent shadow-md font-bold text-xs font-mono flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isDumpingHeap ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" /> : <Cpu className="w-3.5 h-3.5" />}
                  <span>{isDumpingHeap ? 'Scanning...' : 'Capture RAM & Extract Key'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenDevSettings}
                  className="px-3.5 py-2 rounded-lg bg-white/10 dark:bg-white/5 hover:bg-slate-700 text-white border border-white/15 font-bold text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5 text-white" />
                  <span>Launch Settings on Device</span>
                </button>
              </div>

              {/* Status Message */}
              {heapStatus && (
                <span className={`text-[11px] font-mono block ${heapStatus.startsWith('Success') ? 'text-emerald-400' : 'text-white'}`}>
                  {heapStatus}
                </span>
              )}

              {/* Per-Method Results Table */}
              {heapResult?.methods && heapResult.methods.length > 0 && (
                <div className="rounded-lg bg-black/25 dark:bg-black/40 border border-white/10 overflow-hidden">
                  <table className="w-full text-[11px] font-mono">
                    <thead>
                      <tr className="bg-white/10 dark:bg-white/5 opacity-70">
                        <th className="text-left px-3 py-1.5">Method</th>
                        <th className="text-left px-3 py-1.5">Status</th>
                        <th className="text-left px-3 py-1.5">Details</th>
                        <th className="text-right px-3 py-1.5">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {heapResult.methods.map((m: any, idx: number) => (
                        <tr key={idx} className="border-t border-white/10/50 hover:bg-white/10 dark:bg-white/5">
                          <td className="px-3 py-1.5 text-white">{m.method}</td>
                          <td className="px-3 py-1.5">
                            {m.status === 'success' ? (
                              <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Success</span>
                            ) : (
                              <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> Failed</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 opacity-70 max-w-[250px] truncate" title={m.reason || m.intel ? JSON.stringify(m.intel) : ''}>
                            {m.reason || (m.candidates?.length ? `${m.candidates.length} key candidates` : m.intel ? 'Intelligence gathered' : (m.openFiles?.length ? `${m.openFiles.length} open file(s)` : '—'))}
                          </td>
                          <td className="px-3 py-1.5 text-right opacity-70">{m.duration_ms}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Key Candidates */}
              {heapResult?.candidates && heapResult.candidates.length > 0 && (
                <div className="rounded-lg bg-emerald-500/5 border border-white/15 p-3 space-y-1.5">
                  <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Key Candidates Found</span>
                  {heapResult.candidates.map((k: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      <code className="text-[10px] text-emerald-200 bg-white/5 dark:bg-black/20 px-2 py-0.5 rounded font-mono flex-1 truncate">{k}</code>
                      <button
                        type="button"
                        onClick={() => setHexKey(k)}
                        className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 cursor-pointer"
                      >
                        Use in Vector 1
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Next Steps Guidance */}
              {heapResult?.nextSteps && heapResult.nextSteps.length > 0 && (
                <div className="rounded-lg bg-amber-500/5 border border-white/15 p-3 space-y-1">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Recommended Next Steps
                  </span>
                  {heapResult.nextSteps.map((step: string, idx: number) => (
                    <p key={idx} className="text-[10px] font-mono text-amber-200/80 pl-4">• {step}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Vector 6: Interactive Physical Boot Triage */}
            <div className="p-4 rounded-xl bg-black/20 dark:bg-white/5 border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-purple-400" />
                  <h4 className="text-xs font-bold text-white">Vector 6: Physical Exploit Extractor (BROM / EDL)</h4>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white border border-white/15">
                  Unified Hardware Exploit
                </span>
              </div>
              <p className="text-[11px] font-mono opacity-70">
                Automated chipset detection, vendor exploit orchestration (mtkclient/edl), and physical <code>userdata</code> dumping. Kept entirely offline.
              </p>

              {physicalInfo && (
                <div className="flex gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 dark:bg-white/5 text-white border border-white/15 flex items-center gap-1">
                    Chipset: <span className="text-white">{physicalInfo.chipFamily} ({physicalInfo.chipset})</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 dark:bg-white/5 text-white border border-white/15 flex items-center gap-1">
                    OS Root: {physicalInfo.hasRootAccess ? <span className="text-emerald-400">Yes</span> : <span className="text-red-400">No</span>}
                  </span>
                </div>
              )}

              {/* Wizard State Machine */}
              <div className="rounded-lg bg-black/25 dark:bg-black/40 border border-white/10 p-4 space-y-4">
                
                {v6Step === 0 && (
                  <div className="space-y-3">
                    <p className="text-[11px] opacity-70">Step 1: Analyze connected device to determine optimal exploit path.</p>
                    <button
                      type="button"
                      onClick={handleInspectPhysical}
                      disabled={isInspectingPhysical}
                      className="px-4 py-2.5 rounded-xl bg-[#FF7A59] hover:bg-[#ff6540] text-white dark:bg-white dark:text-black border-transparent shadow-md font-bold text-xs font-mono flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isInspectingPhysical ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" /> : <Terminal className="w-3.5 h-3.5" />}
                      <span>Analyze Hardware</span>
                    </button>
                  </div>
                )}

                {v6Step === 1 && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 bg-emerald-500/5 border border-white/15 p-2 rounded">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-bold text-emerald-300">MediaTek Chipset Detected</p>
                        <p className="text-[10px] opacity-70">Requires mtkclient exploit framework.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleV6Setup}
                      className="px-4 py-2.5 rounded-xl bg-[#FF7A59] hover:bg-[#ff6540] text-white dark:bg-white dark:text-black border-transparent shadow-md font-bold text-xs font-mono flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Setup Embedded Exploit Tooling</span>
                    </button>
                  </div>
                )}

                {v6Step === 2 && (
                  <div className="space-y-3">
                    <div className="bg-amber-500/5 border border-white/15 p-3 rounded space-y-2">
                      <p className="text-[11px] font-bold text-white flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> IO Action Required: Power Off</p>
                      <p className="text-[11px] text-white pl-4">1. Unplug the USB cable from the device.</p>
                      <p className="text-[11px] text-white pl-4">2. Power off the device completely.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setV6Step(3)}
                      className="px-4 py-2.5 rounded-xl bg-[#FF7A59] hover:bg-[#ff6540] text-white dark:bg-white dark:text-black border-transparent shadow-md font-bold text-xs font-mono w-full"
                    >
                      Done, Device is Powered Off
                    </button>
                  </div>
                )}

                {v6Step === 3 && (
                  <div className="space-y-3">
                    <div className="bg-amber-500/5 border border-white/15 p-3 rounded space-y-2">
                      <p className="text-[11px] font-bold text-white flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> IO Action Required: Enter BROM</p>
                      <p className="text-[11px] text-white pl-4">1. Hold both <strong>Volume Up</strong> and <strong>Volume Down</strong> buttons simultaneously.</p>
                      <p className="text-[11px] text-white pl-4">2. Keep holding the buttons and plug in the USB cable.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleV6Extract}
                      className="px-4 py-2.5 rounded-xl bg-[#FF7A59] hover:bg-[#ff6540] text-white dark:bg-white dark:text-black border-transparent shadow-md font-bold text-xs font-mono w-full"
                    >
                      Cable Connected - Begin BROM Exploit
                    </button>
                  </div>
                )}

                {v6Step === 4 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-white flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> 
                      Extracting Physical Image (This will take several minutes)...
                    </p>
                    <div className="bg-black/80 rounded border border-white/10 p-2 h-48 overflow-y-auto font-mono text-[9px] text-emerald-500 leading-tight whitespace-pre-wrap">
                      {v6Logs || 'Initializing payload injection...'}
                    </div>
                  </div>
                )}

                {v6Step === 5 && (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 bg-emerald-500/5 border border-white/15 p-2 rounded">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-bold text-emerald-300">Physical Extraction Complete</p>
                        <p className="text-[10px] opacity-70">The userdata image has been saved locally to the case directory. It will NOT be synced to the cloud.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setV6Step(0); setV6Logs(''); }}
                      className="px-4 py-2 rounded-lg bg-white/10 dark:bg-white/5 hover:bg-slate-700 text-white border border-white/15 font-bold text-[10px] font-mono"
                    >
                      Reset Vector 6
                    </button>
                  </div>
                )}

                {v6Step === 6 && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 bg-red-500/5 border border-red-500/20 p-2 rounded">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-bold text-red-300">Extraction Failed</p>
                        <p className="text-[10px] opacity-70 mb-2">The exploit encountered an error. Check the logs above.</p>
                        {v6Logs.includes('Access denied') && (
                          <div className="text-[10px] bg-red-950/50 p-2 rounded border border-red-900/50">
                            <strong>Permission Error Detected:</strong> macOS restricts raw USB access. 
                            You MUST run the CopSight Daemon with sudo privileges.
                            <br/><br/>
                            <code>sudo PYTHONPATH=. python3 -m apps.macos.daemon.server --port 54322</code>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setV6Step(2); setV6Logs(''); }}
                      className="px-4 py-2 rounded-lg bg-white/10 dark:bg-white/5 hover:bg-slate-700 text-white border border-white/15 font-bold text-[10px] font-mono"
                    >
                      Retry Connection
                    </button>
                  </div>
                )}
              </div>

              {physicalStatus && (
                <span className={`text-[11px] font-mono block ${physicalStatus.startsWith('Success') ? 'text-emerald-400' : 'opacity-70'}`}>
                  Status: {physicalStatus}
                </span>
              )}
            </div>
          </div>
        )}

        {activeTab === 'messages' && (
          <div>
            {isLoadingEvidence ? (
              <div className="text-center py-10 text-xs font-mono opacity-70 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Loading chats from central case database...</span>
              </div>
            ) : chats.length === 0 ? (
              <div className="text-center py-12 opacity-70 font-mono text-xs space-y-2">
                <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
                <p>No ingested chat records in database for this case yet.</p>
                <p className="text-[10px] text-slate-600">Run an acquisition to stream and extract messages.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {chats.map((chat: any, idx: number) => {
                  const isOutgoing = chat.direction === 'outgoing' || chat.type === 'outgoing' || chat.sender === 'Me (Device Owner)';
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs font-mono transition-all ${
                        isOutgoing
                          ? 'bg-emerald-500/20 border-emerald-500/30 ml-4'
                          : 'bg-black/20 dark:bg-white/5 border-white/10 mr-4'
                      }`}
                    >
                      <div className="flex items-center justify-between opacity-70 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold ${isOutgoing ? 'text-emerald-300' : 'text-white'}`}>
                            {chat.sender || chat.from || 'Participant'}
                          </span>
                          {chat.recipient && (
                            <span className="text-[10px] opacity-70">➔ {chat.recipient}</span>
                          )}
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                              isOutgoing
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-light-accent dark:bg-dark-accent text-white border border-white/10'
                            }`}
                          >
                            {isOutgoing ? 'OUTGOING' : 'INCOMING'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="px-1.5 py-0.2 rounded bg-white/10 dark:bg-white/5 text-white">
                            {chat.app || chat.platform || 'Chat'}
                          </span>
                          <span>{chat.timestamp ? chat.timestamp.split('T')[0] : ''}</span>
                        </div>
                      </div>
                      <p className="text-white pl-0.5">{chat.message || chat.content || chat.text}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'calls' && (
          <div>
            {isLoadingEvidence ? (
              <div className="text-center py-10 text-xs font-mono opacity-70 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Loading entities from central case database...</span>
              </div>
            ) : entities.length === 0 ? (
              <div className="text-center py-12 opacity-70 font-mono text-xs space-y-2">
                <FolderX className="w-8 h-8 text-slate-600 mx-auto" />
                <p>No entity tags or phone records for this case in database.</p>
                <p className="text-[10px] text-slate-600">Entities are indexed automatically upon extraction.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {entities.map((ent: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-xl bg-black/20 dark:bg-white/5 border border-white/10 text-xs font-mono flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white">{ent.value || ent.name}</span>
                      <span className="opacity-70 ml-2 text-[10px]">({ent.type || ent.category})</span>
                    </div>
                    <div className="text-right text-[10px] text-white">
                      {ent.confidence ? `${Math.round(ent.confidence * 100)}% Confidence` : 'Indexed'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
