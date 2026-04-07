import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  // VITE_API_URL is set per environment in GitHub Actions → injected at build time
  // e.g. VITE_API_URL=https://abc123.execute-api.ap-southeast-2.amazonaws.com/prod
});
