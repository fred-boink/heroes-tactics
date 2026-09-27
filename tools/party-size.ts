// How does party size change the game? Plays bot battles with N heroes a side
// (N = 3, 4, 5, 6, 8 on the 4×2 grid) and reports length, balance, how much
// skill and reading the queue matter, dodge rates and decision size.
// Run: `pnpm -s tsx tools/party-size.ts [battles per size] [seed] [sizes]`,
// e.g. `pnpm -s tsx tools/party-size.ts 200 1 3,4,5,6,8`.
import { chooseActivation, type BotOptions } from '@tactics/bot';
import {
  abilities,
  activeUnit,
  aimOptions,
  applyCommand,
  BACK,
  COLUMNS,
  createBattle,
  factionClasses,
  FRONT,
  moveOptions,
  previewAction,
  randomLevels,
  rolePool,
  seededRandom,
  type BattleEvent,
  type BattleState,
  type Faction,
  type PlayerId,
  type Row,
  type Slot,
  type UnitSetup,
} from '@tactics/rules';

const battles = Number(process.argv[2] ?? 200);
const seed = Number(process.argv[3] ?? 1);
const sizes = (process.argv[4] ?? '3,4,5,6,8').split(',').map(Number);
const random = seededRandom(seed);
const factions: Faction[] = ['light', 'dark', 'nature'];
const pickOne = <T>(xs: T[]) => xs[Math.floor(random() * xs.length)]!;
const cap = 300;

/** N heroes, cycling through the faction's classes; melee up front. */
function party(faction: Faction, owner: PlayerId, n: number): UnitSetup[] {
  const classes = factionClasses(faction);
  const heroes = Array.from(
    { length: n },
    (_, i) => classes[i % classes.length]!,
  );
  const free: Record<Row, number[]> = {
    [FRONT]: [1, 2, 0, 3],
    [BACK]: [1, 2, 0, 3],
  } as Record<Row, number[]>;
  const count = new Map<string, number>();
  return heroes.map((c) => {
    const k = (count.get(c.id) ?? 0) + 1;
    count.set(c.id, k);
    const want: Row = c.role === 'warrior' ? FRONT : BACK;
    const row: Row = free[want].length ? want : want === FRONT ? BACK : FRONT;
    const pos: Slot = { col: free[row].shift()!, row };
    const loadout = [
      pickOne(rolePool(c.role, 'primary')),
      pickOne(rolePool(c.role, 'secondary')),
    ];
    return {
      id: `${owner}-${c.id}${k > 1 ? `-${k}` : ''}`,
      owner,
      classId: c.id,
      pos,
      loadout,
      levels: randomLevels(loadout, random, 2),
    };
  });
}

interface Stats {
  activations: number[];
  ms: number[];
  timeouts: number;
  decided: number;
  firstWins: number;
  faction: Record<Faction, { w: number; n: number }>;
  plans: number[];
  queueSeen: number[];
  queued: number;
  asAimed: number;
  dodged: number;
  redirected: number;
  damageByKind: Record<string, number>;
}

const newStats = (): Stats => ({
  activations: [],
  ms: [],
  timeouts: 0,
  decided: 0,
  firstWins: 0,
  faction: {
    light: { w: 0, n: 0 },
    dark: { w: 0, n: 0 },
    nature: { w: 0, n: 0 },
  },
  plans: [],
  queueSeen: [],
  queued: 0,
  asAimed: 0,
  dodged: 0,
  redirected: 0,
  damageByKind: {},
});

/** Enemies an action would damage if it landed right now. */
function victims(state: BattleState, seq: number): Set<string> | null {
  const q = state.queue.find((x) => x.seq === seq);
  if (!q) return null;
  const ids = new Set<string>();
  for (const e of previewAction(state, q.unitId, q.abilityId, q).events) {
    if (e.type !== 'damaged') continue;
    const u = state.units.find((x) => x.id === e.unitId);
    if (u && u.owner !== q.owner) ids.add(e.unitId);
  }
  return ids;
}

function track(
  st: Stats,
  predicted: Map<number, Set<string>>,
  before: BattleState,
  after: BattleState,
  events: BattleEvent[],
) {
  let current: number | null = null;
  let hit = new Set<string>();
  const close = () => {
    if (current === null) return;
    const aimed = predicted.get(current);
    if (aimed && aimed.size > 0) {
      const same =
        aimed.size === hit.size && [...aimed].every((id) => hit.has(id));
      if (same) st.asAimed++;
      else if (hit.size === 0) st.dodged++;
      else st.redirected++;
    }
    predicted.delete(current);
    current = null;
    hit = new Set();
  };
  for (const e of events) {
    if (e.type === 'landed') {
      close();
      current = e.seq;
    } else if (e.type === 'activated' || e.type === 'queued') {
      close();
    } else if (e.type === 'damaged') {
      const u = before.units.find((x) => x.id === e.unitId);
      if (current !== null && u && predicted.has(current)) hit.add(e.unitId);
    }
    if (e.type === 'queued') {
      st.queued++;
      const aimed = victims(after, e.action.seq);
      if (aimed) predicted.set(e.action.seq, aimed);
      const a = abilities[e.action.abilityId];
      if (a) {
        const key = a.pattern === 'single' ? 'single' : a.pattern;
        st.damageByKind[key] = (st.damageByKind[key] ?? 0) + 1;
      }
    }
  }
  close();
}

