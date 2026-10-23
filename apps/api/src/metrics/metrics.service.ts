import { Injectable } from '@nestjs/common';
import { useMetrics } from './index.js';

/** Wraps useMetrics(), which stays a shared function like in DR (plan.md Constitution Check VI). */
@Injectable()
export class MetricsService {
	async readAll(): Promise<string | undefined> {
		return await useMetrics()?.readAll();
	}
}
