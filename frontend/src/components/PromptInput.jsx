import { useState } from 'react';
import useUIStore from '../stores/uiStore';
import ImageUpload from './ImageUpload';
import { ArrowLeft, ArrowRight, Lightbulb, Zap } from 'lucide-react';

const PromptInput = () => {
  const { 
    generationMode, 
    prompt, 
    setPrompt, 
    setCurrentStep, 
    resetFlow,
    uploadedImage,
    imageDescription,
    setImageDescription,
    enhancePrompt,
    setEnhancePrompt
  } = useUIStore();
  
  const [error, setError] = useState('');

  const handleNext = () => {
    if (generationMode === 'prompt' && !prompt.trim()) {
      setError('Please enter a prompt to generate your thumbnail');
      return;
    }
    
    if (generationMode === 'image' && !uploadedImage) {
      setError('Please upload an image to continue');
      return;
    }
    
    if (generationMode === 'image' && !imageDescription.trim()) {
      setError('Please provide a description for your thumbnail');
      return;
    }

    setError('');
    setCurrentStep('questions');
  };

  const handleBack = () => {
    resetFlow();
  };


  const handleSkipToGenerate = () => {
    if (generationMode === 'prompt' && !prompt.trim()) {
      setError('Please enter a prompt to generate your thumbnail');
      return;
    }
    
    if (generationMode === 'image' && !uploadedImage) {
      setError('Please upload an image to continue');
      return;
    }
    
    if (generationMode === 'image' && !imageDescription.trim()) {
      setError('Please provide a description for your thumbnail');
      return;
    }

    setError('');
    setCurrentStep('loading');
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <button
          onClick={handleBack}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg p-2 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Options
        </button>
        
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          {generationMode === 'prompt' ? 'Describe Your Thumbnail' : 'Upload Your Image'}
        </h2>
        <p className="text-lg text-gray-600">
          {generationMode === 'prompt' 
            ? 'Tell us what kind of thumbnail you want to create'
            : 'Upload an image to use as the base for your thumbnail'
          }
        </p>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        {generationMode === 'prompt' ? (
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-3">
              Thumbnail Description
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setError('');
              }}
              className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Describe your thumbnail idea... (e.g., 'A futuristic tech thumbnail with neon blue colors showing a robot hand reaching towards a glowing screen')"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-500">
                {prompt.length} characters
              </span>
              <div className="text-xs text-gray-500">
                Be as detailed as possible for best results
              </div>
            </div>
            
            {/* Enhanced Prompt Toggle */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Zap className="w-5 h-5 text-blue-600 mr-2" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-900">AI Prompt Enhancement</h4>
                    <p className="text-xs text-blue-700 mt-1">
                      Let our AI improve your prompt for better results
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enhancePrompt}
                    onChange={(e) => setEnhancePrompt(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <ImageUpload />
            
            {/* Thumbnail Description for Image Mode */}
            {uploadedImage && (
              <div className="mt-6">
                <label htmlFor="imageDescription" className="block text-sm font-medium text-gray-700 mb-3">
                  Thumbnail Description
                </label>
                <textarea
                  id="imageDescription"
                  value={imageDescription}
                  onChange={(e) => {
                    setImageDescription(e.target.value);
                    setError('');
                  }}
                  className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Describe how you want to enhance this image for your thumbnail... (e.g., 'Add bold text overlay, make colors more vibrant, add gaming elements')"
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-500">
                    {imageDescription.length} characters
                  </span>
                  <div className="text-xs text-gray-500">
                    Describe the enhancements you want
                  </div>
                </div>
                
                {/* AI Enhancer Toggle for Image Mode */}
                <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Zap className="w-5 h-5 text-purple-600 mr-2" />
                      <div>
                        <h4 className="text-sm font-medium text-purple-900">AI Enhancement</h4>
                        <p className="text-xs text-purple-700 mt-1">
                          Let AI automatically enhance your description for better results
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enhancePrompt}
                        onChange={(e) => setEnhancePrompt(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={handleSkipToGenerate}
            className="text-gray-600 hover:text-gray-800 font-medium px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
          >
            Skip Questions & Generate Now
          </button>
          
          <button
            onClick={handleNext}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center transition-colors"
          >
            Next: Customize Style
            <ArrowRight className="w-5 h-5 ml-2" />
          </button>
        </div>
      </div>

      {/* Tips */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
          <Lightbulb className="w-5 h-5 mr-2 text-blue-600" />
          {generationMode === 'prompt' ? 'Prompt Tips' : 'Image Tips'}
        </h3>
        {generationMode === 'prompt' ? (
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Include specific colors, emotions, or themes</li>
            <li>• Mention your content category (gaming, tech, vlog, etc.)</li>
            <li>• Describe the mood you want to convey</li>
            <li>• Be specific about visual elements you want</li>
          </ul>
        ) : (
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Upload high-quality images for best results</li>
            <li>• Supported formats: JPG, PNG, WebP</li>
            <li>• Recommended minimum size: 1280x720 pixels</li>
            <li>• The AI will enhance and optimize your image</li>
          </ul>
        )}
      </div>
    </div>
  );
};

export default PromptInput;