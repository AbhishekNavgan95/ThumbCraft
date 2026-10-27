const crypto = require('crypto');

/**
 * Simple in-memory cache for prompt enhancements to avoid repeated API calls
 */
class PromptCache {
  constructor(maxSize = 100, ttlMinutes = 60) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000; // Convert to milliseconds
  }

  /**
   * Generate cache key from prompt
   * @param {string} prompt - The prompt to hash
   * @returns {string} - Cache key
   */
  generateKey(prompt) {
    return crypto.createHash('md5').update(prompt.trim().toLowerCase()).digest('hex');
  }

  /**
   * Get cached enhanced prompt
   * @param {string} originalPrompt - Original prompt
   * @returns {string|null} - Cached enhanced prompt or null if not found/expired
   */
  get(originalPrompt) {
    const key = this.generateKey(originalPrompt);
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }
    
    // Check if expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    console.log(`Cache hit for prompt enhancement: ${key.substring(0, 8)}...`);
    return cached.enhancedPrompt;
  }

  /**
   * Store enhanced prompt in cache
   * @param {string} originalPrompt - Original prompt
   * @param {string} enhancedPrompt - Enhanced prompt
   */
  set(originalPrompt, enhancedPrompt) {
    const key = this.generateKey(originalPrompt);
    
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      enhancedPrompt,
      timestamp: Date.now()
    });
    
    console.log(`Cached prompt enhancement: ${key.substring(0, 8)}...`);
  }

  /**
   * Clear all cached entries
   */
  clear() {
    this.cache.clear();
    console.log('Prompt cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMinutes: this.ttl / (60 * 1000)
    };
  }
}

// Export singleton instance
module.exports = new PromptCache();
