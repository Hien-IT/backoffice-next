// Directus has no test for v-error-boundary.vue: fallback slot, warning, stopPropagation.
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h, nextTick, onErrorCaptured } from 'vue';
import ErrorBoundary from './ErrorBoundary.vue';

const Broken = defineComponent({
	name: 'BrokenChild',
	setup() {
		return () => {
			throw new Error('boom');
		};
	},
});

afterEach(() => {
	vi.restoreAllMocks();
});

function host(stopPropagation: boolean, onParentError: () => void) {
	return defineComponent({
		setup() {
			onErrorCaptured(() => {
				onParentError();
				return false;
			});

			return () =>
				h(ErrorBoundary, { stopPropagation }, { default: () => h(Broken), fallback: () => h('p', 'fallback') });
		},
	});
}

describe('ErrorBoundary', () => {
	test('renders the fallback, warns with the component name and stops the error', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const parent = vi.fn();
		const wrapper = mount(host(true, parent));

		await nextTick();
		expect(wrapper.text()).toBe('fallback');
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('[BrokenChild-error]'));
		expect(parent).not.toHaveBeenCalled();
	});

	test('passes the error on when stopPropagation is false', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const parent = vi.fn();
		mount(host(false, parent));

		await nextTick();
		expect(parent).toHaveBeenCalled();
	});
});
