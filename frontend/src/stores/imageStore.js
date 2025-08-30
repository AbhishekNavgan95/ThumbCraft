import { create } from 'zustand';
import { api } from '../api/client';
import JSZip from 'jszip';

const useImageStore = create((set, get) => ({
  generatedImages: [],
  isLoading: false,
  error: null,
  history: [],
  abortController: null,
  isDownloadingZip: false,
  
  generateThumbnails: async (prompt, answers, uploadedImage = null) => {
    // Cancel any existing request
    const state = get();
    if (state.abortController) {
      state.abortController.abort();
    }
    
    // Create new abort controller
    const abortController = new AbortController();
    set({ isLoading: true, error: null, abortController });
    
    try {
      // Build the final prompt with answers
      const finalPrompt = buildFinalPrompt(prompt, answers);
      
      const requestData = {
        prompt: finalPrompt,
        originalPrompt: prompt,
        answers
      };

      let response;
      if (uploadedImage) {
        requestData.image = uploadedImage;
        response = await api.images.generateFromImage(requestData, abortController.signal);
      } else {
        response = await api.images.generate(requestData, abortController.signal);
      }

      const { data } = response;

      set({ 
        generatedImages: data.images,
        isLoading: false,
        error: null 
      });
      
      // Add to history
      const historyItem = {
        id: Date.now(),
        originalPrompt: prompt,
        finalPrompt,
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
      // Don't set error state if request was aborted
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        set({ isLoading: false, abortController: null });
        return { success: false, aborted: true };
      }
      
      set({ 
        isLoading: false,
        error: error.message || 'Failed to generate thumbnails',
        abortController: null
      });
      return { success: false, error: error.message || 'Failed to generate thumbnails' };
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
  
  fetchHistory: async () => {
    try {
      const response = await api.history.get();
      const { data } = response;

      set({ history: data.history });
      return { success: true };
    } catch (error) {
      set({ error: error.message || 'Failed to fetch history' });
      return { success: false };
    }
  },

  deleteHistoryEntry: async (historyId) => {
    try {
      await api.history.delete(historyId);
      set((state) => ({
        history: state.history.filter(item => item._id !== historyId)
      }));
      return { success: true };
    } catch (error) {
      set({ error: error.message || 'Failed to delete history entry' });
      return { success: false };
    }
  },

  clearHistory: async () => {
    try {
      await api.history.clear();
      set({ history: [] });
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