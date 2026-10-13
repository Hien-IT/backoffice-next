// Ported from directus/api/src/services/panels.ts
import type { AbstractServiceOptions } from '@backoffice/types';
import { ItemsService } from './items.service.js';

export class PanelsService extends ItemsService {
	constructor(options: AbstractServiceOptions) {
		super('directus_panels', options);
	}
}
