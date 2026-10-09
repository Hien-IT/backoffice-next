// Reads the "Khác biệt so với Directus" tables of the feature specs (FR-101): code → "Gỡ khi" (feature that
// removes a temporary difference, or undefined), plus the Status line of each spec.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SPECS_DIR = fileURLToPath(new URL('../../../specs', import.meta.url));

export interface SpecDifferences {
	feature: string;
	status: string | undefined;
	/** code → removal feature ('' when permanent or "theo bản đồ"). */
	codes: Map<string, string>;
}

export function specPath(feature: string, specsDir = SPECS_DIR): string | undefined {
	if (!existsSync(specsDir)) return undefined;
	const dir = readdirSync(specsDir).find((d) => d.startsWith(`${feature}-`));
	return dir ? join(specsDir, dir, 'spec.md') : undefined;
}

export function readSpecDifferences(feature: string, specsDir = SPECS_DIR): SpecDifferences | undefined {
	const path = specPath(feature, specsDir);
	if (!path || !existsSync(path)) return undefined;

	const text = readFileSync(path, 'utf8');
	const status = /^\*\*Status\*\*:\s*(\S+)/m.exec(text)?.[1];
	const codes = new Map<string, string>();

	for (const line of text.split('\n')) {
		const cells = line.split('|').map((c) => c.trim());
		// | Mã | ... | Gỡ khi |  → cells[0] is '' before the first pipe, the last cell is '' after the last pipe.
		if (cells.length < 4 || !/^D-\d+(\.\d+)?$/.test(cells[1] ?? '')) continue;
		const removeAt = (cells[cells.length - 2] ?? '').replace(/^—$/, '').replace(/^theo bản đồ$/, '');
		codes.set(cells[1]!, removeAt);
	}

	return { feature, status, codes };
}
