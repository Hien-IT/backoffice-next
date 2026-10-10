// Ported from directus/packages/types/src/authentication.ts
export type LoginResult = {
	accessToken: string;
	refreshToken: string;
	expires: number;
	id?: string;
};
