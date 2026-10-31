// The count line of the layout actions is screen reader only below `sm` and visible from `sm` (FR-115b). A `.sr-only`
// of base.css in the utilities layer came after `sm:not-sr-only` and hid it at every width (owner 2026-10-31).
import { page } from '@vitest/browser/context';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test } from 'vitest';
import { i18n } from '../lang/index.ts';
import '../styles/index.css';
import CalendarActions from './calendar/CalendarActions.vue';
import CardsActions from './cards/CardsActions.vue';
import KanbanActions from './kanban/KanbanActions.vue';
import MapActions from './map/MapActions.vue';
import TabularActions from './tabular/TabularActions.vue';

enableAutoUnmount(afterEach);

const ACTIONS = { CalendarActions, CardsActions, KanbanActions, MapActions, TabularActions };

test.each(Object.entries(ACTIONS))('%s shows the count from sm and hides it below', async (_name, component) => {
	mount(component, {
		props: { showingCount: '1-25 of 60 Items' },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
	const count = document.body.querySelector<HTMLElement>('[role="status"]')!;
	expect(count.textContent).toContain('1-25 of 60 Items');

	await page.viewport(1024, 768);
	expect(count.getBoundingClientRect().width).toBeGreaterThan(20);

	await page.viewport(414, 896);
	expect(count.getBoundingClientRect().width).toBeLessThanOrEqual(1);
});
