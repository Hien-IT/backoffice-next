// Ported from directus/packages/env/src/types/env-type.ts
import { ENV_TYPES } from '../constants/env-types.js';

export type EnvType = (typeof ENV_TYPES)[number];
