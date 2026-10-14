import { beforeEach, expect, test, vi } from 'vitest';
import { adjustFieldsForDisplays } from './adjust-fields-for-displays.ts';

const { mockFieldsStore, getDisplay } = vi.hoisted(() => ({
	mockFieldsStore: { getField: vi.fn() },
	getDisplay: vi.fn(),
}));

vi.mock('../stores/fields.ts', () => ({ useFieldsStore: () => mockFieldsStore }));
vi.mock('../displays/index.ts', () => ({ getDisplay }));

const fields: Record<string, any> = {
	title: { collection: 'articles', field: 'title', type: 'string', meta: { display: null } },
	plain: { collection: 'articles', field: 'plain', type: 'string', meta: { display: 'raw' } },
	author: { collection: 'articles', field: 'author', type: 'uuid', meta: { display: 'user', display_options: {} } },
	tags: {
		collection: 'articles',
		field: 'tags',
		type: 'alias',
		meta: { display: 'related-values', display_options: { template: '{{ name }}' } },
	},
	unknown: { collection: 'articles', field: 'unknown', type: 'string', meta: { display: 'nope' } },
	folder: { collection: 'directus_files', field: 'folder', type: 'uuid', meta: { display: 'thumb' } },
};

const displays: Record<string, any> = {
	raw: { id: 'raw' },
	user: { id: 'user', fields: ['id', 'avatar.id'] },
	'related-values': { id: 'related-values', fields: vi.fn(() => ['name', 'id']) },
	thumb: { id: 'thumb', fields: ['$thumbnail.id', 'title'] },
};

beforeEach(() => {
	mockFieldsStore.getField.mockImplementation((_collection: string, key: string) => fields[key] ?? null);
	getDisplay.mockImplementation((id: string | null) => (id ? displays[id] : undefined));
});

test('adds the fields each display needs', () => {
	expect(
		adjustFieldsForDisplays(['missing', 'title', 'plain', 'author', 'tags', 'unknown'], 'articles'),
	).toEqual(['missing', 'title', 'plain', 'author.id', 'author.avatar.id', 'tags.name', 'tags.id', 'unknown']);

	expect(displays['related-values'].fields).toHaveBeenCalledWith(
		{ template: '{{ name }}' },
		{ collection: 'articles', field: 'tags', type: 'alias' },
	);
});

test('drops the fake $thumbnail field on directus_files', () => {
	expect(adjustFieldsForDisplays(['folder'], 'directus_files')).toEqual(['folder.id', 'folder.title']);
});
