import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Bookmark, Trash2, Tag, Search, Download, Star } from 'lucide-react';
import { bookmarkAPI } from '../../lib/api';

export const Bookmarks = () => {
  const { caseId } = useParams();
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tagFilter, setTagFilter] = useState('');

  useEffect(() => {
    loadBookmarks();
  }, [caseId]);

  const loadBookmarks = async () => {
    try {
      setLoading(true);
      const response = await bookmarkAPI.getBookmarks(Number(caseId));
      setBookmarks(response.data.data?.bookmarks || []);
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (bookmarkId: number) => {
    if (!confirm('Are you sure you want to delete this bookmark?')) return;

    try {
      await bookmarkAPI.deleteBookmark(bookmarkId);
      setBookmarks(bookmarks.filter(b => b.id !== bookmarkId));
    } catch (error) {
      console.error('Failed to delete bookmark:', error);
      alert('Failed to delete bookmark');
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(bookmarks, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bookmarks-case-${caseId}.json`;
    link.click();
  };

  const filteredBookmarks = bookmarks.filter(bookmark => {
    const matchesSearch = bookmark.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bookmark.evidenceData?.content?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = !tagFilter || bookmark.tags?.includes(tagFilter);
    return matchesSearch && matchesTag;
  });

  // Extract unique tags
  const allTags = Array.from(new Set(bookmarks.flatMap(b => b.tags || [])));

  return (
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bookmark className="w-6 h-6 text-yellow-600" />
              Bookmarked Evidence
            </h1>
            <p className="text-gray-600 mt-1">
              {filteredBookmarks.length} bookmarks saved
            </p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Download className="w-4 h-4" />
            Export All
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search bookmarks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Tags</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Bookmarks List */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading bookmarks...</p>
          </div>
        ) : filteredBookmarks.length > 0 ? (
          <div className="space-y-4">
            {filteredBookmarks.map((bookmark) => (
              <div key={bookmark.id} className="bg-white rounded-lg shadow hover:shadow-md transition p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <Star className="w-5 h-5 text-yellow-500 mt-1 flex-shrink-0" fill="currentColor" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {bookmark.evidenceType || 'Evidence'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(bookmark.createdAt || bookmark.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {bookmark.evidenceData?.content && (
                        <p className="text-gray-800 mb-3">{bookmark.evidenceData.content}</p>
                      )}

                      {bookmark.notes && (
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-3">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Note:</span> {bookmark.notes}
                          </p>
                        </div>
                      )}

                      {bookmark.tags && bookmark.tags.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Tag className="w-4 h-4 text-gray-400" />
                          {bookmark.tags.map((tag: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {bookmark.evidenceData && (
                        <div className="mt-3 text-xs text-gray-500 space-y-1">
                          {bookmark.evidenceData.phoneNumber && (
                            <div>Phone: {bookmark.evidenceData.phoneNumber}</div>
                          )}
                          {bookmark.evidenceData.timestamp && (
                            <div>Time: {new Date(bookmark.evidenceData.timestamp).toLocaleString()}</div>
                          )}
                          {bookmark.evidenceData.sourceType && (
                            <div className="capitalize">Source: {bookmark.evidenceData.sourceType}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(bookmark.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete bookmark"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Bookmark className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No bookmarks yet
            </h3>
            <p className="text-gray-600">
              {searchTerm || tagFilter
                ? 'No bookmarks match your filters'
                : 'Bookmark important evidence while analyzing the case'}
            </p>
          </div>
        )}
      </div>
  );
};
