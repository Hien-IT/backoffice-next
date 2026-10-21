// Ported from directus/api/src/types/migration.ts
export type Migration = {
	version: string;
	name: string;
	timestamp: Date;
};
