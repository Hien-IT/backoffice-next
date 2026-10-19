import { defineConfig } from 'vitest/config';

// Target `deploy` (feature 019): the acceptance suite on deploy/compose (BE replicas + Directus), started by the global
// setup. Files run one after another: several stop or scale containers of the shared environment.
export default defineConfig({
	test: {
		include: ['src/deploy/**/*.test.ts'],
		exclude: ['src/deploy/instances.test.ts'],
		globalSetup: ['src/deploy/global-setup.ts'],
		fileParallelism: false,
		testTimeout: 120_000,
		hookTimeout: 600_000,
		passWithNoTests: true,
	},
});
