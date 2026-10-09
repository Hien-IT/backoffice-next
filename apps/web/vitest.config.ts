import { mergeConfig } from 'vitest/config';
import { createVitestConfig } from '../../vitest.shared.ts';
import viteConfig from './vite.config.ts';

export default mergeConfig(
	viteConfig,
	createVitestConfig({
		coverageThreshold: 60,
		environment: 'happy-dom',
		// Entry point only (mounts the app on #app): exercised by apps/web-e2e.
		coverageExclude: ['src/main.ts'],
	}),
);