/** Decision size a human faces: (stay + steps) × (wait + every aim). */
function planCount(s: BattleState): number {
  const u = activeUnit(s);
  if (!u?.pos) return 0;
  let aims = 1;
  for (const id of u.loadout) aims += aimOptions(s, u, id).length;
  return (1 + moveOptions(s, u).length) * aims;
}

function play(
  n: number,
  a: BotOptions,
  b: BotOptions,
  aSide: PlayerId,
  st: Stats | null,
): number {
  const f: [Faction, Faction] = [pickOne(factions), pickOne(factions)];
  let s = createBattle([...party(f[0], 0, n), ...party(f[1], 1, n)]);
  const firstSide = activeUnit(s)?.owner ?? 0;
  const predicted = new Map<number, Set<string>>();
  const t0 = performance.now();
  while (s.winner === null && s.activations <= cap) {
    const unit = activeUnit(s);
    if (!unit) break;
    if (st) {
      st.plans.push(planCount(s));
      st.queueSeen.push(s.queue.length);
    }
    const before = s;
    for (const c of chooseActivation(s, {
      ...(unit.owner === aSide ? a : b),
      random,
    })) {
      const r = applyCommand(s, c);
      if (!r.ok) break;
      if (st) track(st, predicted, before, r.state, r.events);
      s = r.state;
    }
    if (s === before) {
      const r = applyCommand(s, { type: 'wait', unitId: unit.id });
      if (!r.ok) break;
      s = r.state;
    }
  }
  if (st) {
    st.ms.push(performance.now() - t0);
    st.activations.push(s.activations);
    if (s.winner === null || s.winner === 'draw') st.timeouts++;
    else {
      st.decided++;
      if (s.winner === firstSide) st.firstWins++;
      for (const side of [0, 1] as const) {
        st.faction[f[side]].n++;
        if (s.winner === side) st.faction[f[side]].w++;
      }
    }
  }
  if (s.winner === null || s.winner === 'draw') return 0.5;
  return s.winner === aSide ? 1 : 0;
}

const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0;
};
const avg = (xs: number[]) =>
  xs.reduce((x, y) => x + y, 0) / Math.max(1, xs.length);
const pct = (x: number, n: number) =>
  `${Math.round((100 * x) / Math.max(1, n))}%`;

function versus(n: number, a: BotOptions, b: BotOptions, games: number) {
  let score = 0;
  for (let i = 0; i < games; i++)
    score += play(n, a, b, (i % 2) as PlayerId, null);
  return pct(score, games);
}

const greedy: BotOptions = { noise: 0.3 };
const rows: string[][] = [];
const started = Date.now();
for (const n of sizes) {
  if (n > 2 * COLUMNS) continue;
  const st = newStats();
  for (let i = 0; i < battles; i++)
    play(n, greedy, greedy, (i % 2) as PlayerId, st);
  const skillGames = Math.max(40, Math.round(battles / 2));
  const vsRandom = versus(n, greedy, { style: 'random' }, skillGames);
  const vsStatic = versus(
    n,
    greedy,
    { style: 'static', noise: 0.3 },
    skillGames,
  );
  const vsBlind = versus(n, greedy, { awareness: 0, noise: 0.3 }, skillGames);
  const lookGames = Math.max(20, Math.round(battles / 5));
  const lookahead = versus(
    n,
    { style: 'lookahead', noise: 0.3 },
    greedy,
    lookGames,
  );
  const landed = st.asAimed + st.dodged + st.redirected;
  const shapes = Object.entries(st.damageByKind)
    .sort((x, y) => y[1] - x[1])
    .map(([k, v]) => `${k} ${pct(v, st.queued)}`)
    .join(' ');
  rows.push([
    String(n),
    `${quantile(st.activations, 0.5)}/${quantile(st.activations, 0.9)}`,
    String(st.timeouts),
    `${Math.round(avg(st.ms))}ms`,
    pct(st.firstWins, st.decided),
    factions.map((f) => pct(st.faction[f].w, st.faction[f].n)).join('/'),
    vsRandom,
    vsStatic,
    vsBlind,
    lookahead,
    `${pct(st.asAimed, landed)}/${pct(st.dodged, landed)}/${pct(st.redirected, landed)}`,
    `${Math.round(avg(st.plans))}`,
    avg(st.queueSeen).toFixed(1),
  ]);
  console.error(
    `N=${n} done (${((Date.now() - started) / 1000).toFixed(0)}s); queued shapes: ${shapes}`,
  );
}

const header = [
  'N',
  'acts med/p90',
  'timeouts',
  'ms/battle',
  '1st wins',
  'L/D/N',
  'vs random',
  'vs static',
  'vs blind',
  'lookahead',
  'aimed/dodged/redir',
  'plans',
  'queue',
];
const widths = header.map((h, i) =>
  Math.max(h.length, ...rows.map((r) => r[i]!.length)),
);
const line = (r: string[]) => r.map((c, i) => c.padEnd(widths[i]!)).join('  ');
console.log(line(header));
for (const r of rows) console.log(line(r));
console.log(
  `\n${battles} greedy battles per size (seed ${seed}); skill columns are greedy's score vs that bot; lookahead is lookahead's score vs greedy. ${((Date.now() - started) / 1000).toFixed(0)}s total.`,
);
