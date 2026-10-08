import swc from 'unplugin-swc';
import { defineConfig, type UserConfig } from 'vitest/config';

export interface SharedVitestOptions {
	/** Minimum % for lines, functions, branches and statements (80 for api and BE libs, 60 for web). */
	coverageThreshold: number;
	/** Compile with SWC so NestJS decorator metadata is emitted. */
	swc?: boolean;
	environment?: 'node' | 'happy-dom';
	include?: string[];
	exclude?: string[];
}

export function createVitestConfig(options: SharedVitestOptions): UserConfig {
	const t = options.coverageThreshold;

	return defineConfig({
		plugins: options.swc ? [swc.vite({ module: { type: 'es6' } })] : [],
		test: {
			environment: options.environment ?? 'node',
			...(options.include ? { include: options.include } : {}),
			...(options.exclude ? { exclude: options.exclude } : {}),
			coverage: {
				// Always on, so the `test` target enforces thresholds without a --coverage flag.
				enabled: true,
				provider: 'v8',
				reporter: ['text', 'lcov'],
				include: ['src/**'],
				exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
				thresholds: { lines: t, functions: t, branches: t, statements: t },
			},
		},
	});
}
