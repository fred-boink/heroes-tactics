import { abilities, heroClasses } from './content';
import {
  BACK,
  COLUMNS,
  FRONT,
  MOVE_POINTS,
  upgradePoints,
  type AbilityDef,
  type Aim,
  type BattleEvent,
  type BattleState,
  type Block,
  type Command,
  type CommandResult,
  type Ground,
  type GroundKind,
  type PlayerId,
  type QueuedAction,
  type Row,
  type Slot,
  type Status,
  type Unit,
} from './types';

export interface UnitSetup {
  id: string;
  owner: PlayerId;
  classId: string;
  pos: Slot;
  /** Up to one primary and one secondary; defaults to the first of each. */
  loadout?: string[];
  /** Ability levels (0–2) by ability id, within the hero's upgrade points. */
  levels?: Record<string, number>;
  /** First activation tick; defaults to the class recovery. */
  nextAt?: number;
}

export function heroClass(classId: string) {
  const c = heroClasses[classId];
  if (!c) throw new Error(`Unknown class ${classId}`);
  return c;
}

function baseAbility(id: string): AbilityDef {
  const a = abilities[id];
  if (!a) throw new Error(`Unknown ability ${id}`);
  return a;
}

/** An ability as a particular hero has it, at its level. */
export function unitAbility(
  unit: Pick<Unit, 'levels'>,
  abilityId: string,
): AbilityDef {
  const base = baseAbility(abilityId);
  const level = unit.levels[abilityId] ?? 0;
  let result: AbilityDef = base;
  for (const u of (base.upgrades ?? []).slice(0, level)) {
    result = { ...result, ...u.changes };
    if (u.bonus?.damage) result.damage += u.bonus.damage;
    if (u.bonus?.speed)
      result.speed = Math.max(0, result.speed + u.bonus.speed);
  }
  return result;
}

/** A new battle, advanced to the first hero's activation. Fast heroes go first. */
export function createBattle(units: UnitSetup[]): BattleState {
  const seen = new Set<string>();
  for (const u of units) {
    const k = `${u.owner}:${u.pos.col}:${u.pos.row}`;
    if (seen.has(k)) throw new Error(`Two heroes share a slot: ${u.id}`);
    if (!inBounds(u.pos)) throw new Error(`Bad slot for ${u.id}`);
    seen.add(k);
  }
  const state: BattleState = {
    units: units.map((u) => {
      const loadout = validLoadout(u);
      return {
        id: u.id,
        owner: u.owner,
        classId: u.classId,
        loadout,
        levels: validLevels(u, loadout),
        hp: heroClass(u.classId).maxHp,
        pos: { ...u.pos },
        // Player 1 moves first; player 2's heroes start a tick later, so the
        // first side gets an opening before the other can react.
        nextAt:
          u.nextAt ?? heroClass(u.classId).recovery + (u.owner === 1 ? 1 : 0),
        moves: 0,
        shielded: false,
        stoneskin: false,
        burning: 0,
        petrified: false,
        rooted: false,
        taunting: false,
        guarding: false,
        weak: false,
        empowered: false,
        marked: false,
      };
    }),
    blocks: [],
    grounds: [],
    queue: [],
    time: 0,
    activeId: null,
    lastSide: 1,
    activations: 0,
    nextSeq: 1,
    winner: null,
  };
  advance(state, []);
  return state;
}

function validLoadout(u: UnitSetup): string[] {
  const c = heroClass(u.classId);
  const loadout = u.loadout ?? [c.primaries[0]!, c.secondaries[0]!];
  const allowed = (id: string, slot: 'primary' | 'secondary') => {
    const a = abilities[id];
    return a !== undefined && a.role === c.role && a.slot === slot;
  };
  const primaries = loadout.filter((a) => allowed(a, 'primary'));
  const secondaries = loadout.filter((a) => allowed(a, 'secondary'));
  if (
    primaries.length > 1 ||
    secondaries.length > 1 ||
    primaries.length + secondaries.length !== loadout.length
  ) {
    throw new Error(
      `${u.id} equips one ${c.role} primary and one ${c.role} secondary`,
    );
  }
  return [...primaries, ...secondaries];
}

function validLevels(u: UnitSetup, loadout: string[]): Record<string, number> {
  const levels = u.levels ?? {};
  let spent = 0;
  for (const [abilityId, level] of Object.entries(levels)) {
    if (!loadout.includes(abilityId)) {
      throw new Error(`${u.id} levels ${abilityId}, which it has not equipped`);
    }
    if (!Number.isInteger(level) || level < 0 || level > 2) {
      throw new Error(`${abilityId} levels go from 0 to 2`);
    }
    spent += level;
  }
  if (spent > upgradePoints) {
    throw new Error(
      `${u.id} spends ${spent} upgrade points of ${upgradePoints}`,
    );
  }
  return { ...levels };
}

const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);
const otherRow = (r: Row): Row => (r === FRONT ? BACK : FRONT);
const sameSlot = (a: Slot, b: Slot) => a.col === b.col && a.row === b.row;
const inBounds = (s: Slot) =>
  s.col >= 0 && s.col < COLUMNS && (s.row === FRONT || s.row === BACK);
export const touching = (a: Slot, b: Slot) =>
  Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1;

