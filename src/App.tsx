import { lazy, Suspense } from 'react';
import { isNativeApp } from './platform';
import ErrorBoundary from './ErrorBoundary';
import YouTubeAuthCallback from './YouTubeAuthCallback';

const MusicApp = lazy(() => import('./android/MusicApp'));
const WebApp = lazy(() => import('./WebApp'));

export default function App() {
  if (isNativeApp && window.location.pathname === '/youtube-auth') return <YouTubeAuthCallback />;
  const music = isNativeApp || window.location.pathname.replace(/\/$/, '') === '/app';
  return <ErrorBoundary><Suspense fallback={<div className="app-loading" role="status">Đang mở Khoavila…</div>}>
    {music ? <MusicApp /> : <WebApp />}
  </Suspense></ErrorBoundary>;
}
