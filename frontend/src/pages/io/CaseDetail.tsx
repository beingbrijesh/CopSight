import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Search, Bookmark, FileText, Activity, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { caseAPI, uploadAPI } from '../../lib/api';
import { Navbar } from '../../components/Navbar';
import { CrossCaseConnections } from '../../components/CrossCaseConnections';
import { AnomalyDetection } from '../../components/AnomalyDetection';
import { PredictiveAnalytics } from '../../components/PredictiveAnalytics';

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

  const startPollingJobs = () => {
    // Poll for active jobs every 2 seconds
    pollingInterval.current = setInterval(async () => {
      try {
        const response = await uploadAPI.getProcessingSummary(parseInt(caseId!));
        const data = response.data.data;
        const jobs = data.jobs || [];
        const active = jobs.filter((job: any) => 
          job.status === 'processing' || job.status === 'pending'
        );
        
        // Debug logging
        if (active.length > 0) {
          console.log('Active jobs:', active);
        }
        
        // Update active jobs
        setActiveJobs(active);
        
        // Update processing data (for summary section)
        setProcessing(data);
        
        // If no active jobs and we have completed jobs, show query prompt
        if (active.length === 0 && jobs.length > 0) {
          const hasCompleted = jobs.some((job: any) => job.status === 'completed');
          if (hasCompleted && !showQueryPrompt) {
            setShowQueryPrompt(true);
            // Reload full case data when processing completes
            await loadCaseData();
            // Stop polling when all jobs are done
            if (pollingInterval.current) {
              clearInterval(pollingInterval.current);
              pollingInterval.current = null;
            }
          }
        }
      } catch (error) {
        console.error('Failed to poll jobs:', error);
        // Don't clear active jobs on error - keep showing what we have
      }
    }, 2000);
  };

  const loadCaseData = async () => {
    try {
      setLoading(true);
      const caseRes = await caseAPI.getCase(parseInt(caseId!));
      setCaseData(caseRes.data.data.case);
      
      // Try to load processing summary, but don't fail if it errors
      try {
        const processingRes = await uploadAPI.getProcessingSummary(parseInt(caseId!));
        setProcessing(processingRes.data.data);
        
        // Also check for active jobs
        const jobs = processingRes.data.data.jobs || [];
        const active = jobs.filter((job: any) => 
          job.status === 'processing' || job.status === 'pending'
        );
        setActiveJobs(active);
      } catch (procError) {
        console.error('Failed to load processing summary:', procError);
        // Set empty processing data so UI doesn't break
        setProcessing({ devices: [], jobs: [], entityCount: 0, entityTypes: [] });
      }
    } catch (error) {
      console.error('Failed to load case:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset states
    setUploadError(null);
    setUploadSuccess(false);
    setShowQueryPrompt(false); // Hide old query prompts
    
    // Restart polling if it was stopped
    if (!pollingInterval.current) {
      startPollingJobs();
    }

    try {
      setUploading(true);
      const response = await uploadAPI.uploadFile(parseInt(caseId!), file, (progress) => {
        setUploadProgress(progress);
      });
      
      // Show success message
      setUploadSuccess(true);
      
      // Add the new job to active jobs immediately
      if (response.data.data.jobId) {
        const newJob = {
          id: response.data.data.jobId,
          status: 'pending',
          progress: 0,
          jobType: 'parse_ufdr',
          created_at: new Date().toISOString()
        };
        setActiveJobs([newJob]);
        
        // Also update the processing jobs list
        setProcessing((prev: any) => ({
          ...prev,
          jobs: [newJob, ...(prev?.jobs || [])]
        }));
      }
      
      // Reload case data after a short delay
      setTimeout(() => {
        loadCaseData();
        setUploadSuccess(false);
      }, 2000);
    } catch (error: any) {
      console.error('Upload failed:', error);
      
      // Extract error message
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to upload file. Please try again.';
      setUploadError(errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      
      // Reset file input to allow re-uploading the same file
      e.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500">Loading case...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/io')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Cases
        </button>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{caseData?.title}</h1>
              <p className="text-gray-600 mt-1">Case #{caseData?.caseNumber}</p>
            </div>
            <span className={`px-3 py-1 rounded text-sm font-medium ${
              caseData?.status === 'ready_for_analysis' ? 'bg-purple-100 text-purple-800' :
              caseData?.status === 'processing' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {caseData?.status?.replace('_', ' ')}
            </span>
          </div>
          <p className="text-gray-700 mb-4">{caseData?.description}</p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Priority:</span>
              <span className="ml-2 font-medium">{caseData?.priority}</span>
            </div>
            <div>
              <span className="text-gray-500">Unit:</span>
              <span className="ml-2 font-medium">{caseData?.unit}</span>
            </div>
            <div>
              <span className="text-gray-500">Created:</span>
              <span className="ml-2 font-medium">
                {new Date(caseData?.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Prompt after successful processing */}
        {showQueryPrompt && activeJobs.length === 0 && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Processing Complete! Ready to Analyze
                </h3>
                <p className="text-gray-700 mb-4">
                  Your UFDR file has been processed successfully. You can now query the data or visualize the evidence.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate(`/io/case/${caseId}/query`)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    Start Querying Data
                  </button>
                  <button
                    onClick={() => setShowQueryPrompt(false)}
                    className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <button className="bg-white p-4 rounded-lg shadow hover:shadow-md transition">
            <Upload className="w-6 h-6 text-blue-600 mb-2" />
            <div className="text-sm font-medium">Upload Data</div>
          </button>
          <button 
            onClick={() => navigate(`/io/case/${caseId}/query`)}
            className="bg-white p-4 rounded-lg shadow hover:shadow-md transition"
          >
            <Search className="w-6 h-6 text-purple-600 mb-2" />
            <div className="text-sm font-medium">Execute Query</div>
          </button>
          <button 
            onClick={() => navigate(`/io/case/${caseId}/bookmarks`)}
            className="bg-white p-4 rounded-lg shadow hover:shadow-md transition"
          >
            <Bookmark className="w-6 h-6 text-orange-600 mb-2" />
            <div className="text-sm font-medium">Bookmarks</div>
          </button>
          <button 
            onClick={() => navigate(`/io/case/${caseId}/report`)}
            className="bg-white p-4 rounded-lg shadow hover:shadow-md transition"
          >
            <FileText className="w-6 h-6 text-green-600 mb-2" />
            <div className="text-sm font-medium">Generate Report</div>
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Upload UFDR File</h2>
          
          {/* Success Message */}
          {uploadSuccess && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-medium">✓ File uploaded successfully! Processing started.</p>
            </div>
          )}
          
          {/* Error Message */}
          {uploadError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">✗ {uploadError}</p>
              <p className="text-red-600 text-sm mt-1">Please check the file format and try again.</p>
            </div>
          )}
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              {uploading ? `Uploading... ${uploadProgress}%` : 'Upload UFDR/XML file for processing'}
            </p>
            {uploading && (
              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
            <input
              type="file"
              accept=".xml,.json,.zip,.ufd,.ufdr"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className={`inline-block px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition ${
                uploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {uploading ? 'Uploading...' : 'Choose File'}
            </label>
          </div>
        </div>

        {/* Failed Jobs Alert - Only show if latest job failed */}
        {processing?.jobs && processing.jobs.length > 0 && processing.jobs[0].status === 'failed' && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 mb-2">
                  Processing Failed
                </h3>
                <div>
                  <p className="text-red-800 mb-2">
                    {processing.jobs[0].errorMessage || 'An error occurred while processing the file.'}
                  </p>
                  <div className="text-sm text-red-700 bg-red-100 p-3 rounded mt-2">
                    <p className="font-medium mb-1">Common issues:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>File must be a valid UFDR/Cellebrite XML export</li>
                      <li>Ensure the file is not corrupted</li>
                      <li>Check that you're uploading the correct file format (.xml, .ufdr)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Processing Jobs */}
        {activeJobs.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              Active Processing Jobs
            </h2>
            <div className="space-y-4">
              {activeJobs.map((job: any) => (
                <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-gray-900">
                        {job.jobType === 'parse_ufdr' ? 'Parsing UFDR File' : job.jobType}
                      </span>
                    </div>
                    <span className="text-sm text-gray-600">
                      {job.status === 'processing' ? 'Processing...' : 'Pending...'}
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{job.progress || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${job.progress || 0}%` }}
                      />
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-500">
                    {job.progress < 30 && 'Parsing file structure...'}
                    {job.progress >= 30 && job.progress < 50 && 'Extracting device information...'}
                    {job.progress >= 50 && job.progress < 80 && 'Processing data sources...'}
                    {job.progress >= 80 && 'Finalizing and indexing...'}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Processing may take several minutes depending on file size. You can navigate away and come back later.
              </p>
            </div>
          </div>
        )}

        {/* Cross-Case Connections */}
        {caseData && (
          <CrossCaseConnections caseId={parseInt(caseId!)} />
        )}

        {/* ML Anomaly Detection */}
        {caseData && (
          <AnomalyDetection caseId={parseInt(caseId!)} />
        )}

        {/* Predictive Analytics */}
        {caseData && (
          <PredictiveAnalytics caseId={parseInt(caseId!)} />
        )}

        {/* Processing Summary & Job History */}
        {processing && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Data Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Data Summary
              </h2>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">Devices Processed</span>
                    <span className="text-2xl font-bold text-blue-600">{processing.devices?.length || 0}</span>
                  </div>
                  <p className="text-xs text-gray-600">Total devices extracted from UFDR files</p>
                </div>
                
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">Entities Extracted</span>
                    <span className="text-2xl font-bold text-purple-600">{processing.entityCount || 0}</span>
                  </div>
                  <p className="text-xs text-gray-600">Names, locations, organizations, etc.</p>
                </div>
                
                {processing.entityTypes && processing.entityTypes.length > 0 && (
                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-2">Entity Breakdown:</p>
                    <div className="space-y-2">
                      {processing.entityTypes.map((et: any) => (
                        <div key={et.type} className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 capitalize">{et.type.replace('_', ' ')}</span>
                          <span className="font-medium text-gray-900">{et.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Jobs */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Recent Processing Jobs
              </h2>
              {processing.jobs && processing.jobs.length > 0 ? (
                <div className="space-y-3">
                  {processing.jobs.slice(0, 5).map((job: any) => (
                    <div key={job.id} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          Job #{job.id}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          job.status === 'completed' ? 'bg-green-100 text-green-800' :
                          job.status === 'failed' ? 'bg-red-100 text-red-800' :
                          job.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {job.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">
                        {new Date(job.created_at).toLocaleString()}
                      </p>
                      {job.errorMessage && (
                        <p className="text-xs text-red-600 mt-1">Error: {job.errorMessage}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm">No processing jobs yet</p>
                  <p className="text-xs mt-1">Upload a UFDR file to start processing</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
