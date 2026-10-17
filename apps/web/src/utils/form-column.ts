// Backoffice (owner 2026-10-18, layout-patterns §5): the item pages centre their body in a column as wide as the form
// shows: two 21.375rem columns and their gap, or 64rem when a field takes the `fill` column (layout-patterns §8).
export function formColumnClass(fields: { meta?: { width?: string | null } | null }[]): string {
	return fields.some((field) => field.meta?.width === 'fill')
		? 'mx-auto w-full max-w-5xl'
		: 'mx-auto w-full max-w-[44.25rem]';
}
