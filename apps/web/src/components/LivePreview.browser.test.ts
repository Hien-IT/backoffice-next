import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import axe from 'axe-core';
import { afterEach, expect, test } from 'vitest';
import { h } from 'vue';
import { i18n } from '../lang/index.ts';
import '../styles/index.css';
import LivePreview from './LivePreview.vue';
import SplitPanel from './SplitPanel.vue';

enableAutoUnmount(afterEach);

const global = { plugins: [i18n] };

function host(width: number) {
	const el = document.createElement('div');
	el.style.cssText = `width: ${width}px; height: 500px`;
	document.body.append(el);
	return el;
}

async function serious(el: Element) {
	const { violations } = await axe.run(el, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] });
	return violations
		.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		.map((v) => `${v.id} ${v.nodes.map((n) => n.html + n.failureSummary).join('|')}`);
}

test('split panel with the live preview: keyboard resize, display menu, axe light and dark', async () => {
	const wrapper = mount(SplitPanel, {
		attachTo: host(1000),
		props: { size: 50, minSize: 20, maxSize: 80, label: 'Live Website Preview' },
		slots: {
			start: () => h('p', 'Form'),
			end: () => h(LivePreview, { url: 'about:blank', displayOptions: [{ text: 'Full Width', icon: 'width_full' }] }),
		},
		global,
	});
	const divider = wrapper.get('[role="separator"]').element as HTMLElement;
	const end = wrapper.get('.sp-end').element as HTMLElement;

	expect(end.getBoundingClientRect().width).toBeGreaterThan(450);

	divider.focus();
	await userEvent.keyboard('{ArrowLeft}');
	expect(wrapper.emitted('update:size')).toEqual([[55]]);
	await wrapper.setProps({ size: 55 });
	expect(end.getBoundingClientRect().width).toBeGreaterThan(530);

	await userEvent.click(wrapper.get('button[aria-label="Display Options"]').element);
	expect(document.body.textContent).toContain('Open in New Window');
	await userEvent.keyboard('{Escape}');

	// BoButton colors have a 150 ms transition: axe must read the final colors, also on a loaded machine.
	const noTransitions = document.head.appendChild(document.createElement('style'));
	noTransitions.textContent = '*, *::before, *::after { transition: none !important; }';
	try {
		expect(await serious(wrapper.element)).toEqual([]);
		document.documentElement.classList.add('dark');
		expect(await serious(wrapper.element)).toEqual([]);
	} finally {
		document.documentElement.classList.remove('dark');
		noTransitions.remove();
	}
});

test('narrow frame: the size block hides while full frame, the left group hides while sized', async () => {
	const wrapper = mount(LivePreview, { attachTo: host(400), props: { url: 'about:blank' }, global });
	const dimensions = () => wrapper.get('[data-dimensions]').element as HTMLElement;
	const url = () => wrapper.get('[data-url]').element as HTMLElement;

	expect(getComputedStyle(dimensions()).display).toBe('none');
	expect(url().checkVisibility()).toBe(true);

	await wrapper.get('button[aria-label="Change Display Dimensions"]').trigger('click');

	expect(getComputedStyle(dimensions()).display).toBe('flex');
	expect(url().checkVisibility()).toBe(false);
});
