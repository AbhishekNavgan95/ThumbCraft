const PromptEnhancer = require('../utils/promptEnhancer');
const ImageGenerator = require('../utils/imageGenerator');
const CloudinaryUploader = require('../utils/cloudinaryUpload');
const promptCache = require('../utils/promptCache');
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
    customPrompt,
    originalPrompt
  } = fields;

  let prompt = '';
  
  // Build structured prompt
  const promptParts = [];
  
  // For image-to-image, prioritize the original prompt requirements
  if (isImageToImage) {
    // Start with the original prompt as the primary instruction
    if (originalPrompt) {
      prompt = `Primary objective: ${originalPrompt}. Use the reference image provided as the foundation and modify it to fulfill this main requirement. `;
    } else {
      prompt = 'Create a thumbnail based on the reference image provided, maintaining the core visual elements, characters, objects, and composition from the original image. ';
    }
    
    // Add tweaking instructions based on answers as secondary modifications
    const tweaks = [];
    if (category) tweaks.push(`adapt it for ${category} content style`);
    if (mood) tweaks.push(`adjust the mood to be ${mood.toLowerCase()}`);
    if (theme) tweaks.push(`apply ${theme.toLowerCase()} visual theme`);
    if (primaryColor) tweaks.push(`emphasize ${primaryColor.toLowerCase()} color tones`);
    if (thumbnailStyle) tweaks.push(`render in ${thumbnailStyle.toLowerCase()} style`);
    
    if (includeText === 'Yes' && textStyle) {
      tweaks.push(`add ${textStyle.toLowerCase()} text overlay`);
    } else if (includeText === 'Yes') {
      tweaks.push('add text overlay');
    }
    
    if (tweaks.length > 0) {
      prompt += 'Secondary style adjustments: ' + tweaks.join(', ') + '. ';
    }
    
    if (customPrompt) {
      prompt += `Additional requirements: ${customPrompt}. `;
    }
    
    prompt += 'IMPORTANT: Focus primarily on fulfilling the main objective while preserving recognizable elements from the reference image. Apply style adjustments as enhancements that support the main goal. Ensure the result is suitable as a thumbnail - eye-catching, clear, and professional.';
  } else {
    // For text-to-image, start with strict aspect ratio instructions
    prompt = 'Create a YouTube thumbnail in STRICT 16:9 aspect ratio (1920x1080 dimensions). ';
    
    // Add the original prompt as the main subject
    if (originalPrompt) {
      prompt += `Main subject: ${originalPrompt}. `;
    }
    
    // Add custom prompt if provided
    if (customPrompt) {
      prompt += `Additional requirements: ${customPrompt}. `;
    }
    
    // Build structured style modifications
    if (category) promptParts.push(`${category} style`);
    if (thumbnailStyle) promptParts.push(`${thumbnailStyle} thumbnail`);
    if (theme) promptParts.push(`with ${theme} theme`);
    if (mood) promptParts.push(`${mood} mood`);
    if (primaryColor) promptParts.push(`dominant ${primaryColor} color palette`);
    
    if (includeText === 'Yes' && textStyle) {
      promptParts.push(`featuring ${textStyle} text overlay`);
    } else if (includeText === 'Yes') {
      promptParts.push('with text overlay');
    }
    
    // Combine with structured elements
    if (promptParts.length > 0) {
      prompt += 'Style requirements: ' + promptParts.join(', ') + '. ';
    }
    
    // Add quality modifiers with repeated emphasis on 16:9 aspect ratio
    prompt += 'CRITICAL: Must be exactly 16:9 aspect ratio, widescreen format, horizontal layout, YouTube thumbnail proportions (1920x1080). High quality, professional, eye-catching, clean composition optimized for YouTube thumbnail viewing.';
  }
  
  return prompt;
};

