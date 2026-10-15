// Ported from directus/app/src/layouts/kanban/types.ts
import type { User } from '@directus/types';

export type LayoutOptions = {
	groupField: string;
	groupTitle: string;
	dateField: string;
	tagsField?: string;
	userField?: string;
	titleField?: string;
	textField?: string;
	imageSource?: string;
	crop: boolean;
	showUngrouped: boolean;
	groupOrder: { groupField: string | null; sortMap: Record<string, number> };
};

export type LayoutQuery = {
	fields?: string[];
	sort?: string;
	limit?: number;
	page?: number;
};

export type Group = {
	id: string | number | null;
	title: string;
	items: Item[];
	sort: number;
};

export type Item = {
	id: string | number;
	sort: number;
	title?: string;
	text?: string;
	image?: string | undefined;
	date?: string;
	dateType?: string | undefined;
	tags?: string;
	item: Record<string, any>;
	users: User[];
};

export type ChangeEvent<T> = {
	added?: {
		element: T;
		newIndex: number;
	};
	removed?: {
		element: T;
		oldIndex: number;
	};
	moved?: {
		element: T;
		newIndex: number;
		oldIndex: number;
	};
};
