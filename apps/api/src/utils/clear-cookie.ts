import type { CookieOptions, Response } from 'express';

/**
 * Backoffice: `res.clearCookie` of Express 4.21.2, which DR 11.17.4 runs (research R4 of spec 003). Express 4
 * merges the options over `{ expires: new Date(1), path: '/' }`, so a `maxAge` option wins and the cleared cookie
 * keeps `Max-Age` and a future `Expires`; Express 5 drops `maxAge`. DR passes REFRESH/SESSION_COOKIE_OPTIONS,
 * so clients see the Express 4 header.
 */
export function clearCookie(res: Response, name: string, options?: CookieOptions): Response {
	return res.cookie(name, '', { expires: new Date(1), path: '/', ...options });
}
