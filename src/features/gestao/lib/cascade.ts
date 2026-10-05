// "Cascata": plan the dates of every step of a piece of work up front, from a template of durations.
// Pure functions (no I/O) so they can be unit-tested.
//
// A step is { key, label, after: [step keys], days }. due(step) = max(due(after...)) + days, where days are working
// days (Mon–Fri) unless the template says otherwise. A step with no `after` is the anchor: it gets the start date.
// When a step is finished late and "push on delay" is on, every step downstream of it slides by the same delay.

export type CascadeStep = { key: string; label: string; after: string[]; days: number };
export type CascadePlan = Record<string, string>; // step key → YYYY-MM-DD

const DAY_MS = 24 * 3600 * 1000;

// Dates are handled as plain "YYYY-MM-DD" strings in UTC so time zones never shift a day.
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;

export function addDays(iso: string, n: number): string {
  return fmt(new Date(parse(iso).getTime() + n * DAY_MS));
}

/** Moves a date forward to the next working day when it falls on a weekend. */
export function nextWorkday(iso: string): string {
  let d = parse(iso);
  while (isWeekend(d)) d = new Date(d.getTime() + DAY_MS);
  return fmt(d);
}

/** Adds working days (Mon–Fri). n may be 0 (then a weekend date moves to Monday). */
export function addWorkdays(iso: string, n: number): string {
  let d = parse(nextWorkday(iso));
  let left = Math.max(0, Math.round(n));
  while (left > 0) {
    d = new Date(d.getTime() + DAY_MS);
    if (!isWeekend(d)) left--;
  }
  return fmt(d);
}

/** Number of working days from `from` to `to` (0 if `to` is not after `from`). */
export function workdaysBetween(from: string, to: string): number {
  if (to <= from) return 0;
  let d = parse(from);
  const end = parse(to);
  let n = 0;
  while (d < end) {
    d = new Date(d.getTime() + DAY_MS);
    if (!isWeekend(d)) n++;
  }
  return n;
}

const add = (iso: string, n: number, businessDays: boolean) => (businessDays ? addWorkdays(iso, n) : addDays(iso, n));

/** Steps in dependency order (every step after the ones it depends on). Unknown `after` keys are ignored. */
export function orderSteps(steps: CascadeStep[]): CascadeStep[] {
  const byKey = new Map(steps.map((s) => [s.key, s]));
  const out: CascadeStep[] = [];
  const seen = new Set<string>();
  const visiting = new Set<string>();
  const visit = (s: CascadeStep) => {
    if (seen.has(s.key)) return;
    if (visiting.has(s.key)) return; // cycle guard
    visiting.add(s.key);
    for (const k of s.after) {
      const dep = byKey.get(k);
      if (dep) visit(dep);
    }
    visiting.delete(s.key);
    seen.add(s.key);
    out.push(s);
  };
  steps.forEach(visit);
  return out;
}

/** Computes the planned date of every step from the start date of the anchor step(s). Working-day counting starts from the next working day when the start falls on a weekend. */
export function computePlan(steps: CascadeStep[], startDate: string, businessDays = true): CascadePlan {
  const plan: CascadePlan = {};
  for (const s of orderSteps(steps)) {
    const deps = s.after.filter((k) => plan[k]);
    if (deps.length === 0) {
      plan[s.key] = startDate; // the anchor keeps the date the user picked (even a weekend one)
    } else {
      const latest = deps.map((k) => plan[k]).sort().at(-1)!;
      plan[s.key] = add(latest, s.days, businessDays);
    }
  }
  return plan;
}

/** All steps that depend (directly or not) on `key`. */
export function downstreamOf(steps: CascadeStep[], key: string): Set<string> {
  const out = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of steps) {
      if (out.has(s.key)) continue;
      if (s.after.some((a) => a === key || out.has(a))) {
        out.add(s.key);
        grew = true;
      }
    }
  }
  return out;
}

/**
 * A step was finished on `doneOn`. If that is later than its planned date, every step downstream of it is
 * recomputed from the real finish date (so the delay slides the rest of the cascade). Finishing early never pulls
 * dates forward — the team keeps the planned rhythm. Returns the new plan (the input is not mutated).
 */
export function pushPlan(steps: CascadeStep[], plan: CascadePlan, doneKey: string, doneOn: string, businessDays = true): CascadePlan {
  const planned = plan[doneKey];
  if (!planned || doneOn <= planned) return plan;
  const next: CascadePlan = { ...plan, [doneKey]: doneOn };
  const down = downstreamOf(steps, doneKey);
  for (const s of orderSteps(steps)) {
    if (!down.has(s.key)) continue;
    const deps = s.after.filter((k) => next[k]);
    const latest = deps.map((k) => next[k]).sort().at(-1)!;
    const recomputed = add(latest, s.days, businessDays);
    // never move a date earlier than it was planned
    next[s.key] = recomputed > plan[s.key] ? recomputed : plan[s.key];
  }
  return next;
}

/** Maps a task's stage (+ branch type) to the cascade step key it represents. */
export function stepKeyFor(stage: string, postType?: string | null): string {
  if (stage === "revisao") {
    if (postType === "planejamento") return "revisao_plan";
    if (postType === "design") return "revisao_design";
    if (postType === "video") return "revisao_video";
    return "revisao";
  }
  return stage;
}

/** The date the plan has for a given step, or undefined when the plan doesn't cover it. */
export function plannedDueFor(plan: CascadePlan | null | undefined, stage: string, postType?: string | null): string | undefined {
  return plan?.[stepKeyFor(stage, postType)];
}
