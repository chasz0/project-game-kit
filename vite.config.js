import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'url';

export default defineConfig({
  server: {
    open: true,
  },
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./core', import.meta.url)),
      '@gameplay': fileURLToPath(new URL('./gameplay', import.meta.url)),
      '@ai': fileURLToPath(new URL('./ai', import.meta.url)),
      '@world': fileURLToPath(new URL('./world', import.meta.url)),
      '@ui': fileURLToPath(new URL('./ui', import.meta.url))
    }
  }
});