// Ported from directus/app/src/modules/settings/routes/data-model/field-detail/store/alterations/group.ts
import { set } from 'lodash-es';
import type { HelperFunctions, State, StateUpdates } from '../types.ts';

export function applyChanges(updates: StateUpdates, _state: State, helperFn: HelperFunctions) {
	const { hasChanged } = helperFn;

	if (hasChanged('localType')) {
		removeSchema(updates);
		setTypeToAlias(updates);
		setSpecialToGroup(updates);
	}
}

export function removeSchema(updates: StateUpdates) {
	set(updates, 'field.schema', undefined);
}

export function setTypeToAlias(updates: StateUpdates) {
	set(updates, 'field.type', 'alias');
}

export function setSpecialToGroup(updates: StateUpdates) {
	set(updates, 'field.meta.special', ['alias', 'no-data', 'group']);
}
