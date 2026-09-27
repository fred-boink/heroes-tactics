// Does skill matter? Pits bot styles against each other on random factions and
// loadouts, and measures how often queued attacks end up hitting something other
// than what they were aimed at. Run: `pnpm skill [games per matchup] [seed]`.
import { chooseActivation, type BotOptions } from '@tactics/bot';
import {
  activeUnit,
  applyCommand,
  createBattle,
  factionParty,
  previewAction,
  seededRandom,
  type BattleEvent,
  type BattleState,
  type Faction,
  type PlayerId,
} from '@tactics/rules';

const games = Number(process.argv[2] ?? 40);
const seed = Number(process.argv[3] ?? 3);
const random = seededRandom(seed);
const factions: Faction[] = ['light', 'dark', 'nature'];
const pick = <T>(xs: T[]) => xs[Math.floor(random() * xs.length)]!;
const maxActivations = 150;

interface Tracking {
  predicted: Map<number, Set<string>>;
  queued: number;
  landedAsAimed: number;
  redirected: number;
  dodged: number;
}

function newTracking(): Tracking {
  return {
    predicted: new Map(),
    queued: 0,
    landedAsAimed: 0,
    redirected: 0,
    dodged: 0,
  };
}

/** Enemies an action would damage if it landed right now. */
function victims(state: BattleState, seq: number): Set<string> | null {
  const q = state.queue.find((x) => x.seq === seq);
  if (!q) return null;
  const { events } = previewAction(state, q.unitId, q.abilityId, q);
  const ids = new Set<string>();
  for (const e of events) {
    if (e.type !== 'damaged') continue;
    const u = state.units.find((x) => x.id === e.unitId);
    if (u && u.owner !== q.owner) ids.add(e.unitId);
  }
  return ids;
}

function track(
  t: Tracking,
  before: BattleState,
  after: BattleState,
  events: BattleEvent[],
) {
  // Compare every landing with what was predicted when it was queued.
  let current: number | null = null;
  let hit = new Set<string>();
  const close = () => {
    if (current === null) return;
    const aimed = t.predicted.get(current);
    if (aimed && aimed.size > 0) {
      const same =
        aimed.size === hit.size && [...aimed].every((id) => hit.has(id));
      if (same) t.landedAsAimed++;
      else if (hit.size === 0) t.dodged++;
      else t.redirected++;
    }
    t.predicted.delete(current);
    current = null;
    hit = new Set();
  };
  for (const e of events) {
    if (e.type === 'landed') {
      close();
      current = e.seq;
    } else if (e.type === 'activated' || e.type === 'queued') {
      close();
    } else if (e.type === 'damaged' && current !== null) {
      const u = before.units.find((x) => x.id === e.unitId);
      const q = t.predicted.has(current) ? current : null;
      if (u && q !== null) hit.add(e.unitId);
    }
    if (e.type === 'queued') {
      t.queued++;
      const aimed = victims(after, e.action.seq);
      if (aimed) t.predicted.set(e.action.seq, aimed);
    }
  }
  close();
}

function play(a: BotOptions, b: BotOptions, aSide: PlayerId, t: Tracking) {
  let state = createBattle([
    ...factionParty(pick(factions), 0, { random }),
    ...factionParty(pick(factions), 1, { random }),
  ]);
  while (state.winner === null && state.activations <= maxActivations) {
    const unit = activeUnit(state);
    if (!unit) break;
    const opts = unit.owner === aSide ? a : b;
    const before = state;
    for (const command of chooseActivation(state, { ...opts, random })) {
      const result = applyCommand(state, command);
      if (!result.ok) break;
      track(t, before, result.state, result.events);
      state = result.state;
    }
    if (state === before) {
      const r = applyCommand(state, { type: 'wait', unitId: unit.id });
      if (!r.ok) break;
      state = r.state;
    }
  }
  if (state.winner === null || state.winner === 'draw') return 0.5;
  return state.winner === aSide ? 1 : 0;
}

const suites: Record<string, [string, BotOptions, string, BotOptions][]> = {
  basic: [
    ['greedy', { noise: 0.3 }, 'random', { style: 'random' }],
    ['greedy', { noise: 0.3 }, 'never moves', { style: 'static', noise: 0.3 }],
    ['greedy', { noise: 0.3 }, 'sloppy greedy', { noise: 25 }],
    ['greedy', { noise: 0.3 }, 'greedy', { noise: 0.3 }],
  ],
  wider: [
    [
      'lookahead 12',
      { style: 'lookahead', breadth: 12, noise: 0.3 },
      'lookahead 6',
      { style: 'lookahead', breadth: 6, noise: 0.3 },
    ],
    [
      'lookahead 3',
      { style: 'lookahead', breadth: 3, noise: 0.3 },
      'greedy',
      { noise: 0.3 },
    ],
  ],
  lookahead: [
    ['lookahead', { style: 'lookahead', noise: 0.3 }, 'greedy', { noise: 0.3 }],
    [
      'lookahead',
      { style: 'lookahead', noise: 0.3 },
      'lookahead',
      { style: 'lookahead', noise: 0.3 },
    ],
  ],
};
const matchups = suites[process.argv[4] ?? 'basic']!;

const started = Date.now();
for (const [nameA, a, nameB, b] of matchups) {
  const t = newTracking();
  let score = 0;
  for (let i = 0; i < games; i++) score += play(a, b, (i % 2) as PlayerId, t);
  const landed = t.landedAsAimed + t.redirected + t.dodged;
  const pct = (n: number) => `${Math.round((100 * n) / Math.max(1, landed))}%`;
  console.log(
    `${nameA.padEnd(7)} vs ${nameB.padEnd(14)} ${String(Math.round((100 * score) / games)).padStart(3)}% for ${nameA}` +
      `   | aimed attacks: as aimed ${pct(t.landedAsAimed)}, dodged ${pct(t.dodged)}, hit someone else ${pct(t.redirected)}`,
  );
}
console.log(
  `\n${matchups.length * games} battles in ${((Date.now() - started) / 1000).toFixed(0)}s`,
);