export function unitAt(
  state: Pick<BattleState, 'units'>,
  side: PlayerId,
  slot: Slot,
): Unit | undefined {
  return state.units.find(
    (u) => u.owner === side && u.pos && sameSlot(u.pos, slot),
  );
}

export function blockAt(
  state: Pick<BattleState, 'blocks'>,
  side: PlayerId,
  slot: Slot,
): Block | undefined {
  if (slot.row !== FRONT) return undefined;
  return state.blocks.find((b) => b.owner === side && b.col === slot.col);
}

export function groundAt(
  state: Pick<BattleState, 'grounds'>,
  side: PlayerId,
  slot: Slot,
): Ground | undefined {
  return state.grounds.find((g) => g.side === side && sameSlot(g.slot, slot));
}

export function inSmoke(state: Pick<BattleState, 'grounds'>, unit: Unit) {
  return Boolean(
    unit.pos && groundAt(state, unit.owner, unit.pos)?.kind === 'smoke',
  );
}

/** How many of its placer's turns each slot status lasts. */
const groundTurns: Record<GroundKind, number> = {
  fire: 2,
  smoke: 1,
  frost: 2,
  thorns: 2,
  barrier: 1,
};

/**
 * When a hero's next turn really comes: never before its own queued actions
 * have landed, whatever hastes or delays have done to either.
 */
export function turnAt(state: Pick<BattleState, 'queue'>, unit: Unit): number {
  let at = unit.nextAt;
  for (const q of state.queue) if (q.unitId === unit.id && q.at > at) at = q.at;
  return at;
}

export function activeUnit(state: BattleState): Unit | undefined {
  return state.units.find((u) => u.id === state.activeId && u.pos);
}

/**
 * The move-point cost to reach every slot the hero can move to this turn.
 * With one move point that's a neighbouring slot; stepping onto an ally swaps
 * places with it. Rooted or frozen heroes can't move or be swapped, and stone
 * blocks can't be entered.
 */
export function moveCosts(
  state: Pick<BattleState, 'blocks' | 'units' | 'grounds'>,
  unit: Unit,
): Map<string, { slot: Slot; cost: number }> {
  const result = new Map<string, { slot: Slot; cost: number }>();
  const pos = unit.pos;
  if (!pos || unit.rooted || unit.moves <= 0) return result;
  if (frozen(state, unit)) return result;
  const key = (s: Slot) => `${s.col}:${s.row}`;
  const best = new Map([[key(pos), 0]]);
  let frontier = [{ slot: pos, cost: 0 }];
  while (frontier.length) {
    const next: typeof frontier = [];
    for (const { slot, cost } of frontier) {
      const near: Slot[] = [
        { col: slot.col - 1, row: slot.row },
        { col: slot.col + 1, row: slot.row },
        { col: slot.col, row: otherRow(slot.row) },
      ];
      for (const s of near) {
        if (!inBounds(s) || blockAt(state, unit.owner, s)) continue;
        const total = cost + stepCost(state, unit.owner, s);
        if (total > unit.moves) continue;
        if (total >= (best.get(key(s)) ?? Infinity)) continue;
        best.set(key(s), total);
        next.push({ slot: s, cost: total });
      }
    }
    frontier = next;
  }
  for (const [k, cost] of best) {
    if (cost === 0) continue;
    const [col, row] = k.split(':').map(Number) as [number, Row];
    const slot = { col, row };
    const ally = unitAt(state, unit.owner, slot);
    // Allies can be walked past, but only a neighbour can be swapped with.
    if (ally && (ally.rooted || frozen(state, ally) || !touching(pos, slot))) {
      continue;
    }
    result.set(k, {
      slot,
      cost: ally ? stepCost(state, unit.owner, slot) : cost,
    });
  }
  return result;
}

/** Slots the hero can move to this turn (see moveCosts). */
export function moveOptions(
  state: Pick<BattleState, 'blocks' | 'units' | 'grounds'>,
  unit: Unit,
): Slot[] {
  return [...moveCosts(state, unit).values()].map((m) => m.slot);
}

/** Move points a step into `slot` costs. */
export function stepCost(
  _state: Pick<BattleState, 'grounds'>,
  _side: PlayerId,
  _slot: Slot,
): number {
  return 1;
}

/** A hero standing in frost can't move or be swapped until the frost ends. */
export function frozen(state: Pick<BattleState, 'grounds'>, unit: Unit) {
  return Boolean(
    unit.pos && groundAt(state, unit.owner, unit.pos)?.kind === 'frost',
  );
}

/** Which side an ability lands on. */
export function targetSide(
  user: Unit,
  a: AbilityDef,
  aim?: Pick<Aim, 'own'>,
): PlayerId {
  if (aim?.own && a.eitherSide) return user.owner;
  return a.reach === 'self' ||
    a.reach === 'anyAlly' ||
    a.reach === 'adjacentAlly' ||
    a.reach === 'ownFront'
    ? user.owner
    : other(user.owner);
}

