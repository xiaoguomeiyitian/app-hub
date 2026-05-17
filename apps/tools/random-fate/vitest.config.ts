import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: jsdom',
    deps: {
      inline: ["@app-hub/design-system"],
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    deps: {
      inline: ["@app-hub/design-system"],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 0,
        branches: 0,
        statements: 70,
      },
      exclude: ['**/*.css', '**/*.html', '**/*.md'],
    },
  },
});
