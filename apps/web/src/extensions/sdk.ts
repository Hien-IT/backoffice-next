// Ported from directus/packages/extensions-sdk/src/index.ts
// Backoffice (spec 020, research R4, contracts/web.md §3): the module app extensions import as
// `@directus/extensions-sdk`, served through the import map of index.html. The composables read the injects of
// directus-shim/use-system.ts; the define* helpers are identities (defineTheme too: theme extensions are not loaded, D-135).
export {
	createLayoutWrapper,
	isWritableProp,
	keyMap,
	sizeProps,
	systemKeys,
	translateShortcut,
	useApi,
	useCollection,
	useCustomSelection,
	useCustomSelectionMultiple,
	useElementSize,
	useExtensions,
	useFilterFields,
	useGroupable,
	useGroupableParent,
	useItems,
	useLayout,
	useSdk,
	useShortcut,
	useSizeClass,
	useStores,
	useSync,
} from '@directus/composables';
export { getFieldsFromTemplate, getRelationType } from '@directus/utils';

const identity = <T>(config: T): T => config;

export const defineInterface = identity;
export const defineDisplay = identity;
export const defineLayout = identity;
export const defineModule = identity;
export const definePanel = identity;
export const defineOperationApp = identity;
export const defineOperationApi = identity;
export const defineHook = identity;
export const defineEndpoint = identity;
export const defineTheme = identity;
