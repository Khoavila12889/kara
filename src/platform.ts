import { Capacitor } from '@capacitor/core';

export const isNativeApp = Capacitor.isNativePlatform();
const env = (import.meta as any).env;

// Web retains same-origin behavior. Native assets are served from https://localhost.
export const apiOrigin = (env.VITE_API_ORIGIN || '').replace(/\/$/, '');
export const publicOrigin = (env.VITE_PUBLIC_WEB_ORIGIN || apiOrigin || window.location.origin).replace(/\/$/, '');
