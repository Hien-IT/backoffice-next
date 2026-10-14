import { defineConfig, devices, type Project } from '@playwright/test';
import { e2eConfig, isCors, webUrl } from './src/helpers/config.js';

// Feature 012 (contracts/e2e.md §2, FR-071, FR-090). E2E_CONFIG picks the configuration of the parity profile `web`:
// proxy-directus (8161), proxy-api (8162), cors (localhost:8181 -> 127.0.0.1:8163); unset = the Vite dev server.
// BASE_URL overrides the web URL of the configuration. The three runs share one database: one worker.
const VIEWPORTS = { 768: { width: 768, height: 1024 }, 1280: { width: 1280, height: 800 } };
const BROWSERS = {
	chromium: devices['Desktop Chrome'],
	firefox: devices['Desktop Firefox'],
	webkit: devices['Desktop Safari'],
};

let projects: Project[] = Object.entries(BROWSERS).flatMap(([browser, device]) =>
	Object.entries(VIEWPORTS).map(([width, viewport]) => ({ name: `${browser}-${width}`, use: { ...device, viewport } })),
);

// Cross-site and dev: chromium only (FR-090); msedge only on runners that have it.
if (isCors) projects = projects.filter((p) => p.name === 'chromium-1280');
else if (e2eConfig === 'dev') projects = projects.filter((p) => p.name?.startsWith('chromium-'));
else if (process.env['PLAYWRIGHT_MSEDGE'] === '1') {
	projects.push({
		name: 'msedge-1280',
		use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: VIEWPORTS[1280] },
	});
}

export default defineConfig({
	testDir: './src',
	forbidOnly: !!process.env['CI'],
	retries: process.env['CI'] ? 1 : 0,
	workers: 1,
	reporter: process.env['CI'] ? 'line' : 'list',
	timeout: 120_000,
	use: { baseURL: webUrl, trace: 'retain-on-failure' },
	projects,
	...(e2eConfig === 'dev' && !process.env['BASE_URL']
		? {
				webServer: {
					command: 'pnpm --filter @backoffice/web exec vite --host 127.0.0.1 --port 4200 --strictPort',
					url: `${webUrl}/admin/`,
					reuseExistingServer: true,
				},
			}
		: {}),
});
