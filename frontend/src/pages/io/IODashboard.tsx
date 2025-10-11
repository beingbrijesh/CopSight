import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Upload, Search, Bookmark } from 'lucide-react';
import { caseAPI } from '../../lib/api';
import { Navbar } from '../../components/Navbar';

export const IODashboard = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      setLoading(true);
      const response = await caseAPI.getCases();
      setCases(response.data.data.cases || []);
    } catch (error) {
      console.error('Failed to load cases:', error);
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">My Cases</h2>
          <p className="text-gray-600 mt-1">Assigned investigations and evidence</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="flex items-center gap-3">
              <FolderOpen className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{cases.length}</p>
                <p className="text-xs text-gray-600">Assigned Cases</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="flex items-center gap-3">
              <Upload className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">0</p>
                <p className="text-xs text-gray-600">Files Uploaded</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">0</p>
                <p className="text-xs text-gray-600">Queries Executed</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
            <div className="flex items-center gap-3">
              <Bookmark className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">0</p>
                <p className="text-xs text-gray-600">Evidence Bookmarked</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Active Cases</h3>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading cases...</div>
          ) : cases.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No cases assigned yet
            </div>
          ) : (
            <div className="divide-y">
              {cases.map((c: any) => (
                <div key={c.id} className="p-6 hover:bg-gray-50 cursor-pointer transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-gray-900">{c.title}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          c.status === 'active' ? 'bg-green-100 text-green-800' :
                          c.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          c.status === 'ready_for_analysis' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {c.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{c.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Case #{c.caseNumber}</span>
                        <span>•</span>
                        <span>Priority: {c.priority}</span>
                        <span>•</span>
                        <span>Unit: {c.unit}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => navigate(`/io/case/${c.id}`)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                    >
                      Open Case
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
