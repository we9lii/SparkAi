import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      preview: {
        port: Number(process.env.PORT) || 4173,
        host: '0.0.0.0',
        strictPort: true,
        // Allow Render preview domain
        allowedHosts: ['sparkai-ra3w.onrender.com'],
      },
  plugins: [react()],
  define: {
    'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    'import.meta.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
  },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
