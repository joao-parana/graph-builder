import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/application/**'],
      // NFR-03: cobertura ≥ 90% em domain + application.
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
