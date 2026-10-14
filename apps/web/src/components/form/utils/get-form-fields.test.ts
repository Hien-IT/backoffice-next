// Ported from directus/app/src/components/v-form/utils/get-form-fields.test.ts
// Backoffice: the registry lookup (getInterface) is mocked instead of useExtension; indicatorStyle is not ported (D-55).
import type { DeepPartial, Field, InterfaceConfig } from '@directus/types';
import { expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { getInterface } from '../../../interfaces/index.ts';
import { getFormFields } from './get-form-fields.ts';

vi.mock('../../../interfaces/index.ts', () => ({ getInterface: vi.fn() }));

vi.mock('../../../utils/get-default-interface-for-type.ts', () => ({
	getDefaultInterfaceForType: () => 'input',
}));

it('should not mutate', () => {
	const fields: Field[] = [];

	const formFields = getFormFields(ref(fields));

	expect(formFields).not.toBe(fields);
});

it('should filter out fake fields', () => {
	const fields: DeepPartial<Field>[] = [
		{
			field: '$thumbnail',
		},
	];

	const formFields = getFormFields(ref(fields as Field[]));

	expect(formFields.value).toEqual([]);
});

it('should set default interface', () => {
	vi.mocked(getInterface).mockImplementationOnce(() => undefined);

	const fields: DeepPartial<Field>[] = [
		{
			field: 'field1',
			meta: {},
		},
	];

	const formFields = getFormFields(ref(fields as Field[]));

	expect(formFields.value[0]).toEqual(expect.objectContaining({ meta: { interface: 'input' } }));
});

it('should sort fields', () => {
	const fields: DeepPartial<Field>[] = [
		{ field: 'field3', meta: { id: 1 } },
		{ field: 'field4', meta: { id: 2 } },
		{ field: 'field2', meta: { sort: 2 } },
		{ field: 'field5', meta: { sort: 1, group: 'group1' } },
		{ field: 'field6', meta: { group: 'group1' } },
		{ field: 'field1', meta: { sort: 1 } },
	];

	const formFields = getFormFields(ref(fields as Field[]));

	expect(formFields.value.map((field) => field.field)).toEqual([
		'field1',
		'field2',
		'field3',
		'field4',
		'field5',
		'field6',
	]);
});

it('should inherit config from interface', () => {
	vi.mocked(getInterface).mockImplementationOnce(() => ({ hideLabel: true, hideLoader: true }) as InterfaceConfig);

	const fields: DeepPartial<Field>[] = [
		{
			field: 'field1',
			meta: { interface: 'example' },
		},
	];

	const formFields = getFormFields(ref(fields as Field[]));

	expect(formFields.value[0]).toEqual(
		expect.objectContaining({ meta: { interface: 'example' }, hideLabel: true, hideLoader: true }),
	);
});

it('should arrange system and user fields and inject system divider', () => {
	const fields: DeepPartial<Field>[] = [
		{ field: 'user_field', meta: {} },
		{ field: 'system_field', meta: { system: true } },
	];

	const formFields = getFormFields(ref(fields as Field[]));

	expect(formFields.value).toMatchInlineSnapshot(`
		[
		  {
		    "field": "system_field",
		    "meta": {
		      "interface": "input",
		      "system": true,
		    },
		  },
		  {
		    "field": "$system_divider",
		    "hideLabel": true,
		    "hideLoader": true,
		    "meta": {
		      "group": null,
		      "interface": "presentation-divider",
		    },
		    "type": "alias",
		  },
		  {
		    "field": "user_field",
		    "meta": {
		      "interface": "input",
		    },
		  },
		]
	`);
});
