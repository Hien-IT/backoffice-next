// Ported from directus/app/src/modules/settings/routes/flows/components/arrows/types.ts
import type { Target } from '../../types.ts';

export interface Arrow {
	id: string;
	d: string;
	type: Target;
	loner: boolean;
	isHint?: boolean;
}

export interface Panel {
	id: string;
	resolve: string;
	reject: string;
	x: number;
	y: number;
}
