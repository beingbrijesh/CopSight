import { useState } from 'react';
import { X, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { caseAPI } from '../lib/api';

interface CaseReviewModalProps {
  caseData: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const CaseReviewModal = ({ caseData, onClose, onSuccess }: CaseReviewModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // modify mode state
  const [isModifying, setIsModifying] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleAction = async (action: 'accept' | 'reject' | 'modify') => {
    if (action === 'modify' && !feedback.trim()) {
      setError('Feedback is required when requesting modifications.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      await caseAPI.reviewCase(caseData.id, { action, feedback });
      
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit review');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Review Case Assignment</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Case Details</h3>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Case Number</label>
                    <p className="font-medium text-gray-900">{caseData.caseNumber}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Priority</label>
                    <p className="font-medium capitalize text-gray-900">{caseData.priority}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500">Title</label>
                    <p className="font-medium text-gray-900">{caseData.title}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500">Description</label>
                    <p className="text-sm text-gray-700 mt-1">{caseData.description || 'No description provided.'}</p>
                  </div>
                </div>
              </div>
            </div>

            {isModifying ? (
               <div className="animate-fade-in">
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   Feedback / Required Modifications
                 </label>
                 <textarea
                   value={feedback}
                   onChange={(e) => setFeedback(e.target.value)}
                   rows={4}
                   required
                   placeholder="Describe what needs to be changed before you can accept this case..."
                   className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                 />
                 <div className="mt-4 flex gap-3">
                   <button
                     onClick={() => setIsModifying(false)}
                     disabled={loading}
                     className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
                   >
                     Cancel
                   </button>
                   <button
                     onClick={() => handleAction('modify')}
                     disabled={loading || !feedback.trim()}
                     className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                   >
                     {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Feedback'}
                   </button>
                 </div>
               </div>
            ) : (
                <div>
                   <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Review Action</h3>
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                     <button
                       onClick={() => handleAction('accept')}
                       disabled={loading}
                       className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-green-100 bg-green-50 hover:bg-green-100 hover:border-green-200 transition gap-2"
                     >
                       <CheckCircle className="w-8 h-8 text-green-600" />
                       <span className="font-semibold text-green-800">Accept Case</span>
                     </button>
                     
                     <button
                        onClick={() => setIsModifying(true)}
                        disabled={loading}
                        className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-blue-100 bg-blue-50 hover:bg-blue-100 hover:border-blue-200 transition gap-2"
                     >
                        <AlertCircle className="w-8 h-8 text-blue-600" />
                        <span className="font-semibold text-blue-800">Request Modify</span>
                     </button>

                     <button
                        onClick={() => handleAction('reject')}
                        disabled={loading}
                        className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-red-100 bg-red-50 hover:bg-red-100 hover:border-red-200 transition gap-2"
                     >
                        <XCircle className="w-8 h-8 text-red-600" />
                        <span className="font-semibold text-red-800">Reject Case</span>
                     </button>
                   </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
