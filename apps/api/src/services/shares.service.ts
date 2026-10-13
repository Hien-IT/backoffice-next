// Ported from directus/api/src/services/shares.ts
// Backoffice: stub until T030 of spec 010 ports createOne, updateMany, deleteMany, login and invite. Until then it is a
// plain ItemsService, the same behaviour as the generic ItemsService of D-31 it replaces in getService.
import type { AbstractServiceOptions } from '@backoffice/types';
import { ItemsService } from './items.service.js';

export class SharesService extends ItemsService {
	constructor(options: AbstractServiceOptions) {
		super('directus_shares', options);
	}
}
