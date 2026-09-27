import type {
  AbilityDef,
  Role,
  AbilityEffect,
  AbilityKind,
  AbilityStats,
  GroundKind,
  HeroClass,
  Pattern,
  Reach,
  Upgrade,
} from './types';

// Prototype content from docs/game-design.md. Numbers will change with playtesting.

function ab(
  name: string,
  kind: AbilityKind,
  reach: Reach,
  speed: number,
  damage: number,
  extra: {
    pattern?: Pattern;
    effect?: AbilityEffect;
    ground?: GroundKind;
    ticks?: number;
    heal?: number;
    selfHaste?: number;
    shieldSelf?: boolean;
    eitherSide?: boolean;
    upgrades?: Upgrade[];
  } = {},
): Omit<AbilityDef, 'id' | 'role' | 'slot'> {
  return { name, kind, reach, speed, damage, pattern: 'single', ...extra };
}

const up = (
  id: string,
  name: string,
  cost: number,
  changes: Partial<AbilityStats>,
): Upgrade => ({ id, name, cost, changes });

const plusOne = (_base?: number): Upgrade => ({
  id: 'power',
  name: '+1 damage',
  cost: 2,
  changes: {},
  bonus: { damage: 1 },
});
const faster = (speed: number): Upgrade => ({
  id: 'quick',
  name: 'Faster (−1 tick)',
  cost: speed > 1 ? 2 : 1,
  changes: {},
  bonus: { speed: -1 },
});

