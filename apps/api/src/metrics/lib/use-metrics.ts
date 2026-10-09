// STUB: replaced by the full port of directus/api/src/metrics in US5 (T089).
type MetricsStub = { getDatabaseResponseMetric(): { observe(value: number): void } | undefined };

export const useMetrics = (): MetricsStub | undefined => undefined;
