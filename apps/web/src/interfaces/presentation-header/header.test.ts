// Ported from directus/app/src/interfaces/presentation-header/header.test.ts
// Backoffice: mounted with the real Bo* components (no stubs); buttons are found as `.actions-container` children,
// the v-menu as the "Actions" trigger. Fixture, option and flow tests are in InterfaceHeader.test.ts.
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '../../lang/index.ts';
import Header from './InterfaceHeader.vue';

const mockIsActiveFlow = vi.fn(() => true);
const mockRunningFlows = vi.fn(() => ref<string[]>([]));

vi.mock('../../composables/use-run-manual-flow.ts', () => ({
	useInjectRunManualFlow: () => ({
		runManualFlow: null,
		runningFlows: mockRunningFlows(),
		isActiveFlow: mockIsActiveFlow,
		flowDialogsContext: null,
	}),
}));

vi.mock('../../composables/use-template-data.ts', () => ({
	useTemplateData: () => ({ templateData: computed(() => undefined) }),
}));

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });

const mountOptions = {
	global: {
		plugins: [createPinia(), i18n, router],
	},
	props: {
		title: 'Title',
		subtitle: 'Title',
		links: [],
		help: '<h1>Help</h1>',
		enableHelpTranslations: false,
		color: 'purple',
		collection: 'test-collection',
		primaryKey: '1',
	},
};

const urlLink = {
	icon: 'launch',
	label: 'url',
	type: 'primary' as const,
	actionType: 'url',
	url: 'https://example.com',
};

const flowLink = { icon: 'automation', label: 'flow', type: 'normal' as const, actionType: 'flow', flow: 'test-flow' };

describe('Interface', () => {
	it('should mount', () => {
		const wrapper = mount(Header, mountOptions);

		expect(wrapper.exists()).toBe(true);
	});

	it('renders only help button when no links', () => {
		const wrapper = mount(Header, mountOptions);

		const actionsContainer = wrapper.find('.actions-container');
		const actionButtons = actionsContainer.findAll('button, a');
		expect(actionButtons.length).toEqual(1);
	});

	it('renders primaryLink button for single link', () => {
		const testMountOptions = { ...mountOptions, props: { ...mountOptions.props, links: [urlLink] } };

		const wrapper = mount(Header, testMountOptions);

		const actionsContainer = wrapper.find('.actions-container');
		const actionButtons = actionsContainer.findAll('button, a');
		expect(actionButtons.length).toEqual(2);
	});

	it('renders v-menu button for multiple links', () => {
		const testMountOptions = { ...mountOptions, props: { ...mountOptions.props, links: [urlLink, flowLink] } };

		const wrapper = mount(Header, testMountOptions);

		const vMenu = wrapper.find('[data-actions]');

		expect(vMenu.exists()).toBe(true);
		expect(vMenu.attributes('aria-haspopup')).toBe('menu');
	});

	it('should render action buttons disabled when disabled is true', async () => {
		const wrapper = mount(Header, {
			...mountOptions,
			props: {
				...mountOptions.props,
				links: [flowLink],
				disabled: true,
			},
		});

		expect(wrapper.find('.actions-container .action').attributes('disabled')).toBe('');

		await wrapper.setProps({ links: [urlLink] });
		expect(wrapper.find('.actions-container .action').attributes('disabled')).toBe('');
	});

	it('should disable flow buttons when nonEditable is true', async () => {
		const wrapper = mount(Header, {
			...mountOptions,
			props: {
				...mountOptions.props,
				links: [flowLink],
				nonEditable: true,
				disabled: true,
			},
		});

		expect(wrapper.find('.actions-container .action').attributes('disabled')).toBe('');
	});

	it('should not disable link buttons when nonEditable is true', async () => {
		const wrapper = mount(Header, {
			...mountOptions,
			props: {
				...mountOptions.props,
				links: [urlLink],
				nonEditable: true,
				disabled: true,
			},
		});

		expect(wrapper.find('.actions-container .action').attributes('disabled')).toBeUndefined();
	});

	it('renders without error when subtitle only (no title)', () => {
		const wrapper = mount(Header, {
			...mountOptions,
			props: {
				...mountOptions.props,
				title: undefined,
				subtitle: 'Subtitle only',
			},
		});

		expect(wrapper.exists()).toBe(true);
		const subtitleEl = wrapper.find('[data-subtitle].standalone');
		expect(subtitleEl.exists()).toBe(true);
	});
});
