// Ported from directus/api/src/services/dashboards.ts
import type { AbstractServiceOptions } from '@backoffice/types';
import { ItemsService } from './items.service.js';

export class DashboardsService extends ItemsService {
	constructor(options: AbstractServiceOptions) {
		super('directus_dashboards', options);
	}
}
