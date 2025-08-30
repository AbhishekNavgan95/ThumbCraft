import { useState, useEffect } from 'react';
import useUIStore from '../stores/uiStore';
import useImageStore from '../stores/imageStore';
import { ArrowLeft, ArrowRight, CheckCircle, Zap, Loader2, X } from 'lucide-react';

const QuestionFlow = () => {
  const { 
    currentQuestionIndex,
    questions,
    answers,
    prompt,
    uploadedImage,
    setAnswer,
    nextQuestion,
    previousQuestion,
    skipQuestion,
    setCurrentStep,
    startGeneration,
    resetFlow,
    openLoginModal
  } = useUIStore();

  const { generateThumbnails } = useImageStore();
  const [isGenerating, setIsGenerating] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const currentAnswer = answers[currentQuestion.key];

  const handleAnswerSelect = (value) => {
    setAnswer(currentQuestion.key, value);
  };

  const handleNext = async () => {
    if (isLastQuestion) {
      await handleGenerate();
    } else {
      nextQuestion();
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    startGeneration();
    
    try {
      const result = await generateThumbnails(prompt, answers, uploadedImage);
      if (result.success) {
        setCurrentStep('results');
      } else {
        // Handle generation failure
        setIsGenerating(false);
        if (result.error && result.error.includes('token')) {
          // Authentication error - prompt for login
          openLoginModal();
        }
      }
    } catch (error) {
      console.error('Generation failed:', error);
      setIsGenerating(false);
      
      // Check if it's an authentication error
      if (error.message && error.message.includes('token')) {
        openLoginModal();
      }
    }
  };

  const handleSkipAndGenerate = async () => {
    setIsGenerating(true);
    startGeneration();
    
    try {
      const result = await generateThumbnails(prompt, answers, uploadedImage);
      if (result.success) {
        setCurrentStep('results');
      } else {
        // Handle generation failure
        setIsGenerating(false);
        if (result.error && result.error.includes('token')) {
          // Authentication error - prompt for login
          openLoginModal();
        }
      }
    } catch (error) {
      console.error('Generation failed:', error);
      setIsGenerating(false);
      
      // Check if it's an authentication error
      if (error.message && error.message.includes('token')) {
        openLoginModal();
      }
    }
  };

  const handleCancel = () => {
    resetFlow();
  };

  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Cancel Button */}
      <div className="mb-4">
        <button
          onClick={handleCancel}
          disabled={isGenerating}
          className="flex items-center text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg p-2 disabled:opacity-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Cancel
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
          <span className="text-sm text-gray-500">
            {Math.round(progress)}% complete
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          {currentQuestion.title}
        </h2>

        {currentQuestion.isTextInput ? (
          <div className="space-y-4">
            <textarea
              value={currentAnswer || ''}
              onChange={(e) => handleAnswerSelect(e.target.value)}
              className="w-full h-24 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder={currentQuestion.placeholder}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {currentQuestion.options.map((option) => (
              <button
                key={option}
                onClick={() => handleAnswerSelect(option)}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  currentAnswer === option
                    ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700'
                }`}
              >
                <div className="font-medium text-center">{option}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {currentQuestionIndex > 0 && (
            <button
              onClick={previousQuestion}
              disabled={isGenerating}
              className="flex items-center text-gray-600 hover:text-gray-900 font-medium px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </button>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSkipAndGenerate}
            disabled={isGenerating}
            className="text-gray-600 hover:text-gray-800 font-medium px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 transition-colors"
          >
            Skip & Generate
          </button>

          {currentAnswer ? (
            <button
              onClick={handleNext}
              disabled={isGenerating}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center disabled:opacity-50 transition-colors"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" />
                  Generating...
                </>
              ) : isLastQuestion ? (
                <>
                  Generate Thumbnails
                  <Zap className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          ) : (
            <button
              onClick={skipQuestion}
              disabled={isGenerating}
              className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium px-6 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 transition-colors"
            >
              Skip
            </button>
          )}
        </div>
      </div>

      {/* Selected Answers Summary */}
      {Object.values(answers).some(answer => answer) && (
        <div className="my-8 bg-gray-50 rounded-lg p-8">
          <h3 className="font-semibold text-2xl mb-8 text-gray-900 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 mr-2 text-blue-600" />
            Your Selections
          </h3>
          <div className="flex flex-wrap justify-center gap-4">
            {questions.map(question => {
              const answer = answers[question.key];
              if (!answer) return null;
              
              const questionLabel = question.title
                .replace('?', '')
                .replace('What ', '')
                .replace('Choose ', '')
                .replace('your ', '')
                .trim();
              
              return (
                <div key={question.key} className="inline-flex items-center bg-white border border-gray-200 rounded-md px-4 py-2 shadow-sm">
                  <CheckCircle className="w-5 h-5 mr-2 text-blue-600" />
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mr-2">
                    {questionLabel}
                  </span>
                  <span className="text-sm font-medium ml-2 bg-blue-100 text-blue-800 px-4 py-1 rounded-md">
                    {answer.length > 15 ? `${answer.substring(0, 15)}...` : answer}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionFlow;