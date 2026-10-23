import { createRequire } from 'node:module';
import { createVitestConfig } from '../../vitest.shared.ts';

const require = createRequire(import.meta.url);

export default {
	...createVitestConfig({
		coverageThreshold: 80,
		swc: true,
		// Entry point only (process start, listen, signals): exercised by tests/parity/src/startup.
		// Test helpers ported with the DR unit tests (feature 006).
		// Spec 021 FR-106: the 101 system migrations are verbatim copies checked by port.test.ts and run for real by the
		// parity profile `bootstrap` (Postgres, SQLite); unit tests do not execute them.
		coverageExclude: ['src/main.ts', 'src/test-utils/**', 'src/__utils__/**', 'src/database/migrations/2*.ts'],
	}),
	resolve: {
		// Feature 011: graphql ships CJS (`main`) and ESM (`module`) builds without an exports map. Node loads the CJS
		// build for the app and for graphql-compose alike, but Vite picks `module` for the app's own imports and leaves
		// graphql-compose on Node's copy: two instances, and graphql-compose's instanceof checks fail ("Cannot convert
		// to OutputType"). Pinning the app to the same file as Node keeps one instance, as in production.
		alias: { graphql: require.resolve('graphql') },
	},
};
