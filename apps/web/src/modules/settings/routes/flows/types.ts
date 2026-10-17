// Ported from directus/app/src/modules/settings/routes/flows/components/operation.vue and flow.vue (exported types).
// Backoffice: the types of the two SFCs in one module, so the arrows lib and the composable import no component.
import type { Vector2 } from '../../../../utils/vector2.ts';

export type Target = 'resolve' | 'reject';

export type ArrowInfo = {
	id: string;
	pos: Vector2;
	type: Target;
};

// Maps the x and y coordinates of attachments of panels to their id
export type Attachments = Record<number, Record<number, string>>;

export type ParentInfo = { id: string; type: Target; loner: boolean };
