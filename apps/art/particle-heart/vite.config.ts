import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 20009,
    allowedHosts: ['97.383636.xyz'],
  },
  base: './',
});
