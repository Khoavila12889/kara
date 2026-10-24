import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'vn.khoavila.music',
  appName: 'Khoavila Music',
  webDir: 'dist',
  backgroundColor: '#101017',
  server: { androidScheme: 'https' },
  android: { backgroundColor: '#101017', allowMixedContent: false },
};

export default config;
