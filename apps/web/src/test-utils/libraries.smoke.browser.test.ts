// Feature 014 (T002, research R1): the libraries of the Content module load in the browser build and the calendar
// variables can be set from the theme.
import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import { afterEach, expect, test } from 'vitest';

let host: HTMLElement | null = null;

afterEach(() => {
	host?.remove();
	host = null;
});

test('@directus/vue-split-panel loads as an ES module', async () => {
	const module = await import('@directus/vue-split-panel');

	expect(module.SplitPanel).toBeTruthy();
});

test('json-to-graphql-query builds the query of saveAsCopy', () => {
	const query = jsonToGraphQLQuery({ query: { item: { __aliasFor: 'articles_by_id', __args: { id: 1 }, id: true } } });

	expect(query).toBe('query { item: articles_by_id (id: 1) { id } }');
});

test('FullCalendar variables set on .fc override the :root defaults it injects', () => {
	host = document.createElement('div');
	host.style.setProperty('--fc-border-color', 'rgb(1, 2, 3)');
	document.body.append(host);

	const calendar = new Calendar(host, { plugins: [dayGridPlugin], initialView: 'dayGridMonth' });
	calendar.render();

	const cell = host.querySelector('.fc-scrollgrid')!;

	expect(getComputedStyle(cell).borderTopColor).toBe('rgb(1, 2, 3)');
	calendar.destroy();
});