/** Every aim the unit could choose for an ability from where it stands now. */
export function aimOptions(
  state: BattleState,
  unit: Unit,
  abilityId: string,
): Aim[] {
  const a = unitAbility(unit, abilityId);
  const pos = unit.pos;
  if (!pos) return [];
  const col = pos.col;
  const aims: Aim[] = [];
  const add = (dc: number, row: Row) => {
    if (inBounds({ col: col + dc, row })) aims.push({ dc, row });
  };
  const front = pos.row === FRONT;
  switch (a.reach) {
    case 'meleeFront':
      if (front) add(0, FRONT);
      break;
    case 'meleeDiagonal':
      if (front) {
        add(-1, FRONT);
        add(1, FRONT);
      }
      break;
    case 'straight':
      add(0, FRONT);
      break;
    case 'backline':
      if (front) for (const dc of [-1, 0, 1]) add(dc, BACK);
      break;
    case 'any':
      for (let c = 0; c < COLUMNS; c++) {
        add(c - col, FRONT);
        add(c - col, BACK);
      }
      if (a.eitherSide) {
        for (let c = 0; c < COLUMNS; c++) {
          for (const row of [FRONT, BACK] as const) {
            if (inBounds({ col: c, row }))
              aims.push({ dc: c - col, row, own: true });
          }
        }
      }
      break;
    case 'enemyRow':
      add(-col, FRONT);
      add(-col, BACK);
      break;
    case 'self':
      add(0, pos.row);
      break;
    case 'anyAlly':
      for (const ally of state.units) {
        if (ally.owner === unit.owner && ally.pos) {
          add(ally.pos.col - col, ally.pos.row);
        }
      }
      break;
    case 'adjacentAlly': {
      const near: Slot[] = [
        { col: col - 1, row: pos.row },
        { col: col + 1, row: pos.row },
        { col, row: otherRow(pos.row) },
      ];
      for (const s of near) {
        if (inBounds(s) && unitAt(state, unit.owner, s)) {
          add(s.col - col, s.row);
        }
      }
      break;
    }
    case 'ownFront':
      for (let c = 0; c < COLUMNS; c++) {
        const s = { col: c, row: FRONT };
        if (!unitAt(state, unit.owner, s) && !blockAt(state, unit.owner, s)) {
          add(c - col, FRONT);
        }
      }
      break;
  }
  return aims;
}

/** The slots an ability's pattern covers for an aim, from the user's current column. */
export function patternSlots(user: Unit, a: AbilityDef, aim: Aim): Slot[] {
  if (!user.pos) return [];
  const c = user.pos.col + aim.dc;
  const r = aim.row;
  if (c < 0 || c >= COLUMNS) return [];
  const cells: Slot[] = {
    single: [{ col: c, row: r }],
    pair: [
      { col: c, row: r },
      { col: c + 1, row: r },
    ],
    column: [
      { col: c, row: FRONT },
      { col: c, row: BACK },
    ],
    row: Array.from({ length: COLUMNS }, (_, i) => ({ col: i, row: r })),
    square: [
      { col: c, row: FRONT },
      { col: c, row: BACK },
      { col: c + 1, row: FRONT },
      { col: c + 1, row: BACK },
    ],
    cross: [
      { col: c, row: r },
      { col: c - 1, row: r },
      { col: c + 1, row: r },
      { col: c, row: otherRow(r) },
    ],
  }[a.pattern];
  return cells.filter(inBounds);
}

/**
 * The slots an ability actually hits now: its pattern, except that straight
 * shots stop at the first hero or stone block in the user's column.
 */
export function targetSlots(
  state: Pick<BattleState, 'units' | 'blocks'>,
  user: Unit,
  a: AbilityDef,
  aim: Aim,
): Slot[] {
  if (a.reach !== 'straight') return patternSlots(user, a, aim);
  if (!user.pos) return [];
  const side = targetSide(user, a, aim);
  const col = user.pos.col;
  for (const row of [FRONT, BACK] as const) {
    const slot = { col, row };
    if (unitAt(state, side, slot) || blockAt(state, side, slot)) return [slot];
  }
  return [{ col, row: BACK }];
}

/** Where a queued action would land right now, and on which side. */
export function actionSlots(
  state: BattleState,
  action: QueuedAction,
): { side: PlayerId; slots: Slot[] } {
  const user = state.units.find((u) => u.id === action.unitId);
  if (!user?.pos) return { side: action.owner, slots: [] };
  const a = unitAbility(user, action.abilityId);
  return {
    side: targetSide(user, a, action),
    slots: targetSlots(state, user, a, action),
  };
}

export type TimelineEntry =
  | { kind: 'hero'; at: number; unitId: string; owner: PlayerId }
  | { kind: 'action'; at: number; action: QueuedAction };

/**
 * Upcoming activations and queued actions, in the order they will happen if
 * nothing changes: actions land before heroes on the same tick, and tied heroes
 * alternate sides, exactly as the engine advances.
 */
