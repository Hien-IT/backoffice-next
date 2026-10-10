// Ported from directus/packages/memory/src/kv/types/lock.ts
export interface Lock {
	release(): Promise<void>;
	extend(duration: number): Promise<void>;
}
