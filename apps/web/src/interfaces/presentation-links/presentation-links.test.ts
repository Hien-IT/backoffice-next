// Ported from directus/app/src/interfaces/presentation-links/presentation-links.test.ts
// Backoffice: mounted with the real BoButton (an external link is an `a` with target `_blank`, an internal link a
// router link, a flow a `button`) instead of a v-button stub reading its props as attributes. Fixture, option and
// request tests are in PresentationLinks.test.ts.
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, describe, expect, it, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '../../lang/index.ts';
import PresentationLinks from './PresentationLinks.vue';

const mockIsActiveFlow = vi.fn(() => true);
const mockRunningFlows = vi.fn(() => [] as string[]);

vi.mock('../../composables/use-run-manual-flow.ts', () => ({
	useInjectRunManualFlow: () => ({
		runManualFlow: null,
		runningFlows: mockRunningFlows(),
		isActiveFlow: mockIsActiveFlow,
		flowDialogsContext: null,
	}),
}));

afterEach(() => {
	vi.clearAllMocks();
});

const mockLinks = [
	{
		icon: 'test-icon-1',
		label: 'External URL Link',
		type: 'primary',
		actionType: 'url' as const,
		url: 'https://test.com',
	},
	{
		icon: 'test-icon-2',
		label: 'Internal URL Link',
		type: 'primary',
		actionType: 'url' as const,
		url: '/test',
	},
	{
		icon: 'test-icon-3',
		label: 'Flow Link',
		type: 'secondary',
		actionType: 'flow' as const,
		flow: 'test-flow-id',
	},
];

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });

const mountOptions = {
	global: {
		plugins: [createPinia(), i18n, router],
	},
	props: {
		links: mockLinks,
		collection: 'test-collection',
	},
};

describe('basic rendering', () => {
	test('interface mounts', () => {
		const wrapper = mount(PresentationLinks, mountOptions);

		expect(wrapper.exists()).toBe(true);
	});

	test('renders a button for every link', () => {
		const wrapper = mount(PresentationLinks, mountOptions);

		const buttons = wrapper.findAll('.action');

		expect(buttons).toHaveLength(3);
	});
});

describe('external link', () => {
	const wrapper = mount(PresentationLinks, mountOptions);

	const buttonExternalLink = wrapper.find('a[target="_blank"]');

	test('has correct attributes', () => {
		expect(buttonExternalLink.attributes('href')).toBe(mockLinks[0]!.url);
		expect(buttonExternalLink.attributes('rel')).toBe('noopener noreferrer');
		expect(buttonExternalLink.classes()).toEqual(expect.arrayContaining(['action', 'primary', 'bg-brand-500']));
		expect(buttonExternalLink.attributes('aria-label')).toBeUndefined();
	});

	test('has correct children', () => {
		const buttonIcon = buttonExternalLink.find('.material-symbols-rounded');
		expect(buttonIcon.text()).toBe('test-icon-1');

		expect(buttonExternalLink.text()).toContain('External URL Link');
	});
});

describe('internal link', () => {
	const wrapper = mount(PresentationLinks, mountOptions);

	const buttonInternalLink = wrapper.find('a:not([target])');

	test('has correct attributes', () => {
		expect(buttonInternalLink.attributes('href')).toBe(mockLinks[1]!.url);
		expect(buttonInternalLink.classes()).toEqual(expect.arrayContaining(['action', 'primary', 'bg-brand-500']));
	});

	test('has correct children ', () => {
		const buttonIcon = buttonInternalLink.find('.material-symbols-rounded');

		expect(buttonIcon.text()).toBe('test-icon-2');
		expect(buttonInternalLink.text()).toContain('Internal URL Link');
	});
});

describe('flow link', () => {
	describe('active state', () => {
		const wrapper = mount(PresentationLinks, mountOptions);

		const buttonFlowLink = wrapper.find('button.action');

		test('has correct attributes', () => {
			expect(buttonFlowLink.attributes('href')).toBeUndefined();
			expect(buttonFlowLink.classes()).toEqual(expect.arrayContaining(['action', 'secondary']));
			expect(buttonFlowLink.classes()).not.toContain('bg-brand-500');
			expect(buttonFlowLink.attributes('aria-busy')).toBeUndefined();
		});

		test('has correct child', () => {
			const buttonIcon = buttonFlowLink.find('.material-symbols-rounded');

			expect(buttonIcon.text()).toBe('test-icon-3');
			expect(buttonFlowLink.text()).toContain('Flow Link');
		});
	});

	describe('disabled state', () => {
		test('does not render flow button', () => {
			mockIsActiveFlow.mockReturnValue(false);

			const wrapper = mount(PresentationLinks, mountOptions);
			const buttons = wrapper.findAll('.action');
			const buttonFlowLink = wrapper.find('button.action');

			expect(buttons).toHaveLength(2);
			expect(buttonFlowLink.exists()).toBe(false);
		});
	});

	describe('loading state', () => {
		test('renders with loading state', () => {
			mockIsActiveFlow.mockReturnValue(true);
			mockRunningFlows.mockReturnValue(['test-flow-id']);

			const wrapper = mount(PresentationLinks, mountOptions);
			const buttonFlowLink = wrapper.find('button.action');

			expect(buttonFlowLink.attributes('aria-busy')).toBe('true');
		});
	});
});

describe('Interface', () => {
	const urlLink = {
		icon: 'launch',
		label: 'url',
		type: 'primary',
		actionType: 'url' as const,
		url: 'https://example.com',
	};

	const flowLink = {
		icon: 'automation',
		label: 'flow',
		type: 'secondary',
		actionType: 'flow' as const,
		flow: 'test-flow',
	};

	it('should render action buttons disabled when disabled is true', async () => {
		mockRunningFlows.mockReturnValue([]);

		const wrapper = mount(PresentationLinks, {
			...mountOptions,
			props: {
				...mountOptions.props,
				links: [flowLink],
				disabled: true,
			},
		});

		expect(wrapper.find('button.action').attributes('disabled')).toBe('');

		await wrapper.setProps({ links: [urlLink] });
		expect(wrapper.find('button.action').attributes('disabled')).toBe('');
	});

	it('should disable flow buttons when nonEditable is true', async () => {
		const wrapper = mount(PresentationLinks, {
			...mountOptions,
			props: {
				...mountOptions.props,
				links: [flowLink],
				nonEditable: true,
				disabled: true,
			},
		});

		expect(wrapper.find('button.action').attributes('disabled')).toBe('');
	});

	it('should not disable link buttons when nonEditable is true', async () => {
		const wrapper = mount(PresentationLinks, {
			...mountOptions,
			props: {
				...mountOptions.props,
				links: [urlLink],
				nonEditable: true,
				disabled: true,
			},
		});

		expect(wrapper.find('.action').attributes('disabled')).toBeUndefined();
	});
});
