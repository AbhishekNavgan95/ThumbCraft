const OpenAI = require('openai');

class PromptEnhancer {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Enhances a user prompt using OpenAI with ChatML format
   * @param {string} userPrompt - The original user prompt
   * @returns {Promise<string>} - Enhanced prompt for image generation
   */
  async enhancePrompt(userPrompt) {
    try {
      const messages = [
        {
          role: "system",
          content: `You are an expert prompt engineer for AI image generation. Your task is to enhance user prompts to create more detailed, visually appealing, and technically optimized prompts for image generation models.

Guidelines for enhancement:
- Add specific visual details (lighting, composition, style, colors)
- Include technical photography terms when appropriate
- Specify art styles or techniques if relevant
- Add atmosphere and mood descriptors
- Keep the core concept intact while making it more vivid
- Aim for 1-2 sentences maximum
- Focus on visual elements that will produce better images

Example:
Input: "a cat"
Output: "A majestic fluffy cat with bright emerald eyes, sitting gracefully in golden hour lighting, professional portrait photography, shallow depth of field, warm cinematic tones"`
        },
        {
          role: "user",
          content: `Please enhance this prompt for AI image generation: "${userPrompt}"`
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messages,
        max_tokens: 150,
        temperature: 0.7,
      });

      const enhancedPrompt = response.choices[0].message.content.trim();
      console.log(`Original prompt: "${userPrompt}"`);
      console.log(`Enhanced prompt: "${enhancedPrompt}"`);
      
      return enhancedPrompt;
    } catch (error) {
      console.error('Error enhancing prompt:', error.message);
      // Return original prompt if enhancement fails
      return userPrompt;
    }
  }

  /**
   * Validates if OpenAI API key is configured
   * @returns {boolean} - True if API key is available
   */
  isConfigured() {
    return !!process.env.OPENAI_API_KEY;
  }
}

module.exports = PromptEnhancer;
