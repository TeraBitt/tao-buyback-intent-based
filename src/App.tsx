import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppContent from './components/AppContent';
import LandingPage from './components/LandingPage';
import { AppProvider } from './context/AppContext';

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<AppContent />} />
          <Route path="/app/chat" element={<AppContent />} />
          <Route path="/app/chat/:chatId" element={<AppContent />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
