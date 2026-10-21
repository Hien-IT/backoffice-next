import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import VHighlight from './VHighlight.vue';

const marks = (props: Record<string, unknown>) =>
	mount(VHighlight, { props })
		.findAll('mark')
		.map((mark) => mark.text());

test('marks every match ignoring case and diacritics, merges overlaps, keeps the text', () => {
	const wrapper = mount(VHighlight, { props: { text: 'Crème brûlée', query: 'cre' } });

	expect(wrapper.text()).toBe('Crème brûlée');
	expect(wrapper.get('mark').text()).toBe('Crè');
	expect(marks({ text: 'banana', query: ['ana', 'nan'] })).toEqual(['anana']);
	expect(marks({ text: 'a,b', query: 'a,b' })).toEqual(['a', 'b']);
	expect(marks({ text: 'plain', query: null })).toEqual([]);
	expect(marks({ text: 'plain', query: 'x' })).toEqual([]);
});
