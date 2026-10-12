import { createVitestConfig } from '../../vitest.shared.ts';

export default createVitestConfig({
	coverageThreshold: 80,
	swc: true,
	// Entry point only (process start, listen, signals): exercised by tests/parity/src/startup.
	// Test helpers ported with the Directus unit tests (feature 006).
	coverageExclude: ['src/main.ts', 'src/test-utils/**', 'src/__utils__/**'],
});