// Text-to-image generation
const generateImages = async (req, res) => {
  try {
    const {
      prompt: originalPrompt,
      originalPrompt: explicitOriginalPrompt,
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

    // Use explicit originalPrompt if provided, otherwise fall back to prompt
    const actualOriginalPrompt = explicitOriginalPrompt || originalPrompt;

    console.log("TEXT GENERATION - originalPrompt : ", actualOriginalPrompt);
    console.log("TEXT GENERATION - enhancePrompt : ", enhancePrompt);
    console.log("TEXT GENERATION - category : ", category);
    console.log("TEXT GENERATION - mood : ", mood);
    console.log("TEXT GENERATION - theme : ", theme);
    console.log("TEXT GENERATION - primaryColor : ", primaryColor);
    console.log("TEXT GENERATION - includeText : "  , includeText);
    console.log("TEXT GENERATION - textStyle : ", textStyle);
    console.log("TEXT GENERATION - thumbnailStyle : ", thumbnailStyle);
    console.log("TEXT GENERATION - customPrompt : ", customPrompt);
    console.log("TEXT GENERATION - imageCount : ", imageCount);

    // Convert includeText string to boolean for database storage
    const includeTextBoolean = includeText === 'Yes' || includeText === true;
    
    // Convert imageCount string to integer with validation
    const imageCountInt = Math.max(1, Math.min(4, parseInt(imageCount) || 4));

    // Generate enhanced prompt from structured fields (text-to-image)
    const structuredPrompt = generateEnhancedPrompt({
      category, mood, theme, primaryColor, includeText, textStyle, thumbnailStyle, customPrompt, originalPrompt: actualOriginalPrompt
    }, false);
    
    let finalPrompt = structuredPrompt;
    
    console.log("TEXT GENERATION - structuredPrompt with filters : ", structuredPrompt);
    
    // Apply OpenAI enhancement if requested (with caching)
    if (enhancePrompt && finalPrompt) {
      // Check cache first
      const cachedEnhancement = promptCache.get(finalPrompt);
      if (cachedEnhancement) {
        finalPrompt = cachedEnhancement;
      } else {
        const promptEnhancer = new PromptEnhancer();
        const originalPrompt = finalPrompt;
        finalPrompt = await promptEnhancer.enhancePrompt(finalPrompt);
        // Cache the result
        promptCache.set(originalPrompt, finalPrompt);
      }
    }

    console.log("TEXT GENERATION - finalPrompt after enhancement : ", finalPrompt);

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
          originalPrompt: actualOriginalPrompt,
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
      imageCount = '1'
    } = req.body;

    console.log("originalPrompt : ", originalPrompt);
    console.log("enhancePrompt : ", enhancePrompt);
    console.log("category : ", category);
    console.log("mood : ", mood);
    console.log("theme : ", theme);
    console.log("primaryColor : ", primaryColor);
    console.log("includeText : "  , includeText);
    console.log("textStyle : ", textStyle);
    console.log("thumbnailStyle : ", thumbnailStyle);
    console.log("customPrompt : ", customPrompt);
    console.log("imageCount : ", imageCount);

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
      category, mood, theme, primaryColor, includeText, textStyle, thumbnailStyle, customPrompt, originalPrompt
    }, true);

    console.log("structuredPrompt with filters : ", structuredPrompt);
    
    let finalPrompt = structuredPrompt;
    
    // Apply OpenAI enhancement if requested (with caching)
    if (enhancePrompt && finalPrompt) {
      // Check cache first
      const cachedEnhancement = promptCache.get(finalPrompt);
      if (cachedEnhancement) {
        finalPrompt = cachedEnhancement;
      } else {
        const promptEnhancer = new PromptEnhancer();
        const originalPrompt = finalPrompt;
        finalPrompt = await promptEnhancer.enhancePrompt(finalPrompt);
        // Cache the result
        promptCache.set(originalPrompt, finalPrompt);
      }
    }

    console.log("finalPrompt after enhancement : ", finalPrompt);

    if (!finalPrompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Generate images from input image with optimized pipeline
    const imageGenerator = new ImageGenerator();
    const cloudinaryUploader = new CloudinaryUploader();
    const imageUrls = [];
    
    // Use callback to upload images as they complete (pipeline optimization)
    const onImageComplete = async (imageBuffer, index) => {
      try {
        const fileName = `image_to_image_${Date.now()}_${index}`;
        const url = await cloudinaryUploader.uploadBuffer(imageBuffer, fileName);
        imageUrls.push(url);
        console.log(`Image ${index} uploaded immediately after generation`);
      } catch (uploadError) {
        console.warn(`Failed to upload image ${index} immediately:`, uploadError.message);
      }
    };
    
    const images = await imageGenerator.generateImagesFromImage(
      imageFile.buffer, 
      finalPrompt, 
      imageCountInt, 
      onImageComplete
    );
    
    // Upload any remaining images that weren't uploaded via callback
    const remainingImages = images.filter((_, index) => !imageUrls[index]);
    if (remainingImages.length > 0) {
      const remainingUrls = await cloudinaryUploader.uploadMultiple(remainingImages, 'image_to_image_fallback');
      imageUrls.push(...remainingUrls);
    }

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
