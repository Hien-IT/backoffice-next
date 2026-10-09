import { defineConfig, devices } from '@playwright/test';

// BASE_URL: the web container in CI (job `e2e`); without it, the dev server of apps/web is started.
const baseURL = process.env['BASE_URL'] ?? 'http://127.0.0.1:4200';

export default defineConfig({
	testDir: './src',
	forbidOnly: !!process.env['CI'],
	retries: process.env['CI'] ? 1 : 0,
	reporter: process.env['CI'] ? 'line' : 'list',
	use: { baseURL, trace: 'retain-on-failure' },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	...(process.env['BASE_URL']
		? {}
		: {
				webServer: {
					command: 'pnpm --filter @backoffice/web exec vite --port 4200 --strictPort',
					url: `${baseURL}/admin/`,
					reuseExistingServer: true,
				},
			}),
});
