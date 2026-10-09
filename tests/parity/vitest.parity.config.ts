import { defineConfig } from 'vitest/config';

// Target `parity`: runs against Directus and Backoffice started by `parity-tests:env-up`.
export default defineConfig({
	test: {
		include: [
			'src/{server,startup,observability}/**/*.test.ts',
			'src/{db-unchanged,readonly-account,redis-down}.test.ts',
		],
		globalSetup: ['src/global-setup.ts'],
		fileParallelism: false,
		testTimeout: 30_000,
		hookTimeout: 120_000,
	},
});
