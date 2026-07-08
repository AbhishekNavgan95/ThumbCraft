import { create } from 'zustand';
import { api } from '../api/client';

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  successMessage: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null, successMessage: null });
    
    try {
      const response = await api.auth.login({ email, password });
      const { data } = response;

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      const successMsg = `Welcome back, ${data.user.name}! 🎉`;
      set({ 
        user: data.user, 
        isAuthenticated: true, 
        isLoading: false,
        error: null,
        successMessage: successMsg
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        set({ successMessage: null });
      }, 3000);
      
      return { success: true, message: successMsg };
    } catch (error) {
      let errorMessage = 'Login failed';
      
      // Handle specific error cases
      if (error.status === 401) {
        errorMessage = 'Invalid email or password. Please try again.';
      } else if (error.status === 429) {
        errorMessage = 'Too many login attempts. Please try again later.';
      } else if (error.status === 0) {
        errorMessage = 'Unable to connect to server. Please check your internet connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      set({ 
        isLoading: false, 
        error: errorMessage 
      });
      return { success: false, error: errorMessage };
    }
  },

  signup: async (name, email, password) => {
    set({ isLoading: true, error: null, successMessage: null });
    
    try {
      const response = await api.auth.signup({ name, email, password });
      const { data } = response;

      // Handle the case where signup is disabled
      if (data.message && data.message.includes('paused')) {
        set({ 
          isLoading: false, 
          error: 'Account registration is currently paused. Please try again later or contact support.' 
        });
        return { success: false, error: 'Account registration is currently paused. Please try again later or contact support.' };
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      const successMsg = `Welcome to AI Thumbnail Generator, ${data.user.name}! 🚀`;
      set({ 
        user: data.user, 
        isAuthenticated: true, 
        isLoading: false,
        error: null,
        successMessage: successMsg
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        set({ successMessage: null });
      }, 3000);
      
      return { success: true, message: successMsg };
    } catch (error) {
      let errorMessage = 'Account creation failed';
      
      // Handle specific error cases
      if (error.status === 409) {
        errorMessage = 'An account with this email already exists. Please try logging in instead.';
      } else if (error.status === 422) {
        errorMessage = 'Please check your information. Password must be at least 6 characters long.';
      } else if (error.status === 429) {
        errorMessage = 'Too many signup attempts. Please try again later.';
      } else if (error.status === 0) {
        errorMessage = 'Unable to connect to server. Please check your internet connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      set({ 
        isLoading: false, 
        error: errorMessage 
      });
      return { success: false, error: errorMessage };
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ 
      user: null, 
      isAuthenticated: false, 
      error: null 
    });
  },

  checkAuth: () => {
    console.log('🔍 Checking auth state...');
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    console.log('Token:', token ? 'exists' : 'not found');
    console.log('User data:', userStr ? 'exists' : 'not found');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        console.log('✅ Restoring auth state for user:', user.name);
        set({ 
          user,
          isAuthenticated: true 
        });
      } catch (parseError) {
        // User data in localStorage is corrupted
        console.log('❌ Corrupted user data in localStorage:', parseError);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ 
          user: null,
          isAuthenticated: false 
        });
      }
    } else {
      console.log('❌ No token or user data found');
    }
  },

  // Listen for unauthorized events from API interceptor
  init: () => {
    // Check initial auth state
    get().checkAuth();
    
    // Listen for unauthorized events
    window.addEventListener('unauthorized', () => {
      get().logout();
    });
  },

  clearError: () => {
    set({ error: null });
  },

  clearMessages: () => {
    set({ error: null, successMessage: null });
  },
}));

export default useAuthStore;