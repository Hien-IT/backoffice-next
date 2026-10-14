// The module bar of the private layout: inline from the `lg` breakpoint (922 px), inside the navigation drawer below
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
