import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import TvView from './TvView';
import RemoteView from './RemoteView';
import YouTubeAuthCallback from './YouTubeAuthCallback';
import ErrorBoundary from './ErrorBoundary'; // Import ErrorBoundary
import './App.css';

function App() {
  // Lấy theme từ localStorage hoặc mặc định là light (hồng)
  const savedTheme = localStorage.getItem('app-theme') || 'light';
  const themeAlgorithm = savedTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm;

  return (
    <ConfigProvider
      theme={{
        algorithm: themeAlgorithm,
        token: {
          colorPrimary: '#FF69B4', // Hồng đậm
          colorLink: '#FF69B4', // Link color
          colorSuccess: '#52c41a', // Green for success
          colorWarning: '#faad14', // Orange for warning
          colorError: '#ff4d4f', // Red for error
        },
        components: {
          Button: {
            colorPrimary: '#FF69B4', // Hồng đậm
            colorPrimaryHover: '#FFC0CB', // Hồng nhạt khi hover
            colorPrimaryActive: '#E066FF', // Hồng tím khi active
            // Các nút khác có thể giữ nguyên hoặc điều chỉnh tùy theo thiết kế
            // colorPrimary: '#52c41a', // Example: Green if it needs to be different for some buttons
          },
          Tabs: {
            itemSelectedColor: '#FF69B4', // Màu tab khi được chọn
            inkBarColor: '#FF69B4', // Màu gạch dưới tab
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
          <Route path="/remote" element={<RemoteView />} />
          <Route path="/youtube-auth" element={<YouTubeAuthCallback />} />
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App;
