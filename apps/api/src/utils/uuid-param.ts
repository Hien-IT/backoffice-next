// Backoffice: Express 5 has no regex route params; the handlers of the DR routes `:pk(${UUID_REGEX})` check
// the uuid here and answer like an unmatched route (Express 4 path-to-regexp is case-insensitive).
import { RouteNotFoundError } from '@backoffice/errors';
import type { Request } from 'express';
import { UUID_REGEX } from '../constants.js';

const uuid = new RegExp(`^${UUID_REGEX}$`, 'i');

/** `:pk(${UUID_REGEX})` of the DR router. */
export function uuidParam(req: Request): string {
	const pk = req.params['pk'] as string;
	if (!uuid.test(pk)) throw new RouteNotFoundError({ path: req.path });
	return pk;
}
