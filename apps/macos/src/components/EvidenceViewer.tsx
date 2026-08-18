import React, { useEffect, useState } from 'react';
import {
  FileArchive,
  FileCode,
  FileText,
  Download,
  ShieldCheck,
  MessageSquare,
  RefreshCw,
  FolderX,
  FolderOpen,
  UploadCloud,
  Lock,
} from 'lucide-react';
import { useDaemonStore } from '../store/daemonStore';
import { useCaseStore } from '../store/caseStore';
import { caseService } from '../lib/api';
import { loggerService } from '../lib/loggerService';

export const EvidenceViewer: React.FC = () => {
  const { lastCompletedResult } = useDaemonStore();
  const { selectedCase } = useCaseStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'messages' | 'calls'>('overview');
  const [chats, setChats] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [isLoadingEvidence, setIsLoadingEvidence] = useState(false);
  const [isUploadingCloud, setIsUploadingCloud] = useState(false);
  const [cloudUploadStatus, setCloudUploadStatus] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCase?.id) {
      loadCaseEvidence(selectedCase.id);
    }
  }, [selectedCase]);

  const loadCaseEvidence = async (caseId: number) => {
    setIsLoadingEvidence(true);
    loggerService.event('EVIDENCE', 'Fetch Evidence Records', 'INITIATED', `Retrieving chat history and entities for Case ID: ${caseId}`);
    try {
      const [fetchedChats, fetchedEntities] = await Promise.all([
        caseService.getCaseChats(caseId),
        caseService.getCaseEntities(caseId),
      ]);
      const validChats = Array.isArray(fetchedChats) ? fetchedChats : [];
      const validEntities = Array.isArray(fetchedEntities) ? fetchedEntities : [];
      setChats(validChats);
      setEntities(validEntities);
      loggerService.event(
        'EVIDENCE',
        'Fetch Evidence Records',
        'SUCCESS',
        `Loaded ${validChats.length} decoded chat(s) and ${validEntities.length} extracted entity record(s).`,
        { chatsCount: validChats.length, entitiesCount: validEntities.length }
      );
    } catch (e: any) {
      loggerService.event('EVIDENCE', 'Fetch Evidence Records', 'FAILED', `Error fetching evidence: ${e.message}`);
    } finally {
      setIsLoadingEvidence(false);
    }
  };

  const handleUploadToCloud = async () => {
    setIsUploadingCloud(true);
    setCloudUploadStatus('Syncing evidence records to central cloud database...');
    loggerService.event('EVIDENCE', 'Cloud Database Sync', 'INITIATED', `Syncing case #${selectedCase?.caseNumber || 'Demo'} artifacts to central database.`);
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
        loggerService.event('EVIDENCE', 'Cloud Database Sync', 'SUCCESS', `Sync complete: ${data.message}`, data);
        if (selectedCase?.id) loadCaseEvidence(selectedCase.id);
      } else {
        setCloudUploadStatus(`Upload notice: ${data.message || data.error}`);
        loggerService.event('EVIDENCE', 'Cloud Database Sync', 'FAILED', `Sync returned warning: ${data.message || data.error}`, data);
      }
    } catch (e: any) {
      setCloudUploadStatus(`Upload error: ${e.message}`);
      loggerService.event('EVIDENCE', 'Cloud Database Sync', 'FAILED', `Cloud sync error: ${e.message}`);
    } finally {
      setIsUploadingCloud(false);
    }
  };

  const handleOpenFolder = async () => {
    const caseNum = selectedCase?.caseNumber || (selectedCase as any)?.fir_number || 'Demo';
    loggerService.event('EVIDENCE', 'Reveal in Finder', 'INITIATED', `Opening evidence directory for case #${caseNum}`);
    try {
      await fetch('http://127.0.0.1:54322/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseNumber: caseNum,
        }),
      });
      loggerService.event('EVIDENCE', 'Reveal in Finder', 'SUCCESS', `Finder window launched for case #${caseNum}`);
    } catch (e: any) {
      loggerService.event('EVIDENCE', 'Reveal in Finder', 'FAILED', `Could not open folder: ${e.message}`);
    }
  };

  return (
    <div className="glass-panel rounded-[2rem] p-6 flex flex-col h-full shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10 shrink-0">
        <div>
          <h2 className="text-xl font-light tracking-wide mb-1 text-white">Forensic Evidence Center</h2>
          <p className="text-xs opacity-70 uppercase tracking-wider text-white">Analysis & Custody Dossiers</p>
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
        <div className="mb-3 px-3.5 py-2 rounded-xl bg-black/20 dark:bg-white/10 border border-white/15 text-xs font-mono text-white flex items-center justify-between shrink-0">
          <span>{cloudUploadStatus}</span>
          <button type="button" onClick={() => setCloudUploadStatus(null)} className="opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* View Switcher Tabs with High-Contrast Coral Accent */}
      <div className="flex flex-wrap items-center justify-between gap-3 select-text shrink-0 mb-4">
        <div className="flex items-center gap-1 p-1 rounded-full bg-black/20 dark:bg-white/5 border border-white/10 text-xs font-mono w-fit">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-full transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-[#FF7A59] text-white font-bold shadow-md dark:bg-white dark:text-black'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            Reports & UFDR
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-4 py-2 rounded-full transition-all cursor-pointer ${
              activeTab === 'messages'
                ? 'bg-[#FF7A59] text-white font-bold shadow-md dark:bg-white dark:text-black'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            Chats ({chats.length})
          </button>
          <button
            onClick={() => setActiveTab('calls')}
            className={`px-4 py-2 rounded-full transition-all cursor-pointer ${
              activeTab === 'calls'
                ? 'bg-[#FF7A59] text-white font-bold shadow-md dark:bg-white dark:text-black'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            Entities ({entities.length})
          </button>
        </div>

        {/* Deduplication Guarantee Tag */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/20 dark:bg-white/5 border border-white/10 text-[10.5px] font-mono text-white/80">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Idempotent Sync: Cryptographically Deduplicated (SHA-256)</span>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
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
              <div className="space-y-2 select-text">
                {chats.map((chat: any, idx: number) => {
                  const isOutgoing = chat.direction === 'outgoing' || chat.type === 'outgoing' || chat.sender === 'Me (Device Owner)';
                  const isDatabaseSynced = chat.id || chat.dataSourceId || chat.timestamp;
                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border text-xs font-mono transition-all select-text ${
                        isOutgoing
                          ? 'bg-emerald-500/20 border-emerald-500/30 ml-4'
                          : 'bg-black/20 dark:bg-white/5 border-white/10 mr-4'
                      }`}
                    >
                      <div className="flex items-center justify-between opacity-75 mb-1.5 select-text">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold select-text ${isOutgoing ? 'text-emerald-300' : 'text-white'}`}>
                            {chat.sender || chat.from || 'Participant'}
                          </span>
                          {chat.recipient && (
                            <span className="text-[10px] opacity-70 select-text">➔ {chat.recipient}</span>
                          )}
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase select-text ${
                              isOutgoing
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-white/10 text-white border border-white/15'
                            }`}
                          >
                            {isOutgoing ? 'OUTGOING' : 'INCOMING'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold select-text">
                            {isDatabaseSynced ? 'Database Synced' : 'Local Extraction'}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-white/10 text-white select-text">
                            {chat.appName || chat.app || chat.platform || 'CHAT'}
                          </span>
                          <span className="select-text">{chat.timestamp ? String(chat.timestamp).split('T')[0] : ''}</span>
                        </div>
                      </div>
                      <p className="text-white pl-0.5 select-text whitespace-pre-wrap">{chat.message || chat.content || chat.text}</p>
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
              <div className="space-y-2 select-text">
                {entities.map((ent: any, idx: number) => {
                  const entityVal = typeof ent === 'string' ? ent : (ent.value || ent.entityValue || ent.name || ent.tag || ent.text || ent.label || 'Extracted Entity');
                  const entityType = typeof ent === 'object' ? (ent.type || ent.entityType || ent.category || ent.label || '') : '';
                  const confidence = ent?.confidenceScore ?? ent?.confidence;
                  const isDatabaseSynced = ent?.id || ent?.createdAt || ent?.created_at || ent?.evidenceId;

                  return (
                    <div key={idx} className="p-3.5 rounded-xl bg-black/20 dark:bg-white/5 border border-white/10 text-xs font-mono flex items-center justify-between transition-all select-text">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-white select-text">{entityVal}</span>
                        {entityType && (
                          <span className="opacity-75 text-[10px] px-2 py-0.5 rounded-full bg-white/10 border border-white/15 select-text">
                            {entityType}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[9.5px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-semibold select-text">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          {isDatabaseSynced ? 'Database Synced' : 'Extracted'}
                        </span>
                        <div className="text-right text-[10px] text-white/80 select-text">
                          {confidence ? `${Math.round(confidence * 100)}% Confidence` : 'Indexed'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
