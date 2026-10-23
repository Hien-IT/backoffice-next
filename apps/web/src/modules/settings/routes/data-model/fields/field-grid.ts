// Feature 016 (FR-021 to FR-025): what the field grid (FieldsManagement.vue) gives the rows of its nested lists
// (FieldSelect.vue). DR passes the fields through props and the nested sort through the `setNestedSort` event
// chain; here one injection also carries the row menu, the dialogs and the D-96 keyboard moves.
import type { Field } from '@directus/types';
import type { InjectionKey } from 'vue';
import type { BoMenuItem } from '../../../../../components/BoMenu.vue';

export interface FieldGridContext {
	/** Usable (not system) fields of the collection, sorted like DR parsedFields. */
	fields: () => Field[];
	/** Fields whose `meta.group` is `group` (null: the root list). */
	childrenOf: (group: string | null) => Field[];
	/** Saves the order of `list`, all of them in `group` (DR setSort / onGroupSortChange). */
	sortList: (list: Field[], group: string | null) => void;
	/** A vuedraggable `change` of the list of `group`: a row added by mouse from another list, or removed from it. */
	onChange: (group: string | null, event: unknown) => void;
	/** "Into the group above" is possible for the row at `index` (the row above is a group). */
	canIndent: (list: Field[], index: number) => boolean;
	indent: (list: Field[], index: number) => void;
	outdent: (list: Field[], index: number, group: string | null) => void;
	/** The row menu (field-select-menu.vue). */
	menuFor: (field: Field) => BoMenuItem[];
	/** Opens the field drawer, configuring a field without meta first (FieldSelect openFieldDetail). */
	open: (field: Field) => void;
}

export const FIELD_GRID: InjectionKey<FieldGridContext> = Symbol('field-grid');

/** Two columns from 600px (the form grid of 013); `half` takes one, `full` and `fill` both. */
export const widthClass = (field: Field) => (field.meta?.width === 'half' ? undefined : 'min-[600px]:col-span-2');

export const GRID = 'm-0 grid list-none grid-cols-1 gap-2 p-0 min-[600px]:grid-cols-2';
