import type { Field, PrimaryKey } from '@directus/types';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { useLayoutClickHandler } from './use-layout-click-handler.ts';

const router = { push: vi.fn(), resolve: vi.fn((route: string) => ({ href: `/admin${route}` })) };

vi.mock('vue-router', () => ({ useRouter: () => router }));

beforeEach(() => {
	vi.spyOn(window, 'open').mockImplementation(() => null);
});

afterEach(() => {
	vi.restoreAllMocks();
	router.push.mockReset();
});

function setup(props: Partial<{ selectMode: boolean; readonly: boolean }> = {}, selected: PrimaryKey[] = []) {
	const selection = ref<PrimaryKey[]>(selected);
	const primaryKeyField = ref({ field: 'id' } as Field);

	const { onClick } = useLayoutClickHandler({
		props: { selectMode: false, readonly: false, collection: 'articles', ...props },
		selection,
		primaryKeyField,
	});

	return { onClick, selection, primaryKeyField };
}

const click = (init: MouseEventInit = {}) => new MouseEvent('click', init);

test('opens the item', () => {
	const { onClick } = setup();

	onClick({ item: { id: 3 }, event: click() });

	expect(router.push).toHaveBeenCalledWith('/content/articles/3');
	expect(window.open).not.toHaveBeenCalled();
});

test('Ctrl or Cmd opens the item in a new tab', () => {
	const { onClick } = setup();

	onClick({ item: { id: 3 }, event: click({ ctrlKey: true }) });
	onClick({ item: { id: 4 }, event: click({ metaKey: true }) });

	expect(window.open).toHaveBeenNthCalledWith(1, '/admin/content/articles/3', '_blank');
	expect(window.open).toHaveBeenNthCalledWith(2, '/admin/content/articles/4', '_blank');
	expect(router.push).not.toHaveBeenCalled();
});

test('selectMode toggles the item in the selection', () => {
	const { onClick, selection } = setup({ selectMode: true });

	onClick({ item: { id: 3 }, event: click() });
	expect(selection.value).toEqual([3]);

	onClick({ item: { id: 3 }, event: click() });
	expect(selection.value).toEqual([]);
	expect(router.push).not.toHaveBeenCalled();
});

test('an existing selection toggles instead of opening', () => {
	const { onClick, selection } = setup({}, [1]);

	onClick({ item: { id: 2 }, event: click() });

	expect(selection.value).toEqual([1, 2]);
	expect(router.push).not.toHaveBeenCalled();
});

test('readonly or no primary key field does nothing', () => {
	const readonly = setup({ readonly: true, selectMode: true });
	readonly.onClick({ item: { id: 3 }, event: click() });
	expect(readonly.selection.value).toEqual([]);

	const noPk = setup();
	noPk.primaryKeyField.value = null as unknown as Field;
	noPk.onClick({ item: { id: 3 }, event: click() });

	expect(router.push).not.toHaveBeenCalled();
});
