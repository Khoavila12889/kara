import { loadEnv } from 'vite';

const env = { ...loadEnv('android', process.cwd(), 'VITE_'), ...process.env };
for (const name of ['VITE_API_ORIGIN', 'VITE_PUBLIC_WEB_ORIGIN']) {
  let url;
  try { url = new URL(env[name]); } catch { throw new Error(`${name}: copy .env.android.example to .env.android.local and configure an HTTPS origin.`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error(`${name} must be a public HTTPS origin, without a path, query, credentials or fragment.`);
  }
}
if (!env.VITE_YOUTUBE_API_KEY) console.warn('YouTube search key is missing: the APK can receive songs through the remote QR, but in-app search will be unavailable.');
console.log('Android origins validated.');
