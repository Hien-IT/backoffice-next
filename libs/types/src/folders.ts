// Ported from directus/packages/types/src/folders.ts
export type Folder = {
	id: string;
	name: string;
	parent: string | null;
};
