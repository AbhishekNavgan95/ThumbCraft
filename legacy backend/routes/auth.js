const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  validateRegistration,
  validateLogin
} = require('../middleware/auth');
const router = express.Router();

// Signup endpoint
router.post('/signup', validateRegistration, async (req, res) => {
  try {

    return res.status(200).json({ 
      message: 'Account registration is currently paused for maintenance. Please try again later or contact support for assistance.' 
    });
    
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ 
        error: 'An account with this email already exists',
        suggestion: 'Please try logging in instead, or use a different email address.'
      });
    }
    const user = new User({ name, email, password });
    await user.save();
    const token = user.generateToken();
    res.status(201).json({ 
      token, 
      user: { id: user._id, name: user.name, email: user.email },
      message: 'Account created successfully! Welcome to AI Thumbnail Generator!'
    });
  } catch (err) {
    res.status(500).json({ error: 'Signup failed', details: err.message });
  }
});

// Login endpoint
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        error: 'No account found with this email address',
        suggestion: 'Please check your email address or create a new account.'
      });
    }
    const valid = await user.validatePassword(password);
    if (!valid) {
      return res.status(401).json({ 
        error: 'Incorrect password',
        suggestion: 'Please check your password and try again.'
      });
    }
    const token = user.generateToken();
    res.json({ 
      token, 
      user: { id: user._id, name: user.name, email: user.email },
      message: `Welcome back, ${user.name}! Login successful.`
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

// Profile endpoint - get current user data
router.get('/profile', async (req, res) => {
  try {
    // At this point, req.user should be set by the auth middleware
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email 
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get profile', details: err.message });
  }
});

module.exports = router;
