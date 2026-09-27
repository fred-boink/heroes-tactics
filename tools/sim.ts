// Bot-vs-bot battle simulator: `pnpm sim [battles per pairing] [seed]`.
// Plays every faction pairing both ways round and reports balance and pacing.
import { chooseActivation } from '@tactics/bot';
import {
  abilities,
  activeUnit,
  applyCommand,
  createBattle,
  factionParty,
  heroClasses,
  seededRandom,
  type AbilityKind,
  type BattleEvent,
  type BattleState,
  type Faction,
  type PlayerId,
} from '@tactics/rules';

const perPairing = Number(process.argv[2] ?? 20);
const seed = Number(process.argv[3] ?? 1);
const maxActivations = 150;
const factions: Faction[] = ['light', 'dark', 'nature'];
const random = seededRandom(seed);

/** Games and win share for each ability while equipped, and for each class. */
const equipped: Record<string, { games: number; score: number }> = {};
const classScore: Record<string, { games: number; score: number }> = {};
const tally = (table: typeof equipped, key: string, score: number) => {
  const t = (table[key] ??= { games: 0, score: 0 });
  t.games++;
  t.score += score;
};

const stats = {
  games: 0,
  wins: { light: 0, dark: 0, nature: 0 } as Record<Faction, number>,
  played: { light: 0, dark: 0, nature: 0 } as Record<Faction, number>,
  firstMoverWins: 0,
  draws: 0,
  timeouts: 0,
  activations: [] as number[],
  damage: { melee: 0, ranged: 0, spell: 0, support: 0, burn: 0 } as Record<
    AbilityKind | 'burn',
    number
  >,
  knockouts: 0,
  actions: { queued: 0, landed: 0, hitEnemy: 0, fizzled: 0, friendlyFire: 0 },
  moves: 0,
  waits: 0,
  use: {} as Record<string, number>,
};

function record(state: BattleState, events: BattleEvent[]) {
  const owner = (id: string) => state.units.find((u) => u.id === id)?.owner;
  let source: AbilityKind | 'burn' | null = null;
  let actor: PlayerId | undefined;
  let hitEnemy = false;
  let open = false;
  const close = () => {
    if (open && hitEnemy) stats.actions.hitEnemy++;
    open = false;
  };
  for (const e of events) {
    switch (e.type) {
      case 'queued':
        stats.actions.queued++;
        stats.use[e.action.abilityId] =
          (stats.use[e.action.abilityId] ?? 0) + 1;
        break;
      case 'landed':
        close();
        stats.actions.landed++;
        source = abilities[e.abilityId]!.kind;
        actor = owner(e.unitId);
        open = true;
        hitEnemy = false;
        break;
      case 'fizzled':
        stats.actions.fizzled++;
        break;
      case 'burned':
        close();
        source = 'burn';
        break;
      case 'activated':
      case 'skipped':
        close();
        source = null;
        break;
      case 'damaged':
        if (source) stats.damage[source] += e.amount;
        if (open) {
          if (owner(e.unitId) === actor) stats.actions.friendlyFire++;
          else hitEnemy = true;
        }
        break;
      case 'statusApplied':
      case 'delayed':
      case 'shieldBlocked':
        if (open && owner(e.unitId) !== actor) hitEnemy = true;
        break;
      case 'knockedOut':
        stats.knockouts++;
        break;
      case 'moved':
        stats.moves++;
        break;
      case 'waited':
        stats.waits++;
        break;
    }
  }
  close();
}

