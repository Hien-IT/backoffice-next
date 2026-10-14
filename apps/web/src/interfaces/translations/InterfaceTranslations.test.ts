// Directus has no test for translations.vue: spec FR-048 options, US3 scenario 4, Edge Cases (translations), fixture
// bo_translations / bo_translations_translations / bo_languages, edit shapes ({create, update, delete}, FR-040),
// nested validation (FR-018), states, permissions, keyboard.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed } from 'vue';
import { replaceQueue } from '../../api/sdk.ts';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import {
	assertOnlyKnownRequests,
	calls,
	type FixtureApiOptions,
	json,
	mockFixtureApi,
} from '../../test-utils/fetch.ts';
import { fieldsOf, type FixtureUser, loadSnapshot } from '../../test-utils/fixtures.ts';
import { translate } from '../../utils/translate-object-values.ts';
import config from './index.ts';
import InterfaceTranslations from './InterfaceTranslations.vue';

enableAutoUnmount(afterEach);

const snapshot = loadSnapshot();
let fetch: ReturnType<typeof mockFixtureApi>;
let hydrateCalls = 0;

// shortcut: mockFixtureApi reads the `{ field: value }` filter shorthand (Directus parseFilter: `_eq`) of
// use-relation-multiple as "no condition", so the junction rows of one parent are answered here; drop this when
// test-utils/fetch.ts handles the shorthand.
function junctionRows({ url }: { url: URL }) {
	const parent = JSON.parse(url.searchParams.get('filter') ?? '{}')._and?.[0]?.bo_translations_id;

	const rows = snapshot.items['bo_translations_translations']!.filter((r) => r['bo_translations_id'].id === parent).map(
		(r) => ({ ...r, bo_translations_id: parent, bo_languages_code: { code: r['bo_languages_code'].code } }),
	);

	return json({ data: url.searchParams.has('aggregate') ? [{ count: { id: rows.length } }] : rows });
}

async function setup(user: FixtureUser = 'admin', answers: FixtureApiOptions['answers'] = {}) {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(snapshot, {
		user,
		answers: { 'GET /items/bo_translations_translations': junctionRows, ...answers },
	});
	await useUserStore().hydrate();

	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);

	hydrateCalls = fetch.mock.calls.length;
}

function setWidth(width: number) {
	window.innerWidth = width;
	window.dispatchEvent(new Event('resize'));
}

beforeEach(async () => {
	setWidth(1280);
	await setup();
});

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
});

const ownCalls = () => calls(fetch).slice(hydrateCalls);

// Like FormFieldInterface: the translated `meta.options` spread as props, plus collection, field, primary key.
const fixtureOptions = () =>
	translate(fieldsOf('bo_translations').find((f) => f.field === 'translations')!.meta!.options ?? {}) as Record<
		string,
		unknown
	>;

