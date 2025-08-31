import useUIStore from '../stores/uiStore';
import useAuthStore from '../stores/authStore';
import { 
  Sparkles,
  Edit3,
  Image,
  ArrowRight
} from 'lucide-react';

const LandingPage = () => {
  const { setGenerationMode, setCurrentStep, openLoginModal } = useUIStore();
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
      <div className="relative overflow-hidden w-full">
        
        {/* Floating elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-20 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
        
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full text-blue-700 text-sm font-medium mb-8 shadow-sm border border-blue-100">
              <Sparkles className="w-4 h-4 mr-2 text-blue-500" />
              AI-Powered Thumbnail Generation
            </div>
            
            {/* Main Heading */}
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              <span className="block">ThumbCraft</span>
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent block text-4xl md:text-5xl mt-2">
                AI Thumbnail Generator
              </span>
            </h1>
            
            {/* Subheading */}
            <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-16 leading-relaxed font-light">
              Create stunning YouTube thumbnails in seconds. Choose your method and let AI do the magic.
            </p>
          </div>

          {/* Action Cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Create from Text Card */}
            <div 
              onClick={() => handleOptionSelect('prompt')}
              className="group relative bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 hover:border-blue-300/50 hover:shadow-2xl transition-all duration-300 p-10 cursor-pointer transform hover:scale-[1.02]"
            >
              <div className="text-center">
                <div className="p-4 w-max bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8 group-hover:from-blue-600 group-hover:to-blue-700 transition-all duration-300 shadow-lg group-hover:shadow-xl">
                  <Edit3 className="w-8 h-8 text-white" />
                </div>
                
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                  Create from Text
                </h3>
                
                <p className="text-gray-600 text-lg leading-relaxed mb-8">
                  Describe your thumbnail idea and watch AI bring it to life with stunning visuals
                </p>
                
                <div className="flex items-center justify-center text-blue-600 font-semibold text-lg group-hover:text-blue-700 transition-colors">
                  Start Creating 
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>

            {/* Create from Image Card */}
            <div 
              onClick={() => handleOptionSelect('image')}
              className="group relative bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 hover:border-purple-300/50 hover:shadow-2xl transition-all duration-300 p-10 cursor-pointer transform hover:scale-[1.02]"
            >
              <div className="text-center">
                <div className="p-4 w-max bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-8 group-hover:from-purple-600 group-hover:to-purple-700 transition-all duration-300 shadow-lg group-hover:shadow-xl">
                  <Image className="w-8 h-8 text-white" />
                </div>
                
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                  Create from Image
                </h3>
                
                <p className="text-gray-600 text-lg leading-relaxed mb-8">
                  Upload your image and enhance it with AI-powered thumbnail optimization
                </p>
                
                <div className="flex items-center justify-center text-purple-600 font-semibold text-lg group-hover:text-purple-700 transition-colors">
                  Start Creating 
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-600">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
              <span>Generate in 30 seconds</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
              <span>Up to 4 variations</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-purple-400 rounded-full mr-2"></div>
              <span>HD quality downloads</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;