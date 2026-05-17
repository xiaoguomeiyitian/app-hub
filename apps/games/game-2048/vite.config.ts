import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 20011,
    host: '0.0.0.0',
    allowedHosts: ['97.383636.xyz'],
  },
});
