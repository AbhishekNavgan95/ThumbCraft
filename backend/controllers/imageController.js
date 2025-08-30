const PromptEnhancer = require('../utils/promptEnhancer');
const ImageGenerator = require('../utils/imageGenerator');
const CloudinaryUploader = require('../utils/cloudinaryUpload');
const User = require('../models/User');

// Enhanced prompt generation based on structured fields
const generateEnhancedPrompt = (fields, isImageToImage = false) => {
  const {
    category,
    mood,
    theme,
    primaryColor,
    includeText,
    textStyle,
    thumbnailStyle,
    customPrompt
  } = fields;

  let prompt = customPrompt || '';
  
  // Build structured prompt
  const promptParts = [];
  
  if (category) promptParts.push(`${category} style`);
  if (thumbnailStyle) promptParts.push(`${thumbnailStyle} thumbnail`);
  if (theme) promptParts.push(`with ${theme} theme`);
  if (mood) promptParts.push(`${mood} mood`);
  if (primaryColor) promptParts.push(`dominant ${primaryColor} color palette`);
  
  if (includeText && textStyle) {
    promptParts.push(`featuring ${textStyle} text overlay`);
  } else if (includeText) {
    promptParts.push('with text overlay');
  }
  
  // For image-to-image, add specific instructions to preserve original elements
  if (isImageToImage) {
    promptParts.push('maintaining key visual elements from the reference image');
    promptParts.push('preserving the original composition and subject matter');
    promptParts.push('enhancing while keeping recognizable features');
  }
  
  // Combine custom prompt with structured elements
  if (promptParts.length > 0) {
    const structuredPrompt = promptParts.join(', ');
    prompt = prompt ? `${prompt}, ${structuredPrompt}` : structuredPrompt;
  }
  
  // Add quality modifiers for thumbnails
  prompt += ', high quality, professional, eye-catching, clean composition';
  
  return prompt;
};

// Text-to-image generation
const generateImages = async (req, res) => {
  try {
    const {
      prompt: originalPrompt,
      enhancePrompt = false,
      category,
      mood,
      theme,
      primaryColor,
      includeText,
      textStyle,
      thumbnailStyle,
      customPrompt,
      imageCount = '4'
    } = req.body;

    // Convert includeText string to boolean for database storage
    const includeTextBoolean = includeText === 'Yes' || includeText === true;
    
    // Convert imageCount string to integer with validation
    const imageCountInt = Math.max(1, Math.min(4, parseInt(imageCount) || 4));

    // Generate enhanced prompt from structured fields (text-to-image)
    const structuredPrompt = generateEnhancedPrompt({
      category, mood, theme, primaryColor, includeText, textStyle, thumbnailStyle, customPrompt
    }, false);
    
    let finalPrompt = structuredPrompt || originalPrompt;
    
    // Apply OpenAI enhancement if requested
    if (enhancePrompt && finalPrompt) {
      const promptEnhancer = new PromptEnhancer();
      finalPrompt = await promptEnhancer.enhancePrompt(finalPrompt);
    }

    if (!finalPrompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Generate images
    const imageGenerator = new ImageGenerator();
    const images = await imageGenerator.generateImages(finalPrompt, imageCountInt);
    
    // Upload to Cloudinary
    const cloudinaryUploader = new CloudinaryUploader();
    const imageUrls = await cloudinaryUploader.uploadMultiple(images);

    // Store in user history
    if (req.user) {
      const user = await User.findById(req.user.id);
      if (user) {
        await user.addToHistory({
          type: 'text-to-image',
          originalPrompt,
          finalPrompt,
          enhancedPrompt: enhancePrompt,
          category,
          mood,
          theme,
          primaryColor,
          includeText: includeTextBoolean,
          textStyle,
          thumbnailStyle,
          customPrompt,
          imagesGenerated: imageUrls.length,
          imageUrls
        });
      }
    }

    res.json({
      success: true,
      images: imageUrls,
      prompt: finalPrompt,
      enhanced: enhancePrompt
    });

  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({
      error: 'Failed to generate images',
      details: error.message
    });
  }
};

// Image-to-image generation
const generateFromImage = async (req, res) => {
  try {
    const {
      prompt: originalPrompt,
      enhancePrompt = false,
      category,
      mood,
      theme,
      primaryColor,
      includeText,
      textStyle,
      thumbnailStyle,
      customPrompt,
      imageCount = '4'
    } = req.body;

    // Convert includeText string to boolean for database storage
    const includeTextBoolean = includeText === 'Yes' || includeText === true;
    
    // Convert imageCount string to integer with validation
    const imageCountInt = Math.max(1, Math.min(4, parseInt(imageCount) || 4));
    
    const imageFile = req.file;

    if (!imageFile) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    // Generate enhanced prompt from structured fields (image-to-image)
    const structuredPrompt = generateEnhancedPrompt({
      category, mood, theme, primaryColor, includeText, textStyle, thumbnailStyle, customPrompt
    }, true);
    
    let finalPrompt = structuredPrompt || originalPrompt;
    
    // Apply OpenAI enhancement if requested
    if (enhancePrompt && finalPrompt) {
      const promptEnhancer = new PromptEnhancer();
      finalPrompt = await promptEnhancer.enhancePrompt(finalPrompt);
    }

    if (!finalPrompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Generate images from input image
    const imageGenerator = new ImageGenerator();
    const images = await imageGenerator.generateImagesFromImage(imageFile.buffer, finalPrompt, imageCountInt);
    
    // Upload to Cloudinary
    const cloudinaryUploader = new CloudinaryUploader();
    const imageUrls = await cloudinaryUploader.uploadMultiple(images);

    // Store in user history
    if (req.user) {
      const user = await User.findById(req.user.id);
      if (user) {
        await user.addToHistory({
          type: 'image-to-image',
          originalPrompt,
          finalPrompt,
          enhancedPrompt: enhancePrompt,
          category,
          mood,
          theme,
          primaryColor,
          includeText: includeTextBoolean,
          textStyle,
          thumbnailStyle,
          customPrompt,
          inputImage: {
            originalName: imageFile.originalname,
            size: imageFile.size,
            mimeType: imageFile.mimetype
          },
          imagesGenerated: imageUrls.length,
          imageUrls
        });
      }
    }

    res.json({
      success: true,
      images: imageUrls,
      prompt: finalPrompt,
      enhanced: enhancePrompt,
      inputImage: {
        name: imageFile.originalname,
        size: imageFile.size
      }
    });

  } catch (error) {
    console.error('Image-to-image generation error:', error);
    res.status(500).json({
      error: 'Failed to generate images from input image',
      details: error.message
    });
  }
};

// Get user generation history
const getHistory = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const historyData = user.getHistory(parseInt(limit), parseInt(offset));
    res.json(historyData);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      error: 'Failed to fetch history',
      details: error.message
    });
  }
};

// Delete specific history entry
const deleteHistoryEntry = async (req, res) => {
  try {
    const { historyId } = req.params;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const deleted = await user.deleteHistoryEntry(historyId);
    if (deleted) {
      res.json({ success: true, message: 'History entry deleted' });
    } else {
      res.status(404).json({ error: 'History entry not found' });
    }
  } catch (error) {
    console.error('Delete history entry error:', error);
    res.status(500).json({
      error: 'Failed to delete history entry',
      details: error.message
    });
  }
};

// Clear all history
const clearHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.clearHistory();
    res.json({ success: true, message: 'History cleared' });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({
      error: 'Failed to clear history',
      details: error.message
    });
  }
};

module.exports = {
  generateImages,
  generateFromImage,
  getHistory,
  deleteHistoryEntry,
  clearHistory
};
