import type {
  AbilityDef,
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
): Omit<AbilityDef, 'id'> {
  return { name, kind, reach, speed, damage, pattern: 'single', ...extra };
}

const up = (
  id: string,
  name: string,
  cost: number,
  changes: Partial<AbilityStats>,
): Upgrade => ({ id, name, cost, changes });

const plusOne = (damage: number) =>
  up('power', '+1 damage', 2, { damage: damage + 1 });
const faster = (speed: number) =>
  up('quick', 'Faster (−1 tick)', speed > 1 ? 2 : 1, { speed: speed - 1 });

const defs: Record<string, Omit<AbilityDef, 'id'>> = {
  // Light: Knight
  bash: ab('Bash', 'melee', 'meleeFront', 1, 1, {
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
  bolt: ab('Bolt', 'ranged', 'straight', 1, 1, {
    upgrades: [plusOne(1), up('mark', 'Marks', 1, { effect: 'marked' })],
  }),
  aimedShot: ab('Aimed Shot', 'ranged', 'any', 2, 1, {
    upgrades: [faster(2), plusOne(1)],
  }),
  heavyBolt: ab('Heavy Bolt', 'ranged', 'straight', 2, 2, {
    upgrades: [
      plusOne(2),
      up('stagger', 'Interrupts', 1, { effect: 'interrupt' }),
    ],
  }),
  pinningBolt: ab('Pinning Bolt', 'ranged', 'straight', 1, 1, {
    effect: 'root',
    upgrades: [up('frost', 'Chills instead', 1, { effect: 'chill', ticks: 2 })],
  }),
  suppress: ab('Suppress', 'ranged', 'straight', 1, 0, {
    effect: 'weak',
    upgrades: [up('power', '+1 damage', 1, { damage: 1 })],
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
  dread: ab('Dread', 'melee', 'meleeFront', 1, 0, {
    effect: 'delay',
    ticks: 2,
    upgrades: [
      up('more', 'Delays 3 ticks', 1, { ticks: 3 }),
      up('power', '+1 damage', 1, { damage: 1 }),
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
  backstab: ab('Backstab', 'melee', 'backline', 2, 1, {
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
  fireBolt: ab('Fire Bolt', 'spell', 'any', 1, 1, {
    effect: 'burn',
    upgrades: [plusOne(1)],
  }),
  hex: ab('Hex', 'spell', 'any', 1, 0, {
    effect: 'weak',
    upgrades: [up('wide', 'Two slots', 1, { pattern: 'pair' })],
  }),
  hellfire: ab('Hellfire', 'spell', 'any', 3, 1, {
    pattern: 'square',
    ground: 'fire',
    upgrades: [faster(3)],
  }),
  ignite: ab('Ignite', 'spell', 'any', 1, 0, {
    ground: 'fire',
    upgrades: [up('wide', 'Two slots', 1, { pattern: 'pair' })],
  }),
  disrupt: ab('Disrupt', 'spell', 'any', 2, 0, {
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
  maul: ab('Maul', 'melee', 'meleeFront', 2, 2, {
    upgrades: [up('stagger', 'Interrupts', 1, { effect: 'interrupt' })],
  }),
  stoneWall: ab('Stone Wall', 'support', 'ownFront', 1, 0, {
    effect: 'block',
    upgrades: [faster(1)],
  }),
  entangle: ab('Entangle', 'melee', 'meleeFront', 1, 0, {
    effect: 'root',
    upgrades: [up('power', '+1 damage', 1, { damage: 1 })],
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
  frostArrow: ab('Frost Arrow', 'ranged', 'straight', 1, 0, {
    effect: 'chill',
    ticks: 2,
    upgrades: [
      up('power', '+1 damage', 1, { damage: 1 }),
      up('field', 'Leaves frost', 1, { ground: 'frost' }),
    ],
  }),
  volley: ab('Volley', 'ranged', 'enemyRow', 2, 1, {
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
      up('snare', 'Roots', 1, { effect: 'root' }),
      up('patch', 'Leaves thorns', 1, { ground: 'thorns' }),
    ],
  }),
  quake: ab('Quake', 'spell', 'enemyRow', 2, 1, {
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
  scatterShot: ab('Scatter Shot', 'ranged', 'any', 2, 1, {
    pattern: 'pair',
    upgrades: [faster(2)],
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
    upgrades: [up('power', '+1 damage', 1, { damage: 1 })],
  }),
  sweep: ab('Sweep', 'melee', 'meleeFront', 1, 0, {
    pattern: 'pair',
    effect: 'push',
    upgrades: [up('power', '+1 damage', 2, { damage: 1 })],
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
  uproot: ab('Uproot', 'melee', 'meleeDiagonal', 1, 0, {
    effect: 'shove',
    upgrades: [up('power', '+1 damage', 1, { damage: 1 })],
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
    upgrades: [faster(2), up('power', '+1 damage', 2, { damage: 1 })],
  }),
  intervene: ab('Intervene', 'support', 'anyAlly', 0, 0, {
    effect: 'intervene',
    upgrades: [up('aegis', 'Also shields itself', 1, { shieldSelf: true })],
  }),
  relocate: ab('Relocate', 'support', 'anyAlly', 1, 0, {
    effect: 'relocate',
    upgrades: [faster(1)],
  }),
};

export const abilities: Record<string, AbilityDef> = Object.fromEntries(
  Object.entries(defs).map(([id, d]) => [id, { id, ...d }]),
);

const hero = (
  id: string,
  name: string,
  faction: HeroClass['faction'],
  maxHp: number,
  recovery: number,
  primaries: string[],
  secondaries: string[],
): HeroClass => ({
  id,
  name,
  faction,
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
      4,
      5,
      ['bash', 'cleave', 'shieldBash'],
      ['bodyguard', 'shieldWall', 'taunt', 'rally', 'intervene'],
    ),
    hero(
      'crossbowman',
      'Crossbowman',
      'light',
      3,
      4,
      ['bolt', 'aimedShot', 'scatterShot'],
      ['heavyBolt', 'pinningBolt', 'suppress', 'concussiveBolt'],
    ),
    hero(
      'stormcaller',
      'Stormcaller',
      'light',
      2,
      4,
      ['spark', 'chainLightning'],
      ['thunder', 'aegis', 'haste', 'inspire', 'relocate'],
    ),
    hero(
      'deathKnight',
      'Death Knight',
      'dark',
      4,
      5,
      ['reap', 'rend', 'hook'],
      ['dread', 'drain', 'grimGuard', 'sweep'],
    ),
    hero(
      'assassin',
      'Assassin',
      'dark',
      4,
      3,
      ['stab', 'backstab', 'trip'],
      ['smokeBomb', 'expose', 'kidneyShot', 'shadowstep'],
    ),
    hero(
      'warlock',
      'Warlock',
      'dark',
      2,
      4,
      ['fireBolt', 'hex'],
      ['hellfire', 'ignite', 'disrupt', 'darkPact', 'twist'],
    ),
    hero(
      'warden',
      'Warden',
      'nature',
      4,
      5,
      ['slam', 'maul', 'heave'],
      ['stoneWall', 'entangle', 'standFirm', 'uproot'],
    ),
    hero(
      'ranger',
      'Ranger',
      'nature',
      3,
      3,
      ['arrow', 'quickShot', 'twinArrows'],
      ['frostArrow', 'volley', 'huntersMark', 'drivingShot'],
    ),
    hero(
      'druid',
      'Druid',
      'nature',
      2,
      4,
      ['thorns', 'quake'],
      ['petrify', 'stoneskin', 'wildGrowth', 'mend', 'gust'],
    ),
  ].map((c) => [c.id, c]),
);
