// Ported from directus/app/src/types/login.ts
export interface AuthProvider {
	driver: string;
	name: string;
	icon?: string;
	label?: string;
}
