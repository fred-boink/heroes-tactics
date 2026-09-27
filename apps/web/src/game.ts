import {
  abilities,
  aimOptions,
  heroClass,
  targetSide,
  targetSlots,
  type Aim,
  type BattleEvent,
  type BattleState,
  type Faction,
  type PlayerId,
  type Slot,
  type Status,
  type Unit,
} from '@tactics/rules';

export type Mode = 'bot' | 'hotseat';

export interface GameConfig {
  mode: Mode;
  factions: [Faction, Faction];
  /** Per player, class id → equipped abilities. */
  loadouts: [Record<string, string[]>, Record<string, string[]>];
  /** Per player, class id → ability id → level (0–2). */
  levels: [
    Record<string, Record<string, number>>,
    Record<string, Record<string, number>>,
  ];
  seed: number;
}

export const factionNames: Record<Faction, string> = {
  light: 'Light',
  dark: 'Dark',
  nature: 'Nature',
};

export const kindNames = {
  melee: 'Melee',
  ranged: 'Ranged',
  spell: 'Spell',
  support: 'Support',
} as const;

export const glyphs: Record<string, string> = {
  knight: 'Kn',
  crossbowman: 'Cb',
  stormcaller: 'St',
  deathKnight: 'DK',
  assassin: 'As',
  warlock: 'Wl',
  warden: 'Wd',
  ranger: 'Rg',
  druid: 'Dr',
};

export const slotKey = (side: PlayerId, s: Slot) => `${side}:${s.col}:${s.row}`;

export interface Candidate {
  aim: Aim;
  side: PlayerId;
  slots: Slot[];
}

/**
 * Every aim for an ability from where the unit stands, keyed by each slot the
 * player can click to choose it: the aimed slot and every slot it would hit.
 */
export function candidates(
  state: BattleState,
  unit: Unit,
  abilityId: string,
): Map<string, Candidate> {
  const a = abilities[abilityId];
  const result = new Map<string, Candidate>();
  if (!a || !unit.pos) return result;
  for (const aim of aimOptions(state, unit, abilityId)) {
    const side = targetSide(unit, a, aim);
    const slots = targetSlots(state, unit, a, aim);
    const anchor = { col: unit.pos.col + aim.dc, row: aim.row };
    const candidate = { aim, side, slots };
    // Clicking the aimed slot, or anything the aim actually hits, chooses it.
    for (const s of [anchor, ...slots]) {
      const k = slotKey(side, s);
      if (!result.has(k)) result.set(k, candidate);
    }
  }
  return result;
}

export function sideName(owner: PlayerId, mode: Mode) {
  if (mode === 'bot') return owner === 0 ? 'your' : 'enemy';
  return `P${owner + 1}`;
}

