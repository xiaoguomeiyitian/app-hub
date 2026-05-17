import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/index.ts',
      name: 'design-system',
      formats: ['es'],
    },
  },
});
