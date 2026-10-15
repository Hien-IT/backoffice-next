// Ported from directus/app/src/views/private/components/flow-sidebar-detail.test.ts
// Backoffice: the real BoButton/BoIcon/BoTooltip render; the flow color is checked on the icon (data color) and the
// loading state through aria-busy and the spinner, instead of the stubbed v-button attributes.
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import type { ManualFlow } from '../../composables/use-run-manual-flow.ts';
import FlowSidebarDetail from './FlowSidebarDetail.vue';

const mockRunManualFlow = vi.fn();
const mockIsActiveFlow = vi.fn(() => true);
const mockRunningFlows = vi.fn(() => [] as string[]);

vi.mock('../../composables/use-run-manual-flow.ts', () => ({
	useInjectRunManualFlow: () => ({
		runManualFlow: mockRunManualFlow,
		runningFlows: mockRunningFlows(),
		isActiveFlow: mockIsActiveFlow,
	}),
}));

enableAutoUnmount(afterEach);

afterEach(() => {
	vi.clearAllMocks();
	mockRunningFlows.mockReturnValue([]);
});

const mockFlows = [
	{
		id: 'test-flow-1',
		name: 'test-flow-1',
		trigger: 'manual',
		isFlowDisabled: false,
		color: 'red',
		icon: 'active',
		tooltip: 'Run Flow on Current Item',
	},
	{
		id: 'test-flow-2',
		name: 'test-flow-2',
		trigger: 'manual',
		isFlowDisabled: true,
		color: 'blue',
		tooltip: 'Select One or More Items First',
	},
] as Partial<ManualFlow>[];

const mountOptions = {
	global: {
		plugins: [i18n],
		stubs: {
			SidebarDetail: { props: ['id', 'icon', 'title'], template: '<section :data-title="title"><slot /></section>' },
		},
	},
	props: {
		manualFlows: mockFlows as ManualFlow[],
	},
};

const button = (wrapper: ReturnType<typeof mount>, name: string) =>
	wrapper.findAll('button').find((b) => b.text().includes(name))!;

describe('basic rendering', () => {
	test('interface mounts', () => {
		const wrapper = mount(FlowSidebarDetail, mountOptions);

		expect(wrapper.find('section').attributes('data-title')).toBe('Flows');
	});

	test('renders a button for every flow', () => {
		const wrapper = mount(FlowSidebarDetail, mountOptions);

		expect(wrapper.findAll('button')).toHaveLength(2);
	});

	test('renders nothing without manual flows', () => {
		const wrapper = mount(FlowSidebarDetail, { ...mountOptions, props: { manualFlows: [] } });

		expect(wrapper.find('section').exists()).toBe(false);
	});
});

describe('active state', () => {
	test('has correct attributes', () => {
		const activeFlowButton = button(mount(FlowSidebarDetail, mountOptions), 'test-flow-1');

		expect(activeFlowButton.attributes('disabled')).toBeUndefined();
		expect(activeFlowButton.attributes('aria-busy')).toBeUndefined();
		expect(activeFlowButton.find('.material-symbols-rounded').attributes('style')).toContain('color: red');
	});

	test('has correct children', () => {
		const activeFlowButton = button(mount(FlowSidebarDetail, mountOptions), 'test-flow-1');

		expect(activeFlowButton.find('.material-symbols-rounded').text()).toBe('active');
		expect(activeFlowButton.text()).toContain('test-flow-1');
	});

	test('runs the flow on click', async () => {
		await button(mount(FlowSidebarDetail, mountOptions), 'test-flow-1').trigger('click');

		expect(mockRunManualFlow).toHaveBeenCalledWith('test-flow-1');
	});
});

describe('inactive state', () => {
	test('has correct attributes', () => {
		const disabledFlowButton = button(mount(FlowSidebarDetail, mountOptions), 'test-flow-2');

		expect(disabledFlowButton.attributes('disabled')).toBeDefined();
		expect(disabledFlowButton.attributes('aria-busy')).toBeUndefined();
		expect(disabledFlowButton.find('.material-symbols-rounded').attributes('style')).toContain('color: blue');
	});

	test('has correct children', () => {
		const disabledFlowButton = button(mount(FlowSidebarDetail, mountOptions), 'test-flow-2');

		expect(disabledFlowButton.find('.material-symbols-rounded').text()).toBe('bolt');
		expect(disabledFlowButton.text()).toContain('test-flow-2');
	});
});

describe('loading state', () => {
	test('has correct attributes', () => {
		mockRunningFlows.mockReturnValue(['test-flow-1']);

		const activeFlowButton = button(mount(FlowSidebarDetail, mountOptions), 'test-flow-1');

		expect(activeFlowButton.attributes('aria-busy')).toBe('true');
		expect(activeFlowButton.find('.material-symbols-rounded').exists()).toBe(false);
	});
});
