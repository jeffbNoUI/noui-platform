import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-query': ['@tanstack/react-query'],
        },
      },
    },
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
    proxy: {
      '/api/v1/members': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/api/v1/eligibility': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/api/v1/benefit': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/api/v1/dro': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/api/v1/crm': {
        target: 'http://localhost:8084',
        changeOrigin: true,
      },
      '/api/v1/cases': {
        target: 'http://localhost:8088',
        changeOrigin: true,
      },
      '/api/v1/stages': {
        target: 'http://localhost:8088',
        changeOrigin: true,
      },
      '/api/v1/kb': {
        target: 'http://localhost:8087',
        changeOrigin: true,
      },
      '/api/v1/dq': {
        target: 'http://localhost:8086',
        changeOrigin: true,
      },
      '/api/v1/correspondence': {
        target: 'http://localhost:8085',
        changeOrigin: true,
      },
      '/api/v1/health': {
        target: 'http://localhost:8091',
        changeOrigin: true,
      },
      '/api/v1/preferences': {
        target: 'http://localhost:8089',
        changeOrigin: true,
      },
    },
  },
});
