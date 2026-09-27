export type PlayerId = 0 | 1;

/** Front row faces the enemy. */
export type Row = 0 | 1;
export const FRONT: Row = 0;
export const BACK: Row = 1;
export const COLUMNS = 4;

/** A slot in one side's 4×2 formation. Column c faces the enemy's column c. */
export interface Slot {
  col: number;
  row: Row;
}

export type Faction = 'light' | 'dark' | 'nature';

/**
 * Which slots an ability may aim at, relative to where its user stands.
 * - meleeFront: the enemy front slot straight ahead. The user must be in its front row.
 * - meleeDiagonal: an enemy front slot one column to either side. The user must be in its front row.
 * - backline: an enemy back slot straight ahead or one column to either side.
 * - straight: a shot down the user's own column that hits the first hero or
 *   stone block in the way, front row first. It can be fired from either row.
 * - any: any enemy slot; arcing shots and spells can't be obstructed.
 * - enemyRow: one whole enemy row (the pattern decides which cells).
 * - self: the user.
 * - anyAlly: any hero on the user's own side, itself included.
 * - adjacentAlly: an own slot beside the user or in the other row of its column.
 * - ownFront: an empty slot in the user's own front row.
 */
export type Reach =
  | 'meleeFront'
  | 'meleeDiagonal'
  | 'straight'
  | 'flanks'
  | 'backline'
  | 'any'
  | 'enemyRow'
  | 'self'
  | 'anyAlly'
  | 'adjacentAlly'
  | 'ownFront';

/** The shape an ability hits around its aimed slot. */
export type Pattern =
  'single' | 'pair' | 'sides' | 'column' | 'row' | 'square' | 'cross';

export type ShotPath = 'direct' | 'lob';

export type AbilityKind = 'melee' | 'ranged' | 'spell' | 'support';

/**
 * The one effect an ability carries on each hero it hits.
 * - burn, chill, stun, shield, root, weak, marked: statuses (see Unit).
 * - chain: damage spreads to every hero touching the target on its side, allies included.
 * - delay: the target's queued actions land `ticks` later.
 * - haste: the target's next turn comes `ticks` sooner.
 * - interrupt: the target's queued actions are cancelled.
 * - push: a front-row target is knocked into the back row (swapping with whoever is there).
 * - pull: a back-row target is dragged to the front row (swapping likewise).
 * - shove: the target is knocked one slot away from the user: to the other row if it's in the user's lane, otherwise one lane sideways (swapping likewise).
 * - twist: the two heroes in the hit slots trade places.
 * - intervene: the user trades places with the target ally.
 * - relocate: the target ally is moved to the other row of its lane (swapping likewise).
 * - empower: the target's next damaging action does 1 more damage.
 * - quicken: the target's queued actions land `ticks` sooner.
 * - heal: the target heals `heal` health.
 * - drain: the user heals 1 for each hero it damages.
 * - taunt: single-slot enemy actions aimed at a hero next to the user hit the user instead.
 * - guard: the user steps into the slot of a neighbour about to be hit, and takes it.
 * - block: raises a stone block in an empty own front slot.
 * - stoneskin: a shield that also chills whoever it absorbs.
 */
export type AbilityEffect =
  | 'burn'
  | 'chill'
  | 'stun'
  | 'shield'
  | 'root'
  | 'weak'
  | 'marked'
  | 'chain'
  | 'delay'
  | 'haste'
  | 'interrupt'
  | 'push'
  | 'pull'
  | 'shove'
  | 'twist'
  | 'intervene'
  | 'relocate'
  | 'empower'
  | 'quicken'
  | 'heal'
  | 'drain'
  | 'taunt'
  | 'guard'
  | 'block'
  | 'stoneskin';

/**
 * A status on a slot rather than a hero. It lasts `turns` of its placer's
 * activations.
 * - fire: 1 damage to a hero that steps in or starts its turn there.
 * - smoke: the hero there can't attack, and its queued attacks fizzle.
 * - frost: a hero standing there can't move or be swapped until it ends.
 * - thorns: 1 damage to any hero that steps in, friend or foe.
 * - barrier: the hero standing there takes 1 less damage.
 */
