import { useState, useEffect } from 'react';
import { Network, AlertTriangle, Users, Link, Eye } from 'lucide-react';
import { crossCaseAPI } from '../lib/api';

interface CrossCaseConnection {
  caseId: number;
  caseNumber: string;
  title: string;
  linkType: string;
  entityType: string;
  entityValue: string;
  strength: 'weak' | 'medium' | 'strong' | 'critical';
  confidence: number;
  metadata?: {
    aiAnalysis?: {
      analysis: string;
      citations: string[];
      confidence: number;
      risk_level: string;
    };
    matchType?: string;
    frequency?: number;
    lastSeen?: string;
  };
}

interface CrossCaseConnectionsProps {
  caseId: number;
}

export const CrossCaseConnections = ({ caseId }: CrossCaseConnectionsProps) => {
  const [connections, setConnections] = useState<CrossCaseConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchConnections();
  }, [caseId]);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      const response = await crossCaseAPI.getConnections(caseId);
      const dbLinks = response.data.data.databaseLinks || [];
      
      // Filter out self-links (defense-in-depth) and map to component format
      const validLinks = dbLinks.filter((link: any) => {
        const src = Number(link.source_case_id);
        const tgt = Number(link.target_case_id);
        return src !== tgt; // Exclude self-links
      });

      setConnections(validLinks.map((link: any) => {
        // Determine which side is the "other" case
        const isSource = Number(link.source_case_id) === caseId;
        const otherCase = isSource ? link.targetCase : link.sourceCase;

        return {
          // Align with snake_case backend schema
          caseId: isSource ? link.target_case_id : link.source_case_id,
          caseNumber: otherCase?.caseNumber || 'N/A',
          title: otherCase?.title || 'Unknown Case',
          linkType: link.link_type || 'shared_entity',
          entityType: link.entity_type || 'entity',
          entityValue: link.entity_value || '',
          strength: link.strength || 'weak',
          confidence: Number(link.confidence_score) || 0,
          metadata: link.link_metadata || {}
        };
      }));
    } catch (err) {
      setError('Failed to load cross-case connections');
      console.error('Error fetching connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    try {
      setAnalyzing(true);
      setError(null);
      await crossCaseAPI.analyzeCase(caseId);
      await fetchConnections();
    } catch (err) {
      setError('Analysis failed. Please try again later.');
      console.error('Error analyzing connections:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'critical': return 'text-red-700 bg-red-100 border-red-200';
      case 'strong': return 'text-orange-700 bg-orange-100 border-orange-200';
      case 'medium': return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      case 'weak': return 'text-blue-700 bg-blue-100 border-blue-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  const getStrengthIcon = (strength: string) => {
    switch (strength) {
      case 'critical': return <AlertTriangle className="w-4 h-4" />;
      case 'strong': return <Network className="w-4 h-4" />;
      case 'medium': return <Link className="w-4 h-4" />;
      case 'weak': return <Users className="w-4 h-4" />;
      default: return <Link className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          <span className="mt-4 text-gray-500 font-medium">Scanning for cross-case links...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-[500px] flex flex-col">
      <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Network className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Cross-Case Intelligence
              </h3>
              <p className="text-xs text-gray-500">Detecting relationships across the repository</p>
            </div>
            <span className="ml-2 bg-indigo-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
              {connections.length}
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${
                analyzing 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
              }`}
            >
              <Network className={`w-4 h-4 ${analyzing ? 'animate-pulse' : ''}`} />
              {analyzing ? 'Analyzing connections...' : 'Sync Intelligence'}
            </button>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
            >
              <Eye className="w-4 h-4" />
              {showDetails ? 'Condensed View' : 'Full Reports'}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}


        {connections.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <Network className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h4 className="text-xl font-bold text-gray-900 mb-2">
              No Latent Connections Found
            </h4>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Our AI engine hasn't detected any significant overlaps with other cases in the current repository.
            </p>
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {analyzing ? 'Processing Dataset...' : 'Trigger Automated Analysis'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {connections.map((connection, index) => (
              <div
                key={index}
                className={`group border rounded-xl overflow-hidden transition-all duration-300 ${
                  expandedIndex === index 
                  ? 'border-indigo-300 ring-2 ring-indigo-50 shadow-md' 
                  : 'border-gray-200 hover:border-indigo-200 hover:shadow-sm'
                }`}
              >
                <div 
                  className="p-5 cursor-pointer bg-white"
                  onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                          Forensic Link
                        </span>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm ${getStrengthColor(connection.strength)}`}>
                          {getStrengthIcon(connection.strength)}
                          {connection.strength.toUpperCase()}
                        </div>
                      </div>

                      <h4 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                        Case {connection.caseNumber}: {connection.title}
                      </h4>

                      <div className="mt-4 flex flex-wrap items-center gap-y-2 gap-x-6 text-sm">
                        <div className="flex items-center gap-2 text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                          <Link className="w-4 h-4 text-gray-400" />
                          <span className="font-semibold text-gray-900">{connection.linkType}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span>Linked via <strong>{connection.entityType}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 rounded-full" 
                              style={{ width: `${connection.confidence * 100}%` }}
                            />
                          </div>
                          <span className="font-bold text-indigo-600">{(connection.confidence * 100).toFixed(0)}% Match</span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className={`p-2 rounded-lg transition-colors ${expandedIndex === index ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 group-hover:bg-gray-50'}`}>
                        <Eye className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </div>

                {(expandedIndex === index || showDetails) && (
                  <div className="border-t border-indigo-100 bg-indigo-50/20 p-5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 space-y-4">
                        <div className="bg-white rounded-xl p-5 border border-indigo-200 shadow-sm">
                          <div className="flex items-center gap-2 mb-4 text-indigo-700">
                            <Network className="w-5 h-5" />
                            <h5 className="font-bold">AI Detailed Forensic Analysis</h5>
                          </div>
                          <p className="text-gray-700 leading-relaxed text-sm whitespace-pre-wrap">
                            {connection.metadata?.aiAnalysis?.analysis || 
                             `This connection was established based on the shared ${connection.entityType}: "${connection.entityValue}". 
                             The high overlap suggests potential involvement in the same investigative thread.`}
                          </p>
                        </div>
                        
                        {connection.metadata?.aiAnalysis?.citations && connection.metadata.aiAnalysis.citations.length > 0 && (
                          <div className="bg-white rounded-xl p-5 border border-indigo-100">
                            <h5 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                              <span className="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
                              Ground of Evidences
                            </h5>
                            <ul className="space-y-2">
                              {connection.metadata.aiAnalysis.citations.map((cite, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                                  <span className="flex-shrink-0 w-5 h-5 bg-indigo-50 rounded text-indigo-600 flex items-center justify-center font-bold text-[10px]">
                                    {i + 1}
                                  </span>
                                  {cite}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="bg-white rounded-xl p-5 border border-gray-200">
                          <h5 className="font-bold text-gray-900 mb-4">Connection Details</h5>
                          <div className="space-y-3 text-sm">
                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                              <span className="text-gray-500">Shared Entity</span>
                              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-indigo-600 font-bold">
                                {connection.entityValue}
                              </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-50">
                              <span className="text-gray-500">Match Type</span>
                              <span className="font-medium text-gray-900">{connection.metadata?.matchType || 'Direct Match'}</span>
                            </div>
                            {connection.metadata?.frequency && (
                              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                <span className="text-gray-500">Interaction Frequency</span>
                                <span className="font-bold text-indigo-600">{connection.metadata.frequency} events</span>
                              </div>
                            )}
                            {connection.metadata?.lastSeen && (
                              <div className="flex justify-between items-center py-2">
                                <span className="text-gray-500">Last Interaction</span>
                                <span className="font-medium text-gray-900">
                                  {new Date(connection.metadata.lastSeen).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className={`rounded-xl p-5 border shadow-sm ${
                          connection.metadata?.aiAnalysis?.risk_level === 'critical' ? 'bg-red-50 border-red-100' :
                          connection.metadata?.aiAnalysis?.risk_level === 'high' ? 'bg-orange-50 border-orange-100' :
                          'bg-indigo-50 border-indigo-100'
                        }`}>
                          <h5 className={`font-bold mb-2 flex items-center gap-2 ${
                            connection.metadata?.aiAnalysis?.risk_level === 'critical' ? 'text-red-700' :
                            connection.metadata?.aiAnalysis?.risk_level === 'high' ? 'text-orange-700' :
                            'text-indigo-700'
                          }`}>
                            <AlertTriangle className="w-4 h-4" />
                            Intelligence Risk Level
                          </h5>
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                            connection.metadata?.aiAnalysis?.risk_level === 'critical' ? 'bg-red-200 text-red-800' :
                            connection.metadata?.aiAnalysis?.risk_level === 'high' ? 'bg-orange-200 text-orange-800' :
                            'bg-indigo-200 text-indigo-800'
                          }`}>
                            {connection.metadata?.aiAnalysis?.risk_level || 'EVALUATING'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-gray-400 uppercase tracking-tighter">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
              Live Link Database Active
            </div>
            <div className="flex gap-6">
              <span className="flex items-center gap-1.5 hover:text-red-600 transition-colors cursor-help">
                <AlertTriangle className="w-3.5 h-3.5" /> Critical Risk
              </span>
              <span className="flex items-center gap-1.5 hover:text-orange-600 transition-colors cursor-help">
                <Network className="w-3.5 h-3.5" /> High Signal
              </span>
              <span className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors cursor-help">
                <Link className="w-3.5 h-3.5" /> Verified Link
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
