// Do telegraphs matter? Compares rule variants by how much reading the enemy's
// queue is worth, how the opening is balanced, and how long battles run.
// Run: `pnpm -s tsx tools/tempo.ts [battles] [seed] [variants]`, where variants
// is a comma list of moveTax:heavySlow:secondStart[:answers[:opening]], with
// 0/1 flags, e.g. `0:0:1,0:1:0:1:1`.
import { chooseActivation, chooseOpening, type BotOptions } from '@tactics/bot';
import {
  activeUnit,
  applyCommand,
  createBattle,
  factionParty,
  seededRandom,
  tuning,
  type Faction,
  type PlayerId,
} from '@tactics/rules';

const battles = Number(process.argv[2] ?? 300);
const seed = Number(process.argv[3] ?? 1);
const variants = (process.argv[4] ?? '0:0:1,1:0:1,0:1:1,1:1:1')
  .split(',')
  .map((v) => {
    const [moveTax = 0, heavy = 0, secondStart = 1, answers = 0, opening = 0] =
      v.split(':').map(Number);
    return { moveTax, heavy, secondStart, answers, opening };
  });
const factions: Faction[] = ['light', 'dark', 'nature'];

interface Result {
  winner: PlayerId | null;
  activations: number;
  dodged: number;
  hits: number;
}

function play(random: () => number, bots: [BotOptions, BotOptions]): Result {
  const pick = <T>(xs: T[]) => xs[Math.floor(random() * xs.length)]!;
  let s = createBattle([
    ...factionParty(pick(factions), 0, { random }),
    ...factionParty(pick(factions), 1, { random }),
  ]);
  let dodged = 0;
  let hits = 0;
  for (const owner of [0, 1] as const) {
    if (!s.opening) break;
    const r = applyCommand(s, {
      type: 'opening',
      owner,
      choices: chooseOpening(s, owner, { ...bots[owner], random }),
    });
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  while (s.winner === null && s.activations < 200) {
    const u = activeUnit(s);
    if (!u) break;
    const before = s;
    for (const c of chooseActivation(s, { ...bots[u.owner], random })) {
      const r = applyCommand(s, c);
      if (!r.ok) break;
      for (const e of r.events) {
        if (e.type === 'dodged') dodged++;
        if (e.type === 'damaged') hits++;
      }
      s = r.state;
    }
    if (s === before) {
      const r = applyCommand(s, { type: 'wait', unitId: u.id });
      if (!r.ok) break;
      s = r.state;
    }
  }
  return {
    winner: s.winner === 0 || s.winner === 1 ? s.winner : null,
    activations: s.activations,
    dodged,
    hits,
  };
}

const pct = (n: number, d: number) =>
  `${Math.round((100 * n) / Math.max(1, d))}%`;
const greedy: BotOptions = { noise: 0.3 };
const blind: BotOptions = { noise: 0.3, awareness: 0 };
const lookahead: BotOptions = { style: 'lookahead', noise: 0.3 };

console.log(
  'moveTax heavy p2Start answers opening | reads queue | lookahead | p1 wins | acts med/p90 | dodged per hit',
);
for (const { moveTax, heavy, secondStart, answers, opening } of variants) {
  tuning.moveTax = moveTax;
  tuning.heavySlow = heavy === 1;
  tuning.secondStart = secondStart;
  tuning.threats = answers === 1 ? 'answers' : 'lock';
  tuning.secretOpening = opening === 1;
  const random = seededRandom(seed);

  // Mirror matches: opening balance, length and dodging.
  let p1 = 0;
  let decided = 0;
  let dodged = 0;
  let hits = 0;
  const lengths: number[] = [];
  for (let i = 0; i < battles; i++) {
    const r = play(random, [greedy, greedy]);
    lengths.push(r.activations);
    dodged += r.dodged;
    hits += r.hits;
    if (r.winner !== null) {
      decided++;
      if (r.winner === 0) p1++;
    }
  }
  // Skill: the queue reader against a queue-blind bot, and lookahead against greedy.
  const score = (a: BotOptions, b: BotOptions, n: number) => {
    let total = 0;
    for (let i = 0; i < n; i++) {
      const side = (i % 2) as PlayerId;
      const r = play(random, side === 0 ? [a, b] : [b, a]);
      total += r.winner === null ? 0.5 : r.winner === side ? 1 : 0;
    }
    return pct(total, n);
  };
  const reads = score(greedy, blind, battles);
  const looks = score(lookahead, greedy, Math.round(battles / 4));
  lengths.sort((a, b) => a - b);
  const med = lengths[lengths.length >> 1];
  const p90 = lengths[Math.floor(lengths.length * 0.9)];
  console.log(
    `${String(moveTax).padEnd(8)}${String(heavy === 1).padEnd(6)}${String(secondStart).padEnd(8)}${String(answers === 1).padEnd(8)}${String(opening === 1).padEnd(8)}| ${reads.padEnd(12)}| ${looks.padEnd(10)}| ${pct(p1, decided).padEnd(8)}| ${`${med}/${p90}`.padEnd(13)}| ${(dodged / Math.max(1, hits)).toFixed(2)}`,
  );
}