export type GroundKind = 'fire' | 'smoke' | 'frost' | 'thorns' | 'barrier';

export interface Ground {
  side: PlayerId;
  slot: Slot;
  kind: GroundKind;
  placerId: string;
  turns: number;
}

/** The parts of an ability an upgrade may change. */
export type AbilityStats = Pick<
  AbilityDef,
  | 'damage'
  | 'speed'
  | 'pattern'
  | 'effect'
  | 'ground'
  | 'ticks'
  | 'heal'
  | 'selfHaste'
  | 'shieldSelf'
>;

/**
 * One level of an ability. Abilities have levels 0, 1 and 2; each level applies
 * its changes on top of the previous ones and costs one upgrade point.
 */
export interface Upgrade {
  id: string;
  name: string;
  cost: number;
  changes: Partial<AbilityStats>;
  /** Added to the ability's damage and speed, so rebalancing keeps upgrades meaningful. */
  bonus?: { damage?: number; speed?: number };
}

/** Which heroes can equip an ability, as in Into the Breach's mech classes. */
export type Role = 'warrior' | 'ranged' | 'caster';

export interface AbilityDef {
  id: string;
  name: string;
  role: Role;
  slot: 'primary' | 'secondary';
  kind: AbilityKind;
  reach: Reach;
  pattern: Pattern;
  /**
   * How a ranged ability flies. A direct shot stops at the first hero or block
   * in each lane it crosses, so front-liners cover whoever is behind them. A
   * lob arcs over the front row and hits exactly the slots it is aimed at.
   */
  path?: ShotPath;
  /** Ticks from queueing until it lands. */
  speed: number;
  damage: number;
  effect?: AbilityEffect;
  /** Leaves this status on every slot it hits. */
  ground?: GroundKind;
  /** Health restored by a heal effect. */
  heal?: number;
  /** Size of a delay, haste or quicken effect, in ticks. */
  ticks?: number;
  /** When it lands, the user's next turn comes this many ticks sooner. */
  selfHaste?: number;
  /** Also shields the user when it lands. */
  shieldSelf?: boolean;
  /** Can be aimed at your own side as well as the enemy's. */
  eitherSide?: boolean;
  /** Level 1 and level 2, in order. */
  upgrades?: Upgrade[];
}

export interface HeroClass {
  id: string;
  name: string;
  faction: Faction;
  role: Role;
  maxHp: number;
  /** Ticks from acting until the hero's next activation. */
  recovery: number;
  /**
   * Signature abilities, offered first. Any hero can equip any primary and
   * secondary of its role.
   */
  primaries: string[];
  secondaries: string[];
}

/** Move points per activation: a hero steps one slot a turn. */
export const MOVE_POINTS = 1;

/** How far into a match a battle happens, which sets how levelled heroes are. */
export type Stage = 'early' | 'mid' | 'late';

/** Level points each hero may spend, by stage: none, half, or every ability maxed. */
export const stagePoints: Record<Stage, number> = { early: 0, mid: 2, late: 4 };

/** Level points each hero may spend when a battle doesn't say otherwise. */
export const upgradePoints = stagePoints.mid;

export interface Unit {
  id: string;
  owner: PlayerId;
  classId: string;
  /** [primary, secondary]. */
  loadout: string[];
  /** Ability levels (0–2) by ability id; missing means level 0. */
  levels: Record<string, number>;
  hp: number;
  /** Null once knocked out. */
  pos: Slot | null;
  /** When this hero next activates. */
  nextAt: number;
  /** Move points left in the current activation. */
  moves: number;
  shielded: boolean;
  stoneskin: boolean;
  /** Burn ticks left; each deals 1 damage at the start of the hero's activation. */
  burning: number;
  /** Skips its next activation; the next damage only breaks the stone. */
  petrified: boolean;
  /** Can't reposition on its next activation. */
  rooted: boolean;
  /** Pulling single-slot attacks off its neighbours until its next activation. */
  taunting: boolean;
  /** Stepping in front of neighbours about to be hit, until its next activation. */
  guarding: boolean;
  /** Waited to brace: takes 1 less damage from each hit until its next activation. */
  braced: boolean;
  /** Its next damaging action does 1 less damage. */
  weak: boolean;
  /** Its next damaging action does 1 more damage. */
  empowered: boolean;
  /** The next damage it takes is 1 more. */
  marked: boolean;
}

