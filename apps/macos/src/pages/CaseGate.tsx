import React, { useEffect, useState } from 'react';
import { FolderKey, Search, Calendar, ArrowRight, RefreshCw, LogOut, CheckCircle2, AlertCircle, FolderX } from 'lucide-react';
import { ForensicCase, useCaseStore } from '../store/caseStore';
import { useAuthStore } from '../store/authStore';
import { caseService } from '../lib/api';
import logoImg from '../assets/logo.jpeg';

export const CaseGate: React.FC = () => {
  const { assignedCases, setAssignedCases, selectedCase, setSelectedCase, isLoading, setIsLoading } = useCaseStore();
  const { officer, logout } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [fetchError, setFetchError] = useState<string>('');

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    setIsLoading(true);
    setFetchError('');
    try {
      const cases = await caseService.getAssignedCases();
      if (Array.isArray(cases)) {
        setAssignedCases(cases);
      } else {
        setAssignedCases([]);
      }
    } catch (e: any) {
      console.error('Failed to fetch assigned cases from backend:', e);
      setFetchError(
        e.response?.data?.message ||
          e.message ||
          'Failed to connect to backend server. Please verify backend-node is running.'
      );
      setAssignedCases([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCases = assignedCases.filter((c) => {
    const caseNum = c.caseNumber || (c as any).fir_number || '';
    const title = c.title || '';
    const suspect = c.suspectName || '';

    const matchesSearch =
      caseNum.toLowerCase().includes(searchTerm.toLowerCase()) ||
      title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      suspect.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'ALL' || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleSelectCase = (c: ForensicCase) => {
    setSelectedCase(c);
  };

  return (
    <div className="min-h-screen w-full flex flex-col p-2 sm:p-4 pt-2 select-none overflow-y-auto transition-colors duration-300">
      
      {/* Top Floating Pill Header (Aligned with window traffic lights) */}
      <header className="glass-panel rounded-full py-2 px-3 sm:px-5 pl-20 sm:pl-24 flex items-center justify-between gap-3 mb-6 shadow-lg titlebar-drag-region">
        <div className="flex items-center gap-2.5 no-drag">
          <div className="w-8 h-8 rounded-full bg-white p-1 flex items-center justify-center shadow-md ring-2 ring-white/40 overflow-hidden flex-shrink-0">
            <img src={logoImg} alt="CopSight Logo" className="w-full h-full object-contain rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold text-white uppercase tracking-tight">CopSight AI</h1>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/20 text-white font-bold">
                STAGE 2: CASE SELECTION
              </span>
            </div>
            <p className="text-[9px] font-mono text-white opacity-75">Assigned Case Repository & Custody Chain</p>
          </div>
        </div>

        {/* Officer Profile & Sign Out */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-white">
              {officer?.fullName || officer?.username}
            </div>
            <div className="text-[10px] font-mono text-white opacity-75">
              Badge: #{officer?.badgeNumber || 'N/A'} • {officer?.rank || officer?.role?.replace('_', ' ') || 'Investigating Officer'}
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full btn-danger text-xs font-mono font-bold transition-all cursor-pointer shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl w-full mx-auto flex-1 flex flex-col">
        
        {/* Search & Filter Bar */}
        <div className="glass-panel rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4 shadow-md">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-4 h-4 text-white/50 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Case Number, Title, or Suspect Name..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-black/30 dark:bg-black/50 border border-white/20 text-xs font-mono text-white placeholder:text-white/40 focus:border-[#FF7A59] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                filterStatus === 'ALL'
                  ? 'bg-[#FF7A59] text-white dark:bg-white dark:text-black shadow-md'
                  : 'bg-white/10 text-white/80 border border-white/15 hover:bg-white/20'
              }`}
            >
              All Cases ({assignedCases.length})
            </button>
            <button
              onClick={loadCases}
              disabled={isLoading}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs font-mono shadow-sm"
              title="Refresh Cases"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Error Display */}
        {fetchError && (
          <div className="mb-6 p-4 rounded-2xl alert-danger flex items-start gap-3 text-xs font-mono shadow-md">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-300 dark:text-rose-400" />
            <div className="flex-1">
              <p className="font-bold text-white">Backend Communication Error</p>
              <p className="text-white/90 mt-0.5">{fetchError}</p>
            </div>
            <button
              onClick={loadCases}
              className="px-3 py-1 rounded-xl bg-red-800/40 hover:bg-red-800/60 dark:bg-rose-500/30 text-white font-bold cursor-pointer transition-colors border border-red-300/30"
            >
              Retry
            </button>
          </div>
        )}

        {/* Cases Grid or Empty State */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-white opacity-75 font-mono text-xs">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-white" />
            <span>Loading assigned cases from central database...</span>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center space-y-3 glass-panel rounded-2xl p-8 shadow-lg">
            <FolderX className="w-12 h-12 text-white/50 mx-auto" />
            <h3 className="text-base font-bold text-white">No Assigned Cases Found</h3>
            <p className="text-xs font-mono text-white opacity-75 max-w-md">
              There are currently no cases assigned to officer account <strong className="text-[#FF7A59] dark:text-white">"{officer?.username}"</strong> in the database.
            </p>
            <p className="text-[11px] font-mono text-white opacity-60">
              Please assign a case to this officer account in the supervisor portal, or create a new case as admin.
            </p>
            <button
              onClick={loadCases}
              className="mt-3 px-5 py-2.5 rounded-xl bg-[#FF7A59] hover:bg-[#ff6540] text-white dark:bg-white dark:text-black font-mono text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              Refresh Case List
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 flex-1 items-start">
            {filteredCases.map((c) => {
              const isSelected = selectedCase?.id === c.id;
              const caseNum = c.caseNumber || (c as any).fir_number || `CASE-${c.id}`;

              return (
                <div
                  key={c.id}
                  onClick={() => handleSelectCase(c)}
                  className={`glass-panel rounded-2xl p-5 border transition-all cursor-pointer flex flex-col justify-between h-[230px] shadow-lg ${
                    isSelected
                      ? 'border-[#FF7A59] dark:border-white ring-2 ring-[#FF7A59]/50 shadow-xl bg-black/30 dark:bg-white/10'
                      : 'hover:border-white/30 hover:scale-[1.01]'
                  }`}
                >
                  <div>
                    {/* Top Case Tag & Priority */}
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <FolderKey className={`w-4 h-4 ${isSelected ? 'text-[#FF7A59] dark:text-white' : 'text-white/70'}`} />
                        <span className="text-xs font-mono font-bold text-white tracking-wider">
                          {caseNum}
                        </span>
                      </div>
                      {c.priority && (
                        <span
                          className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            c.priority === 'CRITICAL'
                              ? 'badge-danger'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {c.priority}
                        </span>
                      )}
                    </div>

                    {/* Title & Category */}
                    <h3 className="text-sm font-bold text-white line-clamp-1">{c.title}</h3>
                    <p className="text-[11px] font-mono text-[#FF7A59] dark:text-white opacity-80 mt-0.5">
                      {c.category || (c as any).caseType || 'General Investigation'}
                    </p>

                    {/* Description & Date */}
                    <div className="mt-3 space-y-1 text-[11px] font-mono text-white opacity-70">
                      {c.description && (
                        <p className="text-[11px] line-clamp-2">{c.description}</p>
                      )}
                      {c.createdAt && (
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <Calendar className="w-3 h-3" />
                          <span>Created: {new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Select Action */}
                  <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-white opacity-70 uppercase tracking-wider">
                      Status: <span className="text-emerald-400 font-bold">{c.status || 'ACTIVE'}</span>
                    </span>

                    <div className="flex items-center gap-1 text-xs font-mono font-bold">
                      {isSelected ? (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Selected
                        </span>
                      ) : (
                        <span className="text-white hover:text-[#FF7A59]">Select Case &rarr;</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected Case Bottom Confirmation Bar */}
        {selectedCase && (
          <div className="glass-panel sticky bottom-6 rounded-2xl p-4 border border-[#FF7A59] dark:border-white shadow-2xl mt-6 flex flex-wrap items-center justify-between gap-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FF7A59]/20 dark:bg-white/10 flex items-center justify-center text-[#FF7A59] dark:text-white">
                <FolderKey className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">Active Case Locked:</span>
                  <span className="text-xs font-mono font-extrabold text-[#FF7A59] dark:text-white">
                    {selectedCase.caseNumber || (selectedCase as any).fir_number}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-white opacity-75">{selectedCase.title}</p>
              </div>
            </div>

            <button
              onClick={() => {
                useCaseStore.getState().setSelectedCase(selectedCase);
              }}
              className="py-3 px-6 rounded-xl bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white font-mono text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 shadow-lg active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>Enter Forensic Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
