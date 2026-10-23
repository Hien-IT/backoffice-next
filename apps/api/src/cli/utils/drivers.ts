// Ported from directus/api/src/cli/utils/drivers.ts
import type { Driver } from '@backoffice/types';

// Backoffice (spec 021 D-146): `init` offers the vendors Backoffice installs (D-145); the others are set up with DR.
export const drivers: Partial<Record<Driver, string>> = {
	pg: 'PostgreSQL / Redshift',
	sqlite3: 'SQLite',
};

export function getDriverForClient(client: string): Driver | null {
	for (const [key, value] of Object.entries(drivers)) {
		if (value === client) return key as Driver;
	}

	return null;
}
