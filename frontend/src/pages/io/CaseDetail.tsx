import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Search, Bookmark, FileText, Activity } from 'lucide-react';
import { caseAPI, uploadAPI } from '../../lib/api';
import { Navbar } from '../../components/Navbar';

export const CaseDetail = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<any>(null);
  const [processing, setProcessing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    loadCaseData();
  }, [caseId]);

  const loadCaseData = async () => {
    try {
      setLoading(true);
      const [caseRes, processingRes] = await Promise.all([
        caseAPI.getCase(parseInt(caseId!)),
        uploadAPI.getProcessingSummary(parseInt(caseId!))
      ]);
      setCaseData(caseRes.data.data.case);
      setProcessing(processingRes.data.data);
    } catch (error) {
      console.error('Failed to load case:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      await uploadAPI.uploadFile(parseInt(caseId!), file, (progress) => {
        setUploadProgress(progress);
      });
      setTimeout(loadCaseData, 2000);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload file');
    } finally {
      setUploading(false);
      setUploadProgress(0);
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
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              {uploading ? `Uploading... ${uploadProgress}%` : 'Upload UFDR/XML file for processing'}
            </p>
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

        {processing && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Processing Status
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Devices Processed</span>
                  <span className="text-sm text-gray-600">{processing.devices?.length || 0}</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Entities Extracted</span>
                  <span className="text-sm text-gray-600">{processing.entityCount || 0}</span>
                </div>
              </div>
              {processing.entityTypes?.map((et: any) => (
                <div key={et.type} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{et.type.replace('_', ' ')}</span>
                  <span className="font-medium">{et.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
