import type { Candidate } from './types';

export function selectScenario(candidates: Candidate[], options: { budget: number; target: number; capacity: number; maxCost: number; regions: string[]; weights: Record<string, number> }) {
 if (![options.budget, options.target, options.capacity, options.maxCost].every(Number.isFinite) || options.budget < 0 || options.target < 0 || options.capacity < 0 || options.maxCost < 0) throw new Error('Invalid scenario constraints');
 const excludedUnknownCost = candidates.filter(c => c.estimatedCost == null).length;
 const eligible = candidates.filter(c => c.estimatedCost != null && c.estimatedCost <= options.maxCost && (!options.regions.length || options.regions.includes(c.region ?? '')))
   .map(c => ({ c, result: scoreCandidate(c.factors, options.weights) })).sort((a,b) => b.result.score - a.result.score || a.c.id.localeCompare(b.c.id));
 const selected: Candidate[] = []; let totalCost = 0;
 for (const item of eligible) if (selected.length < Math.min(options.target, options.capacity) && totalCost + (item.c.estimatedCost as number) <= options.budget) { selected.push(item.c); totalCost += item.c.estimatedCost as number; }
 return { selected, totalCost, excludedUnknownCost, completeness: selected.length ? selected.reduce((n,c)=>n+scoreCandidate(c.factors, options.weights).completeness,0)/selected.length : 0 };
}
export function csv<T extends Record<string, unknown>>(rows: T[], columns: (keyof T)[]) {
 const escape = (value: unknown) => { let s = String(value ?? ''); if (/^[=+@-]/.test(s)) s = "'" + s; return '"' + s.replaceAll('"','""') + '"'; };
 return [columns.map(String).join(','), ...rows.map(row => columns.map(c => escape(row[c])).join(','))].join('\r\n');
}

export function scoreCandidate(factors: Record<string, number | null>, weights: Record<string, number>) {
  const entries = Object.entries(weights);
  const total = entries.reduce((n, [, w]) => n + w, 0);
  if (!entries.length || !Number.isFinite(total) || total <= 0 || entries.some(([, w]) => !Number.isFinite(w) || w < 0)) throw new Error('Weights must be nonnegative and sum above zero');
  let contribution = 0, known = 0, count = 0;
  for (const [key, weight] of entries) {
    if (weight === 0) continue;
    count++;
    const value = factors[key];
    if (value != null) {
      if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error('Factors must be between 0 and 100');
      contribution += value * weight; known++;
    }
  }
  return { score: contribution / total, completeness: count ? known / count : 0 };
}
