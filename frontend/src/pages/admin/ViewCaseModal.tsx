import { X, FileText, User, Calendar, Tag, Shield, Building } from 'lucide-react';

interface ViewCaseModalProps {
  caseData: any;
  onClose: () => void;
}

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-gray-100 text-gray-800',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  processing: 'bg-blue-100 text-blue-800',
  ready_for_analysis: 'bg-purple-100 text-purple-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  closed: 'bg-gray-100 text-gray-800',
  created: 'bg-yellow-100 text-yellow-800',
};

export const ViewCaseModal = ({ caseData, onClose }: ViewCaseModalProps) => {
  const c = caseData;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gray-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Case Details</h2>
              <p className="text-sm text-gray-500">#{c.caseNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-2 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Title and Badges */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{c.title}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  statusColors[c.status] || 'bg-gray-100 text-gray-800'
                }`}
              >
                {c.status.replace(/_/g, ' ')}
              </span>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  priorityColors[c.priority] || 'bg-gray-100 text-gray-800'
                }`}
              >
                {c.priority} priority
              </span>
              {c.caseType && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {c.caseType}
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          {c.description && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                Description
              </p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 leading-relaxed">
                {c.description}
              </p>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <User className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned Officer
                </p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">
                  {c.assignedOfficer?.fullName || 'Unassigned'}
                </p>
                {c.assignedOfficer?.badgeNumber && (
                  <p className="text-xs text-gray-500">
                    Badge: {c.assignedOfficer.badgeNumber}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Building className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">
                  {c.unit || 'N/A'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Shield className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supervisor
                </p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">
                  {c.supervisor?.fullName || 'N/A'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">
                  {new Date(c.created_at).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {c.updated_at && (
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Tag className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Updated
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">
                    {new Date(c.updated_at).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 pt-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
