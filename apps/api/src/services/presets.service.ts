// Ported from directus/api/src/services/presets.ts
import type { AbstractServiceOptions } from '@backoffice/types';
import { ItemsService } from './items.service.js';

export class PresetsService extends ItemsService {
	constructor(options: AbstractServiceOptions) {
		super('directus_presets', options);
	}
}
