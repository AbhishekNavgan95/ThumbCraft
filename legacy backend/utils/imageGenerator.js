const { GoogleGenAI } = require('@google/genai');
const mime = require('mime');

class ImageGenerator {
  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    this.model = 'gemini-2.5-flash-image-preview';
    this.config = {
      responseModalities: ['IMAGE', 'TEXT'],
    };
  }

  /**
   * Generates multiple images from a single prompt
   * @param {string} prompt - Text prompt for image generation
   * @param {number} count - Number of images to generate (default: 4)
   * @returns {Promise<Buffer[]>} - Array of image buffers
   */
  async generateImages(prompt, count = 4) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    console.log(`Generating ${count} images for prompt: "${prompt}"`);
    
    const imageBuffers = [];
    const generatePromises = [];

    // Generate multiple images concurrently
    for (let i = 0; i < count; i++) {
      generatePromises.push(this.generateSingleImage(prompt, i + 1));
    }

    try {
      const results = await Promise.all(generatePromises);
      
      // Filter out any failed generations and collect buffers
      for (const result of results) {
        if (result && result.length > 0) {
          imageBuffers.push(...result);
        }
      }

      console.log(`Successfully generated ${imageBuffers.length} images`);
      return imageBuffers;
    } catch (error) {
      console.error('Error generating images:', error);
      throw error;
    }
  }

  /**
   * Generates a single image from a prompt
   * @param {string} prompt - Text prompt for image generation
   * @param {number} index - Index for logging purposes
   * @returns {Promise<Buffer[]>} - Array containing image buffer(s)
   */
  async generateSingleImage(prompt, index) {
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ];

    try {
      console.log(`Generating image ${index}...`);
      
      const response = await this.ai.models.generateContentStream({
        model: this.model,
        config: this.config,
        contents,
      });

      const imageBuffers = [];

      for await (const chunk of response) {
        if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
          continue;
        }

        if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
          const inlineData = chunk.candidates[0].content.parts[0].inlineData;
          const buffer = Buffer.from(inlineData.data || '', 'base64');
          imageBuffers.push(buffer);
          console.log(`Image ${index} generated successfully`);
        } else if (chunk.text) {
          console.log(`AI Response for image ${index}:`, chunk.text);
        }
      }

      return imageBuffers;
    } catch (error) {
      console.error(`Error generating image ${index}:`, error.message);
      return [];
    }
  }

  /**
   * Generates multiple images from an input image and prompt with optimized concurrency
   * @param {Buffer} imageBuffer - Input image buffer
   * @param {string} prompt - Text prompt for image generation
   * @param {number} count - Number of images to generate (default: 4)
   * @param {Function} onImageComplete - Optional callback for each completed image
   * @returns {Promise<Buffer[]>} - Array of image buffers
   */
  async generateImagesFromImage(imageBuffer, prompt, count = 4, onImageComplete = null) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    console.log(`Generating ${count} images from input image with prompt: "${prompt}"`);
    
    const imageBuffers = [];
    const maxConcurrency = Math.min(count, 3); // Limit concurrent requests to prevent API throttling
    const batches = [];
    
    // Split into batches for controlled concurrency
    for (let i = 0; i < count; i += maxConcurrency) {
      const batch = [];
      for (let j = i; j < Math.min(i + maxConcurrency, count); j++) {
        batch.push(j + 1);
      }
      batches.push(batch);
    }

    try {
      // Process batches sequentially, but images within each batch concurrently
      for (const batch of batches) {
        const batchPromises = batch.map(index => 
          this.generateSingleImageFromImageOptimized(imageBuffer, prompt, index, onImageComplete)
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Collect successful results
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
            imageBuffers.push(...result.value);
          } else if (result.status === 'rejected') {
            console.warn(`Batch generation failed:`, result.reason?.message || result.reason);
          }
        }
      }

      console.log(`Successfully generated ${imageBuffers.length} images from input image`);
      return imageBuffers;
    } catch (error) {
      console.error('Error generating images from input image:', error);
      throw error;
    }
  }

  /**
   * Generates a single image from an input image and prompt (legacy method)
   * @param {Buffer} imageBuffer - Input image buffer
   * @param {string} prompt - Text prompt for image generation
   * @param {number} index - Index for logging purposes
   * @returns {Promise<Buffer[]>} - Array containing image buffer(s)
   */
  async generateSingleImageFromImage(imageBuffer, prompt, index) {
    return this.generateSingleImageFromImageOptimized(imageBuffer, prompt, index);
  }

  /**
   * Optimized version: Generates a single image from an input image and prompt
   * @param {Buffer} imageBuffer - Input image buffer
   * @param {string} prompt - Text prompt for image generation
   * @param {number} index - Index for logging purposes
   * @param {Function} onComplete - Optional callback when image is complete
   * @returns {Promise<Buffer[]>} - Array containing image buffer(s)
   */
  async generateSingleImageFromImageOptimized(imageBuffer, prompt, index, onComplete = null) {
    const base64Image = imageBuffer.toString('base64');
    const mimeType = this.detectMimeType(imageBuffer);

    // Create enhanced prompt that ensures strong reference to the original image
    const systemPrompt = `You are a thumbnail creator that modifies existing images. CRITICAL INSTRUCTIONS:
1. Use the provided reference image as the primary foundation - preserve ALL key visual elements
2. Keep the same characters, objects, faces, and overall composition from the original
3. Only apply the requested style modifications as overlays or enhancements
4. The original subject matter and recognizable elements must remain clearly visible
5. Think of this as "restyling" the existing image, not creating something new
6. Generate the image in 16:9 widescreen aspect ratio format suitable for thumbnails`;
    
    const enhancedPrompt = `${systemPrompt}\n\nModification request: ${prompt}\n\nIMPORTANT: Start with the provided reference image and apply only the requested modifications while keeping all original elements intact and recognizable. Create the final image in 16:9 widescreen thumbnail format.`;

    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: enhancedPrompt,
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          }
        ],
      },
    ];

    try {
      console.log(`Generating image ${index} from input image...`);
      
      // Add timeout to prevent hanging requests
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Image ${index} generation timeout after 60 seconds`)), 60000);
      });
      
      const generationPromise = this.ai.models.generateContentStream({
        model: this.model,
        config: this.config,
        contents,
      });
      
      const response = await Promise.race([generationPromise, timeoutPromise]);
      const imageBuffers = [];

      for await (const chunk of response) {
        if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
          continue;
        }

        if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
          const inlineData = chunk.candidates[0].content.parts[0].inlineData;
          const buffer = Buffer.from(inlineData.data || '', 'base64');
          imageBuffers.push(buffer);
          console.log(`Image ${index} generated successfully from input image`);
          
          // Call completion callback if provided
          if (onComplete && typeof onComplete === 'function') {
            try {
              await onComplete(buffer, index);
            } catch (callbackError) {
              console.warn(`Callback error for image ${index}:`, callbackError.message);
            }
          }
        } else if (chunk.text) {
          console.log(`AI Response for image ${index}:`, chunk.text);
        }
      }

      return imageBuffers;
    } catch (error) {
      console.error(`Error generating image ${index} from input image:`, error.message);
      
      // Return empty array instead of throwing to allow other images to continue
      if (error.message.includes('timeout')) {
        console.warn(`Image ${index} generation timed out, continuing with other images`);
      }
      return [];
    }
  }

  /**
   * Detects MIME type from image buffer
   * @param {Buffer} buffer - Image buffer
   * @returns {string} - MIME type
   */
  detectMimeType(buffer) {
    const signatures = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/gif': [0x47, 0x49, 0x46],
      'image/webp': [0x52, 0x49, 0x46, 0x46]
    };

    for (const [mimeType, signature] of Object.entries(signatures)) {
      if (signature.every((byte, index) => buffer[index] === byte)) {
        return mimeType;
      }
    }

    // Default to JPEG if unable to detect
    return 'image/jpeg';
  }

  /**
   * Validates if the image generator is properly configured
   * @returns {boolean} - True if API key is available
   */
  isConfigured() {
    return !!process.env.GEMINI_API_KEY;
  }
}

module.exports = ImageGenerator;
