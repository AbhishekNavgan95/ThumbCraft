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
   * Uploads a buffer to Cloudinary
   * @param {Buffer} imageBuffer - Image buffer to upload
   * @param {string} fileName - Optional filename for the upload
   * @returns {Promise<string>} - Cloudinary URL of uploaded image
   */
  async uploadBuffer(imageBuffer, fileName = null) {
    try {
      return new Promise((resolve, reject) => {
        const uploadOptions = {
          resource_type: 'image',
          folder: 'ai-generated-images',
          use_filename: true,
          unique_filename: true,
        };

        if (fileName) {
          uploadOptions.public_id = fileName;
        }

        cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              console.error('Cloudinary upload error:', error);
              reject(error);
            } else {
              console.log(`Image uploaded to Cloudinary: ${result.secure_url}`);
              resolve(result.secure_url);
            }
          }
        ).end(imageBuffer);
      });
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Uploads multiple image buffers to Cloudinary
   * @param {Buffer[]} imageBuffers - Array of image buffers
   * @param {string} baseFileName - Base filename for uploads
   * @returns {Promise<string[]>} - Array of Cloudinary URLs
   */
  async uploadMultiple(imageBuffers, baseFileName = 'generated_image') {
    try {
      const uploadPromises = imageBuffers.map((buffer, index) => {
        const fileName = `${baseFileName}_${Date.now()}_${index}`;
        return this.uploadBuffer(buffer, fileName);
      });

      const urls = await Promise.all(uploadPromises);
      console.log(`Successfully uploaded ${urls.length} images to Cloudinary`);
      return urls;
    } catch (error) {
      console.error('Error uploading multiple images:', error);
      throw error;
    }
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
