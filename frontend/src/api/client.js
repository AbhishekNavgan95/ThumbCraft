import axios from 'axios';

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  timeout: 30000, // 30 seconds timeout for image generation requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle common HTTP errors
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const { status, data } = error.response;
      
      if (status === 401) {
        // Unauthorized - clear token and redirect to login
        localStorage.removeItem('token');
        window.dispatchEvent(new Event('unauthorized'));
      }
      
      // Return a more user-friendly error message
      return Promise.reject({
        message: data.error || data.message || 'An error occurred',
        status,
        data
      });
    } else if (error.request) {
      // The request was made but no response was received
      return Promise.reject({
        message: 'Network error. Please check your connection.',
        status: 0
      });
    } else {
      // Something happened in setting up the request that triggered an Error
      return Promise.reject({
        message: error.message || 'An unexpected error occurred',
        status: 0
      });
    }
  }
);

// API methods
export const api = {
  // Auth endpoints
  auth: {
    login: (credentials) => apiClient.post('/api/login', credentials),
    signup: (userData) => apiClient.post('/api/signup', userData),
  },

  // Image generation endpoints
  images: {
    generate: (data, signal) => {
      const formData = new FormData();
      formData.append('prompt', data.prompt);
      formData.append('originalPrompt', data.originalPrompt);
      formData.append('enhancePrompt', data.enhancePrompt || false);
      formData.append('imageCount', data.imageCount || '4');
      
      // Add individual answer fields
      if (data.category) formData.append('category', data.category);
      if (data.mood) formData.append('mood', data.mood);
      if (data.theme) formData.append('theme', data.theme);
      if (data.primaryColor) formData.append('primaryColor', data.primaryColor);
      if (data.includeText) formData.append('includeText', data.includeText);
      if (data.textStyle) formData.append('textStyle', data.textStyle);
      if (data.thumbnailStyle) formData.append('thumbnailStyle', data.thumbnailStyle);
      if (data.customPrompt) formData.append('customPrompt', data.customPrompt);

      return apiClient.post('/api/generate', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        signal,
      });
    },

    generateFromImage: (data, signal) => {
      const formData = new FormData();
      formData.append('prompt', data.prompt);
      formData.append('originalPrompt', data.originalPrompt);
      formData.append('enhancePrompt', data.enhancePrompt || false);
      formData.append('imageCount', data.imageCount || '1');
      formData.append('image', data.image);
      
      // Add individual answer fields
      if (data.category) formData.append('category', data.category);
      if (data.mood) formData.append('mood', data.mood);
      if (data.theme) formData.append('theme', data.theme);
      if (data.primaryColor) formData.append('primaryColor', data.primaryColor);
      if (data.includeText) formData.append('includeText', data.includeText);
      if (data.textStyle) formData.append('textStyle', data.textStyle);
      if (data.thumbnailStyle) formData.append('thumbnailStyle', data.thumbnailStyle);
      if (data.customPrompt) formData.append('customPrompt', data.customPrompt);

      return apiClient.post('/api/generate-from-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        signal,
      });
    },

    download: (imageUrl) => {
      return axios.get(imageUrl, {
        responseType: 'blob',
        timeout: 15000, // 15 seconds for downloads
      });
    },
  },

  // History endpoints
  history: {
    get: () => apiClient.get('/api/history'),
    delete: (historyId) => apiClient.delete(`/api/history/${historyId}`),
    clear: () => apiClient.delete('/api/history'),
  },

  // Health check
  health: () => apiClient.get('/health'),
};

export default apiClient;