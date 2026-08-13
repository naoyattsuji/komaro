import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.komaro',
  appName: 'KOMARO',
  webDir: 'public',
  server: {
    url: 'https://komaro.app',
    cleartext: false,
    // 通信できないときに白画面ではなくアプリ同梱の案内を表示する
    errorPath: 'offline.html'
  }
};

export default config;
