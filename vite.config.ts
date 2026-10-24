import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default ({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  process.env = {...process.env, ...loadEnv(mode, process.cwd(), '')};

  return defineConfig({
    plugins: [react()],
    server: {
      proxy: {'/api/rooms': {target:'http://127.0.0.1:3001',ws:true}},
      host: true, // This allows external connections
      port: 5173, // Explicitly set the port
      strictPort: false, // Allow fallback to another port if 5173 is busy
      hmr: {
        // Configure HMR to work properly with domain
        host: process.env.VITE_APP_HOST || 'localhost',
        port: 5173,
        // Use the same protocol as the main page
        protocol: 'ws',
        // Use the client port for WebSocket connections to match the domain
        clientPort: process.env.NODE_ENV === 'production' ? 443 : 5173,
      },
      watch: {
        // Ensure file changes trigger updates
        usePolling: true,
        interval: 1000,
      },
      cors: {
        origin: '*', // Allow all origins during development
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      },
      allowedHosts: [
        process.env.VITE_APP_DOMAIN || 'localhost',
        '127.0.0.1',
        '::1',
        // Allow all hosts in development
        '.localhost',
        '.ngrok.io', // Common tunnel services
        '.vercel.app', // Common deployment services
        'hat.risingdragon.vn', // Add the required domain
        
      ],
    }
  });
}
