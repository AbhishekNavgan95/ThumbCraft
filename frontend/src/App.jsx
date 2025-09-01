import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import useAuthStore from './stores/authStore';
import { api } from './api/client';
import Header from './components/Header';
import Homepage from './components/Homepage';
import HistoryPage from './components/HistoryPage';
import Footer from './components/Footer';
import ServerWarmupModal from './components/ServerWarmupModal';
import Toast from './components/Toast';

function App() {
  const { init } = useAuthStore();
  const [showWarmupModal, setShowWarmupModal] = useState(false);
  const [serverReady, setServerReady] = useState(false);

  const checkServerHealth = async () => {
    try {
      console.log('🔍 Checking server health...');
      const startTime = Date.now();

      // Show warmup modal immediately for slow connections
      const slowConnectionTimer = setTimeout(() => {
        if (!serverReady) {
          console.log('⏳ Connection taking too long, showing warmup modal');
          setShowWarmupModal(true);
        }
      }, 2000);

      const response = await api.health();
      const responseTime = Date.now() - startTime;

      clearTimeout(slowConnectionTimer);

      console.log('✅ Server is healthy!', {
        responseTime: `${responseTime}ms`,
        data: response.data
      });

      // If response took more than 3 seconds, server was probably cold
      if (responseTime > 3000) {
        console.log('🥶 Server was cold, showing warmup modal');
        setShowWarmupModal(true);
      }

      setServerReady(true);
    } catch (error) {
      console.log('❌ Server health check failed:', error);

      // Show warmup modal for any server connection issues
      setShowWarmupModal(true);

      // Retry after a delay
      setTimeout(checkServerHealth, 3000);
    }
  };

  useEffect(() => {
    // Initialize auth
    init();

    // Check server health on app load
    checkServerHealth();
  }, []); // Remove init dependency to prevent re-renders

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Homepage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </main>
        <Footer />

        {/* Server Warmup Modal */}
        <ServerWarmupModal
          isOpen={showWarmupModal}
          onClose={() => setShowWarmupModal(false)}
          serverReady={serverReady}
        />

        {/* Toast Notifications */}
        <Toast />
      </div>
    </Router>
  );
}

export default App;