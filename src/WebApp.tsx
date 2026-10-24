import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import TvView from './TvView';
import RemoteView from './RemoteView';
import YouTubeAuthCallback from './YouTubeAuthCallback';
import ErrorBoundary from './ErrorBoundary'; // Import ErrorBoundary
import './App.css';
import './room-ui.css';

function App() {
  // Lấy theme từ localStorage hoặc mặc định là light (hồng)
  const savedTheme = localStorage.getItem('app-theme') || 'light';
  const themeAlgorithm = savedTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm;

  return (
    <ConfigProvider
      theme={{
        algorithm: themeAlgorithm,
        token: {
          borderRadius: 12,
          controlHeight: 44,
          fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
          colorPrimary: '#7C3AED', // Hồng đậm
          colorLink: '#7C3AED', // Link color
          colorSuccess: '#52c41a', // Green for success
          colorWarning: '#faad14', // Orange for warning
          colorError: '#ff4d4f', // Red for error
        },
        components: {
          Button: {
            colorPrimary: '#7C3AED', // Hồng đậm
            colorPrimaryHover: '#8B5CF6', // Hồng nhạt khi hover
            colorPrimaryActive: '#6D28D9', // Hồng tím khi active
            // Các nút khác có thể giữ nguyên hoặc điều chỉnh tùy theo thiết kế
            // colorPrimary: '#52c41a', // Example: Green if it needs to be different for some buttons
          },
          Tabs: {
            itemSelectedColor: '#7C3AED', // Màu tab khi được chọn
            inkBarColor: '#7C3AED', // Màu gạch dưới tab
          }
        },
      }}
    >
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
          <Route
            path="/remote"
            element={
              <ErrorBoundary>
                <RemoteView />
              </ErrorBoundary>
            }
          />
          <Route path="/youtube-auth" element={<YouTubeAuthCallback />} />
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App;
