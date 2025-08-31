import { useState } from 'react';
import useAuthStore from '../stores/authStore';
import useUIStore from '../stores/uiStore';
import { X, User, Mail, Lock, LogIn, UserPlus, Loader2 } from 'lucide-react';

const LoginModal = ({ isOpen, onClose }) => {
  const [isSignupMode, setIsSignupMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, signup, isLoading, error, successMessage, clearMessages } = useAuthStore();
  const { generationMode, setCurrentStep } = useUIStore();

  const validateForm = () => {
    if (isSignupMode && (!name || name.trim().length < 2)) {
      return 'Name must be at least 2 characters long';
    }
    
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return 'Please enter a valid email address';
    }
    
    if (!password || password.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Client-side validation
    const validationError = validateForm();
    if (validationError) {
      useAuthStore.setState({ error: validationError });
      return;
    }
    
    const result = isSignupMode 
      ? await signup(name, email, password)
      : await login(email, password);
    
    if (result.success) {
      setName('');
      setEmail('');
      setPassword('');
      
      // Show success message briefly before closing modal
      setTimeout(() => {
        onClose();
        
        // If user was trying to create a thumbnail before login, proceed to input step
        if (generationMode) {
          setCurrentStep('input');
        }
      }, 1500); // Give user time to see success message
    }
  };

  const handleClose = () => {
    setName('');
    setEmail('');
    setPassword('');
    setIsSignupMode(false);
    clearMessages();
    onClose();
  };

  const toggleMode = () => {
    setIsSignupMode(!isSignupMode);
    clearMessages();
  };

  if (!isOpen) return null;

  return (
    <div onClick={handleClose} className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              {isSignupMode ? <UserPlus className="w-4 h-4 text-blue-600" /> : <LogIn className="w-4 h-4 text-blue-600" />}
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isSignupMode ? 'Create Account' : 'Welcome Back'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mx-6 mb-4 text-center">
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-center mb-2">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse mr-2"></div>
              <span className="text-orange-800 font-semibold text-sm uppercase tracking-wide">Server Notice</span>
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse ml-2"></div>
            </div>
            <p className="text-orange-900 font-medium text-base leading-relaxed">
              🚀 <strong>Hosted on Render:</strong> Response times may be slower than usual. It may take 30-60 seconds to respond 🙏
            </p>
            <div className="mt-2 text-xs text-orange-700 opacity-75">
              Free tier limitations - thank you for your understanding! ✨
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          
          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center">
              <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {successMessage}
            </div>
          )}

          <div className="space-y-4">
            {isSignupMode && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your full name"
                    required={isSignupMode}
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email address"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={isSignupMode ? "Create a secure password" : "Enter your password"}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between space-x-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-gray-300 rounded-lg transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" />
                  {isSignupMode ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : (
                <>
                  {isSignupMode ? <UserPlus className="w-4 h-4 mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
                  {isSignupMode ? 'Create Account' : 'Sign In'}
                </>
              )}
            </button>
          </div>
          
          <div className="text-center mt-6 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              {isSignupMode ? 'Already have an account?' : "Don't have an account?"}
              <button
                type="button"
                onClick={toggleMode}
                className="ml-1 text-blue-600 hover:text-blue-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-colors"
                disabled={isLoading}
              >
                {isSignupMode ? 'Sign In' : 'Create Account'}
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;