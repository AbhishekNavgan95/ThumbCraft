import { useState, useRef } from 'react';
import useUIStore from '../stores/uiStore';
import { Upload, X, Trash2 } from 'lucide-react';

const ImageUpload = () => {
  const { uploadedImage, setUploadedImage } = useUIStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      return 'Please upload a valid image file (JPG, PNG, or WebP)';
    }

    if (file.size > maxSize) {
      return 'File size must be less than 10MB';
    }

    return null;
  };

  const handleFile = (file) => {
    const validationError = validateFile(file);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setUploadedImage(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = () => {
    setUploadedImage(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (uploadedImage) {
    return (
      <div className="space-y-4">
        <div className="relative bg-gray-50 rounded-lg overflow-hidden">
          <img
            src={URL.createObjectURL(uploadedImage)}
            alt="Uploaded thumbnail base"
            className="w-full h-64 object-cover"
          />
          <button
            onClick={handleRemove}
            className="absolute top-3 right-3 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="text-sm text-gray-600 text-center">
          <p className="font-medium">{uploadedImage.name}</p>
          <p>{(uploadedImage.size / (1024 * 1024)).toFixed(2)} MB</p>
        </div>

        <button
          onClick={handleRemove}
          className="w-full text-red-600 hover:text-red-700 font-medium py-2 px-4 border border-red-200 hover:border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors flex items-center justify-center"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Remove Image
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          isDragOver
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
        }`}
        onClick={handleBrowse}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
            <Upload className="w-8 h-8 text-gray-400" />
          </div>
          
          <div>
            <p className="text-lg font-medium text-gray-900 mb-2">
              {isDragOver ? 'Drop your image here' : 'Drag & drop your image here'}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              or click to browse files
            </p>
            
            <div className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
              <Upload className="w-4 h-4 mr-2" />
              Choose File
            </div>
          </div>
          
          <div className="text-xs text-gray-500">
            <p>Supported formats: JPG, PNG, WebP</p>
            <p>Maximum file size: 10MB</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

export default ImageUpload;