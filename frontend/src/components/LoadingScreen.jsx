import { useEffect, useState, useRef } from 'react';
import useUIStore from '../stores/uiStore';
import useImageStore from '../stores/imageStore';
import { Loader2, Info } from 'lucide-react';

const LoadingScreen = () => {
  const { 
    prompt, 
    answers, 
    uploadedImage, 
    completeGeneration, 
    generationMode, 
    imageDescription 
  } = useUIStore();
  const { generateThumbnails, isLoading } = useImageStore();
  const [loadingText, setLoadingText] = useState('Analyzing your prompt...');
  const [progress, setProgress] = useState(0);
  const [isTextVisible, setIsTextVisible] = useState(true);
  const hasGenerated = useRef(false);

  useEffect(() => {
    const loadingSteps = [
      'Analyzing your prompt...',
      'Generating creative concepts...',
      'Applying style preferences...',
      'Rendering thumbnails...',
      'Optimizing for YouTube...',
      'Finalizing your thumbnails...'
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < loadingSteps.length - 1) {
        // Fade out current text
        setIsTextVisible(false);
        
        setTimeout(() => {
          currentStep++;
          setLoadingText(loadingSteps[currentStep]);
          setProgress((currentStep / (loadingSteps.length - 1)) * 90);
          // Fade in new text
          setIsTextVisible(true);
        }, 150); // Brief fade duration
      }
    }, 3000); // Increased from 2000ms to 3000ms for smoother transitions

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const generateImages = async () => {
      if (hasGenerated.current) return; // Prevent multiple calls
      hasGenerated.current = true;
      
      try {
        // Use the appropriate prompt based on generation mode
        const effectivePrompt = generationMode === 'image' ? imageDescription : prompt;
        console.log('Starting image generation, mode:', generationMode);
        
        // Validate that we have the required inputs
        if (!effectivePrompt || effectivePrompt.trim() === '') {
          throw new Error('No prompt provided for generation');
        }
        
        if (generationMode === 'image' && !uploadedImage) {
          throw new Error('Image generation mode selected but no image uploaded');
        }
        
        const result = await generateThumbnails(effectivePrompt, answers, uploadedImage);
        console.log('Generation result:', result);
        
        if (result && result.success) {
          console.log('Generation successful, updating progress and completing...');
          setProgress(100);
          setTimeout(() => {
            completeGeneration();
          }, 1000);
        } else {
          console.error('Generation failed or returned falsy result:', result);
          hasGenerated.current = false; // Reset on error so user can retry
        }
      } catch (error) {
        console.error('Generation failed with exception:', error);
        hasGenerated.current = false; // Reset on error so user can retry
      }
    };

    generateImages();
  }, [prompt, imageDescription, answers, uploadedImage, generationMode]); // Added missing dependencies

  return (
    <div className="max-w-4xl mx-auto text-center">
      {/* Header */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Creating Your Thumbnails
        </h2>
        <p className="text-lg text-gray-600">
          Our AI is working its magic to create stunning thumbnails just for you
        </p>
      </div>

      {/* Progress Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          
          <p className={`text-xl font-semibold text-gray-900 mb-2 transition-opacity duration-150 ${
            isTextVisible ? 'opacity-100' : 'opacity-0'
          }`}>
            {loadingText}
          </p>
          
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          <p className="text-sm text-gray-500 transition-all duration-300">
            {Math.round(progress)}% complete
          </p>
        </div>

        <div className="text-sm text-gray-600">
          <p>This usually takes 30-60 seconds</p>
        </div>
      </div>

      {/* Thumbnail Skeletons */}
      <div className={`grid gap-6 ${
        parseInt(answers.imageCount) === 1 ? 'grid-cols-1 max-w-2xl mx-auto' :
        parseInt(answers.imageCount) === 2 ? 'md:grid-cols-2' :
        parseInt(answers.imageCount) === 3 ? 'md:grid-cols-2 lg:grid-cols-3' :
        parseInt(answers.imageCount) <= 4 ? 'md:grid-cols-2' :
        parseInt(answers.imageCount) <= 6 ? 'md:grid-cols-2 lg:grid-cols-3' :
        'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      }`}>
        {Array.from({ length: parseInt(answers.imageCount) || 4 }, (_, index) => index + 1).map((index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="relative">
              {/* Main image placeholder with smooth pulse */}
              <div className="w-full h-48 bg-gray-200 animate-pulse"></div>
              
              {/* Corner badges with pulse */}
              <div className="absolute top-3 left-3">
                <div className="w-16 h-6 bg-gray-300 rounded-full animate-pulse"></div>
              </div>
              
              <div className="absolute top-3 right-3">
                <div className="w-8 h-8 bg-gray-300 rounded-full animate-pulse"></div>
              </div>
            </div>
            
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-4 bg-gray-300 rounded animate-pulse mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded animate-pulse w-2/3"></div>
                </div>
                <div className="w-20 h-8 bg-gray-300 rounded animate-pulse ml-4"></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fun Facts */}
      <div className="mt-12 bg-blue-50 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-4 flex items-center justify-center">
          <Info className="w-5 h-5 mr-2 text-blue-600" />
          Did you know?
        </h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>• Thumbnails with faces get 30% more clicks than those without</p>
          <p>• Bright colors perform better than dark ones on YouTube</p>
          <p>• Text should be readable even at small sizes</p>
          <p>• The best thumbnails tell a story in a single glance</p>
        </div>
      </div>

    </div>
  );
};

export default LoadingScreen;