// The translations info menu in a real browser (happy-dom closes the Reka popover on open): one entry per translation
// with the language label (`languageField`), the progress of the filled writable fields and the rendered template.
import { readItem } from '@directus/sdk';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { userEvent } from '@vitest/browser/context';
import { replaceQueue, sdk } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import '../../styles/index.css';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { fieldsOf, loadSnapshot } from '../../test-utils/fixtures.ts';
import { adjustFieldsForDisplays } from '../../utils/adjust-fields-for-displays.ts';
import DisplayTranslations from './DisplayTranslations.vue';

enableAutoUnmount(afterEach);

let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(loadSnapshot());
	await Promise.all([useFieldsStore().hydrate(), useRelationsStore().hydrate(), useCollectionsStore().hydrate()]);
});

async function mountRow(id: number, options: Record<string, unknown>) {
	const fields = adjustFieldsForDisplays(['translations'], 'bo_translations');
	const item = (await sdk.request(readItem('bo_translations' as never, id, { fields } as never))) as Record<
		string,
		any
	>;

	return mount(DisplayTranslations, {
		props: {
			collection: 'bo_translations',
			field: 'translations',
			type: 'alias',
			value: item['translations'],
			...options,
		},
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
}

async function open(wrapper: Awaited<ReturnType<typeof mountRow>>) {
	const trigger = wrapper.get('button').element;
	trigger.focus();
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'));
	return [...document.querySelectorAll('[role="dialog"] li')];
}

const options = fieldsOf('bo_translations').find((f) => f.field === 'translations')!.meta!.display_options!;

test('option:translations.languageField labels each entry; progress counts the filled writable fields', async () => {
	const entries = await open(await mountRow(1, options));

	expect(entries.map((li) => li.querySelector('.lang')!.textContent?.replace('translate', '').trim())).toEqual([
		'English',
		'Tiếng Việt',
	]);
	expect(entries.map((li) => li.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow'))).toEqual([
		'100',
		'100',
	]);
	expect(entries.map((li) => li.querySelector(':scope > div:last-child')?.textContent?.trim())).toEqual([
		'Hello',
		'Xin chào',
	]);

	await userEvent.keyboard('{Escape}');
	expect(document.activeElement).toBe(document.querySelector('.display-translations button'));
	assertOnlyKnownRequests(calls(fetch));
});

test('without languageField the language key is shown; a half filled translation is at 50 %', async () => {
	const entries = await open(await mountRow(2, { template: '{{ title }}' }));
	const bar = entries[0]!.querySelector<HTMLElement>('[role="progressbar"]')!;

	expect(entries[0]!.querySelector('.lang')!.textContent?.replace('translate', '').trim()).toBe('ar-SA');
	expect(bar.getAttribute('aria-valuenow')).toBe('50');
	// v-progress-linear `colorful`: <= 66 % takes the warning color instead of the brand one.
	const probe = document.createElement('div');
	probe.className = 'bg-warning-500';
	document.body.append(probe);
	expect(getComputedStyle(bar.firstElementChild!).backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
	probe.remove();
});
