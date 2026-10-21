// Spec 020 (FR-060 to FR-069): what an extension built for the Directus app finds at run time is there in the new app
// too. Both apps run with the fixture extension set loaded; the Vue app context of each is read in the browser: global
// components (v-*, interface-*, display-*, layout-*, panel-*... compared by their PascalCase name), directives, provides
// (api, sdk, stores, extensions), global properties, the --theme--* variables on body and the theme class of body.
// Everything of the Directus app must exist in the new app (extras are allowed). Found missing by hand once already:
// display-raw, layout-sidebar-*, the body theme class (an extension resolving one of them by name drew nothing).
// Chromium only: the lists do not depend on the browser.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL } from './helpers/config.js';
import { onDirectusApp } from './helpers/directus-app.js';
import { login, resetLastPage } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

/** Directus has it, the new app does not, on purpose. */
const ACCEPTED_MISSING = {
	// D-41: the MCP settings are out of scope.
	components: ['InterfaceSystemMcpPromptsCollectionValidation'],
};

/** Registered by both apps once the fixture extension bundle is loaded. */
const FIXTURE_COMPONENT = 'display-parity-display-badge';

interface Runtime {
	components: string[];
	directives: string[];
	provides: string[];
	globals: string[];
	themeVariables: string[];
	bodyClasses: string[];
}

async function runtime(page: Page): Promise<Runtime> {
	await page.waitForFunction((name) => {
		const host = Array.from(document.querySelectorAll('*')).find((el) => '__vue_app__' in el) as
			| (Element & { __vue_app__: { component: (name: string) => unknown } })
			| undefined;
		return !!host?.__vue_app__.component(name);
	}, FIXTURE_COMPONENT);

	return page.evaluate(() => {
		const host = Array.from(document.querySelectorAll('*')).find((el) => '__vue_app__' in el) as Element & {
			__vue_app__: {
				_context: {
					components: object;
					directives: object;
					provides: object;
					config: { globalProperties: object };
				};
			};
		};
		const context = host.__vue_app__._context;
		const pascal = (name: string) =>
			name.replace(/-(\w)/g, (_, char: string) => char.toUpperCase()).replace(/^\w/, (char) => char.toUpperCase());

		return {
			components: [...new Set(Object.keys(context.components).map(pascal))].sort(),
			directives: Object.keys(context.directives).sort(),
			provides: Object.keys(context.provides).sort(),
			globals: Object.keys(context.config.globalProperties).sort(),
			themeVariables: Array.from(getComputedStyle(document.body))
				.filter((name) => name.startsWith('--theme--'))
				.sort(),
			bodyClasses: Array.from(document.body.classList).sort(),
		};
	});
}

test('the Directus app runtime an extension relies on is there in the new app', async ({
	browser,
	browserName,
	page,
	playwright,
}) => {
	test.skip(browserName !== 'chromium', 'the registrations do not depend on the browser');

	const directus = await onDirectusApp(browser, async (directusPage) => runtime(directusPage));

	const api = new AdminApi(await playwright.request.newContext());
	await resetLastPage(api);
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
	const backoffice = await runtime(page);

	const missing = (key: keyof Runtime) => {
		const accepted = (ACCEPTED_MISSING as Partial<Record<keyof Runtime, string[]>>)[key] ?? [];
		return directus[key].filter((name) => !backoffice[key].includes(name) && !accepted.includes(name));
	};

	// Sanity: the Directus app context was read with its extensions (a broken read would make every check pass).
	expect(directus.components.length).toBeGreaterThan(150);
	expect(directus.themeVariables.length).toBeGreaterThan(100);

	expect(missing('components'), 'global components').toEqual([]);
	expect(missing('directives'), 'directives').toEqual([]);
	expect(missing('provides'), 'provides').toEqual([]);
	expect(missing('globals'), 'global properties').toEqual([]);
	expect(missing('themeVariables'), '--theme--* variables on body').toEqual([]);
	expect(missing('bodyClasses'), 'body classes').toEqual([]);
});
