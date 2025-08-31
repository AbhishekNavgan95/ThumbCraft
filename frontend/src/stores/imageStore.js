import { create } from 'zustand';
import { api } from '../api/client';
import JSZip from 'jszip';
import useUIStore from './uiStore';

const useImageStore = create((set, get) => ({
  generatedImages: [],
  isLoading: false,
  error: null,
  history: [],
  historyPagination: {
    currentPage: 1,
    totalItems: 0,
    totalPages: 0,
    hasMore: false,
    itemsPerPage: 10
  },
  abortController: null,
  isDownloadingZip: false,
  
  generateThumbnails: async (prompt, answers, uploadedImage = null) => {
    // Only cancel existing request if we're not already loading
    const state = get();
    if (state.abortController && !state.isLoading) {
      console.log('Cancelling previous request');
      state.abortController.abort();
    }
    
    // Don't start a new request if one is already in progress
    if (state.isLoading) {
      console.log('Request already in progress, skipping');
      return { success: false, error: 'Request already in progress' };
    }
    
    // Create new abort controller
    const abortController = new AbortController();
    set({ isLoading: true, error: null, abortController });
    
    try {
      // Get enhancePrompt and originalPrompt from UI store
      const uiState = useUIStore.getState();
      
      // Determine the original prompt based on generation mode
      let originalPrompt;
      if (uiState.generationMode === 'image') {
        originalPrompt = uiState.imageDescription;
      } else {
        originalPrompt = uiState.prompt;
      }
      
      // Send the raw prompt and let backend handle enhancement
      const requestData = {
        prompt: originalPrompt,
        originalPrompt: originalPrompt,
        enhancePrompt: uiState.enhancePrompt,
        imageCount: answers.imageCount || (uploadedImage ? '1' : '4'),
        // Send individual answer fields to backend for proper prompt structuring
        category: answers.category,
        mood: answers.mood,
        theme: answers.theme,
        primaryColor: answers.primaryColor,
        includeText: answers.includeText,
        textStyle: answers.textStyle,
        thumbnailStyle: answers.thumbnailStyle,
        customPrompt: answers.customPrompt
      };

      let response;
      if (uploadedImage) {
        requestData.image = uploadedImage;
        console.log('Making image-to-image API request');
        response = await api.images.generateFromImage(requestData, abortController.signal);
      } else {
        response = await api.images.generate(requestData, abortController.signal);
      }

      console.log('API Response received, success:', response.data?.success);
      const { data } = response;

      if (!data || !data.success) {
        throw new Error(data?.error || 'API response indicates failure');
      }

      if (!data.images || !Array.isArray(data.images) || data.images.length === 0) {
        throw new Error('Invalid response: No images received from API');
      }

      set({ 
        generatedImages: data.images,
        isLoading: false,
        error: null 
      });
      
      // Add to history
      const historyItem = {
        id: Date.now(),
        originalPrompt: originalPrompt,
        finalPrompt: data.prompt || originalPrompt,
        answers,
        images: data.images,
        timestamp: new Date().toISOString(),
        uploadedImage: uploadedImage ? URL.createObjectURL(uploadedImage) : null
      };
      
      set((state) => ({
        history: [historyItem, ...state.history]
      }));
      
      return { success: true };
    } catch (error) {
      console.log('Image generation error:', error);
      
      // Don't set error state if request was aborted by user
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        console.log('Request was aborted by user');
        set({ isLoading: false, abortController: null });
        return { success: false, aborted: true };
      }
      
      // Check if it's a timeout error
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        console.log('Request timed out');
        set({ 
          isLoading: false,
          error: 'Request timed out. Please try again.',
          abortController: null
        });
        return { success: false, error: 'Request timed out. Please try again.' };
      }
      
      // Check if it's a network error
      if (error.message?.includes('NS_BINDING_ABORTED') || error.message?.includes('Network Error')) {
        console.log('Network error occurred');
        set({ 
          isLoading: false,
          error: 'Network error. Please check your connection and try again.',
          abortController: null
        });
        return { success: false, error: 'Network error. Please check your connection and try again.' };
      }
      
      // Generic error handling
      const errorMessage = error.message || 'Failed to generate thumbnails';
      console.log('Generic error:', errorMessage);
      set({ 
        isLoading: false,
        error: errorMessage,
        abortController: null
      });
      return { success: false, error: errorMessage };
    }
  },
  
  downloadImage: async (imageUrl, filename) => {
    try {
      const response = await api.images.download(imageUrl);
      const blob = response.data;
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename || `thumbnail-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Download failed:', error);
    }
  },
  
  downloadAll: async (images) => {
    set({ isDownloadingZip: true });
    
    try {
      const zip = new JSZip();
      const promises = images.map(async (imageUrl, index) => {
        try {
          const response = await api.images.download(imageUrl);
          const blob = response.data;
          zip.file(`thumbnail-${index + 1}.png`, blob);
        } catch (error) {
          console.error(`Failed to download image ${index + 1}:`, error);
          // Continue with other images even if one fails
        }
      });

      // Wait for all downloads to complete
      await Promise.all(promises);

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Create download link
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `thumbnails-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

    } catch (error) {
      console.error('Failed to create ZIP file:', error);
      // Fallback to individual downloads
      images.forEach((imageUrl, index) => {
        setTimeout(() => {
          get().downloadImage(imageUrl, `thumbnail-${index + 1}-${Date.now()}.png`);
        }, index * 100);
      });
    } finally {
      set({ isDownloadingZip: false });
    }
  },
  
  fetchHistory: async (page = 1, append = false) => {
    try {
      const state = get();
      const response = await api.history.get({ 
        page, 
        limit: state.historyPagination.itemsPerPage 
      });
      const { data } = response;

      const totalPages = Math.ceil(data.total / state.historyPagination.itemsPerPage);

      set((currentState) => ({
        history: append ? [...currentState.history, ...data.history] : data.history,
        historyPagination: {
          ...currentState.historyPagination,
          currentPage: page,
          totalItems: data.total,
          totalPages,
          hasMore: data.hasMore
        }
      }));
      
      return { success: true };
    } catch (error) {
      set({ error: error.message || 'Failed to fetch history' });
      return { success: false };
    }
  },

  loadMoreHistory: async () => {
    const state = get();
    if (!state.historyPagination.hasMore) return { success: false };
    
    return await get().fetchHistory(state.historyPagination.currentPage + 1, true);
  },

  setHistoryPage: async (page) => {
    const result = await get().fetchHistory(page, false);
    
    // Scroll to top of page when changing pages
    if (result.success) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    return result;
  },

  deleteHistoryEntry: async (historyId) => {
    try {
      await api.history.delete(historyId);
      
      // Update local state and pagination info
      set((state) => {
        const newHistory = state.history.filter(item => item._id !== historyId);
        const newTotalItems = Math.max(0, state.historyPagination.totalItems - 1);
        const newTotalPages = Math.ceil(newTotalItems / state.historyPagination.itemsPerPage);
        
        return {
          history: newHistory,
          historyPagination: {
            ...state.historyPagination,
            totalItems: newTotalItems,
            totalPages: newTotalPages,
            hasMore: state.historyPagination.currentPage < newTotalPages
          }
        };
      });
      
      return { success: true };
    } catch (error) {
      set({ error: error.message || 'Failed to delete history entry' });
      return { success: false };
    }
  },

  clearHistory: async () => {
    try {
      await api.history.clear();
      set({ 
        history: [],
        historyPagination: {
          currentPage: 1,
          totalItems: 0,
          totalPages: 0,
          hasMore: false,
          itemsPerPage: 10
        }
      });
      return { success: true };
    } catch (error) {
      set({ error: error.message || 'Failed to clear history' });
      return { success: false };
    }
  },
  
  clearError: () => set({ error: null }),
  
  clearImages: () => set({ generatedImages: [] }),
}));

// Helper function to build final prompt from answers
const buildFinalPrompt = (originalPrompt, answers) => {
  let finalPrompt = originalPrompt;
  
  const promptParts = [];
  
  if (answers.category) promptParts.push(`Category: ${answers.category}`);
  if (answers.mood) promptParts.push(`Mood: ${answers.mood}`);
  if (answers.theme) promptParts.push(`Theme: ${answers.theme}`);
  if (answers.primaryColor) promptParts.push(`Primary color: ${answers.primaryColor}`);
  if (answers.includeText === 'Yes' && answers.textStyle) {
    promptParts.push(`Text style: ${answers.textStyle}`);
  } else if (answers.includeText === 'No') {
    promptParts.push('No text overlay');
  }
  if (answers.thumbnailStyle) promptParts.push(`Style: ${answers.thumbnailStyle}`);
  if (answers.customPrompt) promptParts.push(answers.customPrompt);
  
  if (promptParts.length > 0) {
    finalPrompt += '\n\nAdditional requirements:\n' + promptParts.join('\n');
  }
  
  return finalPrompt;
};

export default useImageStore;