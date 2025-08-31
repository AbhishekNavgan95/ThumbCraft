# AI Thumbnail Generator

> **Demo Credentials**
> 
> Email: `navganabhishek90@gmail.com`
> 
> Password: `Abhi@1212`
>
> **Live Demo:** [https://thumbcraft.abhisheknavgan.xyz/](https://thumbcraft.abhisheknavgan.xyz/)

A full-stack web application for generating high-quality, YouTube-ready thumbnails using AI. Supports both text-to-image and image-to-image workflows, advanced filtering, OpenAI-powered prompt enhancement, Cloudinary image hosting, and complete user generation history.

---

## 🚀 Features

### 🌐 Frontend (React + Vite)
- **Modern UI/UX:** Built with React, TailwindCSS, Zustand state management, and Vite for fast development.
- **Multi-Step Generation Flow:**
  - **Mode Selection:** Choose between text prompt or image upload.
  - **Prompt Input:** Enter a description or upload an image, with a dedicated description field for enhancements.
  - **AI Enhancer Toggle:** Optionally let OpenAI improve your prompt for better results.
  - **Questionnaire:** Answer customizable questions (category, mood, theme, color, text style, etc.) for more control.
  - **Template Selection:** Choose from 8 high-CTR visual templates (SVG-based) proven to boost click-through rates.
  - **Results Grid:** Preview, download, and manage generated thumbnails (HD, ZIP download, individual download).
  - **History Page:** View, search, filter, and bulk-download all your previous generations.
  - **Selection Pills:** Remove individual selections in the flow for easy editing.
- **Authentication:** User login and session management (if enabled).

### 🛠️ Backend (Node.js + Express)
- **RESTful API:** Endpoints for generation, image upload, and history management.
- **OpenAI Integration:** Enhances user prompts using ChatGPT for richer, more detailed AI instructions.
- **Google Gemini AI:** Generates images from text or image+prompt using Gemini's image models.
- **Cloudinary Hosting:** All generated images are uploaded and served from Cloudinary CDN.
- **MongoDB Storage:** Stores user data, generation history, and template usage analytics.
- **User History:** Every generation (prompt, filters, template, results) is saved per user for analytics and re-use.
- **Robust Error Handling:** Handles API errors, file validation, and service health.

---

## 🏗️ Workflow Overview

1. **User Query & Input:**
   - User selects generation mode (prompt or image).
   - Provides a text description or uploads an image, with optional AI enhancement toggle.
   - Answers a series of filter questions (category, mood, style, etc.).
   - Optionally selects a visual template for the thumbnail.

2. **Frontend Processing:**
   - State is managed with Zustand stores (`uiStore.js`, `imageStore.js`).
   - User selections, prompt, and image are validated and prepared for API submission.

3. **Backend Processing:**
   - Receives user data (prompt, filters, image, template, enhancement toggle).
   - If enabled, uses OpenAI to enhance the prompt for better visual results.
   - Generates images using Google Gemini, strictly following user filters and template (if provided).
   - Uploads generated images to Cloudinary and saves URLs.
   - Stores generation details in MongoDB under the user's history.

4. **Response & Storage:**
   - Returns generated image URLs, prompt details, and metadata to the frontend.
   - Frontend displays results, allows downloads, and updates the user's history view.

5. **History & Analytics:**
   - Users can view, search, filter, and bulk-download their entire generation history.
   - History includes all prompt/filter/template data for easy re-generation or analytics.

---

## 📦 Technology Stack

### Frontend
- **React** (UI)
- **Vite** (build tool)
- **TailwindCSS** (styling)
- **Zustand** (state management)
- **Axios** (HTTP requests)
- **JSZip** (ZIP downloads)
- **Lucide-react** (icons)

### Backend
- **Node.js** + **Express** (API server)
- **@google/genai** (Gemini AI SDK)
- **openai** (OpenAI API)
- **cloudinary** (image CDN)
- **mongoose** (MongoDB ODM)
- **multer** (file uploads)
- **jsonwebtoken** (auth)
- **dotenv** (env config)
- **cors**, **mime**, **bcryptjs** (utilities)

---

## 📝 Example API Workflow

### 1. Generate from Prompt
```http
POST /api/generate
Content-Type: application/json
{
  "prompt": "A bold tech thumbnail with neon blue colors",
  "enhancePrompt": true,
  "category": "Tech",
  "mood": "Excited",
  ...other filters
}
```

### 2. Generate from Image
```http
POST /api/generate-from-image
Content-Type: multipart/form-data
image: [file]
prompt: "Add bold text overlay, make colors more vibrant"
enhancePrompt: true
...other filters
```

### 3. Get User History
```http
GET /api/history
Authorization: Bearer <token>
```

---

## 🔑 Key Features Detailed

- **Multi-Mode Generation:** Supports both text-to-image and image-to-image (with enhancement description) flows.
- **Template System:** 8 high-CTR SVG templates, visually selectable, strictly enforced by backend AI prompts.
- **Filters & Customization:** Category, mood, theme, color, text, style, and more, all sent to backend for precise AI control.
- **Prompt Enhancement:** OpenAI-powered toggle for richer, more detailed prompts.
- **Image Hosting:** All images are uploaded to Cloudinary and served via CDN.
- **User Generation History:** Every generation (with all metadata) is stored in MongoDB and viewable/searchable in the frontend.
- **ZIP Download:** Download all generated images in a session as a ZIP file.
- **Bulk Actions:** Select, delete, or export multiple history items.
- **Comprehensive Error Handling:** Friendly error messages for validation, API, and upload issues.

---

## ⚙️ Setup & Installation

### 1. Clone & Install
```bash
git clone <repo-url>
cd thumbnail-generator
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure Environment
- Copy `.env.example` to `.env` in backend and fill in your API keys for Gemini, OpenAI, Cloudinary, and MongoDB.

### 3. Run Locally
```bash
# Start backend
cd backend && npm run dev
# Start frontend
cd ../frontend && npm run dev
```

---

## 📂 Project Structure

```
thumbnail-generator/
├── backend/
│   ├── controllers/
│   ├── models/
│   ├── utils/
│   ├── data/
│   ├── server.js
│   └── ...
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── stores/
│   │   ├── api/
│   │   └── ...
│   └── ...
└── README.md
```

---

## 📜 License
MIT

---

## 🙏 Credits
- [OpenAI](https://openai.com/)
- [Google Gemini](https://aistudio.google.com/)
- [Cloudinary](https://cloudinary.com/)
- [Vite](https://vitejs.dev/)
- [React](https://react.dev/)
- [TailwindCSS](https://tailwindcss.com/)

---

## ✨ Contributing
Pull requests and issues welcome! Please see [CONTRIBUTING.md] if available.

---

## 📧 Contact
For support or questions, open an issue or contact the maintainer.
