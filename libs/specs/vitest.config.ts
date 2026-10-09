import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['test/**/*.test.ts'],
		testTimeout: 120_000,
		coverage: {
			enabled: true,
			provider: 'v8',
			reporter: ['text', 'lcov'],
			include: ['index.js'],
			thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
		},
	},
});
