import { defineConfig, devices } from '@playwright/test';

// Feature 004 (FR-106, SC-008, contracts/proxy-e2e.md §3): the Directus app 11.17.4 through the reverse proxy of the
// parity environment (profile `app`). BASE_URL is the proxy; each spec also runs at DIRECTUS_URL (Directus alone) and
// compares the rows both runs wrote. No webServer: `env-up --profiles=app` starts everything.
const baseURL = process.env['BASE_URL'];
if (!baseURL) throw new Error('BASE_URL must be set (the reverse proxy, e.g. http://127.0.0.1:8160)');

export default defineConfig({
	testDir: './src',
	forbidOnly: !!process.env['CI'],
	retries: process.env['CI'] ? 1 : 0,
	workers: 1,
	reporter: process.env['CI'] ? 'line' : 'list',
	timeout: 120_000,
	use: { baseURL, trace: 'retain-on-failure' },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
