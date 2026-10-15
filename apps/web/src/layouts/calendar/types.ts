// Ported from directus/app/src/layouts/calendar/types.ts
export type LayoutOptions = {
	template?: string;
	startDateField?: string;
	endDateField?: string;
	firstDay?: number;
	viewInfo?: {
		type: string;
		startDateStr: string;
	};
};
