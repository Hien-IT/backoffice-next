// Signs in through the login form of the Backoffice app (local provider). Names are the en-US strings of the Directus
// app (`email`, `password`, `otp`, `sign_in`); a field matches by its label or, like the Directus form, its placeholder.
import type { Page } from '@playwright/test';
import type { AdminApi } from './api.js';
import { ADMIN } from './config.js';

function field(page: Page, name: string) {
	return page.getByLabel(name, { exact: true }).or(page.getByPlaceholder(name, { exact: true }));
}

/**
 * Fills and submits the form of /admin/login (the page must be open). With `otp`, submits again once the OTP field shows
 * (like the Directus form, it appears after the API answers INVALID_OTP).
 */
export async function login(page: Page, user: { email: string; password: string; otp?: string } = ADMIN) {
	const submit = page.getByRole('button', { name: 'Sign In', exact: true });
	await field(page, 'Email').fill(user.email);
	await field(page, 'Password').fill(user.password);
	await submit.click();
	if (user.otp === undefined) return;
	await field(page, 'One-Time Password').fill(user.otp);
	await submit.click();
}

/**
 * Sign-in lands on the admin's last_page (012 FR-018). Specs that expect /admin/content after sign-in, or that leave the
 * admin on another page, reset it first. The parity APIs cache /users/me (CACHE_ENABLED), so the cache is cleared too:
 * without it the app reads the old last_page.
 */
export async function resetLastPage(api: AdminApi): Promise<void> {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
	await api.call('POST', '/utils/cache/clear');
}