export function timeline(state: BattleState): TimelineEntry[] {
  const actions = [...state.queue]
    .sort((x, y) => x.at - y.at || x.seq - y.seq)
    .map((action): TimelineEntry => ({
      kind: 'action',
      at: action.at,
      action,
    }));
  const active = activeUnit(state);
  const waiting = state.units
    .filter((u) => u.pos && u.id !== state.activeId)
    .map((u) => ({ ...u, nextAt: turnAt(state, u) }))
    .sort((x, y) => x.nextAt - y.nextAt);
  const heroes: TimelineEntry[] = active
    ? [{ kind: 'hero', at: state.time, unitId: active.id, owner: active.owner }]
    : [];
  let lastSide = active ? active.owner : state.lastSide;
  while (waiting.length) {
    const soonest = waiting[0]!.nextAt;
    const tied = waiting.filter((u) => u.nextAt === soonest);
    const next = tied.find((u) => u.owner !== lastSide) ?? tied[0]!;
    waiting.splice(waiting.indexOf(next), 1);
    heroes.push({
      kind: 'hero',
      at: next.nextAt,
      unitId: next.id,
      owner: next.owner,
    });
    lastSide = next.owner;
  }
  const merged: TimelineEntry[] = [];
  let h = 0;
  let a = 0;
  if (active) merged.push(heroes[h++]!);
  while (h < heroes.length || a < actions.length) {
    const hero = heroes[h];
    const action = actions[a];
    if (action && (!hero || action.at <= hero.at)) {
      merged.push(action);
      a++;
    } else if (hero) {
      merged.push(hero);
      h++;
    }
  }
  return merged;
}

export function applyCommand(
  state: BattleState,
  command: Command,
): CommandResult {
  if (state.winner !== null) return fail('The battle is over');
  const next = structuredClone(state);
  const events: BattleEvent[] = [];
  const error = run(next, command, events);
  if (error) return fail(error);
  return { ok: true, state: next, events };
}

/**
 * The state right after the active hero queues an action, before the timeline
 * moves on: for previewing where it lands on the timeline and what it shifts.
 */
export function queuePreview(
  state: BattleState,
  command: Extract<Command, { type: 'act' }>,
): BattleState | null {
  const next = structuredClone(state);
  const unit = activeUnit(next);
  if (!unit?.pos || unit.id !== command.unitId) return null;
  const error = queueAction(next, unit, command, []);
  if (error) return null;
  unit.nextAt = next.time + heroClass(unit.classId).recovery;
  next.activeId = null;
  return next;
}

function run(
  state: BattleState,
  command: Command,
  events: BattleEvent[],
): string | null {
  const unit = activeUnit(state);
  if (!unit?.pos || unit.id !== command.unitId) {
    return "It is not this hero's turn";
  }
  const recovery = heroClass(unit.classId).recovery;

  if (command.type === 'move') {
    if (unit.rooted) return 'This hero is rooted';
    if (frozen(state, unit)) return 'This hero is frozen in place';
    const to = command.to;
    const from = unit.pos;
    const option = moveCosts(state, unit).get(`${to.col}:${to.row}`);
    if (!option) return 'That slot is out of reach this turn';
    // Only a neighbouring ally can be the destination, and it swaps; heroes passed on the way stay put.
    const ally = unitAt(state, unit.owner, to);
    unit.moves -= option.cost;
    unit.pos = { ...to };
    events.push({ type: 'moved', unitId: unit.id, from, to });
    stepped(state, unit, events);
    if (ally) {
      ally.pos = { ...from };
      events.push({ type: 'moved', unitId: ally.id, from: to, to: from });
      stepped(state, ally, events);
    }
    checkWinner(state, events);
    if (state.winner === null && !unit.pos) advance(state, events);
    return null;
  }

  if (command.type === 'wait') {
    events.push({ type: 'waited', unitId: unit.id });
    endActivation(state, unit, Math.ceil(recovery / 2), events);
    return null;
  }

  const error = queueAction(state, unit, command, events);
  if (error) return error;
  endActivation(state, unit, recovery, events);
  return null;
}

function queueAction(
  state: BattleState,
  unit: Unit,
  command: Extract<Command, { type: 'act' }>,
  events: BattleEvent[],
): string | null {
  if (inSmoke(state, unit)) return 'Heroes in smoke cannot act';
  if (!unit.loadout.includes(command.abilityId)) return 'Unknown ability';
  const a = unitAbility(unit, command.abilityId);
  const aim = command.aim;
  const valid = aimOptions(state, unit, a.id).some(
    (o) =>
      o.dc === aim.dc &&
      o.row === aim.row &&
      Boolean(o.own) === Boolean(aim.own),
  );
  if (!valid) return 'That target is out of reach';
  const action: QueuedAction = {
    seq: state.nextSeq++,
    owner: unit.owner,
    unitId: unit.id,
    abilityId: a.id,
    dc: aim.dc,
    row: aim.row,
    ...(aim.own ? { own: true } : {}),
    at: state.time + a.speed,
  };
  state.queue.push(action);
  events.push({ type: 'queued', action });
  return null;
}

function endActivation(
  state: BattleState,
  unit: Unit,
  delayTicks: number,
  events: BattleEvent[],
) {
  unit.nextAt = state.time + delayTicks;
  unit.moves = 0;
  unit.rooted = false;
  state.activeId = null;
  advance(state, events);
}

/**
 * Runs the timeline forward: queued actions land in order, and it stops at the
 * next hero's activation. Actions land before heroes on the same tick; tied
 * heroes alternate sides.
 */
