import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test } from 'vitest';
import { h } from 'vue';
import DisplayRating from '../displays/rating/DisplayRating.vue';
import { i18n } from '../lang/index.ts';
import '../styles/index.css';
import BoTable from './BoTable.vue';

enableAutoUnmount(afterEach);

test('rating stars of scrolled rows stay under the sticky header', async () => {
	const rows = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, rating: 5 }));
	mount(
		{
			render: () =>
				h('div', { style: 'height: 300px; display: flex; flex-direction: column' }, [
					h(
						BoTable,
						{ columns: [{ key: 'rating', label: 'Rating', width: 200 }], rows, fixedHeader: true },
						{ 'item.rating': ({ item }: any) => h(DisplayRating, { value: item.rating }) },
					),
				]),
		},
		{ global: { plugins: [i18n] }, attachTo: document.body },
	);

	const scroller = document.querySelector<HTMLElement>('[data-fixed-header]')!;
	const thead = document.querySelector('thead')!;
	let checked = 0;

	// Every scroll offset puts some row under the header; the point on a star there must hit the header.
	for (let top = 0; top <= 400; top += 7) {
		scroller.scrollTop = top;
		await new Promise((resolve) => requestAnimationFrame(resolve));
		const head = thead.getBoundingClientRect();

		for (const star of document.querySelectorAll('.rating .active i, .rating .active span, .rating .active svg')) {
			const r = star.getBoundingClientRect();
			const y = r.top + r.height / 2;
			if (r.width === 0 || y <= head.top + 1 || y >= head.bottom - 1) continue;
			checked++;
			expect(document.elementFromPoint(r.left + r.width / 2, y)?.closest('thead')).not.toBeNull();
		}
	}

	expect(checked).toBeGreaterThan(0);
});
