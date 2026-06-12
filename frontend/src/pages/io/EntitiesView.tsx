import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Database, FilterX, Search, Download, MessageSquareText, Activity, CloudUpload, MessageCircle } from 'lucide-react';
import { caseAPI } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
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

      const normalizedEntities = data.entities.map((e: any) => ({
        ...e,
        id: e.id,
        entityValue: e.entityValue || e.entity_value || e.value,
        entityType: e.entityType || e.entity_type || e.type,
        evidenceType: e.evidenceType || e.evidence_type,
        evidenceId: e.evidenceId || e.evidence_id,
        confidenceScore: e.confidenceScore || e.confidence_score || e.confidence || 0,
        entityMetadata: e.entityMetadata || e.entity_metadata || e.metadata || {},
        created_at: e.created_at || e.createdAt || new Date().toISOString()
      }));

      setEntities(normalizedEntities);
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
        case 'person': return 'Person';
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

          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <Database className="w-6 h-6 text-red-600 dark:text-red-400" />
              <div>
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-300">Error Loading Entities</h3>
                <p className="text-red-700 dark:text-red-400 mt-1">{error}</p>
                <p className="text-red-600 dark:text-red-400/70 text-sm mt-2">
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
        <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl dark:bg-white/5 rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-white/10 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Database className="w-6 h-6 text-blue-600" />
              <div>
                <p className="text-gray-600 font-medium mt-1">
                  {totalEntities + totalChats > 0
                    ? `All entities and chat messages extracted from case #${caseId}`
                    : `Case #${caseId} is ready for forensic data extraction`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-slate-500">
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
          <div className="border-b border-gray-200 dark:border-white/10 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('entities')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'entities'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
              >
                <Activity className="w-4 h-4 inline mr-2" />
                Entities ({totalEntities})
              </button>
              <button
                onClick={() => setActiveTab('chats')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'chats'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
              >
                <MessageSquareText className="w-4 h-4 inline mr-2" />
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
                    className={`p-4 rounded-xl border-2 cursor-pointer transition card-hover-lift ${
                      selectedType === type.type
                        ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-500/10'
                        : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 bg-white dark:bg-transparent'
                    }`}
                    onClick={() => {
                      setSelectedType(selectedType === type.type ? '' : type.type);
                      setCurrentPage(1);
                    }}
                  >
                    <div className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white">{type.count}</div>
                    <div className="text-sm text-gray-600 dark:text-slate-400">
                      {type.type === 'phone_number' ? '📱 Phones' :
                       type.type === 'person' ? '👤 Persons' :
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
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search entities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                </div>
                {selectedType && (
                  <button
                    onClick={() => {
                      setSelectedType('');
                      setCurrentPage(1);
                    }}
                    className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition flex items-center gap-2"
                  >
                    <FilterX className="w-4 h-4" />
                    Clear Filter
                  </button>
                )}
              </div>

              {/* Entities List */}
              <div className="space-y-2">
                {filteredEntities.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="bg-gradient-to-br from-blue-50 dark:from-blue-500/10 to-indigo-50 dark:to-indigo-500/10 rounded-2xl p-8 border border-blue-200 dark:border-blue-500/30">
                      <Database className="w-16 h-16 text-blue-500 dark:text-blue-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Ready to Extract Forensic Data</h3>
                      <p className="text-gray-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                        No entities have been extracted yet. Upload and process a UFDR file to discover phone numbers, emails, crypto addresses, and chat conversations.
                      </p>
                      <button
                        onClick={() => navigate(`${rolePrefix}/case/${caseId}`)}
                        className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium"
                      >
                        <CloudUpload className="w-4 h-4 mr-2" />
                        Upload CopSight AI File
                      </button>
                    </div>
                  </div>
                ) : (
                  filteredEntities.map((entity) => (
                    <div
                      key={entity.id}
                      className="border border-gray-200 dark:border-white/10 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                              entity.entityType === 'phone_number' ? 'bg-green-100 dark:bg-emerald-500/10 text-green-800 dark:text-emerald-300' :
                              entity.entityType === 'person' ? 'bg-orange-100 dark:bg-orange-500/10 text-orange-800 dark:text-orange-300' :
                              entity.entityType === 'email' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300' :
                              entity.entityType === 'crypto_address' ? 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-300' :
                              entity.entityType === 'url' ? 'bg-purple-100 dark:bg-purple-500/10 text-purple-800 dark:text-purple-300' :
                              entity.entityType === 'indian_id' ? 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-300' :
                              entity.entityType === 'ip_address' ? 'bg-red-100 dark:bg-red-500/10 text-red-800 dark:text-red-300' :
                              'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-300'
                            }`}>
                              {entity.entityType === 'phone_number' ? '📱 Phone' :
                               entity.entityType === 'person' ? '👤 Person' :
                               entity.entityType === 'email' ? '✉️ Email' :
                               entity.entityType === 'crypto_address' ? '₿ Crypto' :
                               entity.entityType === 'url' ? '🔗 URL' :
                               entity.entityType === 'indian_id' ? '🆔 ID' :
                               entity.entityType === 'ip_address' ? '🌐 IP' :
                               entity.entityType.replace('_', ' ')}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-slate-500">
                              {entity.evidenceType} • {entity.evidenceId}
                            </span>
                          </div>
                          <div className="font-medium text-gray-900 dark:text-white mb-1">
                            <EvidenceChip
                              evidence={{
                                id: `entity_${entity.id}`,
                                type: entity.entityType === 'phone_number' ? 'phone' : entity.entityType === 'person' ? 'contact' : entity.entityType === 'email' ? 'email' : entity.entityType === 'crypto_address' ? 'crypto' : entity.entityType === 'url' ? 'url' : 'entity',
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
                            <div className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                              {entity.entityType === 'phone_number' && (
                                <div className="flex items-center gap-4">
                                  {entity.entityMetadata.cleaned && (
                                    <span className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-2 py-1 rounded">
                                      Cleaned: {entity.entityMetadata.cleaned}
                                    </span>
                                  )}
                                  {entity.entityMetadata.isIndian !== undefined && (
                                    <span className={`text-xs px-2 py-1 rounded ${
                                      entity.entityMetadata.isIndian ? 'bg-green-100 dark:bg-emerald-500/10 text-green-800 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-500/10 text-red-800 dark:text-red-300'
                                    }`}>
                                      {entity.entityMetadata.isIndian ? '🇮🇳 Indian' : '🌍 International'}
                                    </span>
                                  )}
                                </div>
                              )}
                              {entity.entityType === 'crypto_address' && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs bg-blue-100 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 px-2 py-1 rounded capitalize">
                                    {entity.entityMetadata.currency || 'Unknown'} Network
                                  </span>
                                </div>
                              )}
                              {entity.entityType === 'indian_id' && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs bg-purple-100 dark:bg-purple-500/10 text-purple-800 dark:text-purple-300 px-2 py-1 rounded capitalize">
                                    {entity.entityMetadata.idType || 'ID'} Document
                                  </span>
                                </div>
                              )}
                              {entity.entityType !== 'phone_number' && entity.entityType !== 'crypto_address' && entity.entityType !== 'indian_id' && entity.entityType !== 'person' && (
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
                        <div className="text-right text-sm text-gray-500 dark:text-slate-500">
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
                  <div className="text-sm text-gray-500 dark:text-slate-500">
                    Showing {((currentPage - 1) * 50) + 1} to {Math.min(currentPage * 50, totalEntities)} of {totalEntities} entities
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700 transition"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600 dark:text-slate-400">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700 transition"
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
                <div className="bg-gradient-to-br from-green-50 dark:from-emerald-500/10 to-emerald-50 dark:to-green-500/10 rounded-2xl p-8 border border-green-200 dark:border-emerald-500/30">
                  <MessageCircle className="w-16 h-16 text-green-500 dark:text-emerald-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Chat Messages Await Discovery</h3>
                  <p className="text-gray-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                    No chat conversations have been processed yet. Upload a UFDR file containing WhatsApp, SMS, or messaging data to view detailed chat histories with timestamps.
                  </p>
                  <button
                    onClick={() => navigate(`${rolePrefix}/case/${caseId}`)}
                    className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition font-medium"
                  >
                    <CloudUpload className="w-4 h-4 mr-2" />
                    Upload CopSight AI File
                  </button>
                </div>
              ) : (
                Object.entries(conversations).map(([conversationKey, messages]) => (
                  <div key={conversationKey} className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-100 dark:border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquareText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <h3 className="font-medium text-gray-900 dark:text-white">{conversationKey}</h3>
                      <span className="text-xs text-gray-500 dark:text-slate-400 bg-gray-200 dark:bg-slate-800 px-2 py-1 rounded-full">
                        {messages.length} messages
                      </span>
                    </div>
                    <div className="space-y-2">
                      {messages.slice().reverse().map((chat) => (
                        <div key={chat.id} className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded p-3 shadow-sm">
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
                              <span className="text-gray-500 dark:text-slate-500">→</span>
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
                            <span className="text-xs text-gray-500 dark:text-slate-500">
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
                          <p className="text-gray-700 dark:text-slate-300">{chat.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}

              {/* Chat Pagination */}
              {totalChatPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-gray-500 dark:text-slate-500">
                    Showing {((chatPage - 1) * 100) + 1} to {Math.min(chatPage * 100, totalChats)} of {totalChats} messages
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setChatPage(Math.max(1, chatPage - 1))}
                      disabled={chatPage === 1}
                      className="px-3 py-1.5 border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700 transition"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600 dark:text-slate-400">
                      Page {chatPage} of {totalChatPages}
                    </span>
                    <button
                      onClick={() => setChatPage(Math.min(totalChatPages, chatPage + 1))}
                      disabled={chatPage === totalChatPages}
                      className="px-3 py-1.5 border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700 transition"
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
