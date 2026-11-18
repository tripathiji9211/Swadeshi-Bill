/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  esbuild: {
    target: 'esnext',
    supported: {
      destructuring: true,
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
      supported: {
        destructuring: true,
      },
    },
  },
  build: {
    target: 'esnext',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Proxies any request starting with /api to the FastAPI backend running on port 8000
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
