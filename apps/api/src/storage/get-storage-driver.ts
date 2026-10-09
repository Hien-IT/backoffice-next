// Ported from directus/api/src/storage/get-storage-driver.ts (local and s3 only: other drivers are out of scope,
// Principle XI; the startup check stops before reaching here, FR-034)
import type { Driver } from '@backoffice/storage';

export const _aliasMap: Record<string, string> = {
	local: '@backoffice/storage-driver-local',
	s3: '@backoffice/storage-driver-s3',
	supabase: '@backoffice/storage-driver-supabase',
	gcs: '@backoffice/storage-driver-gcs',
	azure: '@backoffice/storage-driver-azure',
	cloudinary: '@backoffice/storage-driver-cloudinary',
};

export const getStorageDriver = async (driverName: string): Promise<typeof Driver> => {
	if (driverName in _aliasMap) {
		driverName = _aliasMap[driverName]!;
	} else {
		throw new Error(`Driver "${driverName}" doesn't exist.`);
	}

	return (await import(driverName)).default;
};
