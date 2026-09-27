import {
  abilities,
  activeUnit,
  aimOptions,
  applyCommand,
  BACK,
  FRONT,
  inSmoke,
  moveOptions,
  type BattleState,
  type Command,
  type PlayerId,
  type Unit,
} from '@tactics/rules';

/**
 * A greedy bot for one activation. Everything in a battle is visible, so it
 * reads the real state. For each reposition and action it fast-forwards the
 * timeline, with every other hero waiting, until everything already queued
 * (and its own new action) has landed, then scores the result.
 */
export interface BotOptions {
  /** Random noise added to scores, so repeated games differ. */
  noise?: number;
  random?: () => number;
  /**
   * - greedy (default): picks the best-scoring plan.
   * - static: greedy, but never repositions.
   * - random: picks uniformly among all legal plans.
   * - lookahead: takes the best few greedy plans, plays each forward until the
   *   enemy's next hero has replied with its best greedy answer, and picks the
   *   plan that holds up best.
   */
  style?: 'greedy' | 'static' | 'random' | 'lookahead';
  /** Lookahead only: how many of the best greedy plans to test. */
  breadth?: number;
}

export function chooseActivation(
  state: BattleState,
  options: BotOptions = {},
): Command[] {
  const unit = activeUnit(state);
  if (!unit?.pos) return [];
  const me = unit.owner;
  const random = options.random ?? Math.random;
  const noise = options.noise ?? 0.3;
  const style = options.style ?? 'greedy';
  const plans: Command[][] = [];
  const scored: { score: number; plan: Command[]; after: BattleState }[] = [];

  let best: { score: number; plan: Command[] } = {
    score: -Infinity,
    plan: [{ type: 'wait', unitId: unit.id }],
  };
  const consider = (from: BattleState, plan: Command[], prefix: Command[]) => {
    if (style === 'random') {
      plans.push([...prefix, ...plan]);
      return;
    }
    let s = from;
    for (const c of plan) {
      const r = applyCommand(s, c);
      if (!r.ok) return;
      s = r.state;
    }
    const score = evaluate(forecast(s), me) + random() * noise;
    if (style === 'lookahead')
      scored.push({ score, plan: [...prefix, ...plan], after: s });
    if (score > best.score) best = { score, plan: [...prefix, ...plan] };
  };

  // Every path of up to two steps, keeping one path per resulting formation.
  const starts: Command[][] = [[]];
  const seen = new Set([formationKey(state, me)]);
  let frontier: { path: Command[]; s: BattleState }[] = [
    { path: [], s: state },
  ];
  for (let depth = 0; depth < (style === 'static' ? 0 : 2); depth++) {
    const next: typeof frontier = [];
    for (const { path, s } of frontier) {
      const self = s.units.find((u) => u.id === unit.id);
      if (!self?.pos || s.activeId !== unit.id) continue;
      for (const to of moveOptions(s, self)) {
        const command: Command = { type: 'move', unitId: unit.id, to };
        const r = applyCommand(s, command);
        if (!r.ok) continue;
        const k = formationKey(r.state, me);
        if (seen.has(k)) continue;
        seen.add(k);
        starts.push([...path, command]);
        next.push({ path: [...path, command], s: r.state });
      }
    }
    frontier = next;
  }
  for (const start of starts) {
    let s = state;
    let ok = true;
    for (const c of start) {
      const r = applyCommand(s, c);
      if (!r.ok) {
        ok = false;
        break;
      }
      s = r.state;
    }
    if (!ok) continue;
    const self = s.units.find((u) => u.id === unit.id);
    if (!self?.pos || s.activeId !== unit.id) {
      consider(s, [], start);
      continue;
    }
    consider(s, [{ type: 'wait', unitId: unit.id }], start);
    if (inSmoke(s, self)) continue;
    for (const abilityId of self.loadout) {
      for (const aim of aimOptions(s, self, abilityId)) {
        consider(s, [{ type: 'act', unitId: unit.id, abilityId, aim }], start);
      }
    }
  }
  if (style === 'random' && plans.length) {
    return plans[Math.floor(random() * plans.length)]!;
  }
  if (style === 'lookahead' && scored.length > 1) {
    const top = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, options.breadth ?? 6);
    let pick = top[0]!;
    let pickScore = -Infinity;
    for (const candidate of top) {
      const replied = untilEnemyReplies(candidate.after, me);
      const score = evaluate(forecast(replied), me) + random() * noise;
      if (score > pickScore) {
        pickScore = score;
        pick = candidate;
      }
    }
    return pick.plan;
  }
  return best.plan;
}

/**
 * Plays greedy moves for everyone until the first enemy hero after this one
 * has acted: the reply this plan has to survive.
 */
function untilEnemyReplies(state: BattleState, me: PlayerId): BattleState {
  let s = state;
  for (let i = 0; i < 8 && s.winner === null; i++) {
    const active = activeUnit(s);
    if (!active) break;
    const plan = chooseActivation(s, { style: 'greedy', noise: 0 });
    const before = s;
    for (const c of plan) {
      const r = applyCommand(s, c);
      if (!r.ok) break;
      s = r.state;
    }
    if (s === before) {
      const r = applyCommand(s, { type: 'wait', unitId: active.id });
      if (!r.ok) break;
      s = r.state;
    }
    if (active.owner !== me) break;
  }
  return s;
}

/** Lets everyone wait until every action queued so far has landed. */
function forecast(state: BattleState): BattleState {
  const pending = new Set(state.queue.map((q) => q.seq));
  let s = state;
  for (let i = 0; i < 12 && s.winner === null; i++) {
    if (!s.queue.some((q) => pending.has(q.seq))) break;
    const active = activeUnit(s);
    if (!active) break;
    const r = applyCommand(s, { type: 'wait', unitId: active.id });
    if (!r.ok) break;
    s = r.state;
  }
  return s;
}

function evaluate(state: BattleState, me: PlayerId): number {
  if (state.winner === me) return 10_000;
  if (state.winner !== null && state.winner !== 'draw') return -10_000;
  let score = 0;
  for (const u of state.units) {
    const sign = u.owner === me ? 1 : -1;
    if (!u.pos) {
      score -= sign * 30;
      continue;
    }
    score += sign * (10 * u.hp + 15);
    score += sign * (u.shielded ? 4 : 0);
    score -= sign * 4 * Math.min(u.burning, u.hp);
    score -= sign * (u.petrified ? 8 : 0);
    // Tempo: sooner activations are worth a little.
    score -= sign * 0.5 * (u.nextAt - state.time);
    score += sign * roleFit(u);
  }
  for (const b of state.blocks) score += (b.owner === me ? 1 : -1) * 3 * b.hp;
  return score;
}

/** A small preference for heroes standing where their abilities work. */
function roleFit(u: Unit): number {
  if (!u.pos) return 0;
  const melee = u.loadout.some((a) => abilities[a]?.kind === 'melee');
  if (melee) return u.pos.row === FRONT ? 3 : -3;
  return u.pos.row === BACK ? 2 : -1;
}

function formationKey(state: BattleState, side: PlayerId): string {
  return state.units
    .filter((u) => u.owner === side && u.pos)
    .map((u) => `${u.id}@${u.pos!.col}${u.pos!.row}`)
    .sort()
    .join(',');
}
