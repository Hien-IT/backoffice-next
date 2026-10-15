import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import BoInfo from './BoInfo.vue';

test('title as h2, icon box colored by type, copy and append slots', () => {
	const wrapper = mount(BoInfo, {
		props: { title: 'No Results', icon: 'search', type: 'danger' },
		slots: { default: 'Nothing matches', append: '<button>Clear</button>' },
	});

	expect(wrapper.get('h2').text()).toBe('No Results');
	expect(wrapper.get('p').text()).toBe('Nothing matches');
	expect(wrapper.get('h2').element.previousElementSibling?.className).toContain('bg-error-50');
	expect(wrapper.get('button').text()).toBe('Clear');
});

test('no icon, no copy, no append by default', () => {
	const wrapper = mount(BoInfo, { props: { title: 'Empty' } });

	expect(wrapper.findAll('div')).toHaveLength(1);
	expect(wrapper.find('p').exists()).toBe(false);
});
