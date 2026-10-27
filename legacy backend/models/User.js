const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generationHistorySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['text-to-image', 'image-to-image'],
    required: true
  },
  originalPrompt: String,
  finalPrompt: String,
  enhancedPrompt: Boolean,
  // New structured fields
  category: String,
  mood: String,
  theme: String,
  primaryColor: String,
  includeText: Boolean,
  textStyle: String,
  thumbnailStyle: String,
  customPrompt: String,
  inputImage: {
    originalName: String,
    size: Number,
    mimeType: String
  },
  imagesGenerated: Number,
  imageUrls: [String],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: 2
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  generationHistory: [generationHistorySchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.validatePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateToken = function() {
  return jwt.sign({ id: this._id, email: this.email, name: this.name }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

userSchema.statics.verifyToken = function(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return null;
  }
};

userSchema.methods.addToHistory = function(generationData) {
  this.generationHistory.unshift(generationData);
  if (this.generationHistory.length > 100) {
    this.generationHistory = this.generationHistory.slice(0, 100);
  }
  return this.save();
};

userSchema.methods.getHistory = function(limit = 20, offset = 0) {
  const history = this.generationHistory.slice(offset, offset + limit);
  return {
    history,
    total: this.generationHistory.length,
    hasMore: offset + limit < this.generationHistory.length
  };
};

userSchema.methods.deleteHistoryEntry = function(historyId) {
  const initialLength = this.generationHistory.length;
  this.generationHistory = this.generationHistory.filter(
    entry => entry._id.toString() !== historyId
  );
  if (this.generationHistory.length < initialLength) {
    return this.save();
  }
  return Promise.resolve(false);
};

userSchema.methods.clearHistory = function() {
  this.generationHistory = [];
  return this.save();
};

const User = mongoose.model('User', userSchema);
module.exports = User;