const defs: Record<string, Omit<AbilityDef, 'id' | 'role' | 'slot'>> = {
  // Light: Knight
  bash: ab('Bash', 'melee', 'meleeFront', 1, 2, {
    upgrades: [plusOne(1), up('daze', 'Weakens', 1, { effect: 'weak' })],
  }),
  cleave: ab('Cleave', 'melee', 'meleeFront', 2, 1, {
    pattern: 'pair',
    upgrades: [faster(2), up('mark', 'Marks', 1, { effect: 'marked' })],
  }),
  bodyguard: ab('Bodyguard', 'support', 'self', 1, 0, {
    effect: 'guard',
    upgrades: [up('aegis', 'Also shields itself', 1, { shieldSelf: true })],
  }),
  shieldWall: ab('Shield Wall', 'support', 'self', 1, 0, {
    pattern: 'row',
    ground: 'barrier',
    upgrades: [faster(1)],
  }),
  taunt: ab('Taunt', 'support', 'self', 1, 0, {
    effect: 'taunt',
    upgrades: [up('aegis', 'Also shields itself', 1, { shieldSelf: true })],
  }),

  // Light: Crossbowman
  bolt: ab('Bolt', 'ranged', 'straight', 1, 2, {
    upgrades: [plusOne(1), up('mark', 'Marks', 1, { effect: 'marked' })],
  }),
  aimedShot: ab('Aimed Shot', 'ranged', 'any', 1, 1, {
    upgrades: [faster(2), plusOne(1)],
  }),
  heavyBolt: ab('Heavy Bolt', 'ranged', 'straight', 2, 3, {
    upgrades: [
      plusOne(2),
      up('stagger', 'Interrupts', 1, { effect: 'interrupt' }),
    ],
  }),
  pinningBolt: ab('Pinning Bolt', 'ranged', 'straight', 1, 1, {
    effect: 'root',
    upgrades: [up('frost', 'Chills instead', 1, { effect: 'chill', ticks: 2 })],
  }),
  suppress: ab('Suppress', 'ranged', 'straight', 1, 1, {
    effect: 'weak',
    upgrades: [
      {
        id: 'power',
        name: '+1 damage',
        cost: 1,
        changes: {},
        bonus: { damage: 1 },
      },
    ],
  }),

  // Light: Stormcaller
  spark: ab('Spark', 'spell', 'any', 1, 1, {
    upgrades: [plusOne(1), up('arc', 'Chains', 2, { effect: 'chain' })],
  }),
  chainLightning: ab('Chain Lightning', 'spell', 'any', 2, 1, {
    effect: 'chain',
    upgrades: [plusOne(1), faster(2)],
  }),
  thunder: ab('Thunder', 'spell', 'any', 2, 1, {
    pattern: 'column',
    upgrades: [
      plusOne(1),
      up('frost', 'Chills', 1, { effect: 'chill', ticks: 2 }),
    ],
  }),
  aegis: ab('Aegis', 'support', 'adjacentAlly', 1, 0, {
    effect: 'shield',
    upgrades: [
      faster(1),
      up('holy', 'Leaves a barrier', 1, { ground: 'barrier' }),
    ],
  }),
  haste: ab('Haste', 'support', 'anyAlly', 1, 0, {
    effect: 'haste',
    ticks: 2,
    upgrades: [up('more', '3 ticks sooner', 1, { ticks: 3 })],
  }),

  // Dark: Death Knight
  reap: ab('Reap', 'melee', 'meleeFront', 1, 1, {
    effect: 'burn',
    upgrades: [plusOne(1)],
  }),
  rend: ab('Rend', 'melee', 'meleeDiagonal', 1, 1, {
    effect: 'marked',
    upgrades: [plusOne(1)],
  }),
  dread: ab('Dread', 'melee', 'meleeFront', 1, 1, {
    effect: 'delay',
    ticks: 2,
    upgrades: [
      up('more', 'Delays 3 ticks', 1, { ticks: 3 }),
      {
        id: 'power',
        name: '+1 damage',
        cost: 1,
        changes: {},
        bonus: { damage: 1 },
      },
    ],
  }),
  drain: ab('Drain', 'melee', 'meleeFront', 1, 1, {
    effect: 'drain',
    upgrades: [plusOne(1)],
  }),
  grimGuard: ab('Grim Guard', 'support', 'self', 1, 0, {
    effect: 'guard',
    upgrades: [up('aegis', 'Also shields itself', 1, { shieldSelf: true })],
  }),

  // Dark: Assassin
  stab: ab('Stab', 'melee', 'meleeDiagonal', 1, 2, {
    upgrades: [up('bleed', 'Burns', 1, { effect: 'burn' })],
  }),
  backstab: ab('Backstab', 'melee', 'backline', 2, 2, {
    upgrades: [plusOne(1), faster(2)],
  }),
  smokeBomb: ab('Smoke Bomb', 'ranged', 'any', 1, 0, {
    ground: 'smoke',
    upgrades: [up('wide', 'Two slots', 2, { pattern: 'pair' })],
  }),
  expose: ab('Expose', 'ranged', 'any', 1, 0, {
    effect: 'marked',
    upgrades: [up('wide', 'Two slots', 1, { pattern: 'pair' })],
  }),
  kidneyShot: ab('Kidney Shot', 'melee', 'meleeFront', 1, 1, {
    effect: 'interrupt',
    upgrades: [up('stun', 'Stuns instead', 2, { effect: 'stun' })],
  }),

  // Dark: Warlock
  fireBolt: ab('Fire Bolt', 'spell', 'any', 1, 0, {
    ground: 'fire',
    upgrades: [plusOne(1)],
  }),
  hex: ab('Hex', 'spell', 'any', 2, 1, {
    effect: 'weak',
    upgrades: [up('wide', 'Two slots', 1, { pattern: 'pair' })],
  }),
  hellfire: ab('Hellfire', 'spell', 'any', 3, 1, {
    pattern: 'square',
    ground: 'fire',
    upgrades: [faster(3)],
  }),
  ignite: ab('Ignite', 'spell', 'any', 2, 0, {
    ground: 'fire',
    pattern: 'pair',
    upgrades: [faster(2)],
  }),
  disrupt: ab('Disrupt', 'spell', 'any', 1, 0, {
    effect: 'delay',
    ticks: 3,
    upgrades: [faster(2)],
  }),

  // Nature: Warden
  slam: ab('Slam', 'melee', 'meleeFront', 1, 1, {
    effect: 'chill',
    ticks: 2,
    upgrades: [plusOne(1)],
  }),
  maul: ab('Maul', 'melee', 'meleeFront', 2, 3, {
    upgrades: [up('stagger', 'Interrupts', 1, { effect: 'interrupt' })],
  }),
  stoneWall: ab('Stone Wall', 'support', 'ownFront', 1, 0, {
    effect: 'block',
    upgrades: [faster(1)],
  }),
  entangle: ab('Entangle', 'melee', 'meleeFront', 1, 1, {
    effect: 'root',
    upgrades: [
      {
        id: 'power',
        name: '+1 damage',
        cost: 1,
        changes: {},
        bonus: { damage: 1 },
      },
    ],
  }),
  standFirm: ab('Stand Firm', 'support', 'self', 1, 0, {
    pattern: 'row',
    ground: 'barrier',
    upgrades: [up('aegis', 'Also shields itself', 1, { shieldSelf: true })],
  }),

  // Nature: Ranger
  arrow: ab('Arrow', 'ranged', 'any', 1, 1, {
    upgrades: [plusOne(1)],
  }),
  quickShot: ab('Quick Shot', 'ranged', 'straight', 1, 1, {
    selfHaste: 1,
    upgrades: [up('more', 'Next turn 2 sooner', 1, { selfHaste: 2 })],
  }),
  frostArrow: ab('Frost Arrow', 'ranged', 'straight', 1, 1, {
    effect: 'chill',
    ticks: 2,
    upgrades: [
      {
        id: 'power',
        name: '+1 damage',
        cost: 1,
        changes: {},
        bonus: { damage: 1 },
      },
      up('field', 'Leaves frost', 1, { ground: 'frost' }),
    ],
  }),
  volley: ab('Volley', 'ranged', 'enemyRow', 3, 1, {
    pattern: 'row',
    upgrades: [faster(2)],
  }),
  huntersMark: ab("Hunter's Mark", 'ranged', 'any', 1, 0, {
    effect: 'marked',
    upgrades: [faster(1)],
  }),

  // Nature: Druid
  thorns: ab('Thorns', 'spell', 'any', 1, 1, {
    upgrades: [
      up('patch', 'Leaves thorns', 1, { ground: 'thorns' }),
      up('snare', 'Roots', 1, { effect: 'root' }),
    ],
  }),
  quake: ab('Quake', 'spell', 'enemyRow', 3, 1, {
    pattern: 'row',
    upgrades: [up('frost', 'Chills', 1, { effect: 'chill', ticks: 2 })],
  }),
  petrify: ab('Petrify', 'spell', 'any', 3, 0, {
    effect: 'stun',
    upgrades: [faster(3)],
  }),
  stoneskin: ab('Stoneskin', 'support', 'adjacentAlly', 1, 0, {
    effect: 'stoneskin',
    upgrades: [faster(1)],
  }),
  wildGrowth: ab('Wild Growth', 'support', 'anyAlly', 1, 0, {
    effect: 'haste',
    ticks: 2,
    upgrades: [up('more', '3 ticks sooner', 1, { ticks: 3 })],
  }),

  // Pushes, pulls, two-slot attacks and support for your own side.
  shieldBash: ab('Shield Bash', 'melee', 'meleeFront', 1, 1, {
    effect: 'push',
    upgrades: [plusOne(1)],
  }),
  rally: ab('Rally', 'support', 'anyAlly', 1, 0, {
    effect: 'quicken',
    ticks: 1,
    upgrades: [up('more', '2 ticks sooner', 1, { ticks: 2 })],
  }),
  // Two slots anywhere, so it never gets faster: levels mark and shield.
  scatterShot: ab('Scatter Shot', 'ranged', 'any', 2, 1, {
    pattern: 'pair',
    upgrades: [
      up('mark', 'Marks what it hits', 1, { effect: 'marked' }),
      up('aegis', 'Also shields itself', 1, { shieldSelf: true }),
    ],
  }),
  concussiveBolt: ab('Concussive Bolt', 'ranged', 'straight', 1, 1, {
    effect: 'push',
    upgrades: [up('stagger', 'Interrupts instead', 1, { effect: 'interrupt' })],
  }),
  inspire: ab('Inspire', 'support', 'anyAlly', 1, 0, {
    effect: 'empower',
    upgrades: [faster(1)],
  }),
  hook: ab('Hook', 'melee', 'backline', 1, 0, {
    effect: 'pull',
    upgrades: [
      {
        id: 'power',
        name: '+1 damage',
        cost: 1,
        changes: {},
        bonus: { damage: 1 },
      },
    ],
  }),
  sweep: ab('Sweep', 'melee', 'meleeFront', 1, 0, {
    pattern: 'pair',
    effect: 'push',
    upgrades: [
      {
        id: 'power',
        name: '+1 damage',
        cost: 2,
        changes: {},
        bonus: { damage: 1 },
      },
    ],
  }),
  shadowstep: ab('Shadowstep', 'support', 'self', 0, 0, {
    effect: 'haste',
    ticks: 2,
    upgrades: [up('more', '3 ticks sooner', 1, { ticks: 3 })],
  }),
  darkPact: ab('Dark Pact', 'support', 'anyAlly', 1, 0, {
    effect: 'empower',
    upgrades: [faster(1)],
  }),
  heave: ab('Heave', 'melee', 'meleeFront', 1, 1, {
    effect: 'push',
    upgrades: [plusOne(1)],
  }),
  twinArrows: ab('Twin Arrows', 'ranged', 'any', 2, 1, {
    pattern: 'column',
    upgrades: [faster(2)],
  }),
  drivingShot: ab('Driving Shot', 'ranged', 'straight', 1, 1, {
    effect: 'push',
    upgrades: [plusOne(1)],
  }),
  mend: ab('Mend', 'support', 'anyAlly', 1, 0, {
    effect: 'heal',
    heal: 2,
    upgrades: [up('more', 'Heals 3', 1, { heal: 3 })],
  }),

  // Sideways shoves, swaps and repositioning.
  trip: ab('Trip', 'melee', 'meleeDiagonal', 1, 1, {
    effect: 'shove',
    upgrades: [plusOne(1)],
  }),
  uproot: ab('Uproot', 'melee', 'meleeDiagonal', 1, 1, {
    effect: 'shove',
    upgrades: [
      {
        id: 'power',
        name: '+1 damage',
        cost: 1,
        changes: {},
        bonus: { damage: 1 },
      },
    ],
  }),
  gust: ab('Gust', 'spell', 'any', 1, 0, {
    effect: 'shove',
    eitherSide: true,
    upgrades: [up('wide', 'Whole column', 2, { pattern: 'column' })],
  }),
  twist: ab('Twist', 'spell', 'any', 2, 0, {
    pattern: 'pair',
    effect: 'twist',
    eitherSide: true,
    upgrades: [
      faster(2),
      {
        id: 'power',
        name: '+1 damage',
        cost: 2,
        changes: {},
        bonus: { damage: 1 },
      },
    ],
  }),
  intervene: ab('Intervene', 'support', 'anyAlly', 0, 0, {
    effect: 'intervene',
    upgrades: [up('aegis', 'Also shields itself', 1, { shieldSelf: true })],
  }),
  relocate: ab('Relocate', 'support', 'anyAlly', 1, 0, {
    effect: 'relocate',
    upgrades: [faster(1)],
  }),

  // Dark's ranged skirmisher.
  throwingKnives: ab('Throwing Knives', 'ranged', 'straight', 1, 2, {
    upgrades: [plusOne(), up('mark', 'Marks', 1, { effect: 'marked' })],
  }),
  poisonDart: ab('Poison Dart', 'ranged', 'any', 1, 0, {
    effect: 'burn',
    upgrades: [plusOne(), up('weak', 'Also weakens', 1, { effect: 'weak' })],
  }),
};

const hero = (
  id: string,
  name: string,
  faction: HeroClass['faction'],
  role: Role,
  maxHp: number,
  recovery: number,
  primaries: string[],
  secondaries: string[],
): HeroClass => ({
  id,
  name,
  faction,
  role,
  maxHp,
  recovery,
  primaries,
  secondaries,
});

export const heroClasses: Record<string, HeroClass> = Object.fromEntries(
  [
    hero(
      'knight',
      'Knight',
      'light',
      'warrior',
      4,
      5,
      ['bash', 'cleave', 'shieldBash'],
      ['bodyguard', 'shieldWall', 'taunt', 'rally', 'intervene'],
    ),
    hero(
      'crossbowman',
      'Crossbowman',
      'light',
      'ranged',
      3,
      4,
      ['bolt', 'aimedShot', 'scatterShot'],
      ['heavyBolt', 'pinningBolt', 'suppress', 'concussiveBolt'],
    ),
    hero(
      'stormcaller',
      'Stormcaller',
      'light',
      'caster',
      2,
      4,
      ['spark', 'chainLightning'],
      ['thunder', 'aegis', 'haste', 'inspire', 'relocate'],
    ),
    hero(
      'deathKnight',
      'Death Knight',
      'dark',
      'warrior',
      4,
      5,
      ['reap', 'rend', 'hook', 'stab', 'backstab', 'trip'],
      ['dread', 'drain', 'grimGuard', 'sweep', 'kidneyShot'],
    ),
    hero(
      'assassin',
      'Assassin',
      'dark',
      'ranged',
      3,
      4,
      ['throwingKnives', 'poisonDart'],
      ['smokeBomb', 'expose', 'shadowstep'],
    ),
    hero(
      'warlock',
      'Warlock',
      'dark',
      'caster',
      2,
      4,
      ['fireBolt', 'hex'],
      ['hellfire', 'ignite', 'disrupt', 'darkPact', 'twist'],
    ),
    hero(
      'warden',
      'Warden',
      'nature',
      'warrior',
      4,
      5,
      ['slam', 'maul', 'heave'],
      ['stoneWall', 'entangle', 'standFirm', 'uproot'],
    ),
    hero(
      'ranger',
      'Ranger',
      'nature',
      'ranged',
      3,
      4,
      ['arrow', 'quickShot', 'twinArrows'],
      ['frostArrow', 'volley', 'huntersMark', 'drivingShot'],
    ),
    hero(
      'druid',
      'Druid',
      'nature',
      'caster',
      2,
      4,
      ['thorns', 'quake'],
      ['petrify', 'stoneskin', 'wildGrowth', 'mend', 'gust'],
    ),
  ].map((c) => [c.id, c]),
);

