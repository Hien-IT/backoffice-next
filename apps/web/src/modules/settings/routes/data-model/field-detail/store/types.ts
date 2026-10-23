// Ported from directus/app/src/modules/settings/routes/data-model/field-detail/store/types.ts
import { useFieldDetailStore } from './index.ts';

export type StateUpdates = DeepPartial<ReturnType<typeof useFieldDetailStore>['$state']>;
export type State = ReturnType<typeof useFieldDetailStore>['$state'];
export type HelperFunctions = {
	getCurrent: (path: string) => any;
	hasChanged: (path: string) => boolean;
};

/**
 * Backoffice: DeepPartial of @directus/types without `exactOptionalPropertyTypes` trouble: the DR store and its
 * alterations set properties to `undefined` to reset them.
 */
export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> | undefined } : T;
