import { defineConfig } from 'vitest/config';

// Target `test`: unit tests of the comparer, no Docker. Coverage is not gated here: this project is test
// tooling, the 80% gate applies to apps/api and BE libs (Principle X).
export default defineConfig({
	test: {
		// Feature 008 and 009: the comparable form of the history and run log rows needs no Docker either.
		include: [
			'src/*.test.ts',
			'src/history/history-effects.test.ts',
			'src/flows/helpers.test.ts',
			'src/system/helpers.test.ts',
			'src/graphql/helpers.test.ts',
		],
		exclude: ['src/db-unchanged.test.ts', 'src/readonly-account.test.ts', 'src/redis-down.test.ts'],
	},
});
