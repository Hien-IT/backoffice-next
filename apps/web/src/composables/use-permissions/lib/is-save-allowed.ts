// Ported from directus/app/src/composables/use-permissions/lib/is-save-allowed.ts
import { computed, type ComputedRef, unref } from 'vue';
import { type IsNew } from '../types/index.ts';

export const isSaveAllowed = (isNew: IsNew, createAllowed: ComputedRef<boolean>, updateAllowed: ComputedRef<boolean>) =>
	computed(() => {
		if (unref(isNew)) {
			return createAllowed.value;
		}

		return updateAllowed.value;
	});