async function mountTranslations(props: Record<string, unknown> = {}, provide: Record<string | symbol, unknown> = {}) {
	const wrapper = mount(InterfaceTranslations, {
		props: { collection: 'bo_translations', field: 'translations', primaryKey: 1, ...props } as never,
		global: { plugins: [i18n], provide },
		attachTo: document.body,
	});

	await flushPromises();
	await flushPromises();
	return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountTranslations>>;

const forms = (w: Wrapper) => w.findAll('[data-lang]');
const langs = (w: Wrapper) => forms(w).map((f) => f.attributes('data-lang'));
const trigger = (w: Wrapper, index = 0) => forms(w)[index]!.get<HTMLButtonElement>('button[aria-haspopup="menu"]');
const display = (w: Wrapper, index = 0) => forms(w)[index]!.get('[data-testid="display-value"]').text();
const input = (w: Wrapper, field: string, index = 0) =>
	forms(w)[index]!.find<HTMLInputElement | HTMLTextAreaElement>(`[data-field="${field}"] :is(input, textarea)`);
const lastInput = (w: Wrapper) => w.emitted('input')?.at(-1)?.[0];

async function key(el: Element, key: string) {
	el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
	await flushPromises();
}

async function openMenu(w: Wrapper, index = 0) {
	const el = trigger(w, index).element;
	el.focus();
	await key(el, 'Enter');
	return [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')];
}

describe('translations', () => {
	test('registry: same id, types and options as Directus', () => {
		expect(config.id).toBe('translations');
		expect(config.component).toBe(InterfaceTranslations);
	});

	test('fixture: loads languages and translations, no input on mount, first and second language (US3-4)', async () => {
		const wrapper = await mountTranslations(fixtureOptions());

		expect(wrapper.emitted('input')).toBeUndefined();

		// #39: every language, sorted by languageField (no sort field on bo_languages), then the junction rows.
		expect(ownCalls()).toContain('GET /items/bo_languages?fields=name,direction,code&sort=name&limit=-1');
		expect(ownCalls().some((c) => c.startsWith('GET /items/bo_translations_translations?'))).toBe(true);

		// userLanguage: the app locale (en-US) first; defaultLanguage en-US is the same, so the next language second.
		expect(langs(wrapper)).toEqual(['en-US', 'vi-VN']);
		expect(display(wrapper, 0)).toBe('English');
		expect(display(wrapper, 1)).toBe('Tiếng Việt');
		expect(input(wrapper, 'title', 0).element.value).toBe('Hello');
		expect(input(wrapper, 'title', 1).element.value).toBe('Xin chào');

		// badge = language name on each field label
		expect(forms(wrapper)[0]!.get('[data-field="title"]').text()).toContain('English');
		expect(forms(wrapper)[1]!.get('[data-field="title"]').text()).toContain('Tiếng Việt');
	});

	test('missing option keys: Directus defaults (pk as text, direction field, no split, first language)', async () => {
		const wrapper = await mountTranslations();

		expect(ownCalls()).toContain('GET /items/bo_languages?fields=direction,code&sort=code&limit=-1');
		expect(langs(wrapper)).toEqual(['ar-SA']);
		expect(display(wrapper)).toBe('ar-SA');
		expect(input(wrapper, 'title').attributes('dir')).toBe('rtl');
		expect(wrapper.find('[data-testid="split-view-open"]').exists()).toBe(true);
	});

	test('option:translations.languageField', async () => {
		const wrapper = await mountTranslations({ languageField: 'name' });
		expect(langs(wrapper)).toEqual(['en-US']);
		expect(display(wrapper)).toBe('English');
	});

	test('option:translations.languageDirectionField', async () => {
		const wrapper = await mountTranslations({ languageField: 'name', defaultLanguage: 'ar-SA' });
		expect(input(wrapper, 'title').attributes('dir')).toBe('rtl');

		const none = await mountTranslations({ languageDirectionField: null, defaultLanguage: 'ar-SA' });
		expect(ownCalls()).toContain('GET /items/bo_languages?fields=code&sort=code&limit=-1');
		expect(input(none, 'title').attributes('dir')).toBeUndefined();
	});

	test('option:translations.defaultLanguage (found, then not found: first language)', async () => {
		const wrapper = await mountTranslations({ languageField: 'name', defaultLanguage: 'vi-VN' });
		expect(langs(wrapper)).toEqual(['vi-VN']);

		const missing = await mountTranslations({ languageField: 'name', defaultLanguage: 'xx-XX' });
		expect(langs(missing)).toEqual(['en-US']);
	});

	test('option:translations.userLanguage (stored boolean, declared string)', async () => {
		const on = await mountTranslations({ userLanguage: true, defaultLanguage: 'vi-VN', defaultOpenSplitView: true });
		expect(langs(on)).toEqual(['en-US', 'vi-VN']);

		const off = await mountTranslations({ userLanguage: false, defaultLanguage: 'vi-VN', defaultOpenSplitView: true });
		expect(langs(off)).toEqual(['vi-VN', 'ar-SA']);
	});

	test('option:translations.defaultOpenSplitView and the split view toggle', async () => {
		const wrapper = await mountTranslations({ languageField: 'name' });
		expect(langs(wrapper)).toEqual(['en-US']);
		expect(wrapper.get('[data-testid="translations"]').classes()).toContain('grid-cols-1');

		await wrapper.get('[data-testid="split-view-open"]').trigger('click');
		await flushPromises();
		expect(langs(wrapper)).toEqual(['en-US', 'vi-VN']);
		expect(wrapper.get('[data-testid="translations"]').classes()).toContain('grid-cols-2');

		await wrapper.get('[data-testid="split-view-close"]').trigger('click');
		await flushPromises();
		expect(langs(wrapper)).toEqual(['en-US']);
	});

	test('no split view at 960 px or less, nor with a single language', async () => {
		setWidth(960);
		const narrow = await mountTranslations(fixtureOptions());
		expect(langs(narrow)).toEqual(['en-US']);
		expect(narrow.find('[data-testid="split-view-open"]').exists()).toBe(false);

		setWidth(1280);
		await flushPromises();
		expect(langs(narrow)).toEqual(['en-US', 'vi-VN']);

		await setup('admin', { 'GET /items/bo_languages': [{ code: 'en-US', name: 'English', direction: 'ltr' }] });
		const single = await mountTranslations(fixtureOptions());
		expect(langs(single)).toEqual(['en-US']);
		expect(single.find('[data-testid="split-view-open"]').exists()).toBe(false);
	});

	test('language menu: progress per language, keyboard selection', async () => {
		const wrapper = await mountTranslations({ languageField: 'name', primaryKey: 2 });
		const items = await openMenu(wrapper);

		expect(items.map((i) => i.textContent?.trim())).toEqual(['English', 'Tiếng Việt', 'العربية']);
		// item 2 has only ar-SA, with title filled and body null: 1 of the 2 writable fields.
		const progress = items.map((i) => i.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow'));
		expect(progress).toEqual(['0', '0', '50']);

		await key(items[1]!, 'Enter');
		await flushPromises();
		expect(langs(wrapper)).toEqual(['vi-VN']);
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('edit an existing translation: update with the junction key (FR-040)', async () => {
		const wrapper = await mountTranslations({ languageField: 'name' });
		await input(wrapper, 'title').setValue('Hi');
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({
			create: [],
			update: [{ title: 'Hi', bo_languages_code: { code: 'en-US' }, id: 1 }],
			delete: [],
		});
	});

	test('enable then fill a new translation: create; the edited dot shows in the menu', async () => {
		const wrapper = await mountTranslations({ languageField: 'name', primaryKey: 2 });

		const enable = wrapper.get('[data-testid="enable-translation"]');
		expect(enable.attributes('aria-label')).toBe('Enable');
		await enable.trigger('click');
		await flushPromises();
		expect(lastInput(wrapper)).toEqual({ create: [{ bo_languages_code: { code: 'en-US' } }], update: [], delete: [] });

		await wrapper.setProps({ value: lastInput(wrapper) } as never);
		await flushPromises();
		await input(wrapper, 'title').setValue('Hello');
		await flushPromises();

		// Directus updateValue: a created row of a saved parent also gets the parent key.
		expect(lastInput(wrapper)).toEqual({
			create: [{ bo_languages_code: { code: 'en-US' }, title: 'Hello', bo_translations_id: 2 }],
			update: [],
			delete: [],
		});

		await wrapper.setProps({ value: lastInput(wrapper) } as never);
		const items = await openMenu(wrapper);
		expect(items[0]!.textContent).toContain('Value Edited');
	});

	test('remove an existing translation: delete with the junction key, then undo', async () => {
		const wrapper = await mountTranslations({ languageField: 'name' });
		const remove = forms(wrapper)[0]!.get('button[aria-label="Remove Item"]');

		await remove.trigger('click');
		await flushPromises();
		expect(lastInput(wrapper)).toEqual({ create: [], update: [], delete: [1] });

		await wrapper.setProps({ value: lastInput(wrapper) } as never);
		await flushPromises();
		expect(input(wrapper, 'title').element.disabled).toBe(true);
		await forms(wrapper)[0]!.get('button[aria-label="Undo Removed Item"]').trigger('click');
		await flushPromises();
		expect(lastInput(wrapper)).toBeUndefined();
	});

	test('a new translation with edits asks before it is removed (v-remove)', async () => {
		const value = { create: [{ bo_languages_code: { code: 'en-US' }, title: 'Hello' }], update: [], delete: [] };
		const wrapper = await mountTranslations({ languageField: 'name', primaryKey: 2, value });

		await forms(wrapper)[0]!.get('button[aria-label="Remove Item"]').trigger('click');
		await flushPromises();
		expect(wrapper.emitted('input')).toBeUndefined();

		const dialog = document.body.querySelector('[role="dialog"]')!;
		[...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Delete')!.click();
		await flushPromises();
		expect(lastInput(wrapper)).toBeUndefined();
		expect(wrapper.emitted('input')).toHaveLength(1);
	});

	test('nested validation errors as field.lang.subfield (FR-018)', async () => {
		const title = useFieldsStore().fields.find(
			(f) => f.collection === 'bo_translations_translations' && f.field === 'title',
		)!;
		title.meta!.required = true;

		const updateNestedValidationErrors = vi.fn();
		const value = { create: [{ bo_languages_code: { code: 'en-US' } }], update: [], delete: [] };
		const wrapper = await mountTranslations(
			{ languageField: 'name', primaryKey: 2 },
			{ nestedValidation: { updateNestedValidationErrors } },
		);

		await wrapper.setProps({ value } as never);
		await flushPromises();

		const [field, errors] = updateNestedValidationErrors.mock.calls.at(-1)!;
		expect(field).toBe('translations');
		expect(errors).toEqual([
			expect.objectContaining({
				field: 'translations.en-US.title',
				type: 'required',
				nestedNames: { 'en-US': 'English', title: 'Title' },
			}),
		]);
	});

	test('disabled: menu, activator and form are disabled', async () => {
		const wrapper = await mountTranslations({ languageField: 'name', primaryKey: 2, disabled: true });

		expect(trigger(wrapper).element.disabled).toBe(true);
		expect(wrapper.get<HTMLButtonElement>('[data-testid="enable-translation"]').element.disabled).toBe(true);
		expect(input(wrapper, 'title').element.disabled).toBe(true);
	});

	test('nonEditable: the language menu still opens, no activator', async () => {
		const wrapper = await mountTranslations({
			languageField: 'name',
			primaryKey: 2,
			disabled: true,
			nonEditable: true,
		});

		expect(trigger(wrapper).element.disabled).toBe(false);
		expect(wrapper.find('[data-testid="enable-translation"]').exists()).toBe(false);
		expect(await openMenu(wrapper)).toHaveLength(3);
	});

	test('bo-viewer: no create or update permission on the junction collection', async () => {
		await setup('bo-viewer');
		const wrapper = await mountTranslations({ languageField: 'name', primaryKey: 2 });

		expect(wrapper.get<HTMLButtonElement>('[data-testid="enable-translation"]').element.disabled).toBe(true);
		expect(input(wrapper, 'title').element.disabled).toBe(true);
	});

	test('bo-editor: no delete permission, an existing translation cannot be removed', async () => {
		await setup('bo-editor');
		const wrapper = await mountTranslations({ languageField: 'name' });

		expect(input(wrapper, 'title').element.disabled).toBe(false);
		expect(forms(wrapper)[0]!.get<HTMLButtonElement>('button[aria-label="Remove Item"]').element.disabled).toBe(true);
	});

	test('edge: empty languages collection shows no form', async () => {
		await setup('admin', { 'GET /items/bo_languages': [] });
		const wrapper = await mountTranslations(fixtureOptions());

		expect(wrapper.find('[data-field]').exists()).toBe(false);
		expect(wrapper.get('[data-testid="display-value"]').text()).toBe('');
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('edge: languageField of a field that no longer exists falls back to the key', async () => {
		const wrapper = await mountTranslations({ languageField: 'gone' });

		expect(ownCalls()).toContain('GET /items/bo_languages?fields=direction,code&sort=gone&limit=-1');
		expect(display(wrapper)).toBe('ar-SA');
	});

	test('new item (+): no item request, every language can be enabled', async () => {
		const wrapper = await mountTranslations({ ...fixtureOptions(), primaryKey: '+' });

		expect(ownCalls().filter((c) => c.includes('bo_translations_translations'))).toEqual([]);
		expect(wrapper.findAll('[data-testid="enable-translation"]')).toHaveLength(2);
	});

	test('label linking: group and language menu linked to the field label (FORM_FIELD_A11Y)', async () => {
		const a11y = computed(() => ({ inputId: 'f-in', labelId: 'f-label', describedBy: 'f-note', invalid: true }));
		const wrapper = await mountTranslations({ languageField: 'name' }, { [FORM_FIELD_A11Y as symbol]: a11y });

		const group = wrapper.get('[data-testid="translations"]');
		expect(group.attributes('role')).toBe('group');
		expect(group.attributes('aria-labelledby')).toBe('f-label');
		expect(group.attributes('aria-describedby')).toBe('f-note');
		expect(group.attributes('aria-invalid')).toBe('true');

		const button = trigger(wrapper);
		const value = button.get('[data-testid="display-value"]');
		expect(button.attributes('aria-labelledby')).toBe(`f-label ${value.attributes('id')}`);
		expect(button.attributes('aria-describedby')).toBe('f-note');
		expect(value.text()).toBe('English');
	});
});
