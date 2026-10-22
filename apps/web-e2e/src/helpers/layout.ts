// The private layout (D-157, owner 2026-10-22): one sidebar column (Arc style) with the module tiles on the project color,
// the open module's navigation, then the user menu and the bell; inline from the `xl` breakpoint (1280 px), a drawer
// below it (like the Directus app). These open the drawer when needed.
import { expect, type Locator, type Page } from '@playwright/test';

/** The module tiles of the sidebar (names are their accessible names); below `xl` this opens the drawer. */
export async function moduleBar(page: Page): Promise<Locator> {
	await moduleNavigation(page);
	const bar = page.getByTestId('module-bar');
	await expect(bar).toBeVisible();
	return bar;
}

/**
 * Opens the "Links and extensions" tile menu (D-162: the module_bar links and the app extension modules) and returns
 * its items; Escape closes it.
 */
export async function openModuleMenu(page: Page): Promise<Locator> {
	await (await moduleBar(page)).getByRole('button', { name: /Links and extensions/ }).click();
	const items = page.locator('[role^="menuitem"]');
	await expect(items.first()).toBeVisible();
	return items;
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

/** The bell: at the bottom of the sidebar, next to the user menu (D-157). */
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
