import { useState } from 'react';
import { Eye, Download, Sparkles } from 'lucide-react';

// Import gallery images - selecting a curated set for best showcase
const galleryImages = [
  'thumbnail-68b2f0fdd86111670ff367f7-1.png',
  'thumbnail-68b2f7c8f78bb3c1033b1b53-1.png',
  'thumbnail-68b2f7c8f78bb3c1033b1b53-2.png',
  'thumbnail-68b322db94465a4ddecc3d31-2.png',
  'thumbnail-68b3372c3a786e66dc8e9ba0-2.png',
  'thumbnail-68b3ed76ae68e13ffa09b90a-2.png',
  'thumbnail-68b4045b63ffee57c8600856-3.png',
  'thumbnail-68b406baf62d49c7eaf9efdd-3.png',
  'thumbnail-68b4126a6e583ae5de07ec2d-1.png',
  'thumbnail-68b4143a6e583ae5de07ec41-2.png',
  'thumbnail-68b416c542174adce76347d4-1.png',
  'thumbnail-68b41877d0cb58818761c54f-1.png',
  'thumbnail-68b41877d0cb58818761c54f-2.png',
  'thumbnail-68b419fc264b97e4eba26881-1.png',
  'thumbnail-68b4277aef9e0d38640c7a01-1.png',
  'thumbnail-68b4281def9e0d38640c7a51-1.png'
];

const Gallery = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [hoveredImage, setHoveredImage] = useState(null);

  const openModal = (image) => {
    setSelectedImage(image);
  };

  const closeModal = () => {
    setSelectedImage(null);
  };

  const downloadImage = (imageName) => {
    const link = document.createElement('a');
    link.href = `/gallery/${imageName}`;
    link.download = imageName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="mt-20 mb-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full text-purple-700 text-sm font-medium mb-6 shadow-sm border border-purple-100">
            <Sparkles className="w-4 h-4 mr-2 text-purple-500" />
            AI-Generated Masterpieces
          </div>
          
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Gallery of <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Amazing Creations</span>
          </h2>
          <p className="text-gray-600 text-lg max-w-3xl mx-auto leading-relaxed">
            Discover stunning thumbnails created by our AI. Each image showcases the power of artificial intelligence in creating eye-catching, professional-grade thumbnails.
          </p>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {galleryImages.map((image, index) => (
            <div
              key={index}
              className="group relative aspect-video bg-gray-100 rounded-xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] cursor-pointer"
              onMouseEnter={() => setHoveredImage(index)}
              onMouseLeave={() => setHoveredImage(null)}
              onClick={() => openModal(image)}
            >
              <img
                src={`/gallery/${image}`}
                alt={`AI Generated Thumbnail ${index + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                loading="lazy"
              />
              
              {/* Overlay */}
              <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-300 ${
                hoveredImage === index ? 'opacity-100' : 'opacity-0'
              }`}>
                <div className="flex space-x-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal(image);
                    }}
                    className="p-3 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadImage(image);
                    }}
                    className="p-3 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="text-center mt-12">
          <p className="text-gray-600 mb-6">
            Ready to create your own stunning thumbnails?
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            Start Creating Now
          </button>
        </div>
      </div>

      {/* Modal for full-size image */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl">
            <img
              src={`/gallery/${selectedImage}`}
              alt="Full size thumbnail"
              className="w-full h-full object-contain"
            />
            
            {/* Close button */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Download button in modal */}
            <button
              onClick={() => downloadImage(selectedImage)}
              className="absolute bottom-4 right-4 p-3 bg-purple-600 hover:bg-purple-700 rounded-full text-white transition-colors shadow-lg"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Gallery;
