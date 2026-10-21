import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**', 'e2e/**', 'apps/mobile/.expo/**'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
