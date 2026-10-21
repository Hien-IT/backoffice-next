// Spec 021 parity fixture: no "-" in the name, so the migration runner ignores this file.
export async function up() {
	throw new Error('utils.js must never run');
}
