// Registry parity with Directus 11.17.4 (spec 017 FR-041, FR-044, SC-006): every operation matches the config extracted
// from directus/app/src/operations by scripts/extract-directus-registry.mjs, for the same sample arguments.
import type { FlowRaw } from '@directus/types';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';
import registry from '../../fixtures/interfaces/directus-registry.json';
import { useFlowsStore } from '../stores/flows.ts';
import { getOperation, getOperations } from './index.ts';

interface Expected {
	id: string;
	name: string;
	icon: string;
	description: string | null;
	optionsKind: string;
	flows: Partial<FlowRaw>[];
	options: { args: Record<string, unknown> | null; fields: unknown }[];
	overview: { args: Record<string, unknown>; items: unknown }[];
}

const expected = (registry as unknown as { operations: Record<string, Expected> }).operations;

/** Same JSON round trip as the extract script: functions and undefined values drop out. */
const plain = (value: unknown) => JSON.parse(JSON.stringify(value ?? null));

beforeEach(() => setActivePinia(createPinia()));

describe('operations registry', () => {
	test('has the 15 Directus operations, sorted by id', () => {
		expect(getOperations().map((operation) => operation.id)).toEqual(Object.keys(expected).sort());
	});

	describe.each(Object.keys(expected))('%s', (id) => {
		const entry = expected[id]!;

		test('id, name, icon, description', () => {
			const config = getOperation(id)!;

			expect({ id: config.id, name: config.name, icon: config.icon, description: config.description ?? null }).toEqual({
				id: entry.id,
				name: entry.name,
				icon: entry.icon,
				description: entry.description,
			});
		});

		test('options for every sample argument', () => {
			useFlowsStore().flows = entry.flows as FlowRaw[];
			const { options } = getOperation(id)!;

			for (const sample of entry.options) {
				const fields = typeof options === 'function' ? options(sample.args ?? {}) : options;
				expect(plain(fields), JSON.stringify(sample.args)).toEqual(sample.fields);
			}
		});

		test('overview for every sample argument', () => {
			const { overview } = getOperation(id)!;

			for (const sample of entry.overview) {
				const items =
					typeof overview === 'function' ? overview(sample.args, { flow: { id: 'flow-1' } as FlowRaw }) : null;
				expect(plain(items), JSON.stringify(sample.args)).toEqual(sample.items);
			}
		});
	});
});
