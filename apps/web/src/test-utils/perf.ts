// Feature 014 (SC-011, research R14, owner decision 2026-10-15): the perf budgets hold on the reference machine (a
// developer Mac, Apple M-series, where REFERENCE_MS was measured); a CI runner is several times slower. machineFactor()
// times a fixed DOM and JS workload (median of 5) and divides it by REFERENCE_MS, so a budget scales with the runner
// and never drops below its value on the reference machine.
const REFERENCE_MS = 55;

function workload(): number {
	const start = performance.now();
	const root = document.createElement('div');
	document.body.append(root);

	for (let index = 0; index < 20_000; index++) {
		const row = document.createElement('div');
		row.className = 'truncate px-3 text-theme-sm';
		row.textContent = `row ${index}`;
		row.dataset['key'] = JSON.stringify({ id: index, values: [index, index * 2] });
		root.append(row);
	}

	void root.offsetHeight;
	root.remove();
	return performance.now() - start;
}

export function machineFactor(): number {
	const runs = Array.from({ length: 5 }, workload).sort((a, b) => a - b);
	return Math.max(1, runs[2]! / REFERENCE_MS);
}
