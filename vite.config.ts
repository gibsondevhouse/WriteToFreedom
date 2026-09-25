import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// The Worker still owns HTML, APIs, authentication, and asset delivery.
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  base: '/frontend/',
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    manifest: true,
    target: 'es2022',
    modulePreload: {polyfill: false},
    rolldownOptions: {input: ['frontend/lore-profile.tsx', 'frontend/writing-workspace.tsx']},
  },
});
