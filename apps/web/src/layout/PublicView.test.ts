import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import logoDark from '../assets/logo-dark.svg';
import logoLight from '../assets/logo-light.svg';
import { i18n } from '../lang/index.ts';
import { type Info, useServerStore } from '../stores/server.ts';
import PublicView from './PublicView.vue';

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => vi.unstubAllGlobals());

function project(values: Partial<NonNullable<Info['project']>>) {
	useServerStore().info.project = values as NonNullable<Info['project']>;
}

function mountView() {
	return mount(PublicView, {
		global: { plugins: [i18n] },
		slots: { default: '<p data-testid="content">form</p>', notice: '<span data-testid="notice">notice</span>' },
	});
}

function stubReducedMotion(matches: boolean) {
	vi.stubGlobal(
		'matchMedia',
		vi.fn((media: string) => ({ matches, media, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
	);
}

describe('PublicView', () => {
	test('no project (FR-037): Backoffice logos for light and dark, default name and descriptor, token pattern', () => {
		const wrapper = mountView();
		const images = wrapper.get('[data-testid="public-title"]').findAll('img');

		expect(images).toHaveLength(2);
		expect(images[0]!.attributes('src')).toBe(logoLight);
		expect(images[0]!.classes()).toContain('dark:hidden');
		expect(images[1]!.attributes('src')).toBe(logoDark);
		expect(images[1]!.classes()).toEqual(expect.arrayContaining(['hidden', 'dark:block']));
		expect(images[0]!.attributes('alt')).toBe('Backoffice');
		expect(wrapper.text()).toContain('Backoffice');
		expect(wrapper.text()).toContain('Application');
		expect(wrapper.find('[data-testid="content"]').exists()).toBe(true);
		expect(wrapper.find('[data-testid="notice"]').exists()).toBe(true);
		expect(wrapper.find('video').exists()).toBe(false);
		expect(wrapper.find('[data-testid="public-note"]').exists()).toBe(false);
	});

	test('project without logo: Backoffice logo with the project name as alt, on the project color box', () => {
		project({ project_name: 'Acme', project_descriptor: 'Admin', project_color: 'red', project_logo: null });
		const wrapper = mountView();
		const title = wrapper.get('[data-testid="public-title"]');

		expect(title.findAll('img').map((img) => img.attributes('alt'))).toEqual(['Acme', 'Acme']);
		expect(title.find('.bg-project').exists()).toBe(true);
		expect(title.text()).toContain('Acme');
		expect(title.text()).toContain('Admin');
	});

	test('project_logo: one image from /assets', () => {
		project({ project_name: 'Acme', project_logo: 'logo-id' });
		const images = mountView().get('[data-testid="public-title"]').findAll('img');

		expect(images).toHaveLength(1);
		expect(images[0]!.attributes('src')).toMatch(/\/assets\/logo-id$/);
		expect(images[0]!.attributes('alt')).toBe('Acme');
	});

	test('public_note is markdown with dangerous HTML removed', () => {
		project({ public_note: '**Hi** <img src=x onerror="alert(1)"><script>alert(2)</script>' });
		const note = mountView().get('[data-testid="public-note"]');

		expect(note.find('strong').text()).toBe('Hi');
		expect(note.html()).not.toContain('onerror');
		expect(note.html()).not.toContain('<script');
	});

	test('image background and foreground', () => {
		project({ project_name: 'Acme', public_background: { id: 'bg', type: 'image/png' }, public_foreground: 'fg' });
		const wrapper = mountView();
		const art = wrapper.get('[data-testid="public-art"]');

		expect(art.attributes('style')).toContain('/assets/bg');
		expect(art.find('video').exists()).toBe(false);
		expect(art.get('img').attributes('src')).toMatch(/\/assets\/fg$/);
	});

	test('video background autoplays muted, looped and inline', () => {
		stubReducedMotion(false);
		project({ public_background: { id: 'bg', type: 'video/mp4' } });
		const wrapper = mountView();
		const video = wrapper.get('video');
		const element = video.element as HTMLVideoElement;

		expect(video.attributes('src')).toMatch(/\/assets\/bg$/);
		expect(element.autoplay).toBe(true);
		expect(element.muted).toBe(true);
		expect(element.loop).toBe(true);
		expect(video.attributes()).toHaveProperty('playsinline');
		expect(wrapper.find('button').exists()).toBe(false);
	});

	test('reduced motion (D-50): no autoplay, a labelled play button starts the video', async () => {
		stubReducedMotion(true);
		project({ public_background: { id: 'bg', type: 'video/mp4' } });
		const wrapper = mountView();
		const element = wrapper.get('video').element as HTMLVideoElement;
		const play = vi.spyOn(element, 'play').mockResolvedValue();

		expect(element.autoplay).toBe(false);

		const button = wrapper.get('button');
		expect(button.attributes('aria-label')).toBe('Play background video');

		await button.trigger('click');

		expect(play).toHaveBeenCalled();
		expect(wrapper.find('button').exists()).toBe(false);
	});
});
