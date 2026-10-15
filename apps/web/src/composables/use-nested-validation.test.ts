// Backoffice: Directus has no test for use-nested-validation.ts.
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import { defineComponent, h } from 'vue';
import { useInjectNestedValidation, useNestedValidation } from './use-nested-validation.ts';

test('children report errors per field, empty lists are dropped, reset clears them', () => {
	let parent!: ReturnType<typeof useNestedValidation>;
	let child!: ReturnType<typeof useInjectNestedValidation>;

	const Child = defineComponent({
		setup() {
			child = useInjectNestedValidation();
			return () => null;
		},
	});

	mount(
		defineComponent({
			setup() {
				parent = useNestedValidation();
				return () => h(Child);
			},
		}),
	);

	child.updateNestedValidationErrors('a', [{ field: 'a.x' }]);
	child.updateNestedValidationErrors('b', []);
	child.updateNestedValidationErrors('c', [{ field: 'c.y' }, { field: 'c.z' }]);
	expect(parent.nestedValidationErrors.value).toEqual([{ field: 'a.x' }, { field: 'c.y' }, { field: 'c.z' }]);

	child.updateNestedValidationErrors('a', []);
	expect(parent.nestedValidationErrors.value).toEqual([{ field: 'c.y' }, { field: 'c.z' }]);

	parent.resetNestedValidationErrors();
	expect(parent.nestedValidationErrors.value).toEqual([]);
});

test('without a provider the injected updater is a no-op', () => {
	let child!: ReturnType<typeof useInjectNestedValidation>;

	mount(
		defineComponent({
			setup() {
				child = useInjectNestedValidation();
				return () => null;
			},
		}),
	);

	expect(() => child.updateNestedValidationErrors('a', [{}])).not.toThrow();
});
