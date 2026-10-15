// Ported from directus/app/src/components/v-form/types.ts
// Backoffice: indicatorStyle is left out: no registered interface sets it, so the Directus default applies (groups
// `hidden`, other fields `active`, see BoForm.vue).
import type { DeepPartial, Field, InterfaceConfig } from '@directus/types';
import type { ComputedRef, InjectionKey } from 'vue';

export type FormField = Omit<DeepPartial<Field>, 'meta'> & {
	field: string;
	name: string;
	meta?: DeepPartial<Field['meta']> & {
		non_editable?: boolean;
	};
} & Pick<InterfaceConfig, 'hideLabel' | 'hideLoader'>;

export interface ComparisonContext {
	side: 'base' | 'incoming';
	fields: Set<string>;
	revisionFields?: Set<string> | undefined;
	selectedFields: string[];
	onToggleField: ((field: string) => void) | null;
	showDifferencesOnly?: boolean | undefined;
}

/** Backoffice: a group's nested BoForm reads the comparison of its parent form (Directus passes it as a prop). */
export const FORM_COMPARISON: InjectionKey<ComputedRef<ComparisonContext | undefined>> = Symbol('form-comparison');

export type FieldValues = {
	[field: string]: any;
};

/**
 * Backoffice: ids FormField provides to its interface so the control can be linked to the label (`id` or
 * `aria-labelledby`), the note and the validation message (`aria-describedby`, `aria-invalid`) (FR-094).
 */
export type FormFieldA11y = { inputId: string; labelId: string; describedBy: string | undefined; invalid: boolean };

export const FORM_FIELD_A11Y: InjectionKey<ComputedRef<FormFieldA11y>> = Symbol('form-field-a11y');

/**
 * Backoffice: grid placement of `meta.width` (layout-patterns §8, Directus `form-grid` mixin). The same classes work
 * in the two-column grid and in the `with-fill` grid (two 342px columns and the fill column).
 */
export const WIDTH_CLASSES: Record<string, string> = {
	half: 'col-start-1 col-span-1',
	'half-left': 'col-start-1 col-span-1',
	'half-right': 'col-start-2 col-span-1',
	full: 'col-start-1 col-span-2',
	fill: 'col-span-full',
};
