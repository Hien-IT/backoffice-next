// Ported from directus/app/src/utils/get-folder-filter.ts
import type { Filter } from '@directus/types';
import { subDays } from 'date-fns';
import type { SpecialFolder } from '../types/folders.ts';

export function getFolderFilter(folder?: string, special?: SpecialFolder, currentUserId?: string): Filter {
	const filterParsed: Filter & { _and: Filter[] } = {
		_and: [
			{
				type: {
					_nnull: true,
				},
			},
		],
	};

	if (!special) {
		if (folder) {
			filterParsed._and.push({
				folder: {
					_eq: folder,
				},
			});
		} else {
			filterParsed._and.push({
				folder: {
					_null: true,
				},
			});
		}
	}

	if (special === 'mine' && currentUserId) {
		filterParsed._and.push({
			uploaded_by: {
				_eq: currentUserId,
			},
		});
	}

	if (special === 'recent') {
		filterParsed._and.push({
			uploaded_on: {
				_gt: subDays(new Date(), 5).toISOString(),
			},
		});
	}

	return filterParsed;
}