function advance(state: BattleState, events: BattleEvent[]) {
  state.activeId = null;
  while (state.winner === null) {
    const living = state.units.filter((u) => u.pos);
    for (const u of living) u.nextAt = turnAt(state, u);
    const nextAction = [...state.queue].sort(
      (x, y) => x.at - y.at || x.seq - y.seq,
    )[0];
    const soonest = Math.min(...living.map((u) => u.nextAt));
    if (nextAction && nextAction.at <= soonest) {
      state.time = Math.max(state.time, nextAction.at);
      state.queue = state.queue.filter((q) => q !== nextAction);
      land(state, nextAction, events);
      checkWinner(state, events);
      continue;
    }
    const tied = living.filter((u) => u.nextAt === soonest);
    const hero = tied.find((u) => u.owner !== state.lastSide) ?? tied[0];
    if (!hero) return;
    state.time = Math.max(state.time, hero.nextAt);
    state.lastSide = hero.owner;
    state.activations++;
    hero.taunting = false;
    hero.guarding = false;
    for (const g of state.grounds) if (g.placerId === hero.id) g.turns--;
    state.grounds = state.grounds.filter((g) => g.turns > 0);
    const underfoot = hero.pos && groundAt(state, hero.owner, hero.pos);
    if (underfoot?.kind === 'fire') {
      events.push({ type: 'groundTriggered', unitId: hero.id, kind: 'fire' });
      hit(state, hero, 1, null, events);
      checkWinner(state, events);
      if (!hero.pos) continue;
    }
    if (hero.burning > 0) {
      hero.burning--;
      events.push({ type: 'burned', unitId: hero.id });
      hit(state, hero, 1, null, events);
      checkWinner(state, events);
      if (!hero.pos) continue;
    }
    if (hero.petrified) {
      hero.petrified = false;
      hero.nextAt = state.time + heroClass(hero.classId).recovery;
      events.push({ type: 'skipped', unitId: hero.id });
      continue;
    }
    state.activeId = hero.id;
    hero.moves = MOVE_POINTS;
    events.push({ type: 'activated', unitId: hero.id, time: state.time });
    return;
  }
}

/** A hero next to `target` who steps in for it (Bodyguard) or pulls the hit (Taunt). */
function protector(
  state: BattleState,
  target: Unit,
  kind: 'guarding' | 'taunting',
) {
  return state.units.find(
    (u) =>
      u.owner === target.owner &&
      u !== target &&
      u[kind] &&
      u.pos &&
      target.pos &&
      touching(u.pos, target.pos),
  );
}

function land(state: BattleState, action: QueuedAction, events: BattleEvent[]) {
  const user = state.units.find((u) => u.id === action.unitId);
  if (!user?.pos) {
    events.push({ type: 'fizzled', seq: action.seq });
    return;
  }
  const a = unitAbility(user, action.abilityId);
  if (
    user.petrified ||
    inSmoke(state, user) ||
    (a.kind === 'melee' && user.pos.row !== FRONT)
  ) {
    events.push({ type: 'fizzled', seq: action.seq });
    return;
  }
  const side = targetSide(user, a, action);
  const cells = targetSlots(state, user, a, action);
  if (cells.length === 0) {
    events.push({ type: 'missed', seq: action.seq });
    return;
  }
  events.push({
    type: 'landed',
    seq: action.seq,
    abilityId: a.id,
    unitId: user.id,
  });
  const damage =
    a.damage > 0
      ? Math.max(0, a.damage - (user.weak ? 1 : 0) + (user.empowered ? 1 : 0))
      : 0;
  const hitIds = new Set<string>();
  let drained = 0;

  if (a.effect === 'twist') {
    // Hit both slots, then the two heroes there trade places.
    const [first, second] = cells;
    const x = first && unitAt(state, side, first);
    const y = second && unitAt(state, side, second);
    for (const u of [x, y])
      if (u) hit(state, u, damage, user, events, { ...a, effect: undefined });
    const target = x?.pos ? x : y?.pos ? y : undefined;
    if (target && first && second) {
      const dest = target === x ? second : first;
      moveTo(state, target, dest, events);
    }
    if (a.damage > 0) {
      user.weak = false;
      user.empowered = false;
    }
    return;
  }

  for (const slot of cells) {
    let target = unitAt(state, side, slot);
    if (target && side !== user.owner && a.pattern === 'single') {
      const guard = protector(state, target, 'guarding');
      if (guard?.pos && target.pos) {
        const from = guard.pos;
        guard.pos = target.pos;
        target.pos = from;
        events.push({
          type: 'guarded',
          unitId: guard.id,
          protectedId: target.id,
        });
        target = guard;
      } else {
        const taunter = protector(state, target, 'taunting');
        if (taunter) {
          events.push({
            type: 'taunted',
            unitId: taunter.id,
            protectedId: target.id,
          });
          target = taunter;
        }
      }
    }

    if (a.ground) {
      state.grounds = state.grounds.filter(
        (g) => !(g.side === side && sameSlot(g.slot, slot)),
      );
      state.grounds.push({
        side,
        slot,
        kind: a.ground,
        placerId: user.id,
        turns: groundTurns[a.ground],
      });
      events.push({ type: 'groundPlaced', side, slot, kind: a.ground });
    }
    if (!target) {
      const block = blockAt(state, side, slot);
      if (block && damage > 0) damageBlock(state, block, damage, events);
      if (a.effect === 'block' && !block) {
        state.blocks.push({ owner: side, col: slot.col, hp: 2 });
        events.push({ type: 'blockRaised', owner: side, col: slot.col });
      }
      continue;
    }
    if (hitIds.has(target.id)) continue;
    hitIds.add(target.id);

    switch (a.effect) {
      case 'shield':
        shield(target, events);
        continue;
      case 'stoneskin':
        shield(target, events);
        target.stoneskin = true;
        continue;
      case 'haste':
        haste(state, target, a.ticks ?? 2, events);
        continue;
      case 'empower':
        target.empowered = true;
        status(target, 'empower', events);
        continue;
      case 'quicken':
        for (const q of state.queue) {
          if (q.unitId === target.id) {
            q.at = Math.max(state.time, q.at - (a.ticks ?? 1));
          }
        }
        events.push({ type: 'hasted', unitId: target.id, ticks: a.ticks ?? 1 });
        continue;
      case 'heal':
        heal(target, a.heal ?? 2, events);
        continue;
      case 'intervene':
        if (target !== user && target.pos)
          moveTo(state, user, target.pos, events);
        continue;
      case 'relocate':
        if (target.pos) {
          displace(
            state,
            target,
            target.pos.row === FRONT ? BACK : FRONT,
            events,
          );
        }
        continue;
      case 'taunt':
        target.taunting = true;
        status(target, 'taunt', events);
        continue;
      case 'guard':
        target.guarding = true;
        status(target, 'guard', events);
        continue;
      case 'block':
        continue;
    }

    const victims = a.effect === 'chain' ? chainFrom(state, target) : [target];
    for (const victim of victims) {
      hitIds.add(victim.id);
      const dealt = hit(state, victim, damage, user, events, a);
      if (dealt === null) continue;
      if (a.effect === 'drain' && dealt > 0) drained++;
    }
  }
  if (a.effect === 'drain' && drained > 0) heal(user, drained, events);
  if (a.damage > 0) {
    user.weak = false;
    user.empowered = false;
  }
  if (a.shieldSelf) shield(user, events);
  if (a.selfHaste) haste(state, user, a.selfHaste, events);
}

