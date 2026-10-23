import { page } from '@vitest/browser/context';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import '../../styles/index.css';
import InputCode from './InputCode.vue';

// Layout guards of the code editor with the app CSS (component-specs EditorFrame, Height): a long value never renders
// every line (201dffaa: 62k lines of the Schema Management "Show code" froze the page) and, in an extension dialog
// card, the editor keeps to the card so only one scrollbar shows (D-175).
enableAutoUnmount(afterEach);

const LONG = JSON.stringify(
	Array.from({ length: 3000 }, (_, i) => ({ collection: `c${i}` })),
	null,
	4,
);

async function mountIn(parent: HTMLElement) {
	const wrapper = mount(InputCode, {
		props: { value: LONG, type: 'json', language: 'JSON' },
		global: { plugins: [i18n] },
		attachTo: parent,
	});
	await vi.waitFor(() => expect(document.querySelector('.CodeMirror-code')).not.toBeNull());
	return wrapper;
}

test('a long value keeps CodeMirror line virtualization (56.25rem at most)', async () => {
	const host = document.body.appendChild(document.createElement('div'));
	await mountIn(host);

	const editor = document.querySelector<HTMLElement>('.CodeMirror')!;
	expect(editor.getBoundingClientRect().height).toBeLessThanOrEqual(56.25 * 16 + 1);
	expect(document.querySelectorAll('.CodeMirror-code > div').length).toBeLessThan(200);
	host.remove();
});

test('in a dialog card the editor keeps to the card: the card does not scroll (D-175)', async () => {
	// A screen lower than the 56.25rem editor; the shim structure of an extension dialog: v-dialog-body > v-card (90vh,
	// scrolls) > title, text, actions.
	await page.viewport(1280, 600);
	const body = document.body.appendChild(document.createElement('div'));
	body.className = 'v-dialog-body relative flex';
	body.innerHTML =
		'<div class="v-card max-h-[90vh] overflow-auto"><div style="height:56px">Schema</div><div class="v-card-text px-6 pb-3"></div><div style="height:68px">Close</div></div>';
	await mountIn(body.querySelector<HTMLElement>('.v-card-text')!);

	const card = body.querySelector<HTMLElement>('.v-card')!;
	expect(card.scrollHeight).toBeLessThanOrEqual(card.clientHeight + 1);
	expect(document.querySelector('.CodeMirror')!.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
	body.remove();
});
