import { beforeEach, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import {
	renderDisplayStringTemplate,
	renderPlainStringTemplate,
	renderStringTemplate,
} from './render-string-template.ts';

const { mockFieldsStore, getDisplay } = vi.hoisted(() => ({
	mockFieldsStore: { getField: vi.fn() },
	getDisplay: vi.fn(),
}));

vi.mock('../stores/fields.ts', () => ({ useFieldsStore: () => mockFieldsStore }));
vi.mock('../displays/index.ts', () => ({ getDisplay }));

beforeEach(() => {
	vi.resetAllMocks();
});

test('renderStringTemplate renders nested values and stringifies objects', () => {
	const { fieldsInTemplate, displayValue } = renderStringTemplate(
		ref('{{ title }} - {{ author.name }} {{ tags }}'),
		ref({ title: 'Hello', author: { name: 'Ann' }, tags: ['a'] }),
	);

	expect(fieldsInTemplate.value).toEqual(['title', 'author.name', 'tags']);
	expect(displayValue.value).toBe('Hello - Ann ["a"]');
});

test('renderStringTemplate returns false without item, empty for a missing prop', () => {
	expect(renderStringTemplate('{{ title }}', null).displayValue.value).toBe(false);
	expect(renderStringTemplate('{{ missing.deep }}', { title: 'x' }).displayValue.value).toBe('');
});

test('renderPlainStringTemplate', () => {
	expect(renderPlainStringTemplate('{{ a }} / {{ b.c }}', { a: 1, b: { c: 'two' } })).toBe('1 / two');
	expect(renderPlainStringTemplate('{{ a }}', null)).toBeNull();
	expect(renderPlainStringTemplate('', { a: 1 })).toBeNull();
	expect(renderPlainStringTemplate('{{ missing.deep }}', { a: 1 })).toBeNull();
});

test('renderDisplayStringTemplate runs the display handler of each field', () => {
	mockFieldsStore.getField.mockImplementation((_collection: string, key: string) =>
		key === 'size'
			? {
					field: 'size',
					meta: { display: 'filesize', display_options: { a: 1 }, options: { b: 2 } },
				}
			: { field: key, meta: { display: null } },
	);

	const handler = vi.fn((value: number) => `${value} B`);
	getDisplay.mockImplementation((id: string | null) => (id === 'filesize' ? { id, handler } : undefined));

	expect(renderDisplayStringTemplate('files', '{{ title }} ({{ size }})', { title: 'Doc', size: 10 })).toBe(
		'Doc (10 B)',
	);

	expect(mockFieldsStore.getField).toHaveBeenCalledWith('files', 'size');

	expect(handler).toHaveBeenCalledWith(
		10,
		{ a: 1 },
		{
			interfaceOptions: { b: 2 },
			field: { field: 'size', meta: { display: 'filesize', display_options: { a: 1 }, options: { b: 2 } } },
			collection: 'files',
		},
	);
});

test('renderDisplayStringTemplate keeps null values and values without a display', () => {
	mockFieldsStore.getField.mockReturnValue(null);
	getDisplay.mockReturnValue(undefined);

	expect(renderDisplayStringTemplate('files', '{{ a }}-{{ b }}', { a: 'x', b: null })).toBe('x-');
});
