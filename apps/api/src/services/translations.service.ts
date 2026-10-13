// Ported from directus/api/src/services/translations.ts
// Backoffice: stub until T044 of spec 010 ports the duplicate key and language checks. Until then it is a plain
// ItemsService, the same behaviour as the generic ItemsService of D-31 it replaces in getService.
import type { AbstractServiceOptions } from '@backoffice/types';
import { ItemsService } from './items.service.js';

export class TranslationsService extends ItemsService {
	constructor(options: AbstractServiceOptions) {
		super('directus_translations', options);
	}
}
