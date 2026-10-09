import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      'motion/react': 'framer-motion',
      buffer: path.resolve(__dirname, 'src/polyfills/buffer.ts'),
      crypto: path.resolve(__dirname, 'src/polyfills/crypto.ts'),
      'node:crypto': path.resolve(__dirname, 'src/polyfills/crypto.ts'),
      'node:buffer': path.resolve(__dirname, 'src/polyfills/buffer.ts')
    }
  },
  define: {
    'process.env': {},
    global: 'globalThis'
  },
  server: {
    port: 3000,
    host: true
  }
});
