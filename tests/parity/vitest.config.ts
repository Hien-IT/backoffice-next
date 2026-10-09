import { defineConfig } from 'vitest/config';

// Target `test`: unit tests of the comparer, no Docker. Coverage is not gated here: this project is test
// tooling, the 80% gate applies to apps/api and BE libs (Principle X).
export default defineConfig({
	test: {
		include: ['src/*.test.ts'],
		exclude: ['src/db-unchanged.test.ts', 'src/readonly-account.test.ts', 'src/redis-down.test.ts'],
	},
});
