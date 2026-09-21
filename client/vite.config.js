import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: { manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], map: ['leaflet', 'react-leaflet'], charts: ['recharts'] } },
    },
  },
  server: { proxy: { '/api': process.env.API_PROXY || 'http://localhost:3001' } },
});
