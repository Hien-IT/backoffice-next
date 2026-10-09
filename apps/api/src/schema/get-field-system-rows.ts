// Ported from directus/api/src/utils/get-field-system-rows.ts
import formatTitle from '@backoffice/format-title';
import { systemFieldRows } from '@backoffice/system-data';
import type { FieldMeta } from '@backoffice/types';
import { getAuthProviders } from '../utils/get-auth-providers.js';

// Dynamically populate auth providers field
export function getSystemFieldRowsWithAuthProviders(): FieldMeta[] {
	return systemFieldRows.map((systemField) => {
		if (systemField.collection === 'directus_users' && systemField.field === 'provider') {
			if (!systemField.options) systemField.options = {};

			systemField.options['choices'] = getAuthProviders().map(({ name }) => ({
				text: formatTitle(name),
				value: name,
			}));
		}

		return systemField;
	});
}
