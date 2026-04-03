import { useState, useEffect } from 'react';
import { Search, Plus, Eye } from 'lucide-react';
import { caseAPI } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { CreateCase } from './CreateCase';
import { ViewCaseModal } from './ViewCaseModal';
import { CaseReviewModal } from '../../components/CaseReviewModal';
import { useLocation } from 'react-router-dom';

export const CaseList = () => {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [reviewCase, setReviewCase] = useState<any>(null);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';
  const location = useLocation();

  // Handle URL parameters for direct linking to review
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const reviewTargetId = searchParams.get('reviewCase');
    if (reviewTargetId && cases.length > 0) {
      const targetCase = cases.find((c: any) => c.id.toString() === reviewTargetId);
      if (targetCase && targetCase.status === 'created' && isSupervisor) {
        setReviewCase(targetCase);
      }
    }
  }, [location.search, cases, isSupervisor]);

  useEffect(() => {
    loadCases();
  }, [statusFilter]);

  const loadCases = async () => {
    try {
      setLoading(true);
      const params = statusFilter ? { status: statusFilter } : {};
      const response = await caseAPI.getCases(params);
      setCases(response.data.data.cases || []);
    } catch (error) {
      console.error('Failed to load cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCases = cases.filter((c: any) =>
    c.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Case Management</h2>
            <p className="text-gray-600 mt-1">Manage all investigation cases</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreateCase(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <Plus className="w-4 h-4" />
              Create Case
            </button>
          )}
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search cases..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="created">Created</option>
              <option value="active">Active</option>
              <option value="processing">Processing</option>
              <option value="ready_for_analysis">Ready for Analysis</option>
              <option value="under_review">Under Review</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading cases...</div>
          ) : filteredCases.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No cases found</div>
          ) : (
            <div className="divide-y">
              {filteredCases.map((c: any) => (
                <div key={c.id} className="p-6 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{c.title}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          c.status === 'active' ? 'bg-green-100 text-green-800' :
                          c.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          c.status === 'ready_for_analysis' ? 'bg-purple-100 text-purple-800' :
                          c.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {c.status.replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          c.priority === 'critical' ? 'bg-red-100 text-red-800' :
                          c.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                          c.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {c.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{c.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="font-medium">#{c.caseNumber}</span>
                        <span>•</span>
                        <span>Assigned: {c.assignedOfficer?.fullName || 'Unassigned'}</span>
                        <span>•</span>
                        <span>Unit: {c.unit || 'N/A'}</span>
                        <span>•</span>
                        <span>Created: {new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setSelectedCase(c)}
                        className="flex items-center gap-2 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition text-sm font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      
                      {isSupervisor && c.status === 'created' && (
                        <button 
                          onClick={() => setReviewCase(c)}
                          className="flex items-center gap-2 px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition text-sm font-medium bg-white shadow-sm"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      {showCreateCase && (
        <CreateCase
          onClose={() => setShowCreateCase(false)}
          onSuccess={loadCases}
        />
      )}

      {selectedCase && (
        <ViewCaseModal
          caseData={selectedCase}
          onClose={() => setSelectedCase(null)}
        />
      )}

      {reviewCase && (
        <CaseReviewModal
          caseData={reviewCase}
          onClose={() => setReviewCase(null)}
          onSuccess={loadCases}
        />
      )}
    </div>
  );
};
