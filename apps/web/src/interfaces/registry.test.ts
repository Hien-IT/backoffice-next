// Registry parity with Directus 11.17.4 (contracts/registry.md §3, spec FR-001, FR-005): every registered interface and
// display matches the config extracted from Directus by scripts/extract-directus-registry.mjs.
import type { ExtensionOptionsContext } from '@directus/types';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';
import registry from '../../fixtures/interfaces/directus-registry.json';
import { getDisplays } from '../displays/index.ts';
import type { DisplayConfig } from '../displays/types.ts';
import { getInterfaces } from './index.ts';
import type { InterfaceConfig } from './types.ts';

type Entry = Record<string, unknown> & {
	optionsKind: string;
	optionKeys: string[];
	optionKeysByContext?: { contexts: number[]; keys: string[] }[];
};

const expected = registry as unknown as {
	directusVersion: string;
	contexts: ExtensionOptionsContext[];
	interfaces: Record<string, Entry>;
	displays: Record<string, Entry>;
};

// contracts/registry.md §3
export const EXPECTED_INTERFACE_IDS = [
	'boolean',
	'collection-item-dropdown',
	'collection-item-multiple-dropdown',
	'datetime',
	'file',
	'file-image',
	'files',
	'group-accordion',
	'group-detail',
	'group-raw',
	'group-tabs',
	'input',
	'input-autocomplete-api',
	'input-block-editor',
	'input-code',
	'input-hash',
	'input-multiline',
	'input-rich-text-html',
	'input-rich-text-md',
	'list',
	'list-m2a',
	'list-m2m',
	'list-o2m',
	'list-o2m-tree-view',
	'map',
	'presentation-divider',
	'header',
	'presentation-links',
	'presentation-notice',
	'select-color',
	'select-dropdown',
	'select-dropdown-m2o',
	'select-icon',
	'select-multiple-checkbox',
	'select-multiple-checkbox-tree',
	'select-multiple-dropdown',
	'select-radio',
	'slider',
	'tags',
	'translations',
	'system-raw-editor',
];

export const EXPECTED_DISPLAY_IDS = [
	'boolean',
	'collection',
	'color',
	'datetime',
	'file',
	'filesize',
	'formatted-json-value',
	'formatted-value',
	'hash',
	'icon',
	'image',
	'labels',
	'mime-type',
	'rating',
	'raw',
	'related-values',
	'translations',
	'user',
];

const INTERFACE_FIELDS = [
	'id',
	'name',
	'icon',
	'types',
	'localTypes',
	'group',
	'relational',
	'hideLabel',
	'hideLoader',
	'autoKey',
	'recommendedDisplays',
] as const;

const DISPLAY_FIELDS = ['id', 'name', 'icon', 'types', 'localTypes'] as const;

type Options = InterfaceConfig['options'] | DisplayConfig['options'];

// Same classification as the extraction script.
function optionsKind(options: Options): string {
	if (options === null || options === undefined) return 'null';
	if (typeof options === 'function') return 'function';
	if (Array.isArray(options)) return 'array';
	if ('standard' in options && 'advanced' in options) return 'standard-advanced';
	return 'component';
}

function optionKeys(options: Options): string[] {
	const list = Array.isArray(options)
		? options
		: [
				...(options as { standard: { field?: string }[] }).standard,
				...(options as { advanced: { field?: string }[] }).advanced,
			];

	return [...new Set(list.map((option) => option.field as string))].sort();
}

function checkConfig(config: InterfaceConfig | DisplayConfig, entry: Entry, fields: readonly string[]) {
	for (const key of fields) {
		expect((config as unknown as Record<string, unknown>)[key] ?? null, `${config.id}.${key}`).toEqual(entry[key]);
	}

	// Directus `list` and `map` use a Vue options component (keys in the JSON were read by hand): not compared, D-56.
	if (entry.optionsKind === 'component') return;

	expect(optionsKind(config.options), `${config.id} options kind`).toBe(entry.optionsKind);

	if (typeof config.options === 'function') {
		const optionsFn = config.options;

		for (const { contexts, keys } of entry.optionKeysByContext ?? []) {
			for (const index of contexts) {
				const context = structuredClone(expected.contexts[index]) as ExtensionOptionsContext;
				expect(optionKeys(optionsFn(context)), `${config.id} options, context ${index}`).toEqual(keys);
			}
		}
	} else {
		expect(config.options === null ? [] : optionKeys(config.options), `${config.id} options`).toEqual(entry.optionKeys);
	}
}

describe('registry parity with the Directus registry', () => {
	// Some options functions read the stores (e.g. the translations display), as in the Directus app.
	beforeEach(() => setActivePinia(createPinia()));

	test('the fixture covers the expected ids', () => {
		expect(expected.directusVersion).toBe('11.17.4');
		expect(Object.keys(expected.interfaces).sort()).toEqual([...EXPECTED_INTERFACE_IDS].sort());
		expect(Object.keys(expected.displays).sort()).toEqual([...EXPECTED_DISPLAY_IDS].sort());
	});

	test('registered ids are expected ids', () => {
		for (const { id } of getInterfaces()) expect(EXPECTED_INTERFACE_IDS).toContain(id);
		for (const { id } of getDisplays()) expect(EXPECTED_DISPLAY_IDS).toContain(id);
	});

	// Switched on by default once every id is ported (T090); before that, run with REGISTRY_COMPLETE=1.
	test.runIf(import.meta.env['REGISTRY_COMPLETE'] === '1')('every expected id is registered', () => {
		expect(getInterfaces().map((inter) => inter.id)).toEqual(expect.arrayContaining(EXPECTED_INTERFACE_IDS));
		expect(getDisplays().map((display) => display.id)).toEqual(expect.arrayContaining(EXPECTED_DISPLAY_IDS));
	});

	test('the comparison accepts a matching config and rejects a different one', () => {
		const entry = expected.displays['boolean']!;
		const fake = {
			...Object.fromEntries(DISPLAY_FIELDS.map((key) => [key, entry[key] ?? undefined])),
			options: entry.optionKeys.map((field) => ({ field })),
		} as unknown as DisplayConfig;

		checkConfig(fake, entry, DISPLAY_FIELDS);
		expect(() => checkConfig({ ...fake, options: [{ field: 'other' }] }, entry, DISPLAY_FIELDS)).toThrow();
		expect(() => checkConfig({ ...fake, types: ['string'] }, entry, DISPLAY_FIELDS)).toThrow();
	});

	test('registered interfaces match Directus', () => {
		for (const config of getInterfaces()) checkConfig(config, expected.interfaces[config.id]!, INTERFACE_FIELDS);
	});

	test('registered displays match Directus', () => {
		for (const config of getDisplays()) checkConfig(config, expected.displays[config.id]!, DISPLAY_FIELDS);
	});
});
