import { expect, test } from 'vitest';
import { ref } from 'vue';
import { syncRefProperty } from './sync-ref-property.ts';

test('reads the property or the default, and writes a new object', () => {
	const options = ref<{ size?: number; name?: string }>({});
	const defaultSize = ref(4);
	const size = syncRefProperty(options, 'size', defaultSize);

	expect(size.value).toBe(4);
	defaultSize.value = 5;
	expect(size.value).toBe(5);

	const before = { name: 'a' };
	options.value = before;
	size.value = 8;

	expect(options.value).toEqual({ name: 'a', size: 8 });
	expect(options.value).not.toBe(before);
	expect(size.value).toBe(8);
});
