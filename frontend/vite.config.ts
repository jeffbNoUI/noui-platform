import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import yaml from '@rollup/plugin-yaml';
import path from 'path';
import http from 'node:http';

export default defineConfig({
  plugins: [
    {
      name: 'employer-cross-service-proxy',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url ?? '';
          let target: string | null = null;

          if (/^\/api\/v1\/employer\/[^/]+\/members/.test(url)) {
            target = 'http://localhost:8081'; // dataaccess
          } else if (
            /^\/api\/v1\/employer\/[^/]+\/cases/.test(url) ||
            /^\/api\/v1\/employer\/cases$/.test(url)
          ) {
            target = 'http://localhost:8088'; // casemanagement
          }

          if (!target) return next();

          const proxyReq = http.request(
            target + url,
            { method: req.method, headers: { ...req.headers, host: new URL(target).host } },
            (proxyRes) => {
              res.writeHead(proxyRes.statusCode!, proxyRes.headers);
              proxyRes.pipe(res);
            },
          );
          proxyReq.on('error', () => {
            res.writeHead(502);
            res.end('Proxy error');
          });
          req.pipe(proxyReq);
        });
      },
    },
    react(),
    yaml(),
  ],
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
      '/api/v1/member-auth': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/api/v1/scenarios': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/api/v1/notifications': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      // Employer domain services (ports 8094-8099)
      '/api/v1/employer': {
        target: 'http://localhost:8094',
        changeOrigin: true,
      },
      '/api/v1/reporting': {
        target: 'http://localhost:8095',
        changeOrigin: true,
      },
      '/api/v1/enrollment': {
        target: 'http://localhost:8096',
        changeOrigin: true,
      },
      '/api/v1/terminations': {
        target: 'http://localhost:8097',
        changeOrigin: true,
      },
      '/api/v1/waret': {
        target: 'http://localhost:8098',
        changeOrigin: true,
      },
      '/api/v1/scp': {
        target: 'http://localhost:8099',
        changeOrigin: true,
      },
    },
  },
});
