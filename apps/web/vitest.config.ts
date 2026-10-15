import { defineConfig, mergeConfig } from 'vitest/config';
import { createVitestConfig } from '../../vitest.shared.ts';
import viteConfig from './vite.config.ts';

// Two projects (research R8, contracts/tests.md §1): `unit` runs in happy-dom; `browser` runs *.browser.test.ts in
// headless chromium (editors, focus, axe, timing). Coverage is measured over both.
export default mergeConfig(
	mergeConfig(
		viteConfig,
		createVitestConfig({
			coverageThreshold: 60,
			environment: 'happy-dom',
			// Entry point only (mounts the app on #app): exercised by apps/web-e2e.
			coverageExclude: ['src/main.ts'],
		}),
	),
	defineConfig({
		test: {
			projects: [
				{
					extends: true,
					test: { name: 'unit', environment: 'happy-dom', exclude: ['**/node_modules/**', '**/*.browser.test.ts'] },
				},
				{
					extends: true,
					test: {
						name: 'browser',
						include: ['src/**/*.browser.test.ts'],
						// SC-004 timings are measured alone and without coverage (CI step "web perf", PERF=1); inside the
						// coverage run they measure the runner's load, not the app.
						exclude: process.env['PERF'] ? [] : ['src/**/perf.browser.test.ts'],
						browser: {
							enabled: true,
							provider: 'playwright',
							headless: true,
							screenshotFailures: false,
							instances: [{ browser: 'chromium' }],
						},
					},
				},
			],
		},
	}),
);
