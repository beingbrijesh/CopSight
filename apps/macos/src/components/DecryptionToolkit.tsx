import React, { useEffect, useState } from 'react';
import {
  Key,
  Unlock,
  Cpu,
  Bell,
  HardDrive,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Zap,
  Smartphone,
  Eye,
} from 'lucide-react';
import { useDaemonStore } from '../store/daemonStore';
import { useCaseStore } from '../store/caseStore';

export const DecryptionToolkit: React.FC = () => {
  const { selectedDevice } = useDaemonStore();
  const { selectedCase } = useCaseStore();

  const [activeVector, setActiveVector] = useState<'whatsapp' | 'ram' | 'hardware' | 'notifications' | 'media' | 'ui'>('whatsapp');

  // Vector 1: WhatsApp Decryption State
  const [hexKey, setHexKey] = useState('');
  const [keyFilePath, setKeyFilePath] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptionStatus, setDecryptionStatus] = useState<string | null>(null);

  // Vector 2: RAM Heap Dump State
  const [isDumpingHeap, setIsDumpingHeap] = useState(false);
  const [heapStatus, setHeapStatus] = useState<string | null>(null);
  const [heapResult, setHeapResult] = useState<any | null>(null);

  // Vector 3: Chipset & Hardware (MediaTek / EDL) State
  const [isInspectingPhysical, setIsInspectingPhysical] = useState(false);
  const [physicalInfo, setPhysicalInfo] = useState<any | null>(null);
  const [physicalStatus, setPhysicalStatus] = useState<string | null>(null);
  const [v6Step, setV6Step] = useState<number>(0);
  const [v6Logs, setV6Logs] = useState<string>('');

  // Vector 4: Notifications State
  const [isScrapingNotifications, setIsScrapingNotifications] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);

  // Vector 5: UI Screen State
  const [isScrapingLiveUi, setIsScrapingLiveUi] = useState(false);
  const [liveUiStatus, setLiveUiStatus] = useState<string | null>(null);

  // Vector 6: Media Harvester State
  const [isHarvestingMedia, setIsHarvestingMedia] = useState(false);
  const [mediaHarvestStatus, setMediaHarvestStatus] = useState<string | null>(null);

  // Polling for Hardware MTK Extraction
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
                setV6Step(6);
              } else if (data.logs.length > 200) {
                setV6Step(5);
              }
              clearInterval(interval);
            }
          }
        } catch {
          // Quietly handle transient polling delay
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [v6Step]);

  // Vector 1 Action
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
      } else {
        setDecryptionStatus(`Decryption failed: ${data.message || data.error}`);
      }
    } catch (e: any) {
      setDecryptionStatus(`Error connecting to daemon: ${e.message}`);
    } finally {
      setIsDecrypting(false);
    }
  };

  // Vector 2 Action
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
        if (data.decrypted?.key) setHexKey(data.decrypted.key);
        else if (data.candidates?.length > 0) setHexKey(data.candidates[0]);
      } else {
        setHeapStatus(data.message || data.error || 'All RAM extraction methods blocked by device security.');
      }
    } catch (e: any) {
      setHeapStatus(`RAM Dump error: ${e.message}`);
    } finally {
      setIsDumpingHeap(false);
    }
  };

  // Vector 3 Action
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
          setPhysicalStatus(`Target chipset is ${data.chipFamily}. Automated BROM bypass is currently optimized for MediaTek devices.`);
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
    setPhysicalStatus('Initializing MediaTek exploit tools (mtkclient)...');
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
    setV6Step(4);
    setV6Logs('Starting MediaTek Hardware Physical Extraction...\nWaiting for BROM Handshake...');
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
        setV6Step(6);
        setV6Logs(prev => prev + `\nExecution Error: ${data.error || data.message}`);
      }
    } catch (e: any) {
      setV6Step(6);
      setV6Logs(prev => prev + `\nConnection failed: ${e.message}`);
    }
  };

  // Vector 4 Action
  const handleScrapeNotifications = async () => {
    setIsScrapingNotifications(true);
    setNotificationStatus('Harvesting active notifications from target device buffer...');
    try {
      const res = await fetch('http://127.0.0.1:54322/api/acquire/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseNumber: selectedCase?.caseNumber || (selectedCase as any)?.fir_number || 'Demo',
          deviceSerial: selectedDevice?.serial || '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotificationStatus(`Success: Captured ${data.capturedCount || 0} encrypted notification snippets.`);
      } else {
        setNotificationStatus(`Failed: ${data.message || data.error}`);
      }
    } catch (e: any) {
      setNotificationStatus(`Error: ${e.message}`);
    } finally {
      setIsScrapingNotifications(false);
    }
  };

  // Vector 5 Action
  const handleScrapeLiveUi = async () => {
    setIsScrapingLiveUi(true);
    setLiveUiStatus('Capturing live UI hierarchy & active application view...');
    try {
      const res = await fetch('http://127.0.0.1:54322/api/acquire/live-ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseNumber: selectedCase?.caseNumber || (selectedCase as any)?.fir_number || 'Demo',
          deviceSerial: selectedDevice?.serial || '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLiveUiStatus(`Success: Captured ${data.elementsCount || 0} visible UI elements.`);
      } else {
        setLiveUiStatus(`Failed: ${data.message || data.error}`);
      }
    } catch (e: any) {
      setLiveUiStatus(`Error: ${e.message}`);
    } finally {
      setIsScrapingLiveUi(false);
    }
  };

  // Vector 6 Action
  const handleHarvestMedia = async () => {
    setIsHarvestingMedia(true);
    setMediaHarvestStatus('Harvesting encrypted voice notes, attachments, and photos from media partition...');
    try {
      const res = await fetch('http://127.0.0.1:54322/api/acquire/media-harvest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseNumber: selectedCase?.caseNumber || (selectedCase as any)?.fir_number || 'Demo',
          deviceSerial: selectedDevice?.serial || '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMediaHarvestStatus(`Success: Recovered ${data.recoveredCount || 0} media assets.`);
      } else {
        setMediaHarvestStatus(`Failed: ${data.message || data.error}`);
      }
    } catch (e: any) {
      setMediaHarvestStatus(`Error: ${e.message}`);
    } finally {
      setIsHarvestingMedia(false);
    }
  };

  const vectorCards = [
    {
      id: 'whatsapp' as const,
      title: 'Vector 1: Crypt14 / Crypt15 Key Decryption',
      desc: 'Decrypt raw SQLite databases using 64-char key hex or keyfile',
      icon: Key,
      badge: 'SQLite Engine',
    },
    {
      id: 'ram' as const,
      title: 'Vector 2: Volatile RAM Heap Dump',
      desc: '6-method memory acquisition chain to extract live WhatsApp key vectors',
      icon: Cpu,
      badge: 'Volatile Memory',
    },
    {
      id: 'hardware' as const,
      title: 'Vector 3: MediaTek BROM / Chipset Bypass',
      desc: 'Physical partition extraction via hardware bootrom exploit vectors',
      icon: Zap,
      badge: 'Physical BROM',
    },
    {
      id: 'notifications' as const,
      title: 'Vector 4: Notification Stream Scraper',
      desc: 'Intercept live encrypted message payloads from notification buffers',
      icon: Bell,
      badge: 'Live Listener',
    },
    {
      id: 'ui' as const,
      title: 'Vector 5: Accessibility Screen Harvester',
      desc: 'Extract visible chat messages directly from foreground UI nodes',
      icon: Eye,
      badge: 'UI Hierarchy',
    },
    {
      id: 'media' as const,
      title: 'Vector 6: Encrypted Media Partition Harvester',
      desc: 'Extract unencrypted voice notes, videos, and media metadata',
      icon: HardDrive,
      badge: 'Media Storage',
    },
  ];

  return (
    <div className="space-y-6 max-w-[1750px] mx-auto animate-fadeIn pb-12">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-white mb-1.5 flex items-center gap-3">
            <span>Forensic Decryption & Exploitation Toolkit</span>
            <span className="px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider bg-[#FF7A59] dark:bg-white dark:text-black text-white shadow-sm">
              Vectors 1-6
            </span>
          </h2>
          <p className="text-xs opacity-75 text-white max-w-3xl">
            Execute advanced decryption chains against protected WhatsApp SQLite databases, extract volatile RAM keys, and bypass locked chipsets using low-level hardware exploits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-full bg-black/20 dark:bg-white/10 border border-white/15 text-xs text-white font-mono flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5 text-[#FF7A59] dark:text-white" />
            <span>{selectedDevice ? `${selectedDevice.model} (${selectedDevice.serial || selectedDevice.device_id})` : 'Target: Default Connected USB'}</span>
          </div>
        </div>
      </div>

      {/* Vector Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 font-mono">
        {vectorCards.map((vc) => {
          const Icon = vc.icon;
          const isActive = activeVector === vc.id;
          return (
            <button
              key={vc.id}
              onClick={() => setActiveVector(vc.id)}
              className={`p-4 rounded-2xl glass-panel text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between gap-3 ${
                isActive
                  ? 'ring-2 ring-[#FF7A59] dark:ring-white bg-white/20 dark:bg-white/10 shadow-lg scale-[1.01]'
                  : 'hover:bg-white/10 dark:hover:bg-white/5 opacity-85 hover:opacity-100'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className={`p-2 rounded-xl ${isActive ? 'bg-[#FF7A59] text-white dark:bg-white dark:text-black' : 'bg-white/10 text-white'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/20 dark:bg-white/10 text-white border border-white/10 font-bold">
                  {vc.badge}
                </span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-0.5">{vc.title}</h4>
                <p className="text-[11px] opacity-75 font-sans line-clamp-2">{vc.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Vector Interactive Workspace */}
      <div className="glass-panel rounded-[2rem] p-6 sm:p-8 space-y-6 shadow-xl">
        
        {/* ========================================================================= */}
        {/* VECTOR 1: WHATSAPP SQLITE CRYPT14/15 DECRYPTION                           */}
        {/* ========================================================================= */}
        {activeVector === 'whatsapp' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <Key className="w-6 h-6 text-[#FF7A59] dark:text-white" />
              <div>
                <h3 className="text-lg font-bold text-white">Vector 1: Crypt14 / Crypt15 WhatsApp Decryption Engine</h3>
                <p className="text-xs opacity-75">Decrypt msgstore.db.crypt14 / crypt15 databases into queryable SQLite records</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-4">
                <div>
                  <label className="block text-xs font-mono font-bold text-white uppercase tracking-wider mb-2">
                    64-Character Hexadecimal Key Vector
                  </label>
                  <input
                    type="text"
                    value={hexKey}
                    onChange={(e) => setHexKey(e.target.value)}
                    placeholder="e.g. 4a2f8b91c03e5d7a6b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a"
                    className="w-full bg-black/30 dark:bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-xs font-mono text-white placeholder-white/40 focus:outline-none focus:border-[#FF7A59] focus:ring-1 focus:ring-[#FF7A59] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-white uppercase tracking-wider mb-2">
                    Or WhatsApp Binary Key File Path
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={keyFilePath}
                      onChange={(e) => setKeyFilePath(e.target.value)}
                      placeholder="/Users/investigator/Cases/extracted_keys/whatsapp.key"
                      className="flex-1 bg-black/30 dark:bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-xs font-mono text-white placeholder-white/40 focus:outline-none focus:border-[#FF7A59] focus:ring-1 focus:ring-[#FF7A59] transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap gap-3">
                  <button
                    onClick={handleDecryptWhatsApp}
                    disabled={isDecrypting || (!hexKey && !keyFilePath)}
                    className="px-6 py-3 rounded-full bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white font-bold text-xs font-mono transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>{isDecrypting ? 'Decrypting Database...' : 'Execute Vector 1 Decryption'}</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-4 bg-black/20 dark:bg-black/40 rounded-2xl p-5 border border-white/10 space-y-3 font-mono text-xs">
                <span className="text-[10px] uppercase font-bold text-[#FF7A59] dark:text-white block">Engine Specifications</span>
                <ul className="space-y-2 opacity-80 text-[11px]">
                  <li>• Supports AES-GCM 256-bit encryption</li>
                  <li>• Auto-strips 122-byte crypt14/15 IV header</li>
                  <li>• Validates SQLite header signature</li>
                  <li>• Emits decrypted msgstore.db & contacts</li>
                </ul>
              </div>
            </div>

            {decryptionStatus && (
              <div className={`p-4 rounded-2xl border text-xs font-mono flex items-center gap-2 shadow-sm ${
                decryptionStatus.startsWith('Success') ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-red-500/20 border-red-500/40 text-red-300'
              }`}>
                {decryptionStatus.startsWith('Success') ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
                <span>{decryptionStatus}</span>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VECTOR 2: VOLATILE RAM HEAP DUMP                                          */}
        {/* ========================================================================= */}
        {activeVector === 'ram' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <Cpu className="w-6 h-6 text-[#FF7A59] dark:text-white" />
              <div>
                <h3 className="text-lg font-bold text-white">Vector 2: Volatile RAM Heap Dump Analyzer</h3>
                <p className="text-xs opacity-75">Executes 6 parallel volatile memory dump methods to extract AES keys directly from runtime RAM</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-black/20 dark:bg-black/40 border border-white/10 space-y-2 text-xs font-mono">
              <div className="flex items-center gap-2 text-amber-300">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-bold">Extraction Chain:</span>
              </div>
              <p className="opacity-80 text-[11px] font-sans">
                1. `am dumpheap` (Android Activity Manager) → 2. Root `/proc/[pid]/mem` mapping → 3. Debugger attach → 4. Art runtime heap snapshot → 5. Key entropy analyzer → 6. Automated AES test decryption.
              </p>
            </div>

            <button
              onClick={handleDumpHeap}
              disabled={isDumpingHeap}
              className="px-6 py-3 rounded-full bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white font-bold text-xs font-mono transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Cpu className="w-4 h-4" />
              <span>{isDumpingHeap ? 'Executing RAM Dump Chain...' : 'Trigger Volatile RAM Dump & Scan'}</span>
            </button>

            {heapStatus && (
              <div className={`p-4 rounded-2xl border text-xs font-mono flex items-center gap-2 ${
                heapStatus.startsWith('Success') ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-white/10 border-white/20 text-white'
              }`}>
                <span>{heapStatus}</span>
              </div>
            )}

            {heapResult && (
              <div className="p-4 rounded-2xl bg-black/40 border border-white/15 font-mono text-xs space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#FF7A59] dark:text-white block">Extracted Memory Results:</span>
                <pre className="text-[11px] opacity-90 overflow-x-auto text-emerald-300">{JSON.stringify(heapResult, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VECTOR 3: MEDIATEK BROM / HARDWARE EXPLOITATION                           */}
        {/* ========================================================================= */}
        {activeVector === 'hardware' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <Zap className="w-6 h-6 text-[#FF7A59] dark:text-white" />
              <div>
                <h3 className="text-lg font-bold text-white">Vector 3: MediaTek BROM / Chipset Hardware Exploitation</h3>
                <p className="text-xs opacity-75">Bypass bootloader and secure boot on MediaTek devices via low-level BROM / Preloader handshake</p>
              </div>
            </div>

            {v6Step === 0 && (
              <div className="space-y-4">
                <p className="text-xs opacity-85">
                  Inspect the connected device bootloader, chipset family (MT6765, MT6768, MT6833, etc.), and hardware test points.
                </p>
                <button
                  onClick={handleInspectPhysical}
                  disabled={isInspectingPhysical}
                  className="px-6 py-3 rounded-full bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white font-bold text-xs font-mono shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isInspectingPhysical ? 'animate-spin' : ''}`} />
                  <span>{isInspectingPhysical ? 'Querying Chipset...' : 'Inspect Chipset & Bootloader'}</span>
                </button>
              </div>
            )}

            {v6Step === 1 && (
              <div className="space-y-4 p-5 rounded-2xl bg-black/20 border border-white/15">
                <span className="text-sm font-bold text-white block">Step 2: Initialize Exploit Framework</span>
                <p className="text-xs opacity-80 font-sans">
                  Target device is MediaTek. Initialize the native `mtkclient` payload handlers and payload injection DA (Download Agent).
                </p>
                <button
                  onClick={handleV6Setup}
                  className="px-5 py-2.5 rounded-full bg-[#FF7A59] dark:bg-white dark:text-black text-white font-bold text-xs font-mono shadow cursor-pointer"
                >
                  Initialize mtkclient Framework
                </button>
              </div>
            )}

            {v6Step === 2 && (
              <div className="space-y-4 p-5 rounded-2xl bg-black/20 border border-white/15">
                <span className="text-sm font-bold text-white block">Step 3: Enter BROM / Hardware Mode</span>
                <ol className="text-xs space-y-1.5 opacity-85 list-decimal list-inside font-sans">
                  <li>Power OFF the target device completely.</li>
                  <li>Hold <strong>Volume Down</strong> (or both Volume buttons).</li>
                  <li>Insert the USB cable while holding the button.</li>
                </ol>
                <button
                  onClick={handleV6Extract}
                  className="px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs font-mono shadow cursor-pointer flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  <span>Execute BROM Dump & Payload Handshake</span>
                </button>
              </div>
            )}

            {(v6Step === 4 || v6Step === 5 || v6Step === 6) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-white">Live BROM Telemetry Logs</span>
                  <span className="text-[10px] font-mono opacity-70">
                    {v6Step === 4 ? 'Status: Running Handshake' : v6Step === 5 ? 'Status: Complete' : 'Status: Handshake Error'}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-black/70 border border-white/15 font-mono text-xs h-48 overflow-y-auto text-emerald-400">
                  <pre className="whitespace-pre-wrap">{v6Logs || 'Waiting for serial probe...'}</pre>
                </div>
              </div>
            )}

            {physicalInfo && (
              <div className="p-4 rounded-2xl bg-black/40 border border-white/15 font-mono text-xs space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#FF7A59] dark:text-white block">Detected Chipset Architecture</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                  <div><span className="opacity-60 block">Vendor:</span> <span className="font-bold">{physicalInfo.chipFamily || 'Generic'}</span></div>
                  <div><span className="opacity-60 block">Chipset:</span> <span className="font-bold">{physicalInfo.chipset || 'Unknown'}</span></div>
                  <div><span className="opacity-60 block">Bootloader:</span> <span className="font-bold">{physicalInfo.bootloaderLocked ? 'Locked' : 'Unlocked'}</span></div>
                  <div><span className="opacity-60 block">Exploit Vector:</span> <span className="font-bold text-emerald-400">{physicalInfo.exploitVector || 'BROM'}</span></div>
                </div>
              </div>
            )}

            {physicalStatus && (
              <div className="p-3.5 rounded-xl bg-white/10 border border-white/15 text-xs font-mono text-white">
                {physicalStatus}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VECTOR 4: NOTIFICATION STREAM SCRAPER                                     */}
        {/* ========================================================================= */}
        {activeVector === 'notifications' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <Bell className="w-6 h-6 text-[#FF7A59] dark:text-white" />
              <div>
                <h3 className="text-lg font-bold text-white">Vector 4: Notification Stream Scraper</h3>
                <p className="text-xs opacity-75">Harvests live and pending encrypted notifications from Android NotificationListenerService</p>
              </div>
            </div>

            <p className="text-xs opacity-85">
              Access decrypted chat messages, sender identities, and previews that have surfaced in the device notification bar even when SQLite storage is protected.
            </p>

            <button
              onClick={handleScrapeNotifications}
              disabled={isScrapingNotifications}
              className="px-6 py-3 rounded-full bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white font-bold text-xs font-mono shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Bell className="w-4 h-4" />
              <span>{isScrapingNotifications ? 'Scraping Notification Buffer...' : 'Scrape Active Notifications'}</span>
            </button>

            {notificationStatus && (
              <div className="p-4 rounded-2xl bg-white/10 border border-white/20 text-xs font-mono text-white">
                {notificationStatus}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VECTOR 5: ACCESSIBILITY UI SCREEN EXTRACTOR                               */}
        {/* ========================================================================= */}
        {activeVector === 'ui' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <Eye className="w-6 h-6 text-[#FF7A59] dark:text-white" />
              <div>
                <h3 className="text-lg font-bold text-white">Vector 5: Accessibility UI Screen Harvester</h3>
                <p className="text-xs opacity-75">Directly parses visible chat text from foreground Android UI nodes</p>
              </div>
            </div>

            <p className="text-xs opacity-85">
              Extracts the active screen DOM hierarchy via `uiautomator dump` to capture visible messages without needing SQLite keys or root privilege.
            </p>

            <button
              onClick={handleScrapeLiveUi}
              disabled={isScrapingLiveUi}
              className="px-6 py-3 rounded-full bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white font-bold text-xs font-mono shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Eye className="w-4 h-4" />
              <span>{isScrapingLiveUi ? 'Parsing Screen Hierarchy...' : 'Capture Active Screen Messages'}</span>
            </button>

            {liveUiStatus && (
              <div className="p-4 rounded-2xl bg-white/10 border border-white/20 text-xs font-mono text-white">
                {liveUiStatus}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VECTOR 6: ENCRYPTED MEDIA PARTITION HARVESTER                             */}
        {/* ========================================================================= */}
        {activeVector === 'media' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <HardDrive className="w-6 h-6 text-[#FF7A59] dark:text-white" />
              <div>
                <h3 className="text-lg font-bold text-white">Vector 6: Encrypted Media Partition Harvester</h3>
                <p className="text-xs opacity-75">Extract voice notes (.opus), photos, and documents from external media storage</p>
              </div>
            </div>

            <p className="text-xs opacity-85">
              Pulls all unencrypted voice recordings, received documents, and thumbnails stored in `/sdcard/WhatsApp/Media` and `/sdcard/Android/media/com.whatsapp`.
            </p>

            <button
              onClick={handleHarvestMedia}
              disabled={isHarvestingMedia}
              className="px-6 py-3 rounded-full bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white font-bold text-xs font-mono shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <HardDrive className="w-4 h-4" />
              <span>{isHarvestingMedia ? 'Harvesting Media Files...' : 'Harvest WhatsApp Media Files'}</span>
            </button>

            {mediaHarvestStatus && (
              <div className="p-4 rounded-2xl bg-white/10 border border-white/20 text-xs font-mono text-white">
                {mediaHarvestStatus}
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
};
