import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.komaro',
  appName: 'KOMARO',
  webDir: 'public',
  server: {
    url: 'https://komaro.app',
    cleartext: false
  }
};

export default config;
