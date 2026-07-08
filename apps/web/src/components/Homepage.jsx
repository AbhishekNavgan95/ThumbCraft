import useUIStore from '../stores/uiStore';
import LandingPage from './LandingPage';
import PromptInput from './PromptInput';
import QuestionFlow from './QuestionFlow';
import LoadingScreen from './LoadingScreen';
import ResultsGrid from './ResultsGrid';

const Homepage = () => {
  const { currentStep } = useUIStore();

  const renderStep = () => {
    switch (currentStep) {
      case 'selection':
        return <LandingPage />;
      case 'input':
        return <PromptInput />;
      case 'questions':
        return <QuestionFlow />;
      case 'loading':
        return <LoadingScreen />;
      case 'results':
        return <ResultsGrid />;
      default:
        return <LandingPage />;
    }
  };

  return (
    <div className="min-h-screen">
      {currentStep === 'selection' ? (
        renderStep()
      ) : (
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 py-8">
            {renderStep()}
          </div>
        </div>
      )}
    </div>
  );
};

export default Homepage;