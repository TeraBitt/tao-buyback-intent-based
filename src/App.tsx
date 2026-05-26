import AppContent from './components/AppContent';
import { AppProvider } from './context/AppContext';

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
