import { createHead, useHead } from '@unhead/vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, nextTick } from 'vue';
import { createSdk } from '../api/sdk.ts';
import { useServerStore } from '../stores/server.ts';
import { useUserStore } from '../stores/user.ts';
import { safeColor, useAppHead } from './use-app-head.ts';

vi.mock('../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

beforeEach(() => {
	setActivePinia(createPinia());
	createSdk('http://api.test/');
});

async function resolve(project: Record<string, unknown> | null, pageTitle?: string) {
	useServerStore().info.project = project as never;
	const head = createHead();

	mount(
		defineComponent({
			setup() {
				useAppHead();
				if (pageTitle) useHead({ title: pageTitle });
				return () => null;
			},
		}),
		{ global: { plugins: [head] } },
	);

	await nextTick();
	const tags = await head.resolveTags();
	const find = (tag: string, key: string, value: string) =>
		tags.find((t) => t.tag === tag && (t.props as Record<string, string>)[key] === value);

	return {
		title: tags.find((t) => t.tag === 'title')?.textContent,
		themeColor: (find('meta', 'name', 'theme-color')?.props as Record<string, string> | undefined)?.['content'],
		icon: (find('link', 'rel', 'icon')?.props as Record<string, string> | undefined)?.['href'],
		style: tags.find((t) => t.tag === 'style')?.textContent,
		overrides: tags.find((t) => t.tag === 'style' && (t.props as Record<string, string>)['id'] === 'theme-overrides')
			?.textContent,
		html: tags.find((t) => t.tag === 'htmlAttrs')?.props,
		body: tags.find((t) => t.tag === 'bodyAttrs')?.props,
	};
}

describe('useAppHead', () => {
	test('defaults: Backoffice title, default favicon, design-system primary', async () => {
		const head = await resolve(null, 'Sign In');

		expect(head.title).toBe('Sign In · Backoffice');
		expect(head.icon).toBe('/admin/favicon.ico');
		expect(head.style).toBe(':root { --project-color: var(--color-brand-500) }');
		expect(head.html).toMatchObject({ lang: 'en-US', dir: 'ltr', class: 'light' });
		expect(head.overrides).toBe('');
	});

	test('project name, color and generated favicon (with the mark when there is no logo)', async () => {
		const head = await resolve(
			{ project_name: 'Acme', project_color: '#336699', default_language: 'vi-VN' },
			'Content',
		);

		expect(head.title).toBe('Content · Acme');
		expect(head.themeColor).toBe('#336699');
		expect(head.style).toBe(':root { --project-color: #336699 }');
		expect(head.icon).toMatch(/^data:image\/svg\+xml;base64,/);
		expect(atob(head.icon!.split(',')[1]!)).toContain('<path');
		expect(head.html).toMatchObject({ lang: 'vi-VN' });
	});

	test('public_favicon wins; a project logo removes the mark', async () => {
		expect((await resolve({ project_color: '#336699', public_favicon: 'f1' })).icon).toBe('http://api.test/assets/f1');

		const icon = (await resolve({ project_color: '#336699', project_logo: 'l1' })).icon!;
		expect(atob(icon.split(',')[1]!)).not.toContain('<path');
	});

	test('an invalid project_color is ignored', async () => {
		const head = await resolve({ project_color: 'red; } body { display: none' });

		expect(head.style).toBe(':root { --project-color: var(--color-brand-500) }');
		expect(head.icon).toBe('/admin/favicon.ico');
	});
});

describe('theme', () => {
	test('html class dark from the settings appearance', async () => {
		const head = await resolve({ default_appearance: 'dark' });
		expect(head.html).toMatchObject({ class: 'dark' });
		// Also on body as the Directus app sets it (extension styles may target `body.dark`).
		expect(head.body).toMatchObject({ class: 'dark' });
	});

	test('html class follows the user appearance over the settings', async () => {
		useUserStore().currentUser = { id: 'u1', appearance: 'light' } as never;
		expect((await resolve({ default_appearance: 'dark' })).html).toMatchObject({ class: 'light' });
	});

	test('theme overrides of settings and user as tokens in #theme-overrides', async () => {
		useUserStore().currentUser = { id: 'u1', appearance: null, theme_light_overrides: { primary: '#aa0000' } } as never;

		const head = await resolve({
			theme_light_overrides: { primary: '#111111', danger: 'gray' },
			theme_dark_overrides: { success: 'black' },
		});

		expect(head.overrides).toBe(
			':root.light { --color-brand-500: #111111; --color-error-500: gray; }\n' +
				':root.dark { --color-success-500: black; }',
		);
	});
});

test('safeColor', () => {
	expect(safeColor(null)).toBeNull();
	expect(safeColor('')).toBeNull();
	expect(safeColor('#123')).toBe('#123');
	expect(safeColor('rgb(1 2 3)')).toBe('rgb(1 2 3)');
	expect(safeColor('nope;')).toBeNull();

	const supports = vi.fn().mockReturnValue(false);
	vi.stubGlobal('CSS', { supports });
	expect(safeColor('notacolor')).toBeNull();
	expect(supports).toHaveBeenCalledWith('color', 'notacolor');
	vi.unstubAllGlobals();
});
