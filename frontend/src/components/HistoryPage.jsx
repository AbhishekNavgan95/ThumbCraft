import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useImageStore from '../stores/imageStore';
import useAuthStore from '../stores/authStore';
import ImagePreviewModal from './ImagePreviewModal';
import { Filter, SortAsc, SortDesc, Download, Eye, Archive, Calendar, Image, Type, Trash2, Search, X } from 'lucide-react';

const HistoryPage = () => {
  const navigate = useNavigate();
  const { history, fetchHistory, clearHistory, deleteHistoryEntry, downloadImage, isLoading, error, clearError } = useImageStore();
  const { isAuthenticated } = useAuthStore();
  const [filter, setFilter] = useState('all'); // all, text-to-image, image-to-image
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewModal, setPreviewModal] = useState({ isOpen: false, imageUrl: '', imageIndex: 0, historyItem: null });
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isExportingZip, setIsExportingZip] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    
    fetchHistory();
  }, [isAuthenticated, navigate, fetchHistory]);

  const handleClearHistory = async () => {
    const result = await clearHistory();
    if (result.success) {
      setShowConfirmClear(false);
    }
  };

  const handleDeleteHistoryEntry = async (historyId) => {
    setDeletingId(historyId);
    const result = await deleteHistoryEntry(historyId);
    setDeletingId(null);
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(historyId);
      return newSet;
    });
  };

  const handlePreview = (imageUrl, index, historyItem) => {
    setPreviewModal({ isOpen: true, imageUrl, imageIndex: index, historyItem });
  };

  const closePreview = () => {
    setPreviewModal({ isOpen: false, imageUrl: '', imageIndex: 0, historyItem: null });
  };

  const handleSelectItem = (historyId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(historyId)) {
        newSet.delete(historyId);
      } else {
        newSet.add(historyId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.size === filteredHistory.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredHistory.map(item => item._id)));
    }
  };

  const handleExportSelected = async () => {
    if (selectedItems.size === 0) return;
    
    setIsExportingZip(true);
    try {
      const selectedHistoryItems = filteredHistory.filter(item => selectedItems.has(item._id));
      const allImageUrls = selectedHistoryItems.flatMap(item => item.imageUrls || []);
      
      // Create ZIP file with all selected images
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      for (let i = 0; i < allImageUrls.length; i++) {
        const imageUrl = allImageUrls[i];
        try {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const historyItem = selectedHistoryItems.find(item => item.imageUrls.includes(imageUrl));
          const fileName = `thumbnail-${historyItem._id}-${i + 1}.png`;
          zip.file(fileName, blob);
        } catch (error) {
          console.error(`Failed to download image ${i + 1}:`, error);
        }
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thumbnails-export-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSelectedItems(new Set());
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExportingZip(false);
    }
  };

  const historyToShow = history || [];

  const filteredHistory = historyToShow.filter(item => {
    // Filter by type
    if (filter === 'text-to-image' && item.type !== 'text-to-image') return false;
    if (filter === 'image-to-image' && item.type !== 'image-to-image') return false;
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesPrompt = (item.originalPrompt || '').toLowerCase().includes(searchLower);
      const matchesCustomPrompt = (item.customPrompt || '').toLowerCase().includes(searchLower);
      const matchesCategory = (item.category || '').toLowerCase().includes(searchLower);
      const matchesMood = (item.mood || '').toLowerCase().includes(searchLower);
      const matchesTheme = (item.theme || '').toLowerCase().includes(searchLower);
      
      return matchesPrompt || matchesCustomPrompt || matchesCategory || matchesMood || matchesTheme;
    }
    
    return true;
  });

  const sortedHistory = [...filteredHistory].sort((a, b) => {
    const dateA = new Date(a.createdAt);
    const dateB = new Date(b.createdAt);
    return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const buildAnswersObject = (item) => {
    return {
      category: item.category,
      mood: item.mood,
      theme: item.theme,
      primaryColor: item.primaryColor,
      includeText: item.includeText,
      textStyle: item.textStyle,
      thumbnailStyle: item.thumbnailStyle
    };
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <button
                onClick={() => navigate('/')}
                className="flex items-center text-gray-600 hover:text-gray-900 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg p-2 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Home
              </button>
              
              <h1 className="text-4xl font-bold text-gray-900 mb-3">
                Generation History
              </h1>
              <p className="text-lg text-gray-600">
                Manage and download your AI-generated thumbnails
              </p>
            </div>

            {/* Stats */}
            <div className="mt-6 sm:mt-0 flex items-center space-x-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{historyToShow.length}</div>
                <div className="text-sm text-gray-500">Total Sessions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {historyToShow.reduce((sum, item) => sum + (item.imageUrls?.length || 0), 0)}
                </div>
                <div className="text-sm text-gray-500">Images Created</div>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search prompts, categories, moods..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white min-w-[160px]"
                  >
                    <option value="all">All Types</option>
                    <option value="text-to-image">From Prompt</option>
                    <option value="image-to-image">From Image</option>
                  </select>
                </div>

                <div className="relative">
                  {sortBy === 'newest' ? (
                    <SortDesc className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  ) : (
                    <SortAsc className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  )}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white min-w-[140px]"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bulk Actions */}
            {sortedHistory.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedItems.size === filteredHistory.length && filteredHistory.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      {selectedItems.size > 0 ? `${selectedItems.size} selected` : 'Select all'}
                    </span>
                  </label>
                  
                  {selectedItems.size > 0 && (
                    <span className="text-sm text-gray-500">
                      {selectedItems.size === 1 ? '1 item selected' : `${selectedItems.size} items selected`}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {selectedItems.size > 0 && (
                    <button
                      onClick={handleExportSelected}
                      disabled={isExportingZip}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Archive className="w-4 h-4" />
                      {isExportingZip ? 'Creating ZIP...' : 'Export to ZIP'}
                    </button>
                  )}
                  
                  {historyToShow.length > 0 && (
                    <button
                      onClick={() => setShowConfirmClear(true)}
                      className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 border border-red-300 hover:border-red-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear All
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center text-gray-600">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading your history...
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.598 0L3.216 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div className="ml-3">
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && sortedHistory.length === 0 && (
          <div className="text-center py-16">
            <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-8">
              {searchTerm ? (
                <Search className="w-16 h-16 text-gray-400" />
              ) : (
                <Image className="w-16 h-16 text-gray-400" />
              )}
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">
              {searchTerm ? 'No results found' : 'No thumbnails generated yet'}
            </h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              {searchTerm 
                ? `No thumbnails match "${searchTerm}". Try adjusting your search terms.`
                : 'Start creating amazing AI-powered thumbnails to see them here'
              }
            </p>
            {searchTerm ? (
              <button
                onClick={() => setSearchTerm('')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Clear Search
              </button>
            ) : (
              <button
                onClick={() => navigate('/')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors text-lg"
              >
                Generate Your First Thumbnail
              </button>
            )}
          </div>
        )}

        {/* History Grid */}
        {!isLoading && sortedHistory.length > 0 && (
          <div className="space-y-8">
            {sortedHistory.map((item) => (
              <div key={item._id} className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="p-6">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6">
                    <div className="flex items-start space-x-4 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item._id)}
                        onChange={() => handleSelectItem(item._id)}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center mb-3">
                          <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                            {item.type === 'image-to-image' ? (
                              <span className="flex items-center">
                                <Image className="w-4 h-4 mr-1" />
                                From Image
                              </span>
                            ) : (
                              <span className="flex items-center">
                                <Type className="w-4 h-4 mr-1" />
                                From Prompt
                              </span>
                            )}
                          </span>
                          {item.enhancedPrompt && (
                            <span className="ml-3 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              ✨ AI Enhanced
                            </span>
                          )}
                        </div>
                        
                        <h3 className="text-xl font-semibold text-gray-900 mb-2 leading-tight">
                          {item.originalPrompt || item.customPrompt || 'No prompt provided'}
                        </h3>
                        
                        <div className="flex items-center text-sm text-gray-600 space-x-4">
                          <span className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {formatDate(item.createdAt)}
                          </span>
                          {item.inputImage && (
                            <span className="flex items-center">
                              <Image className="w-4 h-4 mr-1" />
                              {item.inputImage.originalName} ({Math.round(item.inputImage.size / 1024)}KB)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 sm:mt-0 sm:ml-6 flex items-center space-x-3">
                      <span className="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {item.imageUrls?.length || 0} images
                      </span>
                      <button
                        onClick={() => handleDeleteHistoryEntry(item._id)}
                        disabled={deletingId === item._id}
                        className="text-red-500 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-lg p-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Delete this generation"
                      >
                        {deletingId === item._id ? (
                          <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <Trash2 className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Settings Summary */}
                  {(() => {
                    const answers = buildAnswersObject(item);
                    return Object.values(answers).some(answer => answer) && (
                      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Settings Used:</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          {Object.entries(answers).map(([key, value]) => {
                            if (!value) return null;
                            const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
                            return (
                              <div key={key}>
                                <span className="text-gray-600 capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                                </span>
                                <span className="ml-2 font-medium text-gray-900">{displayValue}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Images Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {item.imageUrls?.map((imageUrl, index) => (
                      <div key={index} className="group relative bg-gray-50 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                        <img
                          src={imageUrl}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-40 object-cover"
                          onError={(e) => {
                            e.target.src = `https://via.placeholder.com/320x180/6EE7B7/ffffff?text=Thumb+${index + 1}`;
                          }}
                        />
                        
                        {/* Overlay with actions */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handlePreview(imageUrl, index, item)}
                              className="bg-white/90 hover:bg-white text-gray-900 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black shadow-lg transition-all transform hover:scale-105"
                              title="Preview image"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => downloadImage(imageUrl, `thumbnail-${item._id}-${index + 1}.png`)}
                              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-black shadow-lg transition-all transform hover:scale-105"
                              title="Download image"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Image number badge */}
                        <div className="absolute top-2 left-2">
                          <span className="bg-black/70 text-white text-xs font-semibold px-2 py-1 rounded-full">
                            {index + 1}
                          </span>
                        </div>

                        {/* Quality badge */}
                        <div className="absolute top-2 right-2">
                          <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
                            HD
                          </span>
                        </div>
                      </div>
                    )) || []}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Clear History Confirmation Modal */}
        {showConfirmClear && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.598 0L3.216 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Clear All History</h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                Are you sure you want to clear all your generation history? This action cannot be undone.
              </p>
              
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-gray-400 rounded-lg"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearHistory}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  {isLoading ? 'Clearing...' : 'Clear All'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Preview Modal */}
        <ImagePreviewModal
          isOpen={previewModal.isOpen}
          onClose={closePreview}
          imageUrl={previewModal.imageUrl}
          imageIndex={previewModal.imageIndex}
          onDownload={(imageUrl, index) => downloadImage(imageUrl, `thumbnail-${previewModal.historyItem?._id}-${index + 1}.png`)}
        />
      </div>
    </div>
  );
};

export default HistoryPage;