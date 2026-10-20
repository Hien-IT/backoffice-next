// Backoffice (spec 016 US5-4): what Directus app/src/constants.ts MODULE_BAR_DEFAULT and extensions.ts useAllModules
// give system-modules. The app's own MODULE_BAR_DEFAULT (constants.ts) leaves out the docs link (FR-081, D-49) and the
// app registers six modules (D-41); the list of this interface keeps both as Directus has them, so a saved module bar
// keeps the docs link and the visual / deployments modules.
import { sortBy } from 'lodash-es';
import { computed } from 'vue';
import { DIRECTUS_DOCS_URL, MODULE_BAR_DEFAULT, type ModuleBarPart } from '../../../constants.ts';
import { i18n } from '../../../lang/index.ts';
import { getInternalModules } from '../../../modules/index.ts';
import { translate } from '../../../utils/translate-object-values.ts';

const DOCS_LINK: ModuleBarPart = {
	type: 'link',
	id: 'docs',
	enabled: true,
	name: '$t:documentation',
	icon: 'help',
	url: DIRECTUS_DOCS_URL,
};

/** Directus 11.17.4 MODULE_BAR_DEFAULT: the app default with the docs link before settings. */
export const DIRECTUS_MODULE_BAR_DEFAULT: ModuleBarPart[] = [
	...MODULE_BAR_DEFAULT.filter((part) => part.id !== 'settings'),
	DOCS_LINK,
	...MODULE_BAR_DEFAULT.filter((part) => part.id === 'settings'),
];

/** Directus modules without a Backoffice port (D-41): only their id, name and icon. */
export const OUT_OF_SCOPE_MODULES = [
	{ id: 'deployments', name: '$t:deployment.deployment', icon: 'rocket_launch' },
	{ id: 'visual', name: '$t:visual_editor', icon: 'edit_square' },
];

type ModuleInfo = { id: string; name: string; icon: string; hidden?: boolean | undefined };

/** Directus useAllModules: every internal module (registered or not), translated. */
export function useAllModules() {
	return computed<ModuleInfo[]>(() => {
		void i18n.global.locale.value;

		return translate(
			sortBy(
				[
					...getInternalModules().map(({ id, name, icon, hidden }) => ({ id, name, icon, hidden })),
					...OUT_OF_SCOPE_MODULES,
				],
				'id',
			),
		);
	});
}
