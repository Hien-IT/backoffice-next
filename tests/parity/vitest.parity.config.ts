import { configDefaults, defineConfig } from 'vitest/config';
import { parseSuite, suiteExcludedFiles, suiteFiles } from './src/suite.js';

// Target `parity`: runs against Directus and Backoffice started by `parity-tests:env-up`.
export default defineConfig({
	test: {
		include: suiteFiles(parseSuite()),
		exclude: [...configDefaults.exclude, ...suiteExcludedFiles(parseSuite())],
		globalSetup: ['src/global-setup.ts'],
		fileParallelism: false,
		testTimeout: 30_000,
		hookTimeout: 120_000,
	},
});
