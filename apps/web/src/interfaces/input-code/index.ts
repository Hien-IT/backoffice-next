// Ported from directus/app/src/interfaces/input-code/index.ts
import { defineInterface, type InterfaceConfig } from '../types.ts';
import CodeMirror from 'codemirror';
import InterfaceCode from './InputCode.vue';
import 'codemirror/mode/meta.js';

// Backoffice: option rows typed as InterfaceConfig expects (DeepPartial<Field> also allows `schema: null`).
type OptionField = Extract<NonNullable<InterfaceConfig['options']>, unknown[]>[number];

const choicesMap = CodeMirror.modeInfo.reduce((acc: Record<string, string>, choice) => {
	if (['JSON', 'JSON-LD'].includes(choice.name)) {
		acc['JSON'] = 'JSON';
		return acc;
	}

	if (choice.mode == null || choice.mode == 'null') {
		choice.mode = 'plaintext';
	}

	if (choice.mode in acc) {
		acc[choice.mode] += ' / ' + choice.name;
	} else {
		acc[choice.mode] = choice.name;
	}

	return acc;
}, {});

const choices = Object.entries(choicesMap).map(([key, value]) => ({
	text: value,
	value: key,
}));

export default defineInterface({
	id: 'input-code',
	name: '$t:interfaces.input-code.code',
	description: '$t:interfaces.input-code.description',
	icon: 'code',
	component: InterfaceCode,
	types: ['string', 'json', 'text', 'geometry'],
	group: 'standard',
	options: ({ field }) => {
		const sharedOptions: OptionField[] = [
			{
				field: 'lineNumber',
				name: '$t:interfaces.input-code.line_number',
				type: 'boolean',
				meta: {
					width: 'half',
					interface: 'boolean',
				},
				schema: {
					default_value: true,
				},
			},
			{
				field: 'lineWrapping',
				name: '$t:interfaces.input-code.line_wrapping',
				type: 'boolean',
				meta: {
					width: 'half',
					interface: 'boolean',
				},
				schema: {
					default_value: false,
				},
			},
			{
				field: 'template',
				name: '$t:template',
				type: 'text',
				meta: {
					width: 'full',
					interface: 'input-code',
					options: {
						placeholder: '$t:interfaces.input-code.placeholder',
					},
				},
			},
		];

		const defaultOptions: OptionField[] = [
			{
				field: 'language',
				name: '$t:language',
				type: 'string',
				meta: {
					width: 'full',
					interface: 'select-dropdown',
					options: { choices },
				},
			},
			...sharedOptions,
		];

		const jsonOptions: OptionField[] = [...sharedOptions];

		if (field?.type === 'json') {
			return jsonOptions;
		}

		return defaultOptions;
	},
});
