import { useEffect } from 'react';
import { X, Play, ExternalLink } from 'lucide-react';
import useUIStore from '../stores/uiStore';

const Toast = () => {
  const { toast, hideToast } = useUIStore();

  useEffect(() => {
    if (toast.show && toast.autoHide) {
      const timer = setTimeout(() => {
        hideToast();
      }, toast.duration || 5000);

      return () => clearTimeout(timer);
    }
  }, [toast.show, toast.autoHide, toast.duration, hideToast]);

  if (!toast.show) return null;

  const handleDemoClick = () => {
    // Scroll to Twitter embed section
    const twitterSection = document.querySelector('.twitter-tweet');
    if (twitterSection) {
      twitterSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    hideToast();
  };

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-2xl p-6 transform transition-all duration-300 ease-out">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900">Signups Temporarily Disabled</h3>
          </div>
          <button
            onClick={hideToast}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message */}
        <p className="text-gray-600 mb-4 leading-relaxed">
          We're currently not accepting new signups while we improve the platform. 
          Check out our demo video to see ThumbCraft in action!
        </p>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={handleDemoClick}
            className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105 shadow-md"
          >
            <Play className="w-4 h-4 mr-2" />
            Watch Demo
          </button>
          <button
            onClick={() => window.open('https://twitter.com/Abhishe57977667/status/1962400310930120897', '_blank')}
            className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Twitter Post
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toast;