function playGame(a: Faction, b: Faction) {
  let state = createBattle([
    ...factionParty(a, 0, { random }),
    ...factionParty(b, 1, { random }),
  ]);
  const firstMover = activeUnit(state)!.owner;
  const factionOf = [a, b];
  const lineup = state.units.map((u) => ({
    owner: u.owner,
    classId: u.classId,
    loadout: [...u.loadout],
  }));
  while (state.winner === null && state.activations <= maxActivations) {
    const before = state;
    for (const command of chooseActivation(state, { random, noise: 0.4 })) {
      const result = applyCommand(state, command);
      if (!result.ok) break;
      record(before, result.events);
      state = result.state;
    }
    if (state === before) {
      // The bot found nothing legal: wait so the timeline keeps moving.
      const unit = activeUnit(state);
      if (!unit) break;
      const r = applyCommand(state, { type: 'wait', unitId: unit.id });
      if (!r.ok) break;
      state = r.state;
    }
  }
  for (const u of lineup) {
    const score =
      state.winner === null || state.winner === 'draw'
        ? 0.5
        : state.winner === u.owner
          ? 1
          : 0;
    tally(classScore, u.classId, score);
    for (const id of u.loadout) tally(equipped, id, score);
  }
  stats.games++;
  stats.played[a]++;
  stats.played[b]++;
  stats.activations.push(state.activations);
  if (state.winner === null) stats.timeouts++;
  else if (state.winner === 'draw') stats.draws++;
  else {
    stats.wins[factionOf[state.winner]!]++;
    if (state.winner === firstMover) stats.firstMoverWins++;
  }
}

const started = Date.now();
for (const a of factions) {
  for (const b of factions) {
    for (let i = 0; i < perPairing; i++) playGame(a, b);
  }
}

const pct = (n: number, d: number) =>
  d ? `${Math.round((100 * n) / d)}%` : '-';
const decided = stats.games - stats.timeouts - stats.draws;
const sorted = [...stats.activations].sort((x, y) => x - y);
const totalDamage = Object.values(stats.damage).reduce((x, y) => x + y, 0);
const log = console.log;
log(
  `\n${stats.games} battles in ${((Date.now() - started) / 1000).toFixed(1)}s (seed ${seed})\n`,
);
log('Results');
log(
  `  decided ${decided}, draws ${stats.draws}, timeouts (${maxActivations} activations) ${stats.timeouts}`,
);
log(
  `  side that acts first wins ${pct(stats.firstMoverWins, decided)} of decided battles`,
);
log(
  `  activations per battle: median ${sorted[Math.floor(sorted.length / 2)]}, range ${sorted[0]}–${sorted.at(-1)}`,
);
log('\nWin rate by faction');
for (const f of factions)
  log(`  ${f.padEnd(7)} ${pct(stats.wins[f], stats.played[f])}`);
log('\nDamage by source');
for (const [k, v] of Object.entries(stats.damage)) {
  log(`  ${k.padEnd(8)} ${String(v).padStart(5)}  ${pct(v, totalDamage)}`);
}
log(`  knock-outs ${stats.knockouts}`);
log('\nQueued actions');
const { queued, landed, hitEnemy, fizzled, friendlyFire } = stats.actions;
log(`  queued ${queued}; interrupted (fizzled) ${pct(fizzled, queued)}`);
log(
  `  of those that landed: hit an enemy ${pct(hitEnemy, landed)}, dodged or wasted ${pct(landed - hitEnemy, landed)}; friendly-fire hits ${friendlyFire}`,
);
log(`  repositions ${stats.moves}, waits ${stats.waits}`);
log('\nAbility use');
for (const c of Object.values(heroClasses)) {
  log(
    `  ${c.name.padEnd(13)} ` +
      [...c.primaries, ...c.secondaries]
        .map((id) => `${abilities[id]!.name} ${stats.use[id] ?? 0}`)
        .join(', '),
  );
}

const rate = (t: { games: number; score: number }) =>
  t.score / Math.max(1, t.games);
log('\nClass win rate');
for (const [id, t] of Object.entries(classScore).sort(
  (x, y) => rate(y[1]) - rate(x[1]),
)) {
  log(
    `  ${heroClasses[id]!.name.padEnd(13)} ${pct(t.score, t.games).padStart(4)}  (${t.games})`,
  );
}
log('\nWin rate with the ability equipped (random loadouts)');
for (const [id, t] of Object.entries(equipped).sort(
  (x, y) => rate(y[1]) - rate(x[1]),
)) {
  log(
    `  ${abilities[id]!.name.padEnd(16)} ${pct(t.score, t.games).padStart(4)}  (${t.games}) used ${stats.use[id] ?? 0}`,
  );
}
