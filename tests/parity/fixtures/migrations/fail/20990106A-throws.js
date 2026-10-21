// Spec 021 parity fixture: a custom migration that fails (failed bootstrap of compose and of the Helm Job).
export async function up() {
	throw new Error('20990106A fails on purpose');
}

export async function down() {}
