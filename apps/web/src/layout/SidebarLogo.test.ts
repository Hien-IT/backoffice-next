import { enableAutoUnmount } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { nextTick } from 'vue';
import { createSdk } from '../api/sdk.ts';
import { useRequestsStore } from '../stores/requests.ts';
import { useServerStore } from '../stores/server.ts';
import { useSettingsStore, type Settings } from '../stores/settings.ts';
import { mountLayout } from '../test-utils/layout.ts';
import SidebarLogo from './SidebarLogo.vue';

vi.mock('../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

enableAutoUnmount(afterEach);

async function render(settings: Partial<Settings>) {
	createSdk('http://api.test/');

	return (
		await mountLayout(SidebarLogo, {
			beforeMount: () => {
				useSettingsStore().settings = settings as Settings;
				// The name comes from the server info, where DR defaults are already dropped (D-51).
				useServerStore().info.project = { project_name: settings.project_name ?? null } as never;
			},
		})
	).wrapper;
}

describe('SidebarLogo (FR-026)', () => {
	test('the Backoffice app icon (D-159) without a link when there is no project_url', async () => {
		const wrapper = await render({ project_url: null, project_logo: null });

		expect(wrapper.find('a').exists()).toBe(false);
		expect(wrapper.findAll('img').map((img) => img.attributes('alt'))).toEqual(['Backoffice']);
	});

	test('project_logo from /assets and an http(s) project_url as a new-tab link', async () => {
		const wrapper = await render({
			project_url: 'https://example.test',
			project_logo: 'logo-id',
			project_name: 'Acme',
		});

		expect(wrapper.get('a').attributes()).toMatchObject({
			href: 'https://example.test',
			target: '_blank',
			rel: 'noopener noreferrer',
		});
		expect(wrapper.get('img').attributes()).toMatchObject({ src: 'http://api.test/assets/logo-id', alt: 'Acme' });
		// An uploaded logo sits on a white tile (owner 2026-10-22).
		expect(wrapper.get('img').element.parentElement!.className).toContain('bg-white');
	});

	test.each(['javascript:alert(1)', 'data:text/html,x', 'not a url'])('project_url %s is not a link', async (url) => {
		const wrapper = await render({ project_url: url });

		expect(wrapper.find('a').exists()).toBe(false);
	});

	test('progress bar while the request queue has items', async () => {
		const wrapper = await render({});
		const requests = useRequestsStore();

		expect(wrapper.find('[role="progressbar"]').exists()).toBe(false);

		const id = requests.startRequest();
		await nextTick();
		expect(wrapper.find('[role="progressbar"]').exists()).toBe(true);

		requests.endRequest(id);
		await nextTick();
		expect(wrapper.find('[role="progressbar"]').exists()).toBe(false);
	});
});
