import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/android-ui',
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:5187',
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {},
  },
  webServer: [
    {
      command: 'npm --prefix auth-proxy-server run build && node auth-proxy-server/dist/index.js',
      url: 'http://127.0.0.1:4387/api/rooms/health',
      reuseExistingServer: false,
      env: { PORT: '4387', FRONTEND_URL: 'http://127.0.0.1:5187', ANDROID_APP_ORIGINS: 'https://localhost', ROOM_SERVICE: '1', ROOM_DB_PATH: ':memory:' },
    },
    {
      command: 'vite --host 127.0.0.1 --port 5187 --strictPort',
      url: 'http://127.0.0.1:5187',
      reuseExistingServer: false,
      env: { VITE_API_ORIGIN: 'http://127.0.0.1:4387', VITE_PUBLIC_WEB_ORIGIN: 'https://music.example.com', VITE_YOUTUBE_API_KEY: 'browser-test-placeholder' },
    },
  ],
});
