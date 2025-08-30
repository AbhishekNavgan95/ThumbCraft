import { useState } from 'react';
import useUIStore from '../stores/uiStore';
import useImageStore from '../stores/imageStore';
import { CheckCircle, Download, Plus, Eye, Loader2 } from 'lucide-react';
import ImagePreviewModal from './ImagePreviewModal';

const ResultsGrid = () => {
  const { resetFlow, answers } = useUIStore();
  const { generatedImages, downloadImage, downloadAll, clearImages, isDownloadingZip } = useImageStore();
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [previewModal, setPreviewModal] = useState({ isOpen: false, imageUrl: '', imageIndex: 0 });
  
  // Generate mock images based on selected count if no real images are available
  const imageCount = parseInt(answers.imageCount) || 4;
  const colors = ['6EE7B7', '3B82F6', 'EF4444', 'F59E0B', '8B5CF6', '10B981', 'F97316', 'EC4899'];
  const mockImages = Array.from({ length: imageCount }, (_, index) => 
    `https://via.placeholder.com/640x360/${colors[index % colors.length]}/ffffff?text=Thumbnail+${index + 1}`
  );

  const imagesToShow = generatedImages.length > 0 ? generatedImages : mockImages;

  const handleDownload = (imageUrl, index) => {
    downloadImage(imageUrl, `thumbnail-${index + 1}.png`);
  };

  const handleDownloadAll = () => {
    downloadAll(imagesToShow);
  };

  const handleCreateNew = () => {
    clearImages();
    resetFlow();
  };

  const handlePreview = (imageUrl, index) => {
    setPreviewModal({ isOpen: true, imageUrl, imageIndex: index });
  };

  const closePreview = () => {
    setPreviewModal({ isOpen: false, imageUrl: '', imageIndex: 0 });
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
            <CheckCircle className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            Your Thumbnails Are Ready!
          </h2>
        </div>
        <p className="text-lg text-gray-600">
          Choose your favorite or download all of them
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
        <button
          onClick={handleDownloadAll}
          disabled={isDownloadingZip}
          className={`${
            isDownloadingZip 
              ? 'bg-blue-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'
          } text-white font-medium px-6 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center transition-colors`}
        >
          {isDownloadingZip ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <Download className="w-5 h-5 mr-2" />
          )}
          {isDownloadingZip ? 'Creating ZIP...' : 'Download All as ZIP'}
        </button>
        
        <button
          onClick={handleCreateNew}
          className="border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900/80 font-medium px-6 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 flex items-center transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create New Thumbnails
        </button>
      </div>

      {/* Results Grid */}
      <div className={`grid gap-6 ${
        imageCount === 1 ? 'grid-cols-1 max-w-2xl mx-auto' :
        imageCount === 2 ? 'md:grid-cols-2' :
        imageCount === 3 ? 'md:grid-cols-2 lg:grid-cols-3' :
        imageCount <= 4 ? 'md:grid-cols-2' :
        imageCount <= 6 ? 'md:grid-cols-2 lg:grid-cols-3' :
        'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      }`}>
        {imagesToShow.map((imageUrl, index) => (
          <div 
            key={index}
            className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-200"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="relative group">
              <img
                src={imageUrl}
                alt={`Generated thumbnail ${index + 1}`}
                className="w-full h-64 object-cover"
                onError={(e) => {
                  e.target.src = `https://via.placeholder.com/640x360/6EE7B7/ffffff?text=Thumbnail+${index + 1}`;
                }}
              />
              
              {/* Overlay */}
              <div className={`absolute inset-0 bg-black/50 bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center gap-3 ${
                hoveredIndex === index ? 'opacity-100' : 'opacity-0'
              }`}>
                <button
                  onClick={() => handlePreview(imageUrl, index)}
                  className="bg-white text-gray-900 font-medium px-4 py-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black transform scale-95 hover:scale-100 transition-transform duration-200 flex items-center"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </button>
                <button
                  onClick={() => handleDownload(imageUrl, index)}
                  className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-black transform scale-95 hover:scale-100 transition-transform duration-200 flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </button>
              </div>

              {/* Quality Badge */}
              <div className="absolute top-3 left-3">
                <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
                  HD Quality
                </span>
              </div>

              {/* Thumbnail Number */}
              <div className="absolute top-3 right-3">
                <span className="bg-white bg-opacity-90 text-gray-900 text-sm font-semibold w-8 h-8 rounded-full flex items-center justify-center">
                  {index + 1}
                </span>
              </div>
            </div>
            
            <div className="p-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => handleDownload(imageUrl, index)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm flex items-center transition-colors"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tips Section */}
      <div className="mt-12 bg-yellow-50 rounded-xl p-6">
        <h3 className="font-semibold text-yellow-900 mb-3 flex items-center">
          <svg className="w-5 h-5 mr-2 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Pro Tips for Your Thumbnails
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-yellow-800">
          <div>
            <p className="font-medium mb-1">Upload Best Practices:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Use as your YouTube thumbnail immediately</li>
              <li>Test different versions to see what works best</li>
              <li>Make sure text is readable on mobile devices</li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-1">Optimization Tips:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>A/B test your thumbnails for better CTR</li>
              <li>Keep important elements away from the edges</li>
              <li>Ensure high contrast for better visibility</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      <ImagePreviewModal
        isOpen={previewModal.isOpen}
        onClose={closePreview}
        imageUrl={previewModal.imageUrl}
        imageIndex={previewModal.imageIndex}
        onDownload={handleDownload}
      />
    </div>
  );
};

export default ResultsGrid;