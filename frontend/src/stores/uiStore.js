import { create } from 'zustand';

const useUIStore = create((set, get) => ({
  // Current step in the thumbnail generation flow
  currentStep: 'selection', // selection -> input -> questions -> loading -> results
  
  // Generation mode: 'prompt' or 'image'
  generationMode: null,
  
  // User inputs
  prompt: '',
  uploadedImage: null,
  imageDescription: '',
  enhancePrompt: false,
  
  // Questions and answers
  currentQuestionIndex: 0,
  answers: {
    category: '',
    mood: '',
    theme: '',
    primaryColor: '',
    includeText: '',
    textStyle: '',
    thumbnailStyle: '',
    customPrompt: '',
    imageCount: '4'
  },
  
  // Modal states
  isLoginModalOpen: false,
  
  // Loading states
  isGenerating: false,
  
  // Actions
  setCurrentStep: (step) => set({ currentStep: step }),
  
  setGenerationMode: (mode) => set({ generationMode: mode }),
  
  setPrompt: (prompt) => set({ prompt }),
  
  setUploadedImage: (image) => set({ uploadedImage: image }),
  
  setImageDescription: (description) => set({ imageDescription: description }),
  
  setEnhancePrompt: (enhance) => set({ enhancePrompt: enhance }),
  
  setAnswer: (questionKey, value) => set((state) => ({
    answers: {
      ...state.answers,
      [questionKey]: value
    }
  })),
  
  removeAnswer: (questionKey) => set((state) => ({
    answers: {
      ...state.answers,
      [questionKey]: ''
    }
  })),
  
  nextQuestion: () => set((state) => ({
    currentQuestionIndex: Math.min(state.currentQuestionIndex + 1, get().questions.length - 1)
  })),
  
  previousQuestion: () => set((state) => ({
    currentQuestionIndex: Math.max(state.currentQuestionIndex - 1, 0)
  })),
  
  skipQuestion: () => {
    const state = get();
    if (state.currentQuestionIndex < 7) {
      set({ currentQuestionIndex: state.currentQuestionIndex + 1 });
    } else {
      set({ currentStep: 'loading' });
    }
  },
  
  openLoginModal: () => set({ isLoginModalOpen: true }),
  
  closeLoginModal: () => set({ isLoginModalOpen: false }),
  
  startGeneration: () => set({ 
    isGenerating: true, 
    currentStep: 'loading' 
  }),
  
  completeGeneration: () => set({ 
    isGenerating: false, 
    currentStep: 'results' 
  }),
  
  resetFlow: () => set({
    currentStep: 'selection',
    generationMode: null,
    prompt: '',
    uploadedImage: null,
    imageDescription: '',
    enhancePrompt: false,
    currentQuestionIndex: 0,
    answers: {
      category: '',
      mood: '',
      theme: '',
      primaryColor: '',
      includeText: '',
      textStyle: '',
      thumbnailStyle: '',
      customPrompt: '',
      imageCount: '4'
    },
    isGenerating: false
  }),
  
  // Question definitions
  questions: [
    {
      key: 'category',
      title: 'What category is your content?',
      options: ['Tech', 'Gaming', 'Vlog', 'Tutorial', 'Entertainment', 'News']
    },
    {
      key: 'mood',
      title: 'What mood do you want to convey?',
      options: ['Excited', 'Serious', 'Fun', 'Professional', 'Mysterious', 'Energetic']
    },
    {
      key: 'theme',
      title: 'What theme do you prefer?',
      options: ['Bright', 'Dark', 'Colorful', 'Minimalist', 'Gradient', 'Neon']
    },
    {
      key: 'primaryColor',
      title: 'Choose a primary color',
      options: ['Red', 'Blue', 'Green', 'Purple', 'Orange', 'Yellow', 'Pink', 'Cyan']
    },
    {
      key: 'includeText',
      title: 'Include text in thumbnail?',
      options: ['Yes', 'No']
    },
    {
      key: 'textStyle',
      title: 'What text style do you prefer?',
      options: ['Bold', 'Minimal', 'Fancy', 'Outlined', 'Shadow', 'Gradient']
    },
    {
      key: 'thumbnailStyle',
      title: 'What thumbnail style do you want?',
      options: ['Photo-realistic', 'Cartoonish', 'Minimalistic', 'Artistic', 'Modern', 'Vintage']
    },
    {
      key: 'customPrompt',
      title: 'Any additional requirements?',
      isTextInput: true,
      placeholder: 'Optional: Add any specific details or requirements...'
    },
    {
      key: 'imageCount',
      title: 'How many thumbnails do you want?',
      options: ['1', '2', '3', '4']
    }
  ]
}));

export default useUIStore;