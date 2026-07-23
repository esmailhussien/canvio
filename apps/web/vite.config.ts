import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('leaflet') || id.includes('react-leaflet')) {
            return 'vendor-map';
          }
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
            return 'vendor-react';
          }
          if (id.includes('yjs') || id.includes('y-websocket') || id.includes('lib0') || id.includes('y-protocols')) {
            return 'vendor-collaboration';
          }
          if (id.includes('framer-motion') || id.includes('motion-')) {
            return 'vendor-motion';
          }
          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
