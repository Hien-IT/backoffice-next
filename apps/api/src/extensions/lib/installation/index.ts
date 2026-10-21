// Ported from directus/api/src/extensions/lib/installation/index.ts
import { InstallationManager } from './manager.js';

let manager: InstallationManager | undefined;

export function getInstallationManager(): InstallationManager {
	if (manager) {
		return manager;
	}

	manager = new InstallationManager();

	return manager;
}
