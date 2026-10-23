import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test } from 'vitest';
import '../styles/index.css';
import BoNotice from './BoNotice.vue';

// With the app CSS (D-178): a one-line notice in a form field is as high as an input (h-11), like the DR v-notice, so it
// lines up with a select beside it; outside a field it keeps the TailAdmin Alert padding.
enableAutoUnmount(afterEach);

const height = (parent: HTMLElement) => {
	mount(BoNotice, { props: { type: 'normal' }, slots: { default: 'Select a Collection' }, attachTo: parent });
	return parent.firstElementChild!.getBoundingClientRect().height;
};

test('in a form field interface slot a one-line notice is 44px high, elsewhere taller', () => {
	const field = document.body.appendChild(document.createElement('div'));
	field.setAttribute('data-interface', '');
	field.style.width = '300px';
	const page = document.body.appendChild(document.createElement('div'));
	page.style.width = '300px';

	expect(height(field)).toBe(44);
	expect(height(page)).toBeGreaterThan(44);
	field.remove();
	page.remove();
});
