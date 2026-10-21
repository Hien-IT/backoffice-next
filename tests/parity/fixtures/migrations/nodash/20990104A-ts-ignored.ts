// Spec 021 parity fixture: .ts is not a custom migration extension, so the migration runner ignores this file.
export async function up(): Promise<void> {
	throw new Error('a .ts custom migration must never run');
}
