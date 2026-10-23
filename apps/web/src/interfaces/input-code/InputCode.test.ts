// Ported from directus/app/src/interfaces/input-code/input-code.test.ts
// Backoffice: the CodeMirror mock also returns an input field (the form ids are set on it); the inline snapshot of
// the DR v-button stub is replaced by checks on our template button. Real-editor tests: InputCode.editor.test.ts.
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import InputCode from './InputCode.vue';

// Mock CodeMirror
vi.mock('codemirror', () => {
	return {
		default: vi.fn(() => ({
			setOption: vi.fn(),
			on: vi.fn(),
			getValue: vi.fn(() => ''),
			setValue: vi.fn(),
			getInputField: vi.fn(() => document.createElement('textarea')),
		})),
		Pos: vi.fn(),
		registerHelper: vi.fn(),
	};
});

// Mock import functions
vi.mock('./import-codemirror-mode.ts', () => ({
	default: vi.fn(),
}));

describe('InputCode', () => {
	let wrapper: any;

	// Global mount options with mocked components and plugins
	const global = { plugins: [i18n] };

	beforeEach(() => {
		// Reset all mocks before each test
		vi.clearAllMocks();
	});

	it('should handle null language prop without throwing error', async () => {
		// Test that the component can be mounted with null language
		expect(() => {
			wrapper = mount(InputCode, {
				props: {
					language: null as any, // Cast to any to test null handling
					value: 'test code',
				},
				global,
			});
		}).not.toThrow();
	});

	it('should handle undefined language prop without throwing error', async () => {
		// Test that the component can be mounted with undefined language
		expect(() => {
			wrapper = mount(InputCode, {
				props: {
					value: 'test code',
					// language is undefined (not provided)
				},
				global,
			});
		}).not.toThrow();
	});

	it('should default to plaintext when language is null', async () => {
		wrapper = mount(InputCode, {
			props: {
				language: null as any, // Cast to any to test null handling
				value: 'test code',
			},
			global,
		});

		// Verify the component exists and is mounted
		expect(wrapper.exists()).toBe(true);

		// Since we're testing the internal logic, let's verify that null doesn't break the component
		// The key thing is that the component mounts without throwing an error
		const codeElement = wrapper.find('.input-code');
		expect(codeElement.exists()).toBe(true);
	});

	it('should default to plaintext when language is empty string', async () => {
		wrapper = mount(InputCode, {
			props: {
				language: '',
				value: 'test code',
			},
			global,
		});

		expect(wrapper.exists()).toBe(true);
		const codeElement = wrapper.find('.input-code');
		expect(codeElement.exists()).toBe(true);
	});

	it('should work normally with valid language', async () => {
		wrapper = mount(InputCode, {
			props: {
				language: 'javascript',
				value: 'console.log("test");',
			},
			global,
		});

		expect(wrapper.exists()).toBe(true);
		const codeElement = wrapper.find('.input-code');
		expect(codeElement.exists()).toBe(true);
	});

	it('should hide action buttons when nonEditable is true', () => {
		const wrapper = mount(InputCode, {
			props: {
				language: 'javascript',
				value: 'console.log("test");',
				template: 'console.log("template");',
				nonEditable: true,
				// Note: if nonEditable is true, disabled prop will also be true
				disabled: true,
			},
			global,
		});

		expect(wrapper.find('.input-code.non-editable').exists()).toBe(true);
		expect(wrapper.find('.input-code.non-editable button').exists()).toBe(false);
	});

	it('should render action button disabled when disabled is true', () => {
		const wrapper = mount(InputCode, {
			props: {
				language: 'javascript',
				value: 'console.log("test");',
				template: 'console.log("template");',
				disabled: true,
			},
			global,
		});

		expect(wrapper.classes()).toEqual(expect.arrayContaining(['input-code', 'disabled']));
		expect(wrapper.attributes('dir')).toBe('ltr');
		expect(wrapper.find('.input-code button').attributes('disabled')).toBeDefined();
		expect(wrapper.find('.input-code button').attributes('aria-label')).toBe('Fill with Template Value');
	});
});
