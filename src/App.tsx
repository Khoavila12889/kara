import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TvView from './TvView';
import RemoteView from './RemoteView';
import ErrorBoundary from './ErrorBoundary'; // Import ErrorBoundary
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <ErrorBoundary>
              <TvView />
            </ErrorBoundary>
          }
        />
        <Route path="/remote" element={<RemoteView />} />
      </Routes>
    </Router>
  );
}

export default App;
