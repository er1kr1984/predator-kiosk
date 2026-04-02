import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

function gitVersion() {
  // Try git describe first (local dev)
  try {
    return execSync('git describe --tags --always').toString().trim().replace(/^v/, '');
  } catch {}
  // Fall back to .version file written by deploy script
  try {
    return readFileSync(new URL('.version', import.meta.url), 'utf8').trim();
  } catch {}
  return 'dev';
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(gitVersion()),
  },
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
