import useUIStore from '../stores/uiStore';
import useAuthStore from '../stores/authStore';
import { Edit3, Image, ArrowLeft } from 'lucide-react';

const ModeSelection = () => {
  const { setGenerationMode, setCurrentStep, openLoginModal, resetFlow } = useUIStore();
  const { isAuthenticated } = useAuthStore();

  const handleOptionSelect = (mode) => {
    if (!isAuthenticated) {
      setGenerationMode(mode);
      openLoginModal();
      return;
    }
    
    setGenerationMode(mode);
    setCurrentStep('input');
  };

  const handleBack = () => {
    resetFlow();
  };

  return (
    <div className="text-center bg-white">
      <div className="mb-8">
        <button
          onClick={handleBack}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Home
        </button>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Choose Your Starting Point
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          How would you like to create your thumbnail?
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Create from Prompt Option */}
        <div className="bg-white rounded-xl shadow-sm border-2 border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 p-8">
          <button
            onClick={() => handleOptionSelect('prompt')}
            className="w-full text-left"
          >
            <div className="w-16 h-16 bg-blue-50 rounded-xl flex items-center justify-center mb-6 mx-auto">
              <Edit3 className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3 text-center">
              Create from Text
            </h3>
            <p className="text-gray-600 leading-relaxed text-center">
              Describe your thumbnail idea and let AI create stunning visuals from your words
            </p>
          </button>
        </div>

        {/* Create from Image Option */}
        <div className="bg-white rounded-xl shadow-sm border-2 border-gray-200 hover:border-green-300 hover:shadow-md transition-all duration-200 p-8">
          <button
            onClick={() => handleOptionSelect('image')}
            className="w-full text-left"
          >
            <div className="w-16 h-16 bg-green-50 rounded-xl flex items-center justify-center mb-6 mx-auto">
              <Image className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3 text-center">
              Create from Image
            </h3>
            <p className="text-gray-600 leading-relaxed text-center">
              Upload your image and enhance it with AI-powered thumbnail optimization
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModeSelection;