import { abilities, heroClasses, rolePool } from './content';
import type { Faction, PlayerId, Slot } from './types';
import { BACK, FRONT, upgradePoints } from './types';
import type { UnitSetup } from './engine';

/** A small seeded random number generator, so bot games can be replayed. */
export function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function factionClasses(faction: Faction) {
  return Object.values(heroClasses).filter((c) => c.faction === faction);
}

/** Whether a class fights in melee, so it belongs in the front row. */
export function isFrontLiner(classId: string) {
  return heroClasses[classId]!.primaries.some(
    (a) => abilities[a]!.kind === 'melee',
  );
}

const pick = <T>(xs: T[], random?: () => number) =>
  random ? xs[Math.floor(random() * xs.length)]! : xs[0]!;

/** Random levels within the point budget, for bot and simulator heroes. */
function randomLevels(loadout: string[], random: () => number) {
  const result: Record<string, number> = {};
  let left = upgradePoints;
  for (const id of loadout) {
    const level = Math.min(left, Math.floor(random() * 3));
    if (level > 0) result[id] = level;
    left -= level;
  }
  return result;
}

/**
 * One hero of each class in the faction. Front-liners start in the front row,
 * everyone else in the back row, over the middle columns. With `random`,
 * loadouts and levels are picked at random.
 */
export function factionParty(
  faction: Faction,
  owner: PlayerId,
  options: {
    loadouts?: Record<string, string[]>;
    levels?: Record<string, Record<string, number>>;
    random?: () => number;
  } = {},
): UnitSetup[] {
  const front = [1, 2, 0, 3];
  const back = [1, 2, 0, 3];
  return factionClasses(faction).map((c) => {
    const pos: Slot = isFrontLiner(c.id)
      ? { col: front.shift()!, row: FRONT }
      : { col: back.shift()!, row: BACK };
    // Random heroes pick from everything their role can use.
    const loadout = options.loadouts?.[c.id] ?? [
      pick(
        options.random ? rolePool(c.role, 'primary') : c.primaries,
        options.random,
      ),
      pick(
        options.random ? rolePool(c.role, 'secondary') : c.secondaries,
        options.random,
      ),
    ];
    const levels =
      options.levels?.[c.id] ??
      (options.random ? randomLevels(loadout, options.random) : {});
    return {
      id: `${owner}-${c.id}`,
      owner,
      classId: c.id,
      pos,
      loadout,
      levels,
    };
  });
}
