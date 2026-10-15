// Ported from directus/app/src/views/private/components/search-input.test.ts
// Backoffice: real Pinia instead of @pinia/testing; buttons instead of v-icon stubs (same `icon-*` classes); SystemFilter
// is stubbed; a portaled Reka layer (`data-reka-popper-content-wrapper`) plays the `.v-menu-content` part.
import { DOMWrapper, enableAutoUnmount, mount, VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '../lang/index.ts';
import SearchInput from './SearchInput.vue';

vi.mock('../interfaces/_system/system-filter/SystemFilter.vue', () => ({
	default: {
		name: 'SystemFilter',
		props: ['value', 'collectionName', 'inline'],
		template: '<div class="system-filter" />',
	},
}));

enableAutoUnmount(afterEach);

const global = { plugins: [i18n, createPinia()] };

describe('Component', () => {
	it('should mount', () => {
		const wrapper = mount(SearchInput, {
			props: {
				modelValue: '',
			},
			global,
		});

		expect(wrapper.exists()).toBe(true);
	});

	it('should render action buttons disabled when disabled', () => {
		const wrapper = mount(SearchInput, {
			props: {
				modelValue: 'test',
				disabled: true,
			},
			global,
		});

		expect(wrapper.find('.search-input').classes()).toContain('disabled');

		expect(wrapper.find('.icon-search').attributes('disabled')).toBeDefined();
		expect(wrapper.find('.icon-filter').attributes('disabled')).toBeDefined();
		expect(wrapper.find('.icon-clear').attributes('disabled')).toBeDefined();

		expect(wrapper.find('input').attributes('disabled')).toBe('');
	});

	describe('focusout behavior', () => {
		let wrapper: VueWrapper;
		let search: DOMWrapper<Element>;

		beforeEach(async () => {
			wrapper = mount(SearchInput, {
				props: {
					modelValue: 'test',
				},
				global,
				attachTo: document.body,
			});

			search = wrapper.find('.search-input');

			await search.trigger('click');
			await wrapper.find('.icon-filter').trigger('click');

			expect(search.classes()).toContain('active');
			expect(search.classes()).toContain('filter-active');
		});

		describe('when focus moves outside the search area', () => {
			let outside: HTMLButtonElement;
			let descendant: HTMLButtonElement;

			beforeEach(() => {
				outside = document.createElement('button');
				document.body.appendChild(outside);

				descendant = document.createElement('button');
				search.element.appendChild(descendant);
			});

			afterEach(() => {
				document.body.removeChild(outside);
				descendant.remove();
			});

			it('should close on keyboard focusout even when filter is active', async () => {
				wrapper
					.find('input')
					.element.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));

				await wrapper.vm.$nextTick();

				expect(search.classes()).not.toContain('active');
				expect(search.classes()).not.toContain('filter-active');
			});

			it('should close when focusout target is outside the search area', async () => {
				descendant.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
				await wrapper.vm.$nextTick();

				expect(search.classes()).not.toContain('active');
				expect(search.classes()).not.toContain('filter-active');
			});

			it('should stay open when focusout has no relatedTarget while filter is active (drag operation)', async () => {
				wrapper.find('input').element.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));

				await wrapper.vm.$nextTick();

				expect(search.classes()).toContain('active');
				expect(search.classes()).toContain('filter-active');
			});
		});

		describe('when focus moves into a menu layer', () => {
			let menuContent: HTMLDivElement;
			let menuTarget: HTMLButtonElement;

			beforeEach(() => {
				menuContent = document.createElement('div');
				menuContent.setAttribute('data-reka-popper-content-wrapper', '');
				document.body.appendChild(menuContent);

				menuTarget = document.createElement('button');
				menuContent.appendChild(menuTarget);
			});

			afterEach(() => {
				document.body.removeChild(menuContent);
			});

			it('should stay open when focus moves into a menu layer', async () => {
				wrapper
					.find('input')
					.element.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: menuTarget }));

				await wrapper.vm.$nextTick();

				expect(search.classes()).toContain('active');
				expect(search.classes()).toContain('filter-active');
			});
		});
	});
});

// Backoffice: the count badge, the clear button and the emitted values.
describe('Backoffice', () => {
	it('counts the filter operators of every level', () => {
		const wrapper = mount(SearchInput, {
			props: {
				modelValue: null,
				filter: { _and: [{ title: { _contains: 'a' } }, { _or: [{ status: { _eq: 'draft' } }, { id: { _gt: 3 } }] }] },
			},
			global,
		});

		expect(wrapper.find('.icon-filter').text()).toBe('filter_list3');
	});

	it('emits the typed value and null on clear', async () => {
		const wrapper = mount(SearchInput, { props: { modelValue: 'ab' }, global });

		await wrapper.find('input').setValue('abc');
		await wrapper.find('.icon-clear').trigger('click');

		expect(wrapper.emitted('update:modelValue')).toEqual([['abc'], [null]]);
	});
});
