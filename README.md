# AI Image Generator Server

A powerful Express.js server that generates AI images using Google's Gemini AI, with OpenAI prompt enhancement and Cloudinary hosting.

## Features

- 🎨 **Generate 4 AI images** from text prompts using Google Gemini
- 🚀 **Prompt Enhancement** with OpenAI ChatML format (optional toggle)
- ☁️ **Cloudinary Integration** for automatic image hosting
- 🌐 **RESTful API** with Express.js
- 📊 **Health Check** endpoint for service monitoring
- 🔧 **Modular Architecture** with reusable utility classes

## Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Get API Keys

**Google Gemini API:**
- Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
- Create and copy your API key

**OpenAI API (for prompt enhancement):**
- Visit [OpenAI Platform](https://platform.openai.com/api-keys)
- Create and copy your API key

**Cloudinary (for image hosting):**
- Visit [Cloudinary Console](https://cloudinary.com/console)
- Get your Cloud Name, API Key, and API Secret

### 3. Environment Setup
```bash
# Copy the example file
cp .env.example .env

# Edit .env with your actual credentials
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_cloudinary_api_key_here
CLOUDINARY_API_SECRET=your_cloudinary_api_secret_here
PORT=3000
```

## Usage

### Start the Server
```bash
npm start
# or
node server.js
```

### API Endpoints

#### Health Check
```bash
GET /health
```
Returns service status and configuration check.

#### Generate Images from Text
```bash
POST /api/generate
Content-Type: application/json

{
  "prompt": "A beautiful sunset over mountains",
  "enhancePrompt": true
}
```

**Parameters:**
- `prompt` (string, required): Text description for image generation
- `enhancePrompt` (boolean, optional): Whether to enhance the prompt using OpenAI (default: false)

#### Generate Images from Input Image
```bash
POST /api/generate-from-image
Content-Type: multipart/form-data

Form Data:
- image: [image file] (required)
- prompt: "Transform this into a cyberpunk style" (required)
- enhancePrompt: true (optional)
```

**Parameters:**
- `image` (file, required): Input image file (JPEG, PNG, GIF, WebP, max 10MB)
- `prompt` (string, required): Text description for image transformation
- `enhancePrompt` (boolean, optional): Whether to enhance the prompt using OpenAI (default: false)

**Response (for both endpoints):**
```json
{
  "success": true,
  "data": {
    "originalPrompt": "Transform this into a cyberpunk style",
    "finalPrompt": "A breathtaking cyberpunk transformation with neon lights...",
    "enhancedPrompt": true,
    "inputImage": {
      "originalName": "photo.jpg",
      "size": 1024000,
      "mimeType": "image/jpeg"
    },
    "imagesGenerated": 4,
    "imageUrls": [
      "https://res.cloudinary.com/your-cloud/image/upload/v1234567890/ai-generated-images/image1.png",
      "https://res.cloudinary.com/your-cloud/image/upload/v1234567890/ai-generated-images/image2.png",
      "https://res.cloudinary.com/your-cloud/image/upload/v1234567890/ai-generated-images/image3.png",
      "https://res.cloudinary.com/your-cloud/image/upload/v1234567890/ai-generated-images/image4.png"
    ],
    "timestamp": "2024-08-30T07:28:39.123Z"
  }
}
```

*Note: `inputImage` field is only present in `/api/generate-from-image` responses.*

### Example Usage

**Basic Generation:**
```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A futuristic city with flying cars"}'
```

**With Prompt Enhancement:**
```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A cat", "enhancePrompt": true}'
```

**Image-to-Image Generation:**
```bash
curl -X POST http://localhost:3000/api/generate-from-image \
  -F "image=@/path/to/your/image.jpg" \
  -F "prompt=Transform this into a cyberpunk style" \
  -F "enhancePrompt=true"
```

## Architecture

```
backend/
├── server.js                 # Main Express server
├── utils/
│   ├── promptEnhancer.js     # OpenAI prompt enhancement
│   ├── imageGenerator.js     # Google Gemini image generation
│   └── cloudinaryUpload.js   # Cloudinary upload utility
├── package.json
└── .env.example
```

## Dependencies

- **@google/genai** - Google Generative AI SDK
- **openai** - OpenAI API client
- **cloudinary** - Cloudinary upload service
- **express** - Web framework
- **cors** - Cross-origin resource sharing
- **dotenv** - Environment variable management
- **mime** - MIME type utilities

## Error Handling

The server includes comprehensive error handling:
- Missing or invalid prompts
- API key validation
- Service configuration checks
- Image generation failures
- Upload errors

## Development

The server automatically checks service configurations on startup and provides helpful status messages for missing credentials.
