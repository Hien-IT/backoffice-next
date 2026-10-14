// Ported from directus/app/src/interfaces/list-o2m/list-o2m.test.ts
// Backoffice: mounted with the Bo* stubs of our template: BoRemove for v-remove, BoTable (its `item.$actions` cell is
// the v-table `item-append` slot, `update:columns` with { key, width } its `update:headers`), BoSortableList for
// vuedraggable; the pinia stores are real (no @pinia/testing). Fixture, option and permission tests are in
// ListO2M.test.ts.
import type { Field, Relation } from '@directus/types';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';
import { i18n } from '../../lang/index.ts';
import type { Collection } from '../../stores/collections.ts';
import ListO2M from './ListO2M.vue';

vi.mock('../../composables/use-relation-o2m.ts', () => ({
	useRelationO2M: () => ({
		relationInfo: computed(() => ({
			relation: {
				collection: 'related-collection',
				field: 'parent_id',
				related_collection: 'test-collection',
				schema: null,
				meta: null,
			} as Relation,
			relatedCollection: {
				collection: 'related-collection',
			} as Collection,
			relatedPrimaryKeyField: { field: 'id' } as Field,
			reverseJunctionField: { field: 'parent_id' } as Field,
			type: 'o2m',
		})),
	}),
}));

vi.mock('../../composables/use-relation-permissions.ts', () => ({
	useRelationPermissionsO2M: () => ({
		createAllowed: computed(() => true),
		updateAllowed: computed(() => true),
		deleteAllowed: computed(() => true),
	}),
}));

const mockGetField = vi.hoisted(() => vi.fn(() => null as any));
const mockGetWidth = vi.hoisted(() => vi.fn((_key: string, defaultWidth: number) => defaultWidth));
const mockUpdateWidths = vi.hoisted(() => vi.fn());

vi.mock('./use-column-widths.ts', () => ({
	useColumnWidths: () => ({ getWidth: mockGetWidth, updateWidths: mockUpdateWidths }),
}));

vi.mock('../../stores/fields.ts', () => ({
	useFieldsStore: () => ({
		getFieldsForCollection: vi.fn(() => []),
		getField: mockGetField,
		getPrimaryKeyFieldForCollection: vi.fn(() => ({ field: 'id' })),
	}),
}));

vi.mock('../../composables/use-relation-multiple.ts', () => ({
	useRelationMultiple: () => ({
		create: vi.fn(),
		update: vi.fn(),
		remove: vi.fn(),
		select: vi.fn(),
		displayItems: ref([{ id: '1', $type: 'existingItem', $index: 0, $edits: 0 }]),
		totalItemCount: ref(1),
		loading: ref(false),
		selected: ref([]),
		fetchedSelectItems: ref([]),
		fetchedItems: ref([]),
		useActions: vi.fn(() => ({
			cleanItem: vi.fn((item: any) => item),
			getPage: vi.fn(),
			isLocalItem: vi.fn(() => false),
			getItemEdits: vi.fn(() => 0),
			isEmpty: vi.fn(() => false),
		})),
		cleanItem: vi.fn((item: any) => item),
		isItemSelected: vi.fn(() => false),
		isLocalItem: vi.fn(() => false),
		// Backoffice: an object (Directus returns 0), the BoRemove stub checks the itemEdits prop type.
		getItemEdits: vi.fn(() => ({})),
	}),
}));

afterEach(() => {
	vi.clearAllMocks();
});

const global = {
	stubs: {
		BoIcon: true,
		BoNotice: true,
		BoRemove: true,
		BoButton: true,
		BoSelect: true,
		BoInput: true,
		BoMenu: true,
		BoTable: true,
		DrawerBatch: true,
		DrawerCollection: true,
		DrawerItem: true,
		RenderTemplate: true,
		RouterLink: true,
		BoSortableList: {
			template: '<div><slot v-for="element in modelValue" name="item" :element="element" /></div>',
			props: ['modelValue'],
		},
	},
	plugins: [i18n, createPinia()],
};

const routerLinkStub = {
	template: '<a class="router-link-stub" href="/test"><slot /></a>',
};

const globalWithRouterLink = {
	...global,
	stubs: { ...global.stubs, RouterLink: routerLinkStub },
};

