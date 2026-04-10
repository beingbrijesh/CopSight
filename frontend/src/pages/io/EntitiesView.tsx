import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Database, Filter, Search, Download, MessageCircle, Activity, Upload } from 'lucide-react';
import { caseAPI } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Navbar } from '../../components/Navbar';
import { EvidenceChip } from '../../components/EvidenceChip';

interface Entity {
  id: number;
  entityValue: string;
  entityType: string;
  evidenceType: string;
  evidenceId: string;
  confidenceScore: number;
  entityMetadata?: any;
  created_at: string;
}

interface Chat {
  id: string;
  sender: string;
  receiver: string;
  message: string;
  timestamp: string;
  dataSourceId: number;
  appName: string;
}

interface Conversation {
  [key: string]: Chat[];
}

interface EntityType {
  type: string;
  count: number;
}

export const EntitiesView = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([]);
  const [conversations, setConversations] = useState<Conversation>({});
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'entities' | 'chats'>('entities');
  const [selectedType, setSelectedType] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEntities, setTotalEntities] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [chatPage, setChatPage] = useState(1);
  const [totalChats, setTotalChats] = useState(0);
  const [totalChatPages, setTotalChatPages] = useState(0);
  const { user } = useAuthStore();
  const rolePrefix = user?.role === 'supervisor' ? '/supervisor' : '/io';

  useEffect(() => {
    loadEntities();
  }, [caseId, selectedType, currentPage]);

  useEffect(() => {
    if (activeTab === 'chats') {
      loadChats();
    }
  }, [caseId, activeTab, chatPage]);

  const loadEntities = async () => {
    try {
      const params: any = {
        page: currentPage,
        limit: 50
      };

      if (selectedType) {
        params.type = selectedType;
      }

      const response = await caseAPI.getCaseEntities(parseInt(caseId!), params);
      const data = response.data.data;

      setEntities(data.entities);
      setEntityTypes(data.summary.types);
      setTotalEntities(data.pagination.total);
      setTotalPages(data.pagination.pages);
    } catch (error: any) {
      console.error('Failed to load entities:', error);

      // Check if it's a "case not found" error - treat as empty state
      if (error.response?.status === 404 && error.response?.data?.message?.includes('not found')) {
        // Case exists but no entities - show empty state
        setEntities([]);
        setEntityTypes([]);
        setTotalEntities(0);
        setTotalPages(0);
        setError(null); // Clear error to show empty state
      } else {
        // Real error - show error state
        setError(error.response?.data?.message || error.message || 'Failed to load entities');
      }
    }
  };

  const loadChats = async () => {
    try {
      const params: any = {
        page: chatPage,
        limit: 100
      };

      const response = await caseAPI.getCaseChats(parseInt(caseId!), params);
      const data = response.data.data;

      setConversations(data.conversations);
      setTotalChats(data.pagination.total);
      setTotalChatPages(data.pagination.pages);
    } catch (error: any) {
      console.error('Failed to load chats:', error);

      // Check if it's a "case not found" error - treat as empty state
      if (error.response?.status === 404 && error.response?.data?.message?.includes('not found')) {
        // Case exists but no chats - show empty state
        setConversations({});
        setTotalChats(0);
        setTotalChatPages(0);
      } else {
        // Real error - show error state
        setError(error.response?.data?.message || error.message || 'Failed to load chats');
      }
    }
  };

  const filteredEntities = entities.filter(entity =>
    entity.entityValue && entity.entityValue.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportEntities = () => {
    const getFriendlyType = (type: string) => {
      switch (type) {
        case 'phone_number': return 'Phone';
        case 'email': return 'Email';
        case 'crypto_address': return 'Crypto';
        case 'url': return 'URL';
        case 'indian_id': return 'ID';
        case 'ip_address': return 'IP';
        default: return type.replace('_', ' ');
      }
    };

    const csvContent = [
      ['Type', 'Value', 'Evidence Type', 'Evidence ID', 'Confidence', 'Metadata', 'Created At'],
      ...filteredEntities.map(entity => [
        getFriendlyType(entity.entityType),
        entity.entityValue,
        entity.evidenceType,
        entity.evidenceId,
        entity.confidenceScore,
        JSON.stringify(entity.entityMetadata || {}),
        entity.created_at
      ])
    ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `case-${caseId}-entities.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (error) {
    return (
        <div className="mx-auto max-w-7xl py-8">
          <button
            onClick={() => navigate(`${rolePrefix}/case/${caseId}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Case
          </button>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="text-red-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-900">Error Loading Entities</h3>
                <p className="text-red-700 mt-1">{error}</p>
                <p className="text-red-600 text-sm mt-2">
                  This might be because no forensic data has been processed yet, or there was an error during processing.
                </p>
              </div>
            </div>
          </div>
        </div>
    );
  }

  return (
      <div className="mx-auto max-w-7xl py-8">
        <button
          onClick={() => navigate(`${rolePrefix}/case/${caseId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Case
        </button>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Database className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {totalEntities + totalChats > 0 ? 'Extracted Data' : 'Forensic Analysis Ready'}
                </h1>
                <p className="text-gray-600 mt-1">
                  {totalEntities + totalChats > 0
                    ? `All entities and chat messages extracted from case #${caseId}`
                    : `Case #${caseId} is ready for forensic data extraction`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                Total: {totalEntities + totalChats} items
              </span>
              {totalEntities + totalChats > 0 && (
                <button
                  onClick={exportEntities}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('entities')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'entities'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Activity className="w-4 h-4 inline mr-2" />
                Entities ({totalEntities})
              </button>
              <button
                onClick={() => setActiveTab('chats')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'chats'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <MessageCircle className="w-4 h-4 inline mr-2" />
                Chat Messages ({totalChats})
              </button>
            </nav>
          </div>

          {/* Content based on active tab */}
          {activeTab === 'entities' ? (
            <>
              {/* Entity Type Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                {entityTypes.map((type) => (
                  <div
                    key={type.type}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                      selectedType === type.type
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedType(selectedType === type.type ? '' : type.type);
                      setCurrentPage(1);
                    }}
                  >
                    <div className="text-2xl font-bold text-gray-900">{type.count}</div>
                    <div className="text-sm text-gray-600">
                      {type.type === 'phone_number' ? '📱 Phones' :
                       type.type === 'email' ? '✉️ Emails' :
                       type.type === 'crypto_address' ? '₿ Crypto' :
                       type.type === 'url' ? '🔗 URLs' :
                       type.type === 'indian_id' ? '🆔 IDs' :
                       type.type === 'ip_address' ? '🌐 IPs' :
                       type.type.replace('_', ' ')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search entities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                {selectedType && (
                  <button
                    onClick={() => {
                      setSelectedType('');
                      setCurrentPage(1);
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
                  >
                    <Filter className="w-4 h-4" />
                    Clear Filter
                  </button>
                )}
              </div>

              {/* Entities List */}
              <div className="space-y-2">
                {filteredEntities.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-8 border border-blue-200">
                      <Database className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to Extract Forensic Data</h3>
                      <p className="text-gray-600 mb-6 max-w-md mx-auto">
                        No entities have been extracted yet. Upload and process a UFDR file to discover phone numbers, emails, crypto addresses, and chat conversations.
                      </p>
                      <button
                        onClick={() => navigate(`${rolePrefix}/case/${caseId}`)}
                        className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload UFDR File
                      </button>
                    </div>
                  </div>
                ) : (
                  filteredEntities.map((entity) => (
                    <div
                      key={entity.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                              entity.entityType === 'phone_number' ? 'bg-green-100 text-green-800' :
                              entity.entityType === 'email' ? 'bg-blue-100 text-blue-800' :
                              entity.entityType === 'crypto_address' ? 'bg-yellow-100 text-yellow-800' :
                              entity.entityType === 'url' ? 'bg-purple-100 text-purple-800' :
                              entity.entityType === 'indian_id' ? 'bg-indigo-100 text-indigo-800' :
                              entity.entityType === 'ip_address' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {entity.entityType === 'phone_number' ? '📱 Phone' :
                               entity.entityType === 'email' ? '✉️ Email' :
                               entity.entityType === 'crypto_address' ? '₿ Crypto' :
                               entity.entityType === 'url' ? '🔗 URL' :
                               entity.entityType === 'indian_id' ? '🆔 ID' :
                               entity.entityType === 'ip_address' ? '🌐 IP' :
                               entity.entityType.replace('_', ' ')}
                            </span>
                            <span className="text-sm text-gray-500">
                              {entity.evidenceType} • {entity.evidenceId}
                            </span>
                          </div>
                          <div className="font-medium text-gray-900 mb-1">
                            <EvidenceChip
                              evidence={{
                                id: `entity_${entity.id}`,
                                type: entity.entityType === 'phone_number' ? 'phone' : entity.entityType === 'email' ? 'email' : entity.entityType === 'crypto_address' ? 'crypto' : entity.entityType === 'url' ? 'url' : 'entity',
                                value: entity.entityValue,
                                summary: `${entity.entityType.replace('_', ' ')} extracted from ${entity.evidenceType} (confidence: ${(entity.confidenceScore * 100).toFixed(0)}%)`,
                                source: {
                                  view: 'Entities View',
                                  caseId: caseId,
                                  evidenceId: entity.evidenceId,
                                  timestamp: entity.created_at,
                                },
                                metadata: entity.entityMetadata,
                              }}
                            />
                          </div>
                          {entity.entityMetadata && Object.keys(entity.entityMetadata).length > 0 && (
                            <div className="text-sm text-gray-600 mt-1">
                              {entity.entityType === 'phone_number' && (
                                <div className="flex items-center gap-4">
                                  {entity.entityMetadata.cleaned && (
                                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                      Cleaned: {entity.entityMetadata.cleaned}
                                    </span>
                                  )}
                                  {entity.entityMetadata.isIndian !== undefined && (
                                    <span className={`text-xs px-2 py-1 rounded ${
                                      entity.entityMetadata.isIndian ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                      {entity.entityMetadata.isIndian ? '🇮🇳 Indian' : '🌍 International'}
                                    </span>
                                  )}
                                </div>
                              )}
                              {entity.entityType === 'crypto_address' && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded capitalize">
                                    {entity.entityMetadata.currency || 'Unknown'} Network
                                  </span>
                                </div>
                              )}
                              {entity.entityType === 'indian_id' && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded capitalize">
                                    {entity.entityMetadata.idType || 'ID'} Document
                                  </span>
                                </div>
                              )}
                              {entity.entityType !== 'phone_number' && entity.entityType !== 'crypto_address' && entity.entityType !== 'indian_id' && (
                                <div className="text-xs">
                                  {Object.entries(entity.entityMetadata).map(([key, value]) => (
                                    <span key={key} className="mr-3">
                                      <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span> {String(value)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          <div>Confidence: {(entity.confidenceScore * 100).toFixed(1)}%</div>
                          <div>{new Date(entity.created_at).toLocaleDateString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-gray-500">
                    Showing {((currentPage - 1) * 50) + 1} to {Math.min(currentPage * 50, totalEntities)} of {totalEntities} entities
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Chats View */
            <div className="space-y-4">
              {Object.keys(conversations).length === 0 ? (
                <div className="text-center py-12">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-8 border border-green-200">
                    <MessageCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Chat Messages Await Discovery</h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                      No chat conversations have been processed yet. Upload a UFDR file containing WhatsApp, SMS, or messaging data to view detailed chat histories with timestamps.
                    </p>
                    <button
                      onClick={() => navigate(`${rolePrefix}/case/${caseId}`)}
                      className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload UFDR File
                    </button>
                  </div>
                </div>
              ) : (
                Object.entries(conversations).map(([conversationKey, messages]) => (
                  <div key={conversationKey} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageCircle className="w-5 h-5 text-blue-600" />
                      <h3 className="font-medium text-gray-900">{conversationKey}</h3>
                      <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                        {messages.length} messages
                      </span>
                    </div>
                    <div className="space-y-2">
                      {messages.slice().reverse().map((chat) => (
                        <div key={chat.id} className="bg-white rounded p-3 shadow-sm">
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <EvidenceChip
                                evidence={{
                                  id: `chat_sender_${chat.id}`,
                                  type: 'contact',
                                  value: chat.sender,
                                  content: chat.message,
                                  summary: `Sender in conversation with ${chat.receiver}`,
                                  source: { view: 'Entities View (Chat)', caseId, evidenceId: chat.id, timestamp: chat.timestamp },
                                  metadata: { receiver: chat.receiver, appName: chat.appName },
                                }}
                                compact
                              />
                              <span className="text-gray-500">→</span>
                              <EvidenceChip
                                evidence={{
                                  id: `chat_receiver_${chat.id}`,
                                  type: 'contact',
                                  value: chat.receiver,
                                  content: chat.message,
                                  summary: `Receiver in conversation with ${chat.sender}`,
                                  source: { view: 'Entities View (Chat)', caseId, evidenceId: chat.id, timestamp: chat.timestamp },
                                  metadata: { sender: chat.sender, appName: chat.appName },
                                }}
                                compact
                              />
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(chat.timestamp).toLocaleString('en-IN', {
                                timeZone: 'Asia/Kolkata',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <p className="text-gray-700">{chat.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}

              {/* Chat Pagination */}
              {totalChatPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-gray-500">
                    Showing {((chatPage - 1) * 100) + 1} to {Math.min(chatPage * 100, totalChats)} of {totalChats} messages
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setChatPage(Math.max(1, chatPage - 1))}
                      disabled={chatPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {chatPage} of {totalChatPages}
                    </span>
                    <button
                      onClick={() => setChatPage(Math.min(totalChatPages, chatPage + 1))}
                      disabled={chatPage === totalChatPages}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
  );
};
