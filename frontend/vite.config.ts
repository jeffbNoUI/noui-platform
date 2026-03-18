import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import yaml from '@rollup/plugin-yaml';
import path from 'path';

export default defineConfig({
  plugins: [react(), yaml()],
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
      '/api/v1/issues': {
        target: 'http://localhost:8092',
        changeOrigin: true,
      },
      '/api/v1/security': {
        target: 'http://localhost:8093',
        changeOrigin: true,
      },
    },
  },
});
