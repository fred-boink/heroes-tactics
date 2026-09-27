import {
  actionSlots,
  timeline,
  type BattleEvent,
  type BattleState,
  type PlayerId,
  type Slot,
} from '@tactics/rules';
import { slotKey, statusIcons } from './game';

/** A short pop-up over a slot when something lands there. */
export interface Floater {
  id: number;
  /** Slot key it floats over. */
  slot: string;
  text: string;
  tone: 'damage' | 'heal' | 'status' | 'miss' | 'block' | 'ko';
  /** Milliseconds to wait, so landings play one after another. */
  delay: number;
  /** Stacks pop-ups that share a slot and a moment. */
  stack: number;
  /** Also flashes the slot, for hits. */
  flash: boolean;
}

/** Time between two landings in the same update. */
export const beatMs = 450;
/** How long one pop-up stays on screen. */
export const floaterMs = 1100;

let nextId = 0;

/**
 * Pop-ups for a batch of events, one beat per landing so the player sees the
 * order things happened in. Positions come from the state before the events,
 * following moves and pushes as they happen.
 */
export function floatersFor(
  before: BattleState,
  events: BattleEvent[],
): Floater[] {
  const where = new Map<string, { side: PlayerId; slot: Slot }>();
  for (const u of before.units) {
    if (u.pos) where.set(u.id, { side: u.owner, slot: u.pos });
  }
  const at = (unitId: string) => {
    const w = where.get(unitId);
    return w ? slotKey(w.side, w.slot) : null;
  };
  const out: Floater[] = [];
  let beat = 0;
  // A new beat only once the current one has shown something.
  const next = () => {
    if (out.some((f) => f.delay === beat * beatMs)) beat++;
  };
  const push = (
    slot: string | null,
    text: string,
    tone: Floater['tone'],
    flash = false,
  ) => {
    if (!slot) return;
    const stack = out.filter(
      (f) => f.slot === slot && f.delay === beat * beatMs,
    ).length;
    out.push({
      id: nextId++,
      slot,
      text,
      tone,
      delay: beat * beatMs,
      stack,
      flash,
    });
  };
  for (const e of events) {
    switch (e.type) {
      case 'landed':
        next();
        break;
      case 'missed': {
        next();
        const q = before.queue.find((x) => x.seq === e.seq);
        if (!q) break;
        const { side, slots } = actionSlots(before, q);
        for (const s of slots) push(slotKey(side, s), 'miss', 'miss');
        break;
      }
      case 'activated':
        // Burn and other turn-start damage comes after the landings.
        next();
        break;
      case 'damaged':
        push(at(e.unitId), `−${e.amount}`, 'damage', true);
        break;
      case 'healed':
        push(at(e.unitId), `+${e.amount}`, 'heal');
        break;
      case 'statusApplied':
        push(at(e.unitId), statusIcons[e.status] ?? e.status, 'status');
        break;
      case 'shieldBlocked':
      case 'stoneBroken':
        push(at(e.unitId), 'blocked', 'block');
        break;
      case 'dodged':
        push(at(e.unitId), 'dodged', 'miss');
        break;
      case 'bodyBlocked':
        push(at(e.unitId), 'blocked!', 'block');
        break;
      case 'knockedOut':
        push(at(e.unitId), 'KO', 'ko', true);
        break;
      case 'moved':
      case 'displaced': {
        const w = where.get(e.unitId);
        if (w) where.set(e.unitId, { side: w.side, slot: e.to });
        break;
      }
    }
  }
  return out;
}

/**
 * Heroes whose turn comes before a queued action lands: the ones who can still
 * react to it.
 */
export function turnsBefore(state: BattleState, seq: number): Set<string> {
  const ids = new Set<string>();
  for (const e of timeline(state)) {
    if (e.kind === 'action' && e.action.seq === seq) break;
    if (e.kind === 'hero') ids.add(e.unitId);
  }
  return ids;
}