/** One chronicle line per event worth reading; noise returns null. */
export function describe(
  e: BattleEvent,
  state: Pick<BattleState, 'units'>,
  mode: Mode,
): { text: string; tone: 'turn' | 'hit' | 'magic' | 'plain' } | null {
  const name = (id: string) => {
    const u = state.units.find((x) => x.id === id);
    if (!u) return 'Someone';
    return `${sideName(u.owner, mode)} ${heroClass(u.classId).name}`;
  };
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const ability = (id: string) => abilities[id]?.name ?? id;
  switch (e.type) {
    case 'activated':
      return { text: `${cap(name(e.unitId))}'s turn`, tone: 'turn' };
    case 'skipped':
      return {
        text: `${cap(name(e.unitId))} is stunned and skips its turn.`,
        tone: 'plain',
      };
    case 'queued': {
      const a = abilities[e.action.abilityId]!;
      const ticks = a.speed === 1 ? '1 tick' : `${a.speed} ticks`;
      return {
        text: `${cap(name(e.action.unitId))} readies ${a.name}. It lands in ${ticks}.`,
        tone: a.kind === 'spell' ? 'magic' : 'plain',
      };
    }
    case 'waited':
      return { text: `${cap(name(e.unitId))} waits.`, tone: 'plain' };
    case 'landed':
      return {
        text: `${cap(name(e.unitId))}'s ${ability(e.abilityId)} lands.`,
        tone: 'magic',
      };
    case 'missed':
      return { text: 'An attack lands on nothing.', tone: 'plain' };
    case 'fizzled':
      return { text: 'A queued action is cancelled.', tone: 'magic' };
    case 'damaged':
      return {
        text: `${cap(name(e.unitId))} takes ${e.amount} (${e.hp} left).`,
        tone: 'hit',
      };
    case 'blockDamaged':
      return { text: `A stone block cracks (${e.hp} left).`, tone: 'plain' };
    case 'statusApplied': {
      const what = {
        shield: 'is shielded',
        burn: 'catches fire',
        chill: 'is chilled',
        stun: 'is stunned',
        root: 'is rooted',
        weak: 'is weakened',
        marked: 'is marked',
        haste: 'is hastened',
        taunt: 'taunts',
        guard: 'stands guard',
        empower: 'is empowered',
      }[e.status];
      return { text: `${cap(name(e.unitId))} ${what}.`, tone: 'plain' };
    }
    case 'shieldBlocked':
      return {
        text: `${cap(name(e.unitId))}'s shield absorbs the hit.`,
        tone: 'plain',
      };
    case 'stoneBroken':
      return {
        text: `The stone around ${name(e.unitId)} breaks.`,
        tone: 'plain',
      };
    case 'burned':
      return { text: `${cap(name(e.unitId))} burns.`, tone: 'hit' };
    case 'taunted':
      return {
        text: `${cap(name(e.unitId))} takes the hit for ${name(e.protectedId)}.`,
        tone: 'plain',
      };
    case 'guarded':
      return {
        text: `${cap(name(e.unitId))} steps in front of ${name(e.protectedId)}.`,
        tone: 'plain',
      };
    case 'healed':
      return {
        text: `${cap(name(e.unitId))} heals ${e.amount} (${e.hp}).`,
        tone: 'plain',
      };
    case 'hasted':
      return null;
    case 'displaced':
      return {
        text: `${cap(name(e.unitId))} is knocked to the ${e.to.row === 0 ? 'front' : 'back'} row.`,
        tone: 'plain',
      };
    case 'groundPlaced':
      return null;
    case 'groundTriggered':
      return {
        text: {
          fire: `${cap(name(e.unitId))} is scorched by fire.`,
          thorns: `${cap(name(e.unitId))} steps into thorns.`,
          frost: `${cap(name(e.unitId))} wades through frost.`,
          barrier: `${cap(name(e.unitId))} is behind a barrier.`,
          smoke: `${cap(name(e.unitId))} is lost in smoke.`,
        }[e.kind],
        tone: 'hit',
      };
    case 'blockRaised':
      return { text: 'A stone block rises.', tone: 'plain' };
    case 'knockedOut':
      return { text: `${cap(name(e.unitId))} is knocked out.`, tone: 'hit' };
    case 'battleEnded':
      return {
        text:
          e.winner === 'draw'
            ? 'The battle ends in a draw.'
            : mode === 'bot'
              ? e.winner === 0
                ? 'Victory.'
                : 'Defeat.'
              : `Player ${e.winner + 1} wins.`,
        tone: 'turn',
      };
    default:
      return null;
  }
}

export const statusIcons: Record<Status, string> = {
  shield: '🛡',
  burn: '🔥',
  chill: '❄',
  stun: '🪨',
  root: '🌿',
  weak: '💧',
  marked: '🎯',
  haste: '⏩',
  taunt: '⚑',
  guard: '⛨',
  empower: '💪',
};

/** What an action would do to each hero, read from its predicted events. */
export interface Outcome {
  damage: number;
  heal: number;
  statuses: Status[];
  blocked: boolean;
  knockedOut: boolean;
  /** Slots it would be moved between, on its own side. */
  moves: { from: Slot; to: Slot }[];
}

export function outcomesOf(events: BattleEvent[]): Map<string, Outcome> {
  const result = new Map<string, Outcome>();
  const get = (id: string) => {
    let o = result.get(id);
    if (!o) {
      o = {
        damage: 0,
        heal: 0,
        statuses: [],
        blocked: false,
        knockedOut: false,
        moves: [],
      };
      result.set(id, o);
    }
    return o;
  };
  for (const e of events) {
    switch (e.type) {
      case 'damaged':
        get(e.unitId).damage += e.amount;
        break;
      case 'healed':
        get(e.unitId).heal += e.amount;
        break;
      case 'statusApplied':
        if (!get(e.unitId).statuses.includes(e.status)) {
          get(e.unitId).statuses.push(e.status);
        }
        break;
      case 'shieldBlocked':
      case 'stoneBroken':
        get(e.unitId).blocked = true;
        break;
      case 'knockedOut':
        get(e.unitId).knockedOut = true;
        break;
      case 'displaced':
        get(e.unitId).moves.push({ from: e.from, to: e.to });
        break;
    }
  }
  return result;
}
