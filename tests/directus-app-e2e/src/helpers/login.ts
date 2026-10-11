// Signs in to the Directus app (session mode, like the app does) through the UI at `baseURL`.
import { expect, type Page } from '@playwright/test';

export const ADMIN = { email: 'admin@example.com', password: 'password' };

export async function login(page: Page, baseURL: string): Promise<void> {
	await page.goto(`${baseURL}/admin/login`);
	await page.locator('input[type="email"]').fill(ADMIN.email);
	await page.locator('input[type="password"]').fill(ADMIN.password);
	await page.locator('button[type="submit"]').click();
	await expect(page).not.toHaveURL(/\/admin\/login/, { timeout: 30_000 });
}
