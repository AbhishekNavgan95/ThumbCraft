import { useEffect, useState } from 'react';
import { Loader2, Server, Zap, Clock, CheckCircle } from 'lucide-react';

const ServerWarmupModal = ({ isOpen, onClose, serverReady = false }) => {
  const [warmupStage, setWarmupStage] = useState('connecting');
  const [progress, setProgress] = useState(0);

  const stages = {
    connecting: {
      icon: Server,
      title: 'Connecting to Server',
      message: 'Waking up the server on Render...',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    warming: {
      icon: Zap,
      title: 'Server Warming Up',
      message: 'Initializing services and database connections...',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    },
    ready: {
      icon: CheckCircle,
      title: 'Server Ready!',
      message: 'All systems operational. You\'re good to go!',
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    // Reset state when modal opens
    setWarmupStage('connecting');
    setProgress(5);

    // Simulate warmup stages
    const timer1 = setTimeout(() => {
      setWarmupStage('warming');
      setProgress(40);
    }, 3000);

    // Check if server became ready
    const checkServerReady = () => {
      if (serverReady) {
        setWarmupStage('ready');
        setProgress(100);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setTimeout(checkServerReady, 1000);
      }
    };

    const timer2 = setTimeout(checkServerReady, 5000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isOpen, serverReady, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    // Animate progress bar
    const interval = setInterval(() => {
      setProgress(prev => {
        if (warmupStage === 'connecting' && prev < 45) {
          return prev + 1;
        } else if (warmupStage === 'warming' && prev < 90) {
          return prev + 2;
        }
        return prev;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, warmupStage]);

  if (!isOpen) return null;

  const currentStage = stages[warmupStage];
  const StageIcon = currentStage.icon;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        {/* Icon */}
        <div className={`w-20 h-20 ${currentStage.bgColor} rounded-full flex items-center justify-center mx-auto mb-6 relative`}>
          <StageIcon className={`w-10 h-10 ${currentStage.color}`} />
          {warmupStage !== 'ready' && (
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-current animate-spin opacity-30"></div>
          )}
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          {currentStage.title}
        </h2>

        {/* Message */}
        <p className="text-gray-600 mb-6 leading-relaxed">
          {currentStage.message}
        </p>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className={`h-2.5 rounded-full transition-all duration-300 ${
                warmupStage === 'ready' 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
                  : warmupStage === 'warming'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-600'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600'
              }`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Server Notice */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-center mb-2">
            <Clock className="w-4 h-4 text-amber-600 mr-2" />
            <span className="text-amber-800 font-semibold text-sm">Server Notice</span>
          </div>
          <p className="text-amber-900 text-sm">
            🚀 <strong>Hosted on Render:</strong> Free tier servers sleep after inactivity.<br/>
            ⏰ <strong>First load may take 30-60 seconds</strong> - thanks for your patience! 🙏
          </p>
        </div>

        {/* Loading Animation */}
        {warmupStage !== 'ready' && (
          <div className="mt-6 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin mr-2" />
            <span className="text-gray-500 text-sm">Please wait...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServerWarmupModal;