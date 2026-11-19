import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/application/**', 'src/infrastructure/**'],
      // NFR-03: cobertura ≥ 90% em domain + application + infrastructure.
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
