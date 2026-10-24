import { lazy, Suspense } from 'react';
import { isNativeApp } from './platform';
import ErrorBoundary from './ErrorBoundary';

const MusicApp = lazy(() => import('./android/MusicApp'));
const WebApp = lazy(() => import('./WebApp'));

export default function App() {
  const music = isNativeApp || window.location.pathname.replace(/\/$/, '') === '/app';
  return <ErrorBoundary><Suspense fallback={<div className="app-loading" role="status">Đang mở Khoavila…</div>}>
    {music ? <MusicApp /> : <WebApp />}
  </Suspense></ErrorBoundary>;
}