/** A stone block filling a front-row slot. */
export interface Block {
  owner: PlayerId;
  col: number;
  hp: number;
}

/** A queued action, aimed relative to its user's column; visible to both players. */
export interface QueuedAction {
  seq: number;
  owner: PlayerId;
  unitId: string;
  abilityId: string;
  /** Column offset from the user's column when it lands. */
  dc: number;
  /** Target row, absolute on the target side. */
  row: Row;
  /** Aimed at the user's own side. */
  own?: boolean;
  /** The tick it lands on. */
  at: number;
  /**
   * The heroes in its slots when it was queued. It hits only them, so a hero
   * that moves away dodges it and whoever steps in is safe. Aimed at empty
   * slots, it locks onto no one and hits whoever is there when it lands.
   */
  targets: string[];
}

export interface BattleState {
  units: Unit[];
  blocks: Block[];
  /** Statuses on slots: fire, smoke, frost, thorns, barriers. */
  grounds: Ground[];
  queue: QueuedAction[];
  time: number;
  /** The hero whose activation it is. */
  activeId: string | null;
  /** Side of the last hero to act, for alternating ties. */
  lastSide: PlayerId;
  activations: number;
  nextSeq: number;
  winner: PlayerId | 'draw' | null;
}

export interface Aim {
  dc: number;
  row: Row;
  /** Aimed at the user's own side (only for abilities that allow either side). */
  own?: boolean;
}

export type Command =
  | { type: 'move'; unitId: string; to: Slot }
  | { type: 'act'; unitId: string; abilityId: string; aim: Aim }
  | { type: 'wait'; unitId: string };

export type Status =
  | 'shield'
  | 'burn'
  | 'chill'
  | 'stun'
  | 'root'
  | 'weak'
  | 'marked'
  | 'haste'
  | 'taunt'
  | 'guard'
  | 'empower';

export type BattleEvent =
  | { type: 'activated'; unitId: string; time: number }
  | { type: 'skipped'; unitId: string }
  | { type: 'moved'; unitId: string; from: Slot; to: Slot }
  | { type: 'queued'; action: QueuedAction }
  | { type: 'waited'; unitId: string }
  | { type: 'landed'; seq: number; abilityId: string; unitId: string }
  | { type: 'missed'; seq: number }
  /** A locked-on target was no longer where the action landed. */
  | { type: 'dodged'; seq: number; unitId: string }
  /** A hero in front of the target in its lane took a direct shot for it. */
  | { type: 'bodyBlocked'; unitId: string; protectedId: string }
  | { type: 'fizzled'; seq: number }
  | { type: 'damaged'; unitId: string; amount: number; hp: number }
  | { type: 'blockDamaged'; owner: PlayerId; col: number; hp: number }
  | { type: 'statusApplied'; unitId: string; status: Status }
  | { type: 'delayed'; unitId: string; ticks: number }
  | { type: 'shieldBlocked'; unitId: string }
  | { type: 'stoneBroken'; unitId: string }
  | { type: 'burned'; unitId: string }
  | { type: 'taunted'; unitId: string; protectedId: string }
  | { type: 'guarded'; unitId: string; protectedId: string }
  | { type: 'healed'; unitId: string; amount: number; hp: number }
  | { type: 'hasted'; unitId: string; ticks: number }
  | { type: 'displaced'; unitId: string; from: Slot; to: Slot }
  | { type: 'groundPlaced'; side: PlayerId; slot: Slot; kind: GroundKind }
  | { type: 'groundTriggered'; unitId: string; kind: GroundKind }
  | { type: 'blockRaised'; owner: PlayerId; col: number }
  | { type: 'knockedOut'; unitId: string }
  | { type: 'battleEnded'; winner: PlayerId | 'draw' };

export type CommandResult =
  | { ok: true; state: BattleState; events: BattleEvent[] }
  | { ok: false; error: string };
