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

// Feature 015 (T005, research R1): the image editor and resumable uploads load in the browser build.
test('cropperjs 1.6.2 starts on an image with the Directus options and default data', async () => {
	const { default: Cropper } = await import('cropperjs');
	await import('cropperjs/dist/cropper.css');

	host = document.createElement('div');
	host.style.width = '200px';
	host.style.height = '200px';
	document.body.append(host);

	const image = document.createElement('img');
	// 2 × 2 transparent PNG.
	image.src =
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGNgYGD4z8DAwMDAAAAGBQEBk0PW5QAAAABJRU5ErkJggg==';
	host.append(image);
	await image.decode();

	const cropper = await new Promise<InstanceType<typeof Cropper>>((resolve) => {
		const instance: InstanceType<typeof Cropper> = new Cropper(image, {
			autoCrop: false,
			autoCropArea: 0.5,
			toggleDragModeOnDblclick: false,
			dragMode: 'move',
			viewMode: 1,
			ready: () => resolve(instance),
		});
	});

	expect(cropper.getData()).toEqual({ x: 0, y: 0, width: 0, height: 0, rotate: 0, scaleX: 1, scaleY: 1 });
	expect(host.querySelector('.cropper-container')).toBeTruthy();
	cropper.destroy();
});

test('tus-js-client builds an upload without sending a request', async () => {
	const { Upload } = await import('tus-js-client');
	const upload = new Upload(new File(['x'], 'x.txt', { type: 'text/plain' }), {
		endpoint: 'http://127.0.0.1:1/files/tus',
		metadata: { filename_download: 'x.txt', type: 'text/plain' },
	});

	expect(upload.options.metadata).toEqual({ filename_download: 'x.txt', type: 'text/plain' });
});
