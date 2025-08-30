import { create } from 'zustand';
import { api } from '../api/client';

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await api.auth.login({ email, password });
      const { data } = response;

      localStorage.setItem('token', data.token);
      set({ 
        user: data.user, 
        isAuthenticated: true, 
        isLoading: false,
        error: null 
      });
      return { success: true };
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error.message || 'Login failed' 
      });
      return { success: false, error: error.message || 'Login failed' };
    }
  },

  signup: async (name, email, password) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await api.auth.signup({ name, email, password });
      const { data } = response;

      localStorage.setItem('token', data.token);
      set({ 
        user: data.user, 
        isAuthenticated: true, 
        isLoading: false,
        error: null 
      });
      return { success: true };
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error.message || 'Signup failed' 
      });
      return { success: false, error: error.message || 'Signup failed' };
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ 
      user: null, 
      isAuthenticated: false, 
      error: null 
    });
  },

  checkAuth: () => {
    const token = localStorage.getItem('token');
    if (token) {
      // In a real app, you'd validate the token with the server
      set({ isAuthenticated: true });
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
}));

export default useAuthStore;