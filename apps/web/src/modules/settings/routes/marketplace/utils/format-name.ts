// Ported from directus/app/src/modules/settings/routes/marketplace/utils/format-name.ts
import formatTitle from '@directus/format-title';
import type { RegistryExtension, RegistryListItem } from '../types.ts';

type Extension = RegistryListItem | RegistryExtension;

export const formatName = (extension: Extension) => {
	let name = extension.name;

	if (name.startsWith('@')) {
		name = name.split('/')[1]!;
	}

	if (name.startsWith('directus-extension-')) {
		name = name.substring('directus-extension-'.length);
	}

	return formatTitle(name);
};