/** The target and every hero connected to it through touching slots on its side. */
function chainFrom(state: BattleState, target: Unit): Unit[] {
  const group = [target];
  const seen = new Set([target.id]);
  for (let i = 0; i < group.length; i++) {
    const pos = group[i]!.pos;
    if (!pos) continue;
    const near: Slot[] = [
      { col: pos.col - 1, row: pos.row },
      { col: pos.col + 1, row: pos.row },
      { col: pos.col, row: otherRow(pos.row) },
    ];
    for (const s of near) {
      const u = inBounds(s) ? unitAt(state, target.owner, s) : undefined;
      if (u && !seen.has(u.id)) {
        seen.add(u.id);
        group.push(u);
      }
    }
  }
  return group;
}

/** A shield absorbs the whole hit; Stoneskin also chills the attacker. */
function guarded(unit: Unit, attacker: Unit | null, events: BattleEvent[]) {
  if (!unit.shielded) return false;
  unit.shielded = false;
  events.push({ type: 'shieldBlocked', unitId: unit.id });
  if (unit.stoneskin) {
    unit.stoneskin = false;
    if (attacker?.pos) chill(attacker, 2, events);
  }
  return true;
}

/**
 * One hit from an ability (or a burn tick when `a` is absent). Returns the
 * damage dealt, or null if a shield or stone absorbed it.
 */
function hit(
  state: BattleState,
  unit: Unit,
  baseDamage: number,
  attacker: Unit | null,
  events: BattleEvent[],
  a?: AbilityDef,
): number | null {
  const effect = a?.effect;
  const harmful =
    baseDamage > 0 ||
    effect === 'burn' ||
    effect === 'chill' ||
    effect === 'stun' ||
    effect === 'root' ||
    effect === 'weak' ||
    effect === 'marked' ||
    effect === 'delay' ||
    effect === 'interrupt' ||
    effect === 'push' ||
    effect === 'pull' ||
    effect === 'shove';
  if (!unit.pos || !harmful) return 0;
  if (guarded(unit, attacker, events)) return null;
  if (unit.petrified && baseDamage > 0) {
    unit.petrified = false;
    events.push({ type: 'stoneBroken', unitId: unit.id });
    return null;
  }
  let dealt = 0;
  if (baseDamage > 0) {
    let amount = baseDamage;
    if (unit.marked) {
      amount++;
      unit.marked = false;
    }
    if (unit.pos && groundAt(state, unit.owner, unit.pos)?.kind === 'barrier') {
      amount = Math.max(0, amount - 1);
    }
    if (amount > 0) {
      dealDamage(state, unit, amount, events);
      dealt = amount;
    }
    if (!unit.pos) return dealt;
  }
  switch (effect) {
    case 'burn':
      unit.burning = 2;
      status(unit, 'burn', events);
      break;
    case 'chill':
      chill(unit, a?.ticks ?? 2, events);
      break;
    case 'stun':
      unit.petrified = true;
      cancelActions(state, unit, events);
      status(unit, 'stun', events);
      break;
    case 'root':
      unit.rooted = true;
      status(unit, 'root', events);
      break;
    case 'weak':
      unit.weak = true;
      status(unit, 'weak', events);
      break;
    case 'marked':
      unit.marked = true;
      status(unit, 'marked', events);
      break;
    case 'interrupt':
      cancelActions(state, unit, events);
      break;
    case 'push':
      displace(state, unit, BACK, events);
      break;
    case 'pull':
      displace(state, unit, FRONT, events);
      break;
    case 'shove':
      if (attacker?.pos && unit.pos) {
        // Away from the attacker: across rows in its lane, otherwise sideways.
        if (unit.pos.col === attacker.pos.col) {
          displace(state, unit, unit.pos.row === FRONT ? BACK : FRONT, events);
        } else {
          const dir = unit.pos.col > attacker.pos.col ? 1 : -1;
          moveTo(
            state,
            unit,
            { col: unit.pos.col + dir, row: unit.pos.row },
            events,
          );
        }
      }
      break;
    case 'delay': {
      const ticks = a?.ticks ?? 2;
      for (const q of state.queue) if (q.unitId === unit.id) q.at += ticks;
      events.push({ type: 'delayed', unitId: unit.id, ticks });
      break;
    }
  }
  return dealt;
}