/** A second level for abilities that only list one: more damage, or faster. */
function secondLevel(d: Omit<AbilityDef, 'id' | 'role' | 'slot'>): Upgrade {
  if (d.damage > 0) return plusOne();
  if (d.speed > 1) return faster(d.speed);
  if (d.ticks)
    return up('more', `${d.ticks + 1} ticks`, 1, { ticks: d.ticks + 1 });
  if (d.heal) return up('more', `Heals ${d.heal + 1}`, 1, { heal: d.heal + 1 });
  return up('aegis', 'Also shields itself', 1, { shieldSelf: true });
}

export const abilities: Record<string, AbilityDef> = Object.fromEntries(
  Object.entries(defs).map(([id, d]) => {
    const owner = Object.values(heroClasses).find(
      (c) => c.primaries.includes(id) || c.secondaries.includes(id),
    );
    if (!owner) throw new Error(`${id} is not in any class list`);
    const levels = [...(d.upgrades ?? [])].slice(0, 2);
    while (levels.length < 2) {
      const next = secondLevel({
        ...d,
        ...levels.reduce((x, u) => ({ ...x, ...u.changes }), {}),
      });
      if (levels.some((u) => u.id === next.id)) {
        levels.push(
          up('aegis', 'Also shields itself', 1, { shieldSelf: true }),
        );
      } else {
        levels.push(next);
      }
    }
    return [
      id,
      {
        id,
        ...d,
        role: owner.role,
        slot: owner.primaries.includes(id) ? 'primary' : 'secondary',
        upgrades: levels.map((u) => ({ ...u, cost: 1 })),
      } satisfies AbilityDef,
    ];
  }),
);

/** Abilities any hero of a role can equip in a slot. */
export function rolePool(role: Role, slot: 'primary' | 'secondary'): string[] {
  return Object.values(abilities)
    .filter((a) => a.role === role && a.slot === slot)
    .map((a) => a.id);
}
