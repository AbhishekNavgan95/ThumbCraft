import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useImageStore from '../stores/imageStore';
import useAuthStore from '../stores/authStore';
import ImagePreviewModal from './ImagePreviewModal';
import { Filter, SortAsc, SortDesc, Download, Eye, Archive, Calendar, Image, Type, Trash2, Search, X, Sparkles, Hash, Camera, ArrowLeft, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

const HistoryPage = () => {
  const navigate = useNavigate();
  const { 
    history, 
    historyPagination, 
    fetchHistory, 
    setHistoryPage, 
    loadMoreHistory, 
    clearHistory, 
    deleteHistoryEntry, 
    downloadImage, 
    isLoading, 
    error, 
    clearError 
  } = useImageStore();
  const { isAuthenticated } = useAuthStore();
  const [filter, setFilter] = useState('all'); // all, text-to-image, image-to-image
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewModal, setPreviewModal] = useState({ isOpen: false, imageUrl: '', imageIndex: 0, historyItem: null });
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [expandedPrompts, setExpandedPrompts] = useState(new Set());

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

  const togglePromptExpansion = (itemId) => {
    setExpandedPrompts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const truncatePrompt = (text, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const isPromptLong = (text, maxLength = 100) => {
    return text && text.length > maxLength;
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
                className="flex items-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg px-4 py-2.5 transition-all font-medium"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
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
                <div className="text-2xl font-bold text-blue-600">{historyPagination.totalItems || historyToShow.length}</div>
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
                    className="history-select pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white min-w-[160px]"
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
                    className="history-select pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white min-w-[140px]"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>

                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <select
                    value={historyPagination.itemsPerPage}
                    onChange={async (e) => {
                      const newLimit = parseInt(e.target.value);
                      // Update items per page and reset to page 1
                      await useImageStore.setState((state) => ({
                        historyPagination: {
                          ...state.historyPagination,
                          itemsPerPage: newLimit,
                          currentPage: 1
                        }
                      }));
                      fetchHistory(1);
                    }}
                    className="history-select pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white min-w-[120px]"
                  >
                    <option value="5">5 per page</option>
                    <option value="10">10 per page</option>
                    <option value="20">20 per page</option>
                    <option value="50">50 per page</option>
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
          <div className="space-y-6">
            {sortedHistory.map((item) => (
              <div key={item._id} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100">
                {/* Card Header */}
                <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item._id)}
                        onChange={() => handleSelectItem(item._id)}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 mt-1"
                      />
                      
                      <div className="flex-1 space-y-3">
                        {/* Type and Enhancement Badges */}
                        <div className="flex items-center space-x-3">
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${
                            item.type === 'image-to-image' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {item.type === 'image-to-image' ? (
                              <>
                                <Camera className="w-4 h-4 mr-1.5" />
                                Image to Image
                              </>
                            ) : (
                              <>
                                <Type className="w-4 h-4 mr-1.5" />
                                Text to Image
                              </>
                            )}
                          </span>
                          
                          {item.enhancedPrompt && (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-gradient-to-r from-violet-100 to-purple-100 text-violet-800">
                              <Sparkles className="w-4 h-4 mr-1.5" />
                              AI Enhanced
                            </span>
                          )}
                          
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                            <Hash className="w-4 h-4 mr-1.5" />
                            {item.imageUrls?.length || 0} Generated
                          </span>
                          
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${
                            item.includeText ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            Text: {item.includeText ? 'Yes' : 'No'}
                          </span>
                        </div>
                        
                        {/* Original Prompt */}
                        <div className="space-y-2">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 leading-tight">
                              {expandedPrompts.has(item._id) 
                                ? item.originalPrompt || 'No prompt provided'
                                : truncatePrompt(item.originalPrompt || 'No prompt provided')
                              }
                            </h3>
                            {isPromptLong(item.originalPrompt) && (
                              <button
                                onClick={() => togglePromptExpansion(item._id)}
                                className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium focus:outline-none focus:underline transition-colors"
                              >
                                {expandedPrompts.has(item._id) ? 'Show less' : 'Read more'}
                              </button>
                            )}
                          </div>
                          
                          {/* Final Prompt (if different from original) */}
                          {item.finalPrompt && item.finalPrompt !== item.originalPrompt && (
                            <div className="">
                              <div className="flex items-start space-x-2">
                                <div className="flex-1">  
                                  <p className="text-sm font-medium text-blue-900 mb-1">Enhanced Prompt:</p>
                                  <p className="text-base text-blue-800 leading-relaxed">
                                    {expandedPrompts.has(`final-${item._id}`)
                                      ? item.finalPrompt
                                      : truncatePrompt(item.finalPrompt, 150)
                                    }
                                  </p>
                                  {isPromptLong(item.finalPrompt, 150) && (
                                    <button
                                      onClick={() => togglePromptExpansion(`final-${item._id}`)}
                                      className="mt-2 text-xs text-blue-700 hover:text-blue-900 font-medium focus:outline-none focus:underline transition-colors"
                                    >
                                      {expandedPrompts.has(`final-${item._id}`) ? 'Show less' : 'Read more'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Meta Information */}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1.5" />
                            {formatDate(item.createdAt)}
                          </span>
                          
                          <span className="flex items-center">
                            <Hash className="w-4 h-4 mr-1.5" />
                            {item.imagesGenerated || item.imageUrls?.length || 0} images generated
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 ml-6">
                      <button
                        onClick={() => handleDeleteHistoryEntry(item._id)}
                        disabled={deletingId === item._id}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-lg p-2.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                </div>

                {/* Card Body */}
                <div className="px-8 py-6">
                  {/* Generated Images */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Image className="w-5 h-5 mr-2 text-indigo-600" />
                      Generated Thumbnails ({item.imageUrls?.length || 0})
                    </h4>
                    
                    <div className={`grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`}>
                      {item.imageUrls?.map((imageUrl, index) => (
                        <div key={index} className="group relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-200">
                          <div className="aspect-video">
                            <img
                              src={imageUrl}
                              alt={`Generated thumbnail ${index + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                e.target.src = `https://via.placeholder.com/400x225/6366f1/ffffff?text=Thumbnail+${index + 1}`;
                              }}
                            />
                          </div>
                          
                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                              <span className="text-white text-sm font-medium">Thumbnail #{index + 1}</span>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handlePreview(imageUrl, index, item)}
                                  className="bg-white/90 hover:bg-white text-gray-900 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-white transition-all transform hover:scale-110 shadow-lg"
                                  title="Preview image"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => downloadImage(imageUrl, `thumbnail-${item._id}-${index + 1}.png`)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all transform hover:scale-110 shadow-lg"
                                  title="Download image"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Corner Badges */}
                          <div className="absolute top-3 left-3">
                            <span className="bg-black/80 text-white text-xs font-bold px-2.5 py-1 rounded-full border border-white/20">
                              #{index + 1}
                            </span>
                          </div>

                          <div className="absolute top-3 right-3">
                            <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                              HD
                            </span>
                          </div>
                        </div>
                      )) || []}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {!isLoading && sortedHistory.length > 0 && historyPagination.totalPages > 1 && (
          <div className="mt-12 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{((historyPagination.currentPage - 1) * historyPagination.itemsPerPage) + 1}</span> to{' '}
              <span className="font-medium">
                {Math.min(historyPagination.currentPage * historyPagination.itemsPerPage, historyPagination.totalItems)}
              </span> of{' '}
              <span className="font-medium">{historyPagination.totalItems}</span> results
            </div>

            <div className="flex items-center space-x-2">
              {/* Previous Button */}
              <button
                onClick={() => setHistoryPage(historyPagination.currentPage - 1)}
                disabled={historyPagination.currentPage === 1}
                className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:z-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </button>

              {/* Page Numbers */}
              <div className="flex items-center space-x-1">
                {(() => {
                  const pages = [];
                  const currentPage = historyPagination.currentPage;
                  const totalPages = historyPagination.totalPages;
                  
                  // Always show first page
                  if (totalPages > 0) {
                    pages.push(
                      <button
                        key={1}
                        onClick={() => setHistoryPage(1)}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg focus:z-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          currentPage === 1
                            ? 'bg-blue-600 text-white border border-blue-600'
                            : 'text-gray-900 bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        1
                      </button>
                    );
                  }

                  // Show dots if there's a gap
                  if (currentPage > 4 && totalPages > 7) {
                    pages.push(
                      <span key="dots1" className="px-2 text-gray-500">
                        <MoreHorizontal className="w-4 h-4" />
                      </span>
                    );
                  }

                  // Show pages around current page
                  const startPage = Math.max(2, currentPage - 2);
                  const endPage = Math.min(totalPages - 1, currentPage + 2);

                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => setHistoryPage(i)}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg focus:z-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          currentPage === i
                            ? 'bg-blue-600 text-white border border-blue-600'
                            : 'text-gray-900 bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {i}
                      </button>
                    );
                  }

                  // Show dots if there's a gap
                  if (currentPage < totalPages - 3 && totalPages > 7) {
                    pages.push(
                      <span key="dots2" className="px-2 text-gray-500">
                        <MoreHorizontal className="w-4 h-4" />
                      </span>
                    );
                  }

                  // Always show last page
                  if (totalPages > 1) {
                    pages.push(
                      <button
                        key={totalPages}
                        onClick={() => setHistoryPage(totalPages)}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg focus:z-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          currentPage === totalPages
                            ? 'bg-blue-600 text-white border border-blue-600'
                            : 'text-gray-900 bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {totalPages}
                      </button>
                    );
                  }

                  return pages;
                })()}
              </div>

              {/* Next Button */}
              <button
                onClick={() => setHistoryPage(historyPagination.currentPage + 1)}
                disabled={historyPagination.currentPage === historyPagination.totalPages}
                className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:z-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* Clear History Confirmation Modal */}
        {showConfirmClear && (
          <div onClick={() => setShowConfirmClear(false)} className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.598 0L3.216 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Clear All History (disabled on purpose)</h3>
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
                  disabled={true}
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