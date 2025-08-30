import useUIStore from '../stores/uiStore';
import useAuthStore from '../stores/authStore';
import { Edit3, Image, Zap, Clock, Heart } from 'lucide-react';

const OptionSelection = () => {
  const { setGenerationMode, setCurrentStep, openLoginModal } = useUIStore();
  const { isAuthenticated } = useAuthStore();

  const handleOptionSelect = (mode) => {
    if (!isAuthenticated) {
      // Store the intended mode for after login
      setGenerationMode(mode);
      openLoginModal();
      return;
    }
    
    setGenerationMode(mode);
    setCurrentStep('input');
  };

  return (
    <div className="text-center">
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Create Amazing YouTube Thumbnails
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Generate eye-catching thumbnails using AI. Choose your starting point below.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Create from Prompt Option */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200">
          <button
            onClick={() => handleOptionSelect('prompt')}
            className="w-full p-8 text-left"
          >
            <div className="mb-6">
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                <Edit3 className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Create from Prompt
              </h3>
              <p className="text-gray-600 leading-relaxed text-sm">
                Describe your thumbnail idea in words and let our AI bring your vision to life with stunning visuals.
              </p>
            </div>
          </button>
        </div>

        {/* Create from Image Option */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:border-green-300 hover:shadow-md transition-all duration-200">
          <button
            onClick={() => handleOptionSelect('image')}
            className="w-full p-8 text-left"
          >
            <div className="mb-6">
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center mb-4">
                <Image className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Create from Image
              </h3>
              <p className="text-gray-600 leading-relaxed text-sm">
                Upload your own image as a starting point and enhance it with AI-powered thumbnail optimization.
              </p>
            </div>
          </button>
        </div>
      </div>

      <div className="mt-12">
        <div className="flex items-center justify-center space-x-8 text-sm text-gray-500">
          <div className="flex items-center">
            <Zap className="w-5 h-5 text-blue-500 mr-2" />
            AI-Powered
          </div>
          <div className="flex items-center">
            <Clock className="w-5 h-5 text-blue-500 mr-2" />
            Fast Generation
          </div>
          <div className="flex items-center">
            <Heart className="w-5 h-5 text-blue-500 mr-2" />
            High Quality
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptionSelection;