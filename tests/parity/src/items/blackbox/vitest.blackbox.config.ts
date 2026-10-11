// Feature 005 (research R6, contracts/parity-blackbox.md §1): the port of the Directus blackbox items, query and
// relational files, run by scripts/parity.mjs once per app of the blackbox pair (PARITY_BLACKBOX_APP).
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import SeedFirstSequencer from './sequencer.js';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
	root: here('../../..'),
	resolve: {
		alias: {
			'@common': here('./common'),
			'@utils': here('./utils'),
		},
	},
	test: {
		include: ['src/items/blackbox/**/*.test.ts'],
		globalSetup: ['src/global-setup.ts'],
		fileParallelism: false,
		sequence: { sequencer: SeedFirstSequencer },
		testTimeout: 60_000,
		hookTimeout: 300_000,
	},
});
