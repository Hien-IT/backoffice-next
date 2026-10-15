// Ported from directus/app/src/layouts/tabular/types.ts; Ported from directus/app/src/components/v-table/types.ts
export type LayoutOptions = {
	widths?: {
		[field: string]: number;
	};
	align?: {
		[field: string]: 'left' | 'center' | 'right';
	};
	limit?: number;
	spacing?: 'comfortable' | 'cozy' | 'compact';
};

export type LayoutQuery = {
	fields: string[];
	sort: string[];
	page: number;
	limit: number;
};

// Backoffice: the header and sort types of components/v-table/types.ts (BoTable has its own column type, the layout
// state keeps the Directus header shape).
export type Alignment = 'left' | 'center' | 'right';

export type HeaderRaw = {
	text: string;
	value: string;
	description?: string | null;
	align?: Alignment;
	sortable?: boolean;
	width?: number | null;
	[key: string]: any;
};

export type Sort = {
	by: string | null;
	desc: boolean;
};
