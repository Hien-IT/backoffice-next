// Feature 016 (T090, US5-4): system-modules as Directus: the saved bar (default MODULE_BAR_DEFAULT of Directus, with the
// docs link) plus the modules it lacks (added disabled), the switch of a module, the lock of settings, the link rows
// (edit in the drawer, remove), add a link, the D-96 Up/Down menu, and the emitted value shape.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test } from 'vitest';
import BoSortableList from '../../../components/BoSortableList.vue';
import BoSwitch from '../../../components/BoSwitch.vue';
import BoForm from '../../../components/form/BoForm.vue';
import { i18n } from '../../../lang/index.ts';
import SystemModules from './SystemModules.vue';

enableAutoUnmount(afterEach);

const t = (key: string) => i18n.global.t(key);

let pinia: ReturnType<typeof createPinia>;

beforeEach(() => {
	pinia = createPinia();
	setActivePinia(pinia);
});

function render(value: unknown = null) {
	const wrapper: ReturnType<typeof mount<typeof SystemModules>> = mount(SystemModules, {
		props: { value: value as never, onInput: (v: unknown) => wrapper.setProps({ value: v as never }) },
		global: { plugins: [pinia, i18n] },
		attachTo: document.body,
	});
	return wrapper;
}

// BoSortableList is a generic component: findComponent cannot type it.
const sortable = (wrapper: ReturnType<typeof render>) => wrapper.findComponent(BoSortableList as never) as any;

const rows = (wrapper: ReturnType<typeof render>) =>
	(sortable(wrapper).props('modelValue') as { id: string; enabled: boolean }[]).map(
		(row) => `${row.id}:${row.enabled}`,
	);

const lastInput = (wrapper: ReturnType<typeof render>) => wrapper.emitted('input')!.at(-1)![0] as any[];

test('no saved bar: the Directus default with the docs link, then the modules it lacks, disabled', () => {
	const wrapper = render();

	// activity is hidden (Directus `hidden: true`), so not added.
	expect(rows(wrapper)).toEqual([
		'content:true',
		'visual:false',
		'users:true',
		'files:true',
		'insights:true',
		'deployments:false',
		'docs:true',
		'settings:true',
	]);
	expect(wrapper.text()).toContain(t('documentation'));
});

test('a saved bar keeps its order; missing modules come after it, disabled', () => {
	const wrapper = render([
		{ type: 'module', id: 'files', enabled: true },
		{ type: 'module', id: 'settings', enabled: true, locked: true },
	]);

	expect(rows(wrapper)).toEqual([
		'files:true',
		'settings:true',
		'content:false',
		'deployments:false',
		'insights:false',
		'users:false',
		'visual:false',
	]);
});

test('the switch of a module toggles `enabled`; settings is locked (no switch); the value keeps every part', async () => {
	const wrapper = render();

	const switches = wrapper.findAllComponents(BoSwitch);
	expect(switches.map((s) => s.props('label'))).not.toContain(t('settings'));

	switches.find((s) => s.props('label') === t('insights'))!.vm.$emit('update:modelValue', false);
	await flushPromises();

	expect(lastInput(wrapper)).toEqual([
		{ type: 'module', id: 'content', enabled: true, locked: undefined },
		{ type: 'module', id: 'visual', enabled: false, locked: undefined },
		{ type: 'module', id: 'users', enabled: true, locked: undefined },
		{ type: 'module', id: 'files', enabled: true, locked: undefined },
		{ type: 'module', id: 'insights', enabled: false, locked: undefined },
		{ type: 'module', id: 'deployments', enabled: false, locked: undefined },
		{
			type: 'link',
			id: 'docs',
			// Directus valueToPreview translates the link name, so the saved value has the translated text.
			name: t('documentation'),
			url: 'https://docs.directus.io',
			icon: 'help',
			enabled: true,
			locked: undefined,
		},
		{ type: 'module', id: 'settings', enabled: true, locked: true },
	]);
});

test('add a link in the drawer (name, icon, url required), edit it, remove it', async () => {
	const wrapper = render([{ type: 'module', id: 'content', enabled: true }]);

	await wrapper
		.findAll('button')
		.find((b) => b.text().includes(t('add_link')))!
		.trigger('click');
	await flushPromises();
	expect(document.body.textContent).toContain(t('custom_link'));

	const save = () =>
		[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
			(b) => b.getAttribute('aria-label') === t('save'),
		)!;
	expect(save().disabled).toBe(true);

	const form = wrapper.findComponent(BoForm);
	form.vm.$emit('update:modelValue', {
		...form.props('modelValue'),
		name: 'Wiki',
		icon: 'menu_book',
		url: 'https://wiki',
	});
	await flushPromises();
	expect(save().disabled).toBe(false);
	save().click();
	await flushPromises();

	const link = lastInput(wrapper).find((part) => part.type === 'link');
	expect(link).toMatchObject({ type: 'link', enabled: true, name: 'Wiki', icon: 'menu_book', url: 'https://wiki' });
	expect(typeof link.id).toBe('string');

	await wrapper.get(`button[aria-label="${t('remove')} Wiki"]`).trigger('click');
	expect(lastInput(wrapper).some((part) => part.type === 'link')).toBe(false);
});

test('the D-96 menu of a row moves it with the keyboard path of BoSortableList', async () => {
	const wrapper = render([
		{ type: 'module', id: 'content', enabled: true },
		{ type: 'module', id: 'files', enabled: true },
	]);

	sortable(wrapper).vm.$emit('update:modelValue', [
		...(sortable(wrapper).props('modelValue') as any[]).slice(0, 2).reverse(),
		...(sortable(wrapper).props('modelValue') as any[]).slice(2),
	]);
	await flushPromises();

	expect(
		lastInput(wrapper)
			.slice(0, 2)
			.map((part) => part.id),
	).toEqual(['files', 'content']);
});