const tableGlobal = {
	...global,
	stubs: {
		...global.stubs,
		BoTable: {
			template: '<div class="v-table"><slot v-for="item in rows" name="item.$actions" :item="item" /></div>',
			props: ['rows'],
		},
	},
};

const tableGlobalWithRouterLink = {
	...tableGlobal,
	stubs: { ...tableGlobal.stubs, RouterLink: routerLinkStub },
};

const tableGlobalWithHeaderEmit = {
	...global,
	stubs: {
		...global.stubs,
		BoTable: {
			name: 'BoTable',
			template: '<div class="v-table" />',
			props: ['modelValue', 'columns', 'rows'],
			emits: ['update:columns'],
		},
	},
};

const listProps = {
	primaryKey: '1',
	collection: 'test-collection',
	field: 'test-field',
	width: 'full',
	version: null,
};

describe('list-o2m', () => {
	it('should mount', () => {
		const wrapper = mount(ListO2M, {
			props: listProps,
			global,
		});

		expect(wrapper.exists()).toBe(true);
	});

	describe('list layout', () => {
		describe('non-editable state', () => {
			it('should show item-actions with navigate link when nonEditable and enableLink are true', () => {
				const wrapper = mount(ListO2M, {
					props: { ...listProps, enableLink: true, nonEditable: true, disabled: true },
					global,
				});

				expect(wrapper.find('.item-actions').exists()).toBe(true);
				expect(wrapper.find('.item-actions router-link-stub').exists()).toBe(true);
			});

			it('should hide item-actions when nonEditable is true and enableLink is false', () => {
				const wrapper = mount(ListO2M, {
					props: { ...listProps, enableLink: false, nonEditable: true, disabled: true },
					global,
				});

				expect(wrapper.find('.item-actions').exists()).toBe(false);
			});

			it('should hide remove button when nonEditable is true', () => {
				const wrapper = mount(ListO2M, {
					props: { ...listProps, enableLink: true, nonEditable: true, disabled: true },
					global,
				});

				expect(wrapper.find('.item-actions bo-remove-stub').exists()).toBe(false);
			});

			it('should render clickable navigate link when nonEditable and disabled are both true', () => {
				const wrapper = mount(ListO2M, {
					props: { ...listProps, enableLink: true, nonEditable: true, disabled: true },
					global: globalWithRouterLink,
				});

				expect(wrapper.find('.item-actions .item-link').exists()).toBe(true);
			});

			it('should render non-clickable icon when disabled is true and nonEditable is false', () => {
				const wrapper = mount(ListO2M, {
					props: { ...listProps, enableLink: true, nonEditable: false, disabled: true },
					global: globalWithRouterLink,
				});

				expect(wrapper.find('.item-actions .item-link').exists()).toBe(false);
			});
		});

		describe('disabled state', () => {
			it('should render action buttons disabled when disabled is true', () => {
				const wrapper = mount(ListO2M, {
					props: { ...listProps, disabled: true },
					global,
				});

				expect(wrapper.find('.item-actions bo-remove-stub').exists()).toBe(true);
				expect(wrapper.find('.item-actions bo-remove-stub').attributes('disabled')).toBe('true');
			});
		});

		describe('editable state', () => {
			it('should show remove button when nonEditable is false', () => {
				const wrapper = mount(ListO2M, {
					props: { ...listProps, enableLink: true, nonEditable: false, disabled: false },
					global,
				});

				expect(wrapper.find('.item-actions').exists()).toBe(true);
				expect(wrapper.find('.item-actions bo-remove-stub').exists()).toBe(true);
			});
		});
	});

	describe('table layout', () => {
		describe('non-editable state', () => {
			it('should show item-actions with navigate link when nonEditable and enableLink are true', () => {
				const wrapper = mount(ListO2M, {
					props: { ...listProps, layout: 'table', enableLink: true, nonEditable: true, disabled: true },
					global: tableGlobal,
				});

				expect(wrapper.find('.item-actions').exists()).toBe(true);
				expect(wrapper.find('.item-actions router-link-stub').exists()).toBe(true);
			});

			it('should hide remove button when nonEditable is true', () => {
				const wrapper = mount(ListO2M, {
					props: { ...listProps, layout: 'table', enableLink: true, nonEditable: true, disabled: true },
					global: tableGlobal,
				});

				expect(wrapper.find('.item-actions bo-remove-stub').exists()).toBe(false);
			});

			it('should render clickable navigate link when nonEditable and disabled are both true', () => {
				const wrapper = mount(ListO2M, {
					props: { ...listProps, layout: 'table', enableLink: true, nonEditable: true, disabled: true },
					global: tableGlobalWithRouterLink,
				});

				expect(wrapper.find('.item-actions .item-link').exists()).toBe(true);
			});

			it('should render non-clickable icon when disabled is true and nonEditable is false', () => {
				const wrapper = mount(ListO2M, {
					props: { ...listProps, layout: 'table', enableLink: true, nonEditable: false, disabled: true },
					global: tableGlobalWithRouterLink,
				});

				expect(wrapper.find('.item-actions .item-link').exists()).toBe(false);
			});
		});

		describe('disabled state', () => {
			it('should render action buttons disabled when disabled is true', () => {
				const wrapper = mount(ListO2M, {
					props: { ...listProps, layout: 'table', disabled: true },
					global: tableGlobal,
				});

				expect(wrapper.find('.item-actions bo-remove-stub').exists()).toBe(true);
				expect(wrapper.find('.item-actions bo-remove-stub').attributes('disabled')).toBe('true');
			});
		});

		describe('editable state', () => {
			it('should show remove button when nonEditable is false', () => {
				const wrapper = mount(ListO2M, {
					props: { ...listProps, layout: 'table', enableLink: true, nonEditable: false, disabled: false },
					global: tableGlobal,
				});

				expect(wrapper.find('.item-actions').exists()).toBe(true);
				expect(wrapper.find('.item-actions bo-remove-stub').exists()).toBe(true);
			});
		});

		describe('column width persistence', () => {
			beforeEach(() => {
				mockGetField.mockReset();
				mockGetWidth.mockImplementation((_key: string, defaultWidth: number) => defaultWidth);
				mockUpdateWidths.mockReset();
			});

			it('only calls updateWidths for columns whose width changed', async () => {
				mockGetField.mockReturnValue({ name: 'Name', type: 'string', field: 'name' } as any);
				// getWidth returns 144 (default), so any other value counts as a resize
				mockGetWidth.mockReturnValue(144);

				const wrapper = mount(ListO2M, {
					props: { ...listProps, layout: 'table', fields: ['name'] },
					global: tableGlobalWithHeaderEmit,
				});

				const vTable = wrapper.findComponent({ name: 'BoTable' });

				// Emit a resize: 'name' changes to 250, different from stored 144
				await vTable.vm.$emit('update:columns', [{ label: 'Name', key: 'name', width: 250 }]);
				expect(mockUpdateWidths).toHaveBeenCalledWith([{ value: 'name', width: 250 }]);
			});

			it('does not call updateWidths when no width changed', async () => {
				mockGetField.mockReturnValue({ name: 'Name', type: 'string', field: 'name' } as any);
				mockGetWidth.mockReturnValue(144);

				const wrapper = mount(ListO2M, {
					props: { ...listProps, layout: 'table', fields: ['name'] },
					global: tableGlobalWithHeaderEmit,
				});

				const vTable = wrapper.findComponent({ name: 'BoTable' });

				// Emit same width as currently rendered — no actual resize
				await vTable.vm.$emit('update:columns', [{ label: 'Name', key: 'name', width: 144 }]);
				expect(mockUpdateWidths).not.toHaveBeenCalled();
			});

			it('uses getWidth to restore stored column widths on mount', async () => {
				mockGetField.mockReturnValue({ name: 'Name', type: 'string', field: 'name' } as any);
				mockGetWidth.mockReturnValue(300); // simulate a stored width of 300

				const wrapper = mount(ListO2M, {
					props: { ...listProps, layout: 'table', fields: ['name'] },
					global: tableGlobalWithHeaderEmit,
				});

				const vTable = wrapper.findComponent({ name: 'BoTable' });
				const headers = vTable.props('columns') as Array<{ key: string; width: number }>;
				expect(headers?.find((h) => h.key === 'name')?.width).toBe(300);
			});
		});
	});
});
