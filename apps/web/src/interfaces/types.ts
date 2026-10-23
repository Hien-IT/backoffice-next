import type { ContentVersion, InterfaceConfig as DirectusInterfaceConfig, Field } from '@directus/types';

// Config of an interface (`<id>/index.ts`), as in DR. `options` keeps every DR form (array,
// `{ standard, advanced }`, function, null, or a component: `list` and `map` since 016, D-56 lifted).
export type InterfaceConfig = DirectusInterfaceConfig;

export type InterfaceOptions = InterfaceConfig['options'];

/** Identity helper, like `defineInterface` of @directus/extensions-sdk. */
export function defineInterface(config: InterfaceConfig): InterfaceConfig {
	return config;
}

/** Props every interface receives from the form (contracts/registry.md §1), besides `field.meta.options`. */
export interface InterfaceProps {
	value?: unknown;
	disabled?: boolean;
	nonEditable?: boolean;
	loading?: boolean;
	autofocus?: boolean;
	batchMode?: boolean;
	batchActive?: boolean;
	comparisonMode?: boolean;
	comparisonActive?: boolean;
	comparisonSide?: string;
	width?: string;
	type?: string;
	collection?: string;
	field?: string;
	fieldData?: Field;
	primaryKey?: string | number | null;
	length?: number | null;
	direction?: 'ltr' | 'rtl';
	rawEditorEnabled?: boolean;
	version?: ContentVersion | null;
}

/** Extra props of group interfaces (contracts/registry.md §1). */
export interface GroupInterfaceProps extends InterfaceProps {
	fields?: Field[];
	values?: Record<string, unknown>;
	initialValues?: Record<string, unknown>;
	batchActiveFields?: string[];
	validationErrors?: Record<string, unknown>[];
	badge?: string;
	group?: string;
}

export type InterfaceEmits = {
	input: [value: unknown];
	setFieldValue: [payload: { field: string; value: unknown }];
};
