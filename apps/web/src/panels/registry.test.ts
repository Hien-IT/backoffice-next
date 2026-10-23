// Registry parity with DR 11.17.4 (spec 018 FR-040, FR-031, SC-006): every panel matches the config extracted from
// directus/app/src/panels by scripts/extract-directus-registry.mjs (PANEL_FAKES), for the same sample arguments. The
// stores and helpers below are mocked with the same fakes as the extract script.
import { describe, expect, test, vi } from 'vitest';
import { isRef } from 'vue';
import registry from '../../fixtures/interfaces/directus-registry.json';
import { getPanel, getPanels } from './index.ts';

vi.mock('../stores/collections.ts', () => ({
	useCollectionsStore: () => ({
		getCollection: (collection: string) => (collection ? { collection, meta: { singleton: false } } : null),
	}),
}));

vi.mock('../stores/fields.ts', () => ({
	useFieldsStore: () => ({
		getFieldsForCollection: () => [],
		getField: () => null,
		getPrimaryKeyFieldForCollection: () => ({ field: 'id' }),
	}),
}));

vi.mock('../stores/relations.ts', () => ({
	useRelationsStore: () => ({
		getRelationsForField: () => [],
		getRelationsForCollection: () => [],
		getRelationForField: () => null,
	}),
}));

vi.mock('../utils/adjust-fields-for-displays.ts', () => ({ adjustFieldsForDisplays: (fields: string[]) => fields }));
vi.mock('../utils/get-default-interface-for-type.ts', () => ({
	getDefaultInterfaceForType: (type: string) => `interface-for-${type}`,
}));
vi.mock('../utils/translate-object-values.ts', () => ({ translate: (value: unknown) => value }));
vi.mock('../utils/css-var.ts', () => ({ cssVar: (name: string) => `cssVar(${name})` }));
vi.mock('vue-i18n', async (importOriginal) => ({
	...(await importOriginal<object>()),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../constants.ts', async (importOriginal) => ({
	...(await importOriginal<object>()),
	FIELD_TYPES_SELECT: [{ text: '$t:string', value: 'string' }],
}));

interface Expected {
	id: string;
	name: string;
	icon: string;
	description: string | null;
	minWidth: number;
	minHeight: number;
	variable: boolean | null;
	skipUndefinedKeys: string[] | null;
	optionsKind: string;
	options: { args: Record<string, unknown> | null; fields: unknown }[];
	query: { args: Record<string, unknown>; result: unknown }[];
}

const expected = (registry as unknown as { panels: Record<string, Expected> }).panels;

/**
 * Same JSON round trip as the extract script (whose fake `computed` serializes as `{ value }`); the default color token
 * differs by D-108.
 */
const plain = (value: unknown) =>
	JSON.parse(
		JSON.stringify(value ?? null, (_key, item) => (isRef(item) ? { value: item.value } : item)).replaceAll(
			'cssVar(--color-brand-500)',
			'cssVar(--theme--primary)',
		),
	);

describe('panels registry', () => {
	test('has the 11 Directus panels, sorted by id', () => {
		expect(getPanels().map((panel) => panel.id)).toEqual(Object.keys(expected).sort());
	});

	describe.each(Object.keys(expected))('%s', (id) => {
		const entry = expected[id]!;

		test('id, name, icon, description, sizes, variable, skipUndefinedKeys', () => {
			const config = getPanel(id)!;

			expect({
				id: config.id,
				name: config.name,
				icon: config.icon,
				description: config.description ?? null,
				minWidth: config.minWidth,
				minHeight: config.minHeight,
				variable: config.variable ?? null,
				skipUndefinedKeys: config.skipUndefinedKeys ?? null,
			}).toEqual({
				id: entry.id,
				name: entry.name,
				icon: entry.icon,
				description: entry.description,
				minWidth: entry.minWidth,
				minHeight: entry.minHeight,
				variable: entry.variable,
				skipUndefinedKeys: entry.skipUndefinedKeys,
			});
		});

		test('options for every sample argument', () => {
			const { options } = getPanel(id)!;

			for (const sample of entry.options) {
				const fields = typeof options === 'function' ? options(sample.args ?? {}) : options;
				expect(plain(fields), JSON.stringify(sample.args)).toEqual(sample.fields);
			}
		});

		test('query for every sample options object', () => {
			const { query } = getPanel(id)!;

			for (const sample of entry.query) {
				expect(plain(query ? (query(sample.args) ?? null) : null), JSON.stringify(sample.args)).toEqual(sample.result);
			}
		});
	});
});
