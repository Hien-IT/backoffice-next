// Keyboard of input-rich-text-md in chromium (FR-094): one Tab stop for the toolbar, arrows move, Enter runs a
// button (the edit/preview switch is part of the same toolbar), typing and the Ctrl/Cmd shortcuts edit the markdown.
import { userEvent } from '@vitest/browser/context';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { expect, test, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import InputRichTextMd from './InputRichTextMd.vue';

test('toolbar roving focus, typing, a toolbar button and a shortcut without the mouse', async () => {
	const wrapper = mount(InputRichTextMd, {
		props: { value: '', toolbar: ['bold', 'italic'] },
		global: { plugins: [i18n, createPinia()], stubs: { DrawerFiles: true } },
		attachTo: document.body,
	});
	await vi.waitFor(() => expect(wrapper.find('.CodeMirror').exists()).toBe(true));
	await flushPromises();

	const bold = wrapper.get('[data-toolbar="bold"]').element;
	const italic = wrapper.get('[data-toolbar="italic"]').element;

	await userEvent.tab();
	expect(document.activeElement).toBe(bold);
	await userEvent.keyboard('{ArrowRight}');
	expect(document.activeElement).toBe(italic);
	await userEvent.keyboard('{ArrowRight}');
	expect(document.activeElement?.textContent?.trim()).toBe('Edit');
	await userEvent.keyboard('{ArrowLeft}');

	// Enter runs the button and moves focus into the editor (applyEdit focuses CodeMirror).
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(wrapper.emitted('input')?.at(-1)).toEqual(['**']));
	expect(wrapper.get('.CodeMirror').element.contains(document.activeElement)).toBe(true);

	await userEvent.keyboard('word');
	await vi.waitFor(() => expect(wrapper.emitted('input')?.at(-1)).toEqual(['*word*']));

	// Select "word" first so the result does not depend on the platform's caret keys, then Ctrl (Cmd on macOS) + B.
	await userEvent.keyboard('{Shift>}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{/Shift}');
	await userEvent.keyboard('{ControlOrMeta>}b{/ControlOrMeta}');
	await vi.waitFor(() => expect(wrapper.emitted('input')?.at(-1)).toEqual(['***word***']));

	wrapper.unmount();
});
