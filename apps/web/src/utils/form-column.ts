// Backoffice (layout-patterns §5): the item pages put their body at the left (owner 2026-10-22; centred from 2026-10-18)
// in a column as wide as the form shows: two 21.375rem columns and their gap, or 64rem when a field takes the `fill`
// column (layout-patterns §8), plus the form card padding and border (2 × 1.5rem + 2px, D-150) so the fields keep
// their DR widths.
export function formColumnClass(fields: { meta?: { width?: string | null } | null }[]): string {
	return fields.some((field) => field.meta?.width === 'fill') ? 'w-full max-w-[67.125rem]' : 'w-full max-w-[47.375rem]';
}
