// Ported from directus/api/src/services/settings.ts
// Backoffice: setOwner does not send the owner report to COMPLIANCE_URL (telemetry is out of scope, Principle XI;
// D-38, Clarifications of spec 010). The owner fields are written as Directus writes them once the report was sent
// (project_status null), so no `pending` status makes the `project` job of a Directus next to this app send it later.
import type { AbstractServiceOptions, OwnerInformation } from '@backoffice/types';
import { useLogger } from '../logger/index.js';
import { ItemsService } from './items.service.js';

export class SettingsService extends ItemsService {
	constructor(options: AbstractServiceOptions) {
		super('directus_settings', options);
	}

	async setOwner(data: OwnerInformation) {
		// Backoffice: one warning line instead of sendReport(); no owner email in the log (D-38).
		useLogger().warn(
			`Backoffice: owner report is out of scope; project owner for ${data.org_name || '(no org)'} not reported`,
		);

		return await this.upsertSingleton({
			project_owner: data.project_owner,
			project_usage: data.project_usage,
			org_name: data.org_name,
			product_updates: data.product_updates,
			project_status: null,
		});
	}
}
