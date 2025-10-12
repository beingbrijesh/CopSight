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
}

interface CrossCaseConnectionsProps {
  caseId: number;
}

export const CrossCaseConnections = ({ caseId }: CrossCaseConnectionsProps) => {
  const [connections, setConnections] = useState<CrossCaseConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, [caseId]);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      const response = await crossCaseAPI.getConnections(caseId);
      setConnections(response.data.data.databaseLinks.map((link: any) => ({
        caseId: link.sourceCaseId === caseId ? link.targetCaseId : link.sourceCaseId,
        caseNumber: link.sourceCase?.caseNumber || link.targetCase?.caseNumber,
        title: link.sourceCase?.title || link.targetCase?.title,
        linkType: link.linkType,
        entityType: link.entityType,
        entityValue: link.entityValue,
        strength: link.strength,
        confidence: link.confidenceScore
      })));
    } catch (err) {
      setError('Failed to load cross-case connections');
      console.error('Error fetching connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'strong': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'weak': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
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
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="ml-2 text-gray-600">Loading connections...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-medium text-gray-900">
              Cross-Case Connections
            </h3>
            <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {connections.length}
            </span>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800"
          >
            <Eye className="w-4 h-4" />
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
        </div>
      </div>

      <div className="p-6">
        {connections.length === 0 ? (
          <div className="text-center py-8">
            <Network className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              No Cross-Case Connections
            </h4>
            <p className="text-gray-600 mb-4">
              This case has no connections to other cases yet.
            </p>
            <button
              onClick={fetchConnections}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              Analyze for Connections
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {connections.slice(0, showDetails ? connections.length : 3).map((connection, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-gray-900">
                        Case {connection.caseNumber}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStrengthColor(connection.strength)}`}>
                        {getStrengthIcon(connection.strength)}
                        {connection.strength.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mb-2">
                      {connection.title}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>
                        <strong>Type:</strong> {connection.linkType}
                      </span>
                      <span>
                        <strong>Entity:</strong> {connection.entityType}
                      </span>
                      <span>
                        <strong>Confidence:</strong> {(connection.confidence * 100).toFixed(0)}%
                      </span>
                    </div>

                    {showDetails && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                        <strong>Connected via:</strong> {connection.entityValue}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {connections.length > 3 && !showDetails && (
              <div className="text-center pt-4">
                <button
                  onClick={() => setShowDetails(true)}
                  className="text-purple-600 hover:text-purple-800 font-medium"
                >
                  Show all {connections.length} connections
                </button>
              </div>
            )}
          </div>
        )}

        {connections.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                <strong>Connection Strength Legend:</strong>
              </span>
              <div className="flex gap-4">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-600" />
                  Critical
                </span>
                <span className="flex items-center gap-1">
                  <Network className="w-3 h-3 text-orange-600" />
                  Strong
                </span>
                <span className="flex items-center gap-1">
                  <Link className="w-3 h-3 text-yellow-600" />
                  Medium
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-blue-600" />
                  Weak
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