function status(unit: Unit, s: Status, events: BattleEvent[]) {
  events.push({ type: 'statusApplied', unitId: unit.id, status: s });
}

/**
 * Knocks a hero into the other row of its lane (push to the back, pull to the
 * front), swapping with whoever stands there. Rooted or frozen heroes, and a
 * stone block in the way, stop it.
 */
function displace(
  state: BattleState,
  unit: Unit,
  to: Row,
  events: BattleEvent[],
) {
  if (!unit.pos || unit.pos.row === to) return;
  moveTo(state, unit, { col: unit.pos.col, row: to }, events);
}

/**
 * Moves a hero to a slot on its own side, swapping with whoever stands there.
 * Rooted or frozen heroes, stone blocks and the edge of the formation stop it.
 */
function moveTo(
  state: BattleState,
  unit: Unit,
  dest: Slot,
  events: BattleEvent[],
) {
  const from = unit.pos;
  if (!from || !inBounds(dest) || sameSlot(from, dest)) return;
  if (unit.rooted || frozen(state, unit)) return;
  if (blockAt(state, unit.owner, dest)) return;
  const other = unitAt(state, unit.owner, dest);
  if (other && (other.rooted || frozen(state, other))) return;
  unit.pos = { ...dest };
  events.push({ type: 'displaced', unitId: unit.id, from, to: dest });
  stepped(state, unit, events);
  if (other) {
    other.pos = { ...from };
    events.push({ type: 'displaced', unitId: other.id, from: dest, to: from });
    stepped(state, other, events);
  }
}

/** Chill pushes the hero's next activation later. */
function chill(unit: Unit, ticks: number, events: BattleEvent[]) {
  unit.nextAt += ticks;
  events.push({ type: 'delayed', unitId: unit.id, ticks });
  status(unit, 'chill', events);
}

/** Haste brings the hero's next activation sooner, but never into the past. */
function haste(
  state: BattleState,
  unit: Unit,
  ticks: number,
  events: BattleEvent[],
) {
  if (!unit.pos) return;
  const before = unit.nextAt;
  unit.nextAt = Math.max(state.time, unit.nextAt - ticks);
  events.push({ type: 'hasted', unitId: unit.id, ticks: before - unit.nextAt });
  status(unit, 'haste', events);
}

function heal(unit: Unit, amount: number, events: BattleEvent[]) {
  if (!unit.pos) return;
  const max = heroClass(unit.classId).maxHp;
  const healed = Math.min(amount, max - unit.hp);
  if (healed <= 0) return;
  unit.hp += healed;
  events.push({ type: 'healed', unitId: unit.id, amount: healed, hp: unit.hp });
}

function shield(unit: Unit, events: BattleEvent[]) {
  if (!unit.pos) return;
  unit.shielded = true;
  status(unit, 'shield', events);
}

function cancelActions(state: BattleState, unit: Unit, events: BattleEvent[]) {
  for (const q of state.queue) {
    if (q.unitId === unit.id) events.push({ type: 'fizzled', seq: q.seq });
  }
  state.queue = state.queue.filter((q) => q.unitId !== unit.id);
}

function damageBlock(
  state: BattleState,
  block: Block,
  amount: number,
  events: BattleEvent[],
) {
  block.hp -= amount;
  events.push({
    type: 'blockDamaged',
    owner: block.owner,
    col: block.col,
    hp: Math.max(0, block.hp),
  });
  if (block.hp <= 0) state.blocks = state.blocks.filter((b) => b !== block);
}

/** A hero stepped into a slot: fire or thorns there hurt it. */
function stepped(state: BattleState, unit: Unit, events: BattleEvent[]) {
  const pos = unit.pos;
  if (!pos) return;
  const ground = groundAt(state, unit.owner, pos);
  if (!ground) return;
  switch (ground.kind) {
    case 'fire':
    case 'thorns':
      events.push({
        type: 'groundTriggered',
        unitId: unit.id,
        kind: ground.kind,
      });
      hit(state, unit, 1, null, events);
      break;
  }
}

