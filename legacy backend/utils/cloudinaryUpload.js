const cloudinary = require('cloudinary').v2;

class CloudinaryUploader {
  constructor() {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  /**
   * Uploads a buffer to Cloudinary (legacy method, now uses retry logic)
   * @param {Buffer} imageBuffer - Image buffer to upload
   * @param {string} fileName - Optional filename for the upload
   * @returns {Promise<string>} - Cloudinary URL of uploaded image
   */
  async uploadBuffer(imageBuffer, fileName = null) {
    const finalFileName = fileName || `generated_image_${Date.now()}`;
    return this.uploadBufferWithRetry(imageBuffer, finalFileName, 2);
  }

  /**
   * Uploads multiple image buffers to Cloudinary with optimized concurrency and retry logic
   * @param {Buffer[]} imageBuffers - Array of image buffers
   * @param {string} baseFileName - Base filename for uploads
   * @param {number} maxConcurrency - Maximum concurrent uploads (default: 3)
   * @returns {Promise<string[]>} - Array of Cloudinary URLs
   */
  async uploadMultiple(imageBuffers, baseFileName = 'generated_image', maxConcurrency = 3) {
    if (!imageBuffers || imageBuffers.length === 0) {
      return [];
    }

    try {
      const results = [];
      const batches = [];
      
      // Split into batches for controlled concurrency
      for (let i = 0; i < imageBuffers.length; i += maxConcurrency) {
        const batch = imageBuffers.slice(i, i + maxConcurrency);
        batches.push(batch);
      }

      // Process batches sequentially, uploads within each batch concurrently
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchPromises = batch.map((buffer, bufferIndex) => {
          const globalIndex = batchIndex * maxConcurrency + bufferIndex;
          const fileName = `${baseFileName}_${Date.now()}_${globalIndex}`;
          return this.uploadBufferWithRetry(buffer, fileName, 3);
        });

        const batchResults = await Promise.allSettled(batchPromises);
        
        // Collect successful uploads
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.warn('Upload failed:', result.reason?.message || result.reason);
            // Continue with other uploads instead of failing completely
          }
        }
      }

      console.log(`Successfully uploaded ${results.length}/${imageBuffers.length} images to Cloudinary`);
      return results;
    } catch (error) {
      console.error('Error uploading multiple images:', error);
      throw error;
    }
  }

  /**
   * Uploads a buffer to Cloudinary with retry logic
   * @param {Buffer} imageBuffer - Image buffer to upload
   * @param {string} fileName - Filename for the upload
   * @param {number} maxRetries - Maximum number of retry attempts
   * @returns {Promise<string>} - Cloudinary URL of uploaded image
   */
  async uploadBufferWithRetry(imageBuffer, fileName, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.uploadBufferWithTimeout(imageBuffer, fileName, 30000); // 30 second timeout
        return result;
      } catch (error) {
        lastError = error;
        console.warn(`Upload attempt ${attempt}/${maxRetries} failed for ${fileName}:`, error.message);
        
        if (attempt < maxRetries) {
          // Exponential backoff: wait 1s, 2s, 4s between retries
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Uploads a buffer to Cloudinary with timeout
   * @param {Buffer} imageBuffer - Image buffer to upload
   * @param {string} fileName - Filename for the upload
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<string>} - Cloudinary URL of uploaded image
   */
  async uploadBufferWithTimeout(imageBuffer, fileName, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Upload timeout after ${timeoutMs}ms for ${fileName}`));
      }, timeoutMs);

      const uploadOptions = {
        resource_type: 'image',
        folder: 'ai-generated-images',
        use_filename: true,
        unique_filename: true,
        public_id: fileName
      };

      cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          clearTimeout(timeout);
          
          if (error) {
            console.error(`Cloudinary upload error for ${fileName}:`, error);
            reject(error);
          } else {
            console.log(`Image uploaded to Cloudinary: ${result.secure_url}`);
            resolve(result.secure_url);
          }
        }
      ).end(imageBuffer);
    });
  }

  /**
   * Validates if Cloudinary is properly configured
   * @returns {boolean} - True if all required env vars are set
   */
  isConfigured() {
    return !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
  }
}

module.exports = CloudinaryUploader;
