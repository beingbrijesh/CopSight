import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Activity, SearchCode, CloudUpload, BookmarkCheck, FileBarChart, Loader2, AlertCircle, CheckCircle2, RefreshCw, Network, Brain, Gauge, Link2 } from 'lucide-react';
import { caseAPI, uploadAPI } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { CrossCaseConnections } from '../../components/CrossCaseConnections';
import { AnomalyDetection } from '../../components/AnomalyDetection';
import { PredictiveAnalytics } from '../../components/PredictiveAnalytics';

type AITab = 'cross-case' | 'anomaly' | 'predictive';

export const CaseDetail = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<any>(null);
  const [processing, setProcessing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [showQueryPrompt, setShowQueryPrompt] = useState(false);
  const [fileJustProcessed, setFileJustProcessed] = useState(false);
  const [activeAITab, setActiveAITab] = useState<AITab>('cross-case');
  const [mountedAITabs, setMountedAITabs] = useState<Set<AITab>>(new Set(['cross-case']));
  const { user } = useAuthStore();
  const rolePrefix = user?.role === 'supervisor' ? '/supervisor' : '/io';

  const pollingInterval = useRef<number | null>(null);

  useEffect(() => {
    loadCaseData();
    startPollingJobs();
    
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [caseId]);

  // Reset file processing state when case changes
  useEffect(() => {
    setFileJustProcessed(false);
    setShowQueryPrompt(false);
  }, [caseId]);

  // Stagger component loading to prevent simultaneous API calls
  const [componentsLoaded, setComponentsLoaded] = useState(false);

  useEffect(() => {
    if (caseData) {
      const timer = setTimeout(() => {
        setComponentsLoaded(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [caseData]);

  const startPollingJobs = useCallback(() => {
    if (pollingInterval.current) {
      return;
    }

    let currentInterval = 30000;

    const pollJobs = async () => {
      try {
        const response = await uploadAPI.getProcessingSummary(parseInt(caseId!));
        const data = response.data.data;
        const jobs = data.jobs || [];
        const active = jobs.filter((job: any) => 
          job.status === 'processing' || job.status === 'pending'
        );
        
        const hasHighProgress = active.some((job: any) => job.progress >= 80);
        const newInterval = hasHighProgress ? 5000 : 30000;
        
        if (newInterval !== currentInterval && pollingInterval.current) {
          clearInterval(pollingInterval.current);
          currentInterval = newInterval;
          pollingInterval.current = setInterval(pollJobs, currentInterval);
        }
        
        setActiveJobs(active);
        setProcessing(data);
        
        if (active.length === 0 && jobs.length > 0 && fileJustProcessed) {
          const hasCompleted = jobs.some((job: any) => job.status === 'completed');
          if (hasCompleted && !showQueryPrompt) {
            setShowQueryPrompt(true);
            await loadCaseData();
            if (pollingInterval.current) {
              clearInterval(pollingInterval.current);
              pollingInterval.current = null;
            }
          }
        }
      } catch (error) {
        console.error('Failed to poll jobs:', error);
      }
    };

    pollJobs();
    pollingInterval.current = setInterval(pollJobs, currentInterval);
  }, [caseId, showQueryPrompt, fileJustProcessed]);

  const loadCaseData = async () => {
    try {
      setLoading(true);
      const caseRes = await caseAPI.getCase(parseInt(caseId!));
      setCaseData(caseRes.data.data.case);
      
      try {
        const processingRes = await uploadAPI.getProcessingSummary(parseInt(caseId!));
        setProcessing(processingRes.data.data);
        
        const jobs = processingRes.data.data.jobs || [];
        const active = jobs.filter((job: any) => 
          job.status === 'processing' || job.status === 'pending'
        );
        setActiveJobs(active);
      } catch (procError) {
        console.error('Failed to load processing summary:', procError);
        setProcessing({ devices: [], jobs: [], entityCount: 0, entityTypes: [] });
      }
    } catch (error) {
      console.error('Failed to load case:', error);
      setCaseData({
        id: parseInt(caseId!),
        title: `Case ${caseId}`,
        caseNumber: caseId,
        description: 'Case details could not be loaded due to server error.',
        status: 'error',
        priority: 'Unknown',
        unit: 'Unknown',
        created_at: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(false);
    setShowQueryPrompt(false);
    setFileJustProcessed(false);
    
    if (!pollingInterval.current) {
      startPollingJobs();
    }

    try {
      setUploading(true);
      const response = await uploadAPI.uploadFile(parseInt(caseId!), file, (progress) => {
        setUploadProgress(progress);
      });
      
      setUploadSuccess(true);
      setFileJustProcessed(true);
      
      if (response.data.data.jobId) {
        const newJob = {
          id: response.data.data.jobId,
          status: 'pending',
          progress: 0,
          jobType: 'parse_ufdr',
          created_at: new Date().toISOString()
        };
        setActiveJobs([newJob]);
        
        setProcessing((prev: any) => ({
          ...prev,
          jobs: [newJob, ...(prev?.jobs || [])]
        }));
      }
      
      setTimeout(() => {
        loadCaseData();
        setUploadSuccess(false);
      }, 2000);
    } catch (error: any) {
      console.error('Upload failed:', error);
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to upload file. Please try again.';
      setUploadError(errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl py-12">
        <div className="flex flex-col items-center justify-center text-gray-500 dark:text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
          <p className="text-sm">Loading case details...</p>
        </div>
      </div>
    );
  }

  const quickActions = [
    { label: 'Upload Data', subtitle: 'UFDR / XML', icon: CloudUpload, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', isUpload: true },
    { label: 'Query AI', subtitle: 'Natural language', icon: SearchCode, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10', to: `${rolePrefix}/case/${caseId}/query` },
    { label: 'Entities', subtitle: 'Extracted data', icon: Activity, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', to: `${rolePrefix}/case/${caseId}/entities` },
    { label: 'Bookmarks', subtitle: 'Saved evidence', icon: BookmarkCheck, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', to: `${rolePrefix}/case/${caseId}/bookmarks` },
    { label: 'Report', subtitle: 'Generate PDF', icon: FileBarChart, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/10', to: `${rolePrefix}/case/${caseId}/report` },
    { label: 'Network', subtitle: '3D Graph', icon: Network, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10', to: `${rolePrefix}/case/${caseId}/network` },
  ];

  const aiTabs: { key: AITab; label: string; icon: typeof Brain }[] = [
    { key: 'cross-case', label: 'Cross-Case Intel', icon: Link2 },
    { key: 'anomaly', label: 'Anomaly Detection', icon: Brain },
    { key: 'predictive', label: 'Predictive Analytics', icon: Gauge },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">
      {/* ─── Case Header ─── */}
      <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-white/10 p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{caseData?.title}</h1>
            <p className="text-sm text-gray-500 dark:text-slate-500 mt-0.5">Case #{caseData?.caseNumber}</p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            caseData?.status === 'ready_for_analysis' ? 'bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300' :
            caseData?.status === 'processing' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300' :
            'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
          }`}>
            {caseData?.status?.replace('_', ' ')}
          </span>
        </div>
        {caseData?.description && (
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">{caseData.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-500">
            <span className="font-medium text-gray-700 dark:text-slate-300">{caseData?.priority}</span> priority
          </div>
          <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-500">
            Unit: <span className="font-medium text-gray-700 dark:text-slate-300">{caseData?.unit}</span>
          </div>
          <div className="text-gray-500 dark:text-slate-500">
            Created {new Date(caseData?.created_at).toLocaleDateString('en-IN', {
              timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: 'numeric'
            })}
          </div>
        </div>
      </div>

      {/* ─── Processing Complete Prompt ─── */}
      {showQueryPrompt && activeJobs.length === 0 && (
        <div className="bg-gradient-to-r from-purple-50 dark:from-purple-500/10 to-blue-50 dark:to-blue-500/10 border border-purple-200 dark:border-purple-500/30 rounded-2xl p-5 animate-fade-in">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Processing Complete — Ready to Analyze</h3>
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">
                Your UFDR file has been processed. Query the data or explore the evidence.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setFileJustProcessed(false); navigate(`${rolePrefix}/case/${caseId}/query`); }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition flex items-center gap-2 text-sm font-medium shadow-sm"
                >
                  <SearchCode className="w-4 h-4" />
                  Start Querying
                </button>
                <button
                  onClick={() => { setShowQueryPrompt(false); setFileJustProcessed(false); }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Quick Actions ─── */}
      <div>
        <p className="section-label mb-3">Quick Actions</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 stagger-children">
          {quickActions.map((action) => {
            const Icon = action.icon;
            if (action.isUpload) {
              return (
                <label
                  key={action.label}
                  htmlFor="file-upload"
                  className={`${action.bg} rounded-2xl p-4 cursor-pointer card-hover-lift border border-transparent hover:border-blue-200 dark:hover:border-blue-500/30 transition-all animate-fade-in group`}
                >
                  <Icon className={`w-6 h-6 ${action.color} mb-2 group-hover:scale-110 transition-transform`} />
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{action.label}</div>
                  <div className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">{action.subtitle}</div>
                </label>
              );
            }
            return (
              <button
                key={action.label}
                onClick={() => navigate(action.to!)}
                className={`${action.bg} rounded-2xl p-4 text-left card-hover-lift border border-transparent hover:border-gray-200 dark:hover:border-white/10 transition-all animate-fade-in group`}
              >
                <Icon className={`w-6 h-6 ${action.color} mb-2 group-hover:scale-110 transition-transform`} />
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{action.label}</div>
                <div className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">{action.subtitle}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Upload Section ─── */}
      <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-white/10 p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <CloudUpload className="w-5 h-5 text-blue-500" />
          Upload Forensic File
        </h2>
        
        {uploadSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">File uploaded — processing started.</p>
          </div>
        )}
        
        {uploadError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl">
            <p className="text-sm text-red-700 dark:text-red-300 font-medium">✗ {uploadError}</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {uploadError.includes('Invalid file type')
                ? 'Only UFDR, XML, JSON, ZIP, UFD, and DFXML files are supported.'
                : 'Please check the file and try again.'}
            </p>
          </div>
        )}
        
        <div className="border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl p-6 text-center hover:border-blue-300 dark:hover:border-blue-500/30 transition-colors">
          <CloudUpload className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">
            {uploading ? `Uploading... ${uploadProgress}%` : 'Drag & drop or click to upload UFDR/XML files'}
          </p>
          {uploading && (
            <div className="w-full max-w-xs mx-auto bg-gray-200 dark:bg-slate-700 rounded-full h-1.5 mb-3">
              <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
          <input
            type="file"
            accept=".xml,.json,.zip,.ufd,.ufdr,.dfxml"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className={`inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl cursor-pointer hover:bg-blue-700 transition text-sm font-medium ${
              uploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <CloudUpload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Choose File'}
          </label>
        </div>
      </div>

      {/* ─── Active Processing Jobs ─── */}
      {activeJobs.length > 0 && (
        <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-white/10 p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              Processing
            </h2>
            <button
              onClick={loadCaseData}
              className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 rounded-lg text-xs hover:bg-gray-200 dark:hover:bg-slate-700 transition flex items-center gap-1.5 font-medium"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
          <div className="space-y-3">
            {activeJobs.map((job: any) => (
              <div key={job.id} className="border border-gray-200 dark:border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {job.jobType === 'parse_ufdr' ? 'Parsing UFDR File' : job.jobType}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {job.progress || 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${job.progress || 0}%` }} />
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
                  {job.progress < 30 && 'Parsing file structure...'}
                  {job.progress >= 30 && job.progress < 50 && 'Extracting device information...'}
                  {job.progress >= 50 && job.progress < 80 && 'Processing data sources...'}
                  {job.progress >= 80 && 'Finalizing and indexing...'}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-3 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Processing may take several minutes. You can navigate away and return later.
          </p>
        </div>
      )}

      {/* ─── Data Summary + Recent Jobs ─── */}
      {processing && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Data Summary */}
          <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-white/10 p-6 h-[420px] flex flex-col overflow-hidden">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              Data Summary
            </h2>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
              <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Devices Processed</span>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{processing.devices?.length || 0}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-500">Total devices from UFDR files</p>
              </div>

              <div className="p-4 bg-purple-50 dark:bg-purple-500/10 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Entities Extracted</span>
                  <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{processing.entityCount || 0}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-500">Names, locations, organizations</p>
              </div>

              {processing.entityTypes && processing.entityTypes.length > 0 && (
                <div className="pt-2 border-t border-gray-200 dark:border-white/10">
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Entity Breakdown</p>
                  <div className="space-y-1.5">
                    {processing.entityTypes.map((et: any) => (
                      <div key={et.type} className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-slate-400 capitalize">{et.type.replace('_', ' ')}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{et.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Jobs */}
          <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-white/10 p-6 h-[420px] flex flex-col overflow-hidden">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FileBarChart className="w-5 h-5 text-indigo-500" />
              Recent Jobs
            </h2>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {processing.jobs && processing.jobs.length > 0 ? (
                <div className="space-y-2.5">
                  {processing.jobs.slice(0, 5).map((job: any) => (
                    <div key={job.id} className="p-3 border border-gray-100 dark:border-white/10 rounded-xl">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Job #{job.id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          job.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' :
                          job.status === 'failed' ? 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-300' :
                          job.status === 'processing' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300' :
                          'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
                        }`}>
                          {job.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-500">
                        {new Date(job.created_at).toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                      {job.errorMessage && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">Error: {job.errorMessage}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-500 dark:text-slate-500">
                  <FileBarChart className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm">No processing jobs yet</p>
                  <p className="text-xs mt-0.5">Upload a UFDR file to start</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Failed Jobs Alert ─── */}
      {processing?.jobs && processing.jobs.length > 0 && processing.jobs[0].status === 'failed' && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-300 mb-1">Processing Failed</h3>
              <p className="text-sm text-red-700 dark:text-red-400 mb-2">
                {processing.jobs[0].errorMessage || 'An error occurred while processing the file.'}
              </p>
              <div className="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20 p-2.5 rounded-lg mt-1">
                <p className="font-medium mb-1">Common issues:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>File must be a valid CopSight/Cellebrite XML export</li>
                  <li>Ensure the file is not corrupted</li>
                  <li>Check the correct format (.xml, .ufdr)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── AI Intelligence Section (Tabbed) ─── */}
      {caseData && componentsLoaded && (
        <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-white/10 overflow-hidden">
          <div className="border-b border-gray-200 dark:border-white/10 px-6 pt-4 pb-0">
            <p className="section-label mb-3">AI Intelligence</p>
            <div className="flex gap-1">
              {aiTabs.map(({ key, label, icon: TabIcon }) => (
                <button
                  key={key}
                  onClick={() => {
                    setActiveAITab(key);
                    setMountedAITabs(prev => new Set(prev).add(key));
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all ${
                    activeAITab === key
                      ? 'bg-white dark:bg-white/5 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 border-b-transparent -mb-px'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5'
                  }`}
                >
                  <TabIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="p-0">
            <div className={activeAITab === 'cross-case' ? 'block' : 'hidden'}>
              {mountedAITabs.has('cross-case') && <CrossCaseConnections caseId={parseInt(caseId!)} />}
            </div>
            <div className={activeAITab === 'anomaly' ? 'block' : 'hidden'}>
              {mountedAITabs.has('anomaly') && <AnomalyDetection caseId={parseInt(caseId!)} />}
            </div>
            <div className={activeAITab === 'predictive' ? 'block' : 'hidden'}>
              {mountedAITabs.has('predictive') && <PredictiveAnalytics caseId={parseInt(caseId!)} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
