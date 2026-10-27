require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const PromptEnhancer = require('./utils/promptEnhancer');
const ImageGenerator = require('./utils/imageGenerator');
const CloudinaryUploader = require('./utils/cloudinaryUpload');
const connectMongo = require('./utils/connectMongo');
const { requireAuth } = require('./middleware/auth');
const {
    generateImages,
    generateFromImage,
    getHistory,
    deleteHistoryEntry,
    clearHistory
} = require('./controllers/imageController');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectMongo();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Auth routes
app.use('/api', require('./routes/auth'));

// Protect all API routes except auth and health
app.use((req, res, next) => {
    const openPaths = [
        '/api/signup',
        '/api/login',
        '/api/health',
        '/health',
        '/api-docs',
    ];
    if (openPaths.some(path => req.path.startsWith(path))) {
        return next();
    }
    return requireAuth(req, res, next);
});

// Error handling middleware
app.use((error, req, res, next) => {
    // Handle multer errors
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File too large. Maximum size is 10MB.'
            });
        }
        return res.status(400).json({
            error: 'File upload error',
            message: error.message
        });
    }

    // Handle other errors
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message
    });
});

// Initialize services
const promptEnhancer = new PromptEnhancer();
const imageGenerator = new ImageGenerator();
const cloudinaryUploader = new CloudinaryUploader();

// Health check endpoint
app.get('/health', (req, res) => {
    const status = {
        server: 'running',
        gemini: imageGenerator.isConfigured(),
        openai: promptEnhancer.isConfigured(),
        cloudinary: cloudinaryUploader.isConfigured(),
    };

    res.json({
        status: 'ok',
        services: status,
        timestamp: new Date().toISOString()
    });
});

// Main image generation endpoint
app.post('/api/generate', upload.none(), requireAuth, generateImages);

// Image-to-image generation endpoint
app.post('/api/generate-from-image', upload.single('image'), requireAuth, generateFromImage);

// History endpoints
app.get('/api/history', requireAuth, getHistory);
app.delete('/api/history/:historyId', requireAuth, deleteHistoryEntry);
app.delete('/api/history', requireAuth, clearHistory);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 AI Image Generator Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🎨 Generate images: POST http://localhost:${PORT}/api/generate`);
    console.log(`🖼️ Generate from image: POST http://localhost:${PORT}/api/generate-from-image`);
    console.log(`👤 Register: POST http://localhost:${PORT}/api/signup`);
    console.log(`👤 Login: POST http://localhost:${PORT}/api/login`);


    // Check service configurations
    console.log('\n📋 Service Status:');
    console.log(`   Gemini AI: ${imageGenerator.isConfigured() ? '✅' : '❌'}`);
    console.log(`   OpenAI: ${promptEnhancer.isConfigured() ? '✅' : '❌'}`);
    console.log(`   Cloudinary: ${cloudinaryUploader.isConfigured() ? '✅' : '❌'}`);

    if (!imageGenerator.isConfigured()) {
        console.log('⚠️  Set GEMINI_API_KEY to enable image generation');
    }
    if (!promptEnhancer.isConfigured()) {
        console.log('⚠️  Set OPENAI_API_KEY to enable prompt enhancement');
    }
    if (!cloudinaryUploader.isConfigured()) {
        console.log('⚠️  Set Cloudinary credentials to enable image uploads');
    }
});

module.exports = app;
