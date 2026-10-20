// The module list of the private layout: in the sidebar, inline from the `xl` breakpoint (1280 px), inside the drawer below
// it (like the Directus app); this opens the drawer when needed.
import { expect, type Locator, type Page } from '@playwright/test';

export async function moduleBar(page: Page): Promise<Locator> {
	const bar = page.getByTestId('module-bar');
	const open = page.getByRole('button', { name: 'Open navigation' });

	await expect(bar.or(open).first()).toBeVisible();
	if (!(await bar.isVisible())) await open.click();
	await expect(bar).toBeVisible();
	return bar;
}

/** The bell: under the sidebar logo from `xl`, at the end of the header below it (D-127). */
export const notificationsBell = (page: Page): Locator => page.locator('button[aria-label^="Notifications, "]');

/** Opens the bell panel (D-132: latest inbox, mark as read, "View all"). */
export async function openNotificationsPanel(page: Page): Promise<Locator> {
	await notificationsBell(page).click();
	const viewAll = page.getByRole('button', { name: 'View all', exact: true });
	await expect(viewAll).toBeVisible();
	return viewAll;
}

/** Opens the notifications drawer through the bell panel's "View all". */
export async function openNotificationsDrawer(page: Page): Promise<Locator> {
	await (await openNotificationsPanel(page)).click();
	const drawer = page.getByRole('dialog', { name: 'Notifications', exact: true });
	await expect(drawer).toBeVisible();
	return drawer;
}
