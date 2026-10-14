// Ported from directus/packages/types/src/graphql.ts
// Backoffice: kept in the app (not @backoffice/types) because it names express and graphql types.
import type { Request, Response } from 'express';
import type { DocumentNode } from 'graphql';

export type GQLScope = 'items' | 'system';

export interface GraphQLParams {
	query: string | null;
	variables: { readonly [name: string]: unknown } | null;
	operationName: string | null;
	document: DocumentNode;
	contextValue: {
		req?: Request;
		res?: Response;
		data?: unknown;
		cache: Map<string, Promise<unknown>>;
	};
}
