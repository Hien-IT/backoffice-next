// T093 (FR-122, SC-005, contracts/tests.md §6): axe on BoForm for bo_std, bo_groups and bo_rel of the fixture snapshot
// and on a BoTable rendering the 18 displays, light and `html.dark`: 0 serious or critical violations. Exceptions,
// like 012's apps/web-e2e/src/a11y.spec.ts, are listed below with their rule id and reason; anything else fails.
import { readItem } from '@directus/sdk';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import axe from 'axe-core';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue, sdk } from '../../api/sdk.ts';
import { getDisplays } from '../../displays/index.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import '../../styles/index.css';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import { adjustFieldsForDisplays } from '../../utils/adjust-fields-for-displays.ts';
import BoTable from '../BoTable.vue';
import RenderDisplay from '../render/RenderDisplay.vue';
import BoForm from './BoForm.vue';

enableAutoUnmount(afterEach);

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Accepted exceptions (SC-005: third-party library DOM and data colors only).
 * - `link-in-text-block` in `.maplibregl-ctrl-attrib`: MapLibre's attribution control (its own DOM and CSS, links
 *   to MapLibre and OpenStreetMap without underline); kept as the library ships it (FR-094).
 * - `color-contrast` when the element or an ancestor inside the field or cell gets its color from an inline style:
 *   data colors from the field options or the item (choices `color`, `colorOn`/`colorOff`, radio `color`,
 *   `conditionalFormatting`, `iconLeft` color...), applied as is like Directus (spec Edge Cases, Q-C).
 */
const EXCEPTIONS: { rule: string; reason: string; applies: (el: Element) => boolean }[] = [
	{
		rule: 'link-in-text-block',
		reason: 'MapLibre attribution control (third-party DOM)',
		applies: (el) => el.closest('.maplibregl-ctrl-attrib') !== null,
	},
	{
		rule: 'color-contrast',
		reason: 'data color applied with an inline style (Q-C)',
		applies: (el) => {
			for (let node: Element | null = el; node && !node.matches('[data-field], td, body'); node = node.parentElement) {
				if (/(^|;)\s*(color|background(-color)?|border-color)\s*:/.test(node.getAttribute('style') ?? '')) return true;
			}

			return false;
		},
	},
];

const snapshot = loadSnapshot();
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });
let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(snapshot);
	await useUserStore().hydrate();
	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);
});

afterEach(() => {
	document.documentElement.classList.remove('dark');
	// MapLibre fetches the OpenStreetMap tiles with Request objects (outside the API; the map edge case of the spec).
	const api = fetch.mock.calls.filter(([input]) => !(input instanceof Request));
	assertOnlyKnownRequests(calls({ mock: { calls: api } } as typeof fetch));
});

/** Serious and critical violations outside EXCEPTIONS, as "rule: selector html". */
async function violations(): Promise<string[]> {
	const results = await axe.run(document.body, { runOnly: { type: 'tag', values: TAGS } });

	return results.violations
		.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		.flatMap((v) =>
			v.nodes
				.filter((n) => {
					const el = document.querySelector(String(n.target[0]));
					return !EXCEPTIONS.some((e) => e.rule === v.id && el && e.applies(el));
				})
				.map((n) => `${v.id}: ${n.target.join(' ')} ${n.html.slice(0, 200)}`),
		);
}

/** Lets the async interfaces and displays load (relations, files, editors) before axe runs. */
async function settle() {
	await flushPromises();
	await new Promise((resolve) => setTimeout(resolve, 300));
	await flushPromises();
}

/** One field per registered display, with its first seeded value read with the display fields (FR-073). */
async function displayRow() {
	const fields = getDisplays().map(({ id }) => snapshot.fields.find((field) => field.meta?.display === id)!);
	const row: Record<string, unknown> = { id: 1 };

	for (const field of fields) {
		const pk = useFieldsStore().getPrimaryKeyFieldForCollection(field.collection)!.field;
		const key = snapshot.items[field.collection]![0]![pk];
		const fieldsQuery = adjustFieldsForDisplays([field.field], field.collection);
		const item = (await sdk.request(
			readItem(field.collection as never, key as never, { fields: fieldsQuery } as never),
		)) as Record<string, unknown>;

		row[`${field.collection}.${field.field}`] = item[field.field];
	}

	return { fields, row };
}

describe.each(['light', 'dark'] as const)('%s', (scheme) => {
	beforeEach(() => {
		document.documentElement.classList.toggle('dark', scheme === 'dark');
	});

	test.each(['bo_std', 'bo_groups', 'bo_rel'])('BoForm on %s has no serious or critical violation', async (collection) => {
		const item = snapshot.items[collection]![0]!;

		mount(BoForm, {
			props: { collection, primaryKey: item['id'] as number, initialValues: item, modelValue: {} },
			global: { plugins: [i18n, router] },
			attachTo: document.body,
		});

		await settle();
		expect(document.querySelectorAll('[data-field]').length).toBeGreaterThan(5);
		expect(await violations()).toEqual([]);
	});

	test('BoTable with the 18 displays has no serious or critical violation', async () => {
		const { fields, row } = await displayRow();
		const key = (field: (typeof fields)[number]) => `${field.collection}.${field.field}`;

		expect(fields).toHaveLength(18);

		mount(BoTable, {
			props: { columns: fields.map((field) => ({ key: key(field), label: field.meta!.display! })), rows: [row] },
			slots: Object.fromEntries(
				fields.map((field) => [
					`item.${key(field)}`,
					// typed loosely: BoTable's slot record also types the header.* slots
					(props: Record<string, any>) =>
						h(RenderDisplay, {
							display: field.meta!.display!,
							options: field.meta!.display_options,
							interface: field.meta!.interface,
							interfaceOptions: field.meta!.options,
							value: props['item'][key(field)],
							type: field.type,
							collection: field.collection,
							field: field.field,
						}),
				]),
			),
			global: { plugins: [i18n, router] },
			attachTo: document.body,
		});

		await settle();
		expect(document.querySelectorAll('tbody td').length).toBeGreaterThanOrEqual(18);
		expect(await violations()).toEqual([]);
	});
});
