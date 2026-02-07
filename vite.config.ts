import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Manually define the process.env object with specific keys to prevent
      // leaking all server-side environment variables while ensuring functionality.
      'process.env': {
        GROQ_API_KEY: process.env.GROQ_API_KEY || env.GROQ_API_KEY || '',
        API_KEY: process.env.API_KEY || env.API_KEY || '', // For Gemini
        REACT_APP_GROQ_API_KEY: process.env.REACT_APP_GROQ_API_KEY || env.REACT_APP_GROQ_API_KEY || '',
        NODE_ENV: process.env.NODE_ENV || 'development'
      }
    }
  };
});