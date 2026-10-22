// The private layout (D-157, owner 2026-10-22): the module list is the dark icon rail at the start of the window at every
// width, like the Directus module bar; the navigation of the open module is the sidebar next to it, inline from the `xl`
// breakpoint (1280 px), a drawer below it.
import { expect, type Locator, type Page } from '@playwright/test';

/** The module icons of the rail (names are their accessible names). */
export async function moduleBar(page: Page): Promise<Locator> {
	const bar = page.getByTestId('module-bar');
	await expect(bar).toBeVisible();
	return bar;
}

/** The sidebar with the open module's navigation; below `xl` this opens its drawer. */
export async function moduleNavigation(page: Page): Promise<Locator> {
	const navigation = page.locator('aside#navigation');
	const open = page.getByRole('button', { name: 'Open navigation' });

	await expect(navigation.or(open).first()).toBeVisible();
	if (!(await navigation.isVisible())) await open.click();
	await expect(navigation).toBeVisible();
	return navigation;
}

/** The bell: at the bottom of the module rail, above the user menu (D-157). */
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
