// Ported from directus/app/src/utils/get-version-display-name.ts
import formatTitle from '@directus/format-title';
import type { ContentVersion } from '@directus/types';
import { isNil } from 'lodash-es';
import { DRAFT_VERSION_KEY } from '../constants.ts';
import { i18n } from '../lang/index.ts';

export function getVersionDisplayName(version: Pick<ContentVersion, 'key' | 'name'> | null) {
	if (version === null) return i18n.global.t('main_version');

	if (version.key === DRAFT_VERSION_KEY) return i18n.global.t('draft');

	if (isNil(version.name)) return formatTitle(version.key);

	return version.name;
}
