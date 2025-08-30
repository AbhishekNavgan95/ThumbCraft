import useUIStore from '../stores/uiStore';
import useAuthStore from '../stores/authStore';
import { 
  Zap, 
  Clock, 
  Sparkles,
  Target,
  BarChart3,
  Lightbulb,
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

  const features = [
    {
      icon: Zap,
      title: "AI-Powered Generation",
      description: "Create stunning thumbnails in seconds using advanced AI technology that understands what makes thumbnails click-worthy."
    },
    {
      icon: Target,
      title: "Click-Rate Optimization",
      description: "Our AI analyzes millions of high-performing thumbnails to create designs that maximize your click-through rates."
    },
    {
      icon: Sparkles,
      title: "Multiple Variations",
      description: "Get up to 4 different thumbnail options per generation to A/B test and find your perfect design."
    },
    {
      icon: Clock,
      title: "Lightning Fast",
      description: "Generate professional thumbnails in under 30 seconds. No more waiting hours for designers or struggling with complex tools."
    },
    {
      icon: BarChart3,
      title: "Analytics-Driven",
      description: "Built using data from top-performing YouTube channels to ensure your thumbnails follow proven success patterns."
    },
    {
      icon: Lightbulb,
      title: "Smart Suggestions",
      description: "Get intelligent recommendations based on your content category, mood, and target audience preferences."
    }
  ];

  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 bg-blue-100 rounded-full text-blue-800 text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4 mr-2" />
              AI-Powered Thumbnail Generation
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Create <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Viral</span> YouTube<br />
              Thumbnails in Seconds
            </h1>
            
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-12 leading-relaxed">
              Choose your starting point and let AI generate click-worthy thumbnails that boost views and grow your channel.
            </p>
          </div>

          {/* Quick Action Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Create from Prompt Card */}
            <div 
              onClick={() => handleOptionSelect('prompt')}
              className="bg-white rounded-xl shadow-lg border-2 border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-200 p-8 cursor-pointer group transform"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-6 group-hover:from-blue-600 group-hover:to-blue-700 transition-all duration-200">
                  <Edit3 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Create from Text
                </h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Describe your thumbnail idea and let AI create stunning visuals from your words
                </p>
                <div className="flex items-center justify-center text-blue-600 font-semibold group-hover:text-blue-700">
                  Start Creating <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>

            {/* Create from Image Card */}
            <div 
              onClick={() => handleOptionSelect('image')}
              className="bg-white rounded-xl shadow-lg border-2 border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all duration-200 p-8 cursor-pointer group transform"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-6 group-hover:from-purple-600 group-hover:to-purple-700 transition-all duration-200">
                  <Image className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Create from Image
                </h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Upload your image and enhance it with AI-powered thumbnail optimization
                </p>
                <div className="flex items-center justify-center text-purple-600 font-semibold group-hover:text-purple-700">
                  Start Creating <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Everything You Need to Create <span className="text-blue-600">Winning</span> Thumbnails
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our AI combines the latest in machine learning with proven design principles 
              to create thumbnails that actually convert viewers into clicks.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-xl p-8 hover:shadow-lg transition-all duration-200 hover:border-blue-200">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              From Idea to Thumbnail in <span className="text-blue-600">3 Simple Steps</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              No design experience needed. Our intuitive process makes creating professional thumbnails effortless.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white font-bold text-xl">1</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Describe Your Vision</h3>
              <p className="text-gray-600">Tell us about your video content, mood, and style preferences using simple words.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white font-bold text-xl">2</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">AI Creates Magic</h3>
              <p className="text-gray-600">Our advanced AI generates multiple thumbnail variations optimized for maximum clicks.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white font-bold text-xl">3</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Download & Upload</h3>
              <p className="text-gray-600">Choose your favorite, download in HD, and watch your views skyrocket!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;