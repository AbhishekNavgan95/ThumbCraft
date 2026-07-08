import { X, Download } from 'lucide-react';

const ImagePreviewModal = ({ isOpen, onClose, imageUrl, imageIndex, onDownload }) => {
  if (!isOpen || !imageUrl) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDownload = () => {
    onDownload(imageUrl, imageIndex);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative max-w-4xl max-h-full bg-white rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Thumbnail {imageIndex + 1} Preview
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="relative">
          <img
            src={imageUrl}
            alt={`Thumbnail ${imageIndex + 1} preview`}
            className="max-w-full max-h-[70vh] object-contain"
            onError={(e) => {
              e.target.src = `https://via.placeholder.com/640x360/6EE7B7/ffffff?text=Thumbnail+${imageIndex + 1}`;
            }}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>1280 × 720 pixels • HD Quality</span>
            <span>Perfect for YouTube thumbnails</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImagePreviewModal;