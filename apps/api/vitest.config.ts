import { createVitestConfig } from '../../vitest.shared.ts';

export default createVitestConfig({
	coverageThreshold: 80,
	swc: true,
	// Entry point only (process start, listen, signals): exercised by tests/parity/src/startup.
	coverageExclude: ['src/main.ts'],
});
