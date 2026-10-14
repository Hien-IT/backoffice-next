// Ported from directus/app/src/utils/validate-item.test.ts
import type { DeepPartial, Field } from '@directus/types';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test, vi } from 'vitest';
import { useRelationsStore } from '../../../stores/relations.ts';
import { validateItem } from './validate-item.ts';

vi.mock('./parse-filter.ts', () => ({
	parseFilter: (filter: any) => {
		// Simulate resolving $NOW to actual date, matching real parseFilter behavior
		const resolved = JSON.parse(JSON.stringify(filter), (_key, value) => {
			if (typeof value === 'string' && value.startsWith('$NOW')) return new Date().toISOString();
			return value;
		});

		return resolved;
	},
}));

const fields: DeepPartial<Field>[] = [
	{
		field: 'id',
		collection: 'users',
		type: 'integer',
		name: 'ID',
		meta: {
			required: true,
		},
		schema: null,
	},
	{
		field: 'name',
		collection: 'users',
		type: 'string',
		name: 'Name',
		meta: {
			required: true,
		},
		schema: null,
	},
	{
		field: 'email',
		collection: 'users',
		type: 'string',
		name: 'Email',
		schema: null,
	},
	{
		field: 'role',
		collection: 'users',
		type: 'integer',
		name: 'Role',
		meta: {
			required: true,
		},
		schema: null,
	},
];

beforeEach(() => {
	// Backoffice: a real pinia with getRelationsForField spied instead of @pinia/testing (not a dependency).
	setActivePinia(createPinia());

	vi.spyOn(useRelationsStore(), 'getRelationsForField').mockImplementation(((_collection: string, field: string) => {
		if (field === 'role') {
			return [{ some: 'relation' }];
		}

		return [];
	}) as any);
});

test('Required fields', () => {
	let result = validateItem(
		{
			id: 1,
			name: 'test',
			email: 'test@test.com',
			role: [1, 2],
		},
		fields as Field[],
		true,
	);

	expect(result.length).toEqual(0);

	result = validateItem(
		{
			id: 1,
			name: 'test',
			email: 'test@test.com',
			role: [],
		},
		fields as Field[],
		true,
	);

	expect(result.length).toEqual(1);
});

test('Custom validation with $NOW dynamic variable does not throw', () => {
	const fieldsWithValidation: DeepPartial<Field>[] = [
		{
			field: 'publish_date',
			collection: 'articles',
			type: 'timestamp',
			name: 'Publish Date',
			meta: {
				required: false,
				validation: {
					_and: [
						{
							publish_date: {
								_gte: '$NOW',
							},
						},
					],
				},
			},
			schema: null,
		},
	];

	const futureDate = new Date(Date.now() + 86400000).toISOString();

	const result = validateItem({ publish_date: futureDate }, fieldsWithValidation as Field[], true, true);

	expect(result.length).toEqual(0);
});
