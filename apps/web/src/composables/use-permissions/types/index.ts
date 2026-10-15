// Ported from directus/app/src/composables/use-permissions/types/index.ts
import { type PrimaryKey as PrimaryKeyOrig } from '@directus/types';
import { type MaybeRef } from 'vue';

export type Collection = MaybeRef<string | null>;

export type PrimaryKey = MaybeRef<PrimaryKeyOrig | null>;

export type IsNew = MaybeRef<boolean>;
