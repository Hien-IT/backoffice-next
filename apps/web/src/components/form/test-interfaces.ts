// Test-only fake interfaces for the form component tests (no real interface is registered yet in 013 Phase 2).
// Tests mock the registry with:
//   vi.mock('../../interfaces/index.ts', async () => (await import('./test-interfaces.ts')).registryMock);
import type { InterfaceConfig } from '@directus/types';
import { type Component, defineComponent, h, inject, type PropType } from 'vue';
import { FORM_FIELD_A11Y } from './types.ts';

const FakeInput = defineComponent({
	name: 'FakeInput',
	inheritAttrs: false,
	props: {
		value: { type: null, default: null },
		disabled: Boolean,
		autofocus: Boolean,
		placeholder: { type: String, default: undefined },
		choices: { type: Array, default: undefined },
		direction: { type: String, default: undefined },
		primaryKey: { type: [String, Number], default: undefined },
		width: { type: String, default: undefined },
		length: { type: Number, default: undefined },
		type: { type: String, default: undefined },
		field: { type: String, default: undefined },
		collection: { type: String, default: undefined },
		batchMode: Boolean,
		batchActive: Boolean,
		nonEditable: Boolean,
		loading: Boolean,
	},
	emits: ['input', 'setFieldValue'],
	setup(props, { emit }) {
		const a11y = inject(FORM_FIELD_A11Y, null);

		return () =>
			h('input', {
				id: a11y?.value.inputId,
				'aria-describedby': a11y?.value.describedBy,
				'aria-invalid': a11y?.value.invalid ? 'true' : undefined,
				value: props.value ?? '',
				disabled: props.disabled,
				placeholder: props.placeholder,
				'data-autofocus': props.autofocus ? 'true' : undefined,
				onInput: (event: Event) => emit('input', (event.target as HTMLInputElement).value),
			});
	},
});

const Broken = defineComponent({
	name: 'BrokenInterface',
	props: { value: { type: null, default: null } },
	setup() {
		return () => {
			throw new Error('broken interface');
		};
	},
});

const ValuesProbe = defineComponent({
	name: 'ValuesProbe',
	inheritAttrs: false,
	props: { value: { type: null, default: null } },
	setup() {
		const values = inject<{ value: Record<string, unknown> }>('values');
		return () => h('output', { 'data-values': JSON.stringify(values?.value) });
	},
});

let groupForm: Component | null = null;

/** The fake group renders a nested form like Directus group-detail (set to BoForm by the test). */
export function setGroupForm(component: Component) {
	groupForm = component;
}

const FakeGroup = defineComponent({
	name: 'FakeGroup',
	inheritAttrs: false,
	props: {
		field: { type: Object as PropType<{ field: string; name: string }>, required: true },
		fields: { type: Array, required: true },
		values: { type: Object, default: () => ({}) },
		initialValues: { type: Object, default: () => ({}) },
		disabled: Boolean,
		batchMode: Boolean,
		batchActiveFields: { type: Array, default: () => [] },
		primaryKey: { type: [String, Number], default: undefined },
		loading: Boolean,
		validationErrors: { type: Array, default: () => [] },
		direction: { type: String, default: undefined },
	},
	emits: ['apply'],
	setup(props, { emit }) {
		return () =>
			h('section', { 'data-group': props.field.field }, [
				h('h3', props.field.name),
				h(groupForm!, {
					fields: props.fields,
					initialValues: props.initialValues,
					modelValue: props.values,
					group: props.field.field,
					primaryKey: props.primaryKey,
					disabled: props.disabled,
					batchMode: props.batchMode,
					loading: props.loading,
					validationErrors: props.validationErrors,
					showNoVisibleFields: false,
					showValidationErrors: false,
					direction: props.direction,
					'onUpdate:modelValue': (values: Record<string, unknown>) => emit('apply', values),
				}),
			]);
	},
});

function config(id: string, component: Component, extra: Partial<InterfaceConfig> = {}): InterfaceConfig {
	return { id, name: id, icon: 'box', component, options: null, types: ['string'], ...extra } as InterfaceConfig;
}

export const FAKE_INTERFACES: Record<string, InterfaceConfig> = {
	input: config('input', FakeInput),
	datetime: config('datetime', FakeInput),
	'input-multiline': config('input-multiline', FakeInput),
	'hide-label': config('hide-label', FakeInput, { hideLabel: true }),
	'no-loader': config('no-loader', FakeInput, { hideLoader: true }),
	broken: config('broken', Broken),
	'values-probe': config('values-probe', ValuesProbe),
	'group-detail': config('group-detail', FakeGroup, { group: 'group', types: ['alias'] }),
	'presentation-divider': config('presentation-divider', FakeInput, { hideLabel: true, types: ['alias'] }),
};

export const registryMock = {
	getInterface: (id: string | null | undefined) => (id ? FAKE_INTERFACES[id] : undefined),
	getInterfaces: () => Object.values(FAKE_INTERFACES),
	sortInterfaces: (list: InterfaceConfig[]) => list,
};
