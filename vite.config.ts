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
      host: true, // This allows external connections
      port: 5173, // Explicitly set the port
      allowedHosts: [
        process.env.VITE_APP_DOMAIN,
      ],
    }
  });
}
