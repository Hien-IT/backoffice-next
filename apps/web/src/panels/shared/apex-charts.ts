// Backoffice (spec 018 FR-109, research R1): ApexCharts 4.7.0 (the Directus version) loaded on demand, so the chart
// library and its theme overrides stay in a lazy chunk; Directus imports it statically in each chart panel.
import type ApexChartsType from 'apexcharts';
import '../../styles/apexcharts.css';

let loader: Promise<typeof ApexChartsType> | null = null;

export function loadApexCharts(): Promise<typeof ApexChartsType> {
	loader ??= import('apexcharts').then((module) => module.default);
	return loader;
}

/**
 * The Directus theme variables the chart panels pass to ApexCharts, as the theme-token variables of
 * styles/apexcharts.css (D-108: the default chart color is the brand token).
 */
export const THEME = {
	primary: 'var(--chart-primary)',
	foreground: 'var(--chart-foreground)',
	foregroundSubdued: 'var(--chart-foreground-subdued)',
	borderColor: 'var(--chart-border)',
	borderColorSubdued: 'var(--chart-border-subdued)',
	background: 'var(--chart-background)',
	fontFamily: 'var(--chart-font)',
} as const;

/** Whether the user asked for less motion (charts then render without animation). */
export function prefersReducedMotion(): boolean {
	return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
