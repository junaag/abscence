import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
  },
});
