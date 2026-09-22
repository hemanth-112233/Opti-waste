import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/tests/unit/**/*.test.ts', 'src/tests/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'src/services/__tests__/WasteDetectionService.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/scripts/**', 'src/services/__tests__/WasteDetectionService.test.ts'],
    },
    setupFiles: ['./src/tests/integration/setup.ts'],
  },
});