function dealDamage(
  state: BattleState,
  unit: Unit,
  amount: number,
  events: BattleEvent[],
) {
  unit.hp = Math.max(0, unit.hp - amount);
  events.push({ type: 'damaged', unitId: unit.id, amount, hp: unit.hp });
  if (unit.hp > 0) return;
  unit.pos = null;
  unit.shielded = false;
  unit.stoneskin = false;
  unit.burning = 0;
  unit.petrified = false;
  unit.rooted = false;
  unit.taunting = false;
  unit.guarding = false;
  unit.weak = false;
  unit.empowered = false;
  unit.marked = false;
  events.push({ type: 'knockedOut', unitId: unit.id });
  cancelActions(state, unit, events);
  state.grounds = state.grounds.filter((g) => g.placerId !== unit.id);
}

function checkWinner(state: BattleState, events: BattleEvent[]) {
  if (state.winner !== null) return;
  const standing = (p: PlayerId) =>
    state.units.some((u) => u.owner === p && u.pos);
  const a = standing(0);
  const b = standing(1);
  if (a && b) return;
  state.winner = a ? 0 : b ? 1 : 'draw';
  state.activeId = null;
  events.push({ type: 'battleEnded', winner: state.winner });
}

/**
 * What an action would do if it landed now, from current positions. Used for
 * previews; the real result depends on what moves before it lands.
 */
export function previewAction(
  state: BattleState,
  unitId: string,
  abilityId: string,
  aim: Aim,
): { state: BattleState; events: BattleEvent[] } {
  const s = structuredClone(state);
  const user = s.units.find((u) => u.id === unitId);
  const events: BattleEvent[] = [];
  if (user) {
    land(
      s,
      {
        seq: -1,
        owner: user.owner,
        unitId,
        abilityId,
        dc: aim.dc,
        row: aim.row,
        ...(aim.own ? { own: true } : {}),
        at: s.time,
      },
      events,
    );
  }
  return { state: s, events };
}

/**
 * Whether an ability aimed like this would do nothing if it landed right now:
 * no one in its slots and no ground or block to leave behind.
 */
export function hitsNothing(
  state: BattleState,
  unitId: string,
  abilityId: string,
  aim: Aim,
): boolean {
  const idle = new Set(['landed', 'missed', 'fizzled']);
  return previewAction(state, unitId, abilityId, aim).events.every((e) =>
    idle.has(e.type),
  );
}

/** Plain-language summary of an ability as a hero has it. */
export function abilityText(a: AbilityDef): string {
  const where: Record<AbilityDef['reach'], string> = {
    meleeFront: 'Melee, straight ahead',
    meleeDiagonal: 'Melee, diagonally ahead',
    straight: 'Straight shot down its column',
    backline: 'Melee into the back row ahead',
    any: 'Any enemy slot',
    enemyRow: 'A whole enemy row',
    self: 'Self',
    anyAlly: 'Any ally',
    adjacentAlly: 'An adjacent ally',
    ownFront: 'An empty front slot of your own',
  };
  const shape: Partial<Record<AbilityDef['pattern'], string>> = {
    pair: ' and the slot to its right',
    column: ', whole column',
    square: ', 2×2 square',
    cross: ', cross',
  };
  const effects: Record<string, string> = {
    burn: 'burn (1 damage on its next 2 turns)',
    chill: `chill (next turn ${a.ticks ?? 2} later)`,
    stun: 'stun (skips its next turn, cancels its queued action)',
    shield: 'shield (blocks the next hit)',
    root: "root (can't move next turn)",
    weak: 'weaken (its next hit does 1 less)',
    marked: 'mark (the next hit on it does 1 more)',
    chain: 'chains to touching heroes',
    delay: `delays its queued actions by ${a.ticks ?? 2}`,
    haste: `next turn ${a.ticks ?? 2} sooner`,
    interrupt: 'cancels its queued actions',
    push: 'knocks it into the back row',
    pull: 'drags it into the front row',
    shove:
      'shoves it one slot away from you (across rows in your lane, sideways otherwise)',
    twist: 'the two heroes there swap places',
    intervene: 'you swap places with that ally',
    relocate: 'moves the ally to the other row of its lane',
    empower: 'its next hit does 1 more',
    quicken: `its queued actions land ${a.ticks ?? 1} sooner`,
    heal: `heals ${a.heal ?? 2}`,
    drain: 'heals itself 1',
    taunt: 'single attacks on its neighbours hit it instead',
    guard: 'steps in front of a neighbour about to be hit',
    block: 'raises a stone block (2 health)',
    stoneskin: 'shield that chills whoever hits it',
  };
  const parts = [`${where[a.reach]}${shape[a.pattern] ?? ''}`];
  if (a.damage > 0) parts.push(`${a.damage} damage`);
  if (a.effect) parts.push(effects[a.effect]!);
  if (a.ground) {
    parts.push(
      {
        fire: 'leaves fire (1 damage to whoever stands or steps there)',
        smoke: 'leaves smoke (the hero there cannot attack)',
        frost: 'leaves frost (a hero standing there cannot move or be swapped)',
        thorns: 'leaves thorns (anyone stepping in takes 1)',
        barrier: 'leaves a barrier (the hero there takes 1 less damage)',
      }[a.ground],
    );
  }
  if (a.shieldSelf) parts.push('shields itself');
  if (a.eitherSide) parts.push('works on either side');
  if (a.selfHaste) parts.push(`its next turn ${a.selfHaste} sooner`);
  return parts.join(' · ');
}

function fail(error: string): CommandResult {
  return { ok: false, error };
}
