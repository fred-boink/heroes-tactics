import { afterEach, describe, expect, it } from 'vitest';
import {
  abilities,
  actionSlots,
  aimOptions,
  applyCommand,
  BACK,
  createBattle,
  demoBattle,
  FRONT,
  heroClasses,
  hitsNothing,
  queuePreview,
  targetSlots,
  timeline,
  tuning,
  unitAbility,
  type BattleState,
  type Command,
  type Row,
  type UnitSetup,
} from './index';

function play(state: BattleState, ...commands: Command[]) {
  let current = state;
  const events = [];
  for (const command of commands) {
    const result = applyCommand(current, command);
    if (!result.ok) throw new Error(result.error);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

const unit = (state: BattleState, id: string) =>
  state.units.find((u) => u.id === id)!;

/** Health lost so far, so tests don't depend on balance numbers. */
const lost = (state: BattleState, id: string) => {
  const u = unit(state, id);
  return heroClasses[u.classId]!.maxHp - u.hp;
};

const act = (
  unitId: string,
  abilityId: string,
  dc: number,
  row: Row,
): Command => ({
  type: 'act',
  unitId,
  abilityId,
  aim: { dc, row },
});
const wait = (unitId: string): Command => ({ type: 'wait', unitId });
const move = (unitId: string, col: number, row: Row): Command => ({
  type: 'move',
  unitId,
  to: { col, row },
});

const hero = (
  id: string,
  owner: 0 | 1,
  classId: string,
  col: number,
  row: Row,
  nextAt: number,
  loadout?: string[],
  levels?: Record<string, number>,
): UnitSetup => ({
  id,
  owner,
  classId,
  pos: { col, row },
  nextAt,
  ...(loadout ? { loadout } : {}),
  ...(levels ? { levels } : {}),
});

/** A hero far down the timeline, so the battle doesn't end early. */
const bystander = (owner: 0 | 1) =>
  hero(`idle${owner}`, owner, 'knight', 3, BACK, 99);

describe('timeline', () => {
  it('starts with the fastest hero and alternates ties between sides', () => {
    const s = createBattle([
      hero('a', 0, 'knight', 0, FRONT, 2),
      hero('b', 0, 'knight', 1, FRONT, 2),
      hero('x', 1, 'knight', 0, FRONT, 2),
      hero('fast', 1, 'assassin', 1, FRONT, 1),
    ]);
    expect(s.activeId).toBe('fast');
    const order = timeline(s).map((e) => (e.kind === 'hero' ? e.unitId : '?'));
    expect(order).toEqual(['fast', 'a', 'x', 'b']);
  });

  it('waiting comes back after half the recovery, acting after all of it', () => {
    const s = createBattle([
      hero('k', 0, 'knight', 0, FRONT, 1, ['bash', 'taunt']),
      bystander(1),
    ]);
    expect(unit(play(s, wait('k')).state, 'k').nextAt).toBe(1 + 3);
    expect(unit(play(s, act('k', 'taunt', 0, FRONT)).state, 'k').nextAt).toBe(
      6,
    );
  });

  it('previews where a queued action lands before confirming', () => {
    const s = createBattle([
      hero('c', 0, 'crossbowman', 1, BACK, 1, ['bolt', 'heavyBolt']),
      hero('e', 1, 'knight', 1, FRONT, 2),
    ]);
    const preview = queuePreview(s, act('c', 'heavyBolt', 0, FRONT) as never)!;
    const entries = timeline(preview);
    expect(entries[0]).toMatchObject({ kind: 'hero', unitId: 'e' });
    expect(entries[1]).toMatchObject({ kind: 'action', at: 3 });
    expect(s.queue).toHaveLength(0);
  });

  it('demo battle is ready to play', () => {
    expect(demoBattle().activeId).not.toBeNull();
  });
});

describe('movement', () => {
  it('steps one slot, swapping with an ally there', () => {
    const s = createBattle([
      hero('a', 0, 'assassin', 1, BACK, 1),
      hero('k', 0, 'knight', 1, FRONT, 9),
      bystander(1),
    ]);
    const { state } = play(s, move('a', 1, FRONT));
    expect(unit(state, 'a').pos).toEqual({ col: 1, row: FRONT });
    expect(unit(state, 'k').pos).toEqual({ col: 1, row: BACK });
    expect(applyCommand(s, move('a', 3, BACK)).ok).toBe(false);
    expect(applyCommand(s, move('a', 0, FRONT)).ok).toBe(false);
  });

  it('cannot swap with a rooted ally', () => {
    const s = createBattle([
      hero('w', 0, 'warden', 1, FRONT, 1, ['slam', 'entangle']),
      hero('e', 1, 'knight', 1, FRONT, 3),
      hero('e2', 1, 'knight', 2, FRONT, 9),
    ]);
    const { state } = play(s, act('w', 'entangle', 0, FRONT));
    expect(unit(state, 'e').rooted).toBe(true);
    const t = createBattle([
      hero('e2', 1, 'knight', 2, FRONT, 1),
      hero('r', 1, 'knight', 1, FRONT, 9),
      bystander(0),
    ]);
    t.units.find((u) => u.id === 'r')!.rooted = true;
    expect(applyCommand(t, move('e2', 1, FRONT)).ok).toBe(false);
  });
});

describe('reach and line of fire', () => {
  it('melee only works from the front row, straight ahead or diagonally', () => {
    const s = createBattle([
      hero('k', 0, 'knight', 1, FRONT, 1),
      hero('a', 0, 'assassin', 1, BACK, 5),
      bystander(1),
    ]);
    expect(aimOptions(s, unit(s, 'k'), 'bash')).toEqual([
      { dc: 0, row: FRONT },
    ]);
    expect(aimOptions(s, unit(s, 'a'), 'stab')).toEqual([]);
  });

  it('straight shots hit the first thing in the column', () => {
    const s = createBattle([
      hero('c', 0, 'crossbowman', 1, BACK, 1, ['bolt', 'heavyBolt']),
      hero('front', 1, 'knight', 1, FRONT, 9),
      hero('back', 1, 'warlock', 1, BACK, 9),
    ]);
    const c = unit(s, 'c');
    expect(
      targetSlots(s, c, unitAbility(c, 'bolt'), { dc: 0, row: FRONT }),
    ).toEqual([{ col: 1, row: FRONT }]);
    const { state } = play(s, act('c', 'bolt', 0, FRONT));
    expect(lost(state, 'front')).toBe(abilities.bolt!.damage);
    expect(lost(state, 'back')).toBe(0);
  });
});

describe('queued actions', () => {
  it('lock onto their target, so it dodges by moving and a braced hero takes 1 less', () => {
    const setup = () =>
      createBattle([
        hero('c', 0, 'crossbowman', 1, BACK, 1, ['bolt', 'heavyBolt']),
        hero('k', 1, 'knight', 1, FRONT, 2),
        bystander(1),
      ]);
    const braced = play(
      setup(),
      act('c', 'heavyBolt', 0, FRONT),
      wait('k'),
    ).state;
    expect(lost(braced, 'k')).toBe(abilities.heavyBolt!.damage - 1);
    const { state: missed, events } = play(
      setup(),
      act('c', 'heavyBolt', 0, FRONT),
      move('k', 2, FRONT),
      wait('k'),
    );
    expect(lost(missed, 'k')).toBe(0);
    expect(events.some((e) => e.type === 'dodged' && e.unitId === 'k')).toBe(
      true,
    );
  });

  it('spare a hero that steps into the slot after the lock', () => {
    const s = createBattle([
      hero('s', 0, 'stormcaller', 1, BACK, 1, ['spark', 'thunder']),
      hero('a', 1, 'knight', 1, FRONT, 2),
      hero('b', 1, 'knight', 2, FRONT, 2),
      bystander(1),
    ]);
    const { state } = play(
      s,
      act('s', 'thunder', 0, FRONT),
      move('a', 0, FRONT),
      wait('a'),
      move('b', 1, FRONT),
      act('b', 'bodyguard', 0, FRONT),
    );
    expect(lost(state, 'a')).toBe(0);
    expect(lost(state, 'b')).toBe(0);
  });

  it('hit whoever is there when aimed at an empty slot', () => {
    const s = createBattle([
      hero('s', 0, 'stormcaller', 1, BACK, 1, ['spark', 'thunder']),
      hero('b', 1, 'knight', 2, FRONT, 2),
      bystander(1),
    ]);
    const { state } = play(
      s,
      act('s', 'thunder', 0, FRONT),
      move('b', 1, FRONT),
      act('b', 'bodyguard', 0, FRONT),
    );
    expect(lost(state, 'b')).toBe(abilities.thunder!.damage);
  });

  it('stop a direct shot at a hero who steps in front of its target', () => {
    const s = createBattle([
      hero('c', 0, 'crossbowman', 1, BACK, 1, ['bolt', 'heavyBolt']),
      hero('w', 1, 'stormcaller', 1, BACK, 9),
      hero('k', 1, 'knight', 2, FRONT, 2),
      bystander(1),
    ]);
    const { state, events } = play(
      s,
      act('c', 'heavyBolt', 0, FRONT),
      move('k', 1, FRONT),
      act('k', 'bodyguard', 0, FRONT),
    );
    expect(lost(state, 'w')).toBe(0);
    expect(lost(state, 'k')).toBe(abilities.heavyBolt!.damage);
    expect(events.some((e) => e.type === 'bodyBlocked')).toBe(true);
  });

  it('miss when an ally swap moves the attacker off its target', () => {
    const s = createBattle([
      hero('c', 0, 'crossbowman', 1, BACK, 1, ['bolt', 'heavyBolt']),
      hero('ally', 0, 'knight', 2, BACK, 2),
      hero('e', 1, 'knight', 1, FRONT, 9),
      hero('f', 1, 'knight', 2, FRONT, 9),
    ]);
    const queued = play(
      s,
      act('c', 'heavyBolt', 0, FRONT),
      move('ally', 1, BACK),
    ).state;
    expect(actionSlots(queued, queued.queue[0]!).slots).toEqual([
      { col: 2, row: FRONT },
    ]);
    const { state } = play(queued, wait('ally'));
    expect(lost(state, 'f')).toBe(0);
    expect(lost(state, 'e')).toBe(0);
  });

  it('melee fizzles if the attacker ends up in the back row', () => {
    const s = createBattle([
      hero('dk', 0, 'knight', 1, FRONT, 1, ['cleave', 'taunt']),
      hero('ally', 0, 'knight', 1, BACK, 2),
      hero('e', 1, 'knight', 1, FRONT, 9),
    ]);
    const { state, events } = play(
      s,
      act('dk', 'cleave', 0, FRONT),
      move('ally', 1, FRONT),
      wait('ally'),
    );
    expect(events.some((e) => e.type === 'fizzled')).toBe(true);
    expect(lost(state, 'e')).toBe(0);
  });
});

describe('statuses', () => {
  it('chill pushes the next turn later; haste brings it sooner', () => {
    const s = createBattle([
      hero('r', 0, 'ranger', 1, BACK, 1, ['arrow', 'frostArrow']),
      hero('e', 1, 'knight', 1, FRONT, 5),
    ]);
    expect(
      unit(play(s, act('r', 'frostArrow', 0, FRONT)).state, 'e').nextAt,
    ).toBe(7);
    const t = createBattle([
      hero('s', 0, 'stormcaller', 1, BACK, 1, ['spark', 'haste']),
      hero('k', 0, 'knight', 1, FRONT, 6),
      bystander(1),
    ]);
    expect(unit(play(t, act('s', 'haste', 0, FRONT)).state, 'k').nextAt).toBe(
      4,
    );
  });

  it('burn deals 1 at the start of the next two activations', () => {
    const s = createBattle([
      hero('dk', 0, 'deathKnight', 1, FRONT, 1, ['reap', 'dread']),
      hero('e', 1, 'knight', 1, FRONT, 3),
    ]);
    const hit = abilities.reap!.damage;
    const burnt = play(s, act('dk', 'reap', 0, FRONT)).state;
    expect(burnt.activeId).toBe('e');
    expect(lost(burnt, 'e')).toBe(hit + 1);
    const second = play(burnt, wait('e')).state;
    const later = play(second, wait(second.activeId!)).state;
    const last =
      later.activeId === 'e' ? later : play(later, wait(later.activeId!)).state;
    expect(lost(last, 'e')).toBe(hit + 2);
  });

  it('marked takes 1 more; weak deals 1 less', () => {
    const s = createBattle([
      hero('r', 0, 'ranger', 1, BACK, 1, ['arrow', 'huntersMark']),
      hero('e', 1, 'knight', 1, FRONT, 9),
    ]);
    const marked = play(s, act('r', 'huntersMark', 0, FRONT)).state;
    expect(unit(marked, 'e').marked).toBe(true);
    const hit = play(marked, act('r', 'arrow', 0, FRONT)).state;
    expect(lost(hit, 'e')).toBe(2);

    const t = createBattle([
      hero('w', 0, 'warlock', 1, BACK, 1, ['hex', 'ignite']),
      hero('c', 1, 'crossbowman', 1, BACK, 3, ['bolt', 'heavyBolt']),
      hero('k', 0, 'knight', 1, FRONT, 9),
    ]);
    const hexed = play(
      t,
      act('w', 'hex', 0, BACK),
      act('c', 'heavyBolt', 0, FRONT),
    ).state;
    const after = play(hexed, wait(hexed.activeId!)).state;
    expect(lost(after, 'k')).toBe(abilities.heavyBolt!.damage - 1);
  });

  it('stun cancels queued actions and skips the next activation', () => {
    const s = createBattle([
      hero('d', 0, 'druid', 1, BACK, 1, ['thorns', 'petrify']),
      hero('w', 1, 'warlock', 1, BACK, 2, ['fireBolt', 'hellfire']),
      bystander(0),
    ]);
    const { state, events } = play(
      s,
      act('d', 'petrify', 0, BACK),
      act('w', 'hellfire', 0, FRONT),
    );
    expect(state.queue.filter((q) => q.unitId === 'w')).toHaveLength(0);
    expect(events.some((e) => e.type === 'fizzled')).toBe(true);
    const next = play(state, wait(state.activeId!)).events;
    expect(next.some((e) => e.type === 'skipped')).toBe(true);
  });

  it('interrupt cancels queued actions without skipping', () => {
    const s = createBattle([
      hero('a', 0, 'deathKnight', 1, FRONT, 1.5, ['stab', 'kidneyShot']),
      hero('e', 1, 'knight', 1, FRONT, 1, ['cleave', 'taunt']),
    ]);
    const { state, events } = play(
      s,
      act('e', 'cleave', 0, FRONT),
      act('a', 'kidneyShot', 0, FRONT),
    );
    expect(events.some((e) => e.type === 'fizzled')).toBe(true);
    expect(lost(state, 'a')).toBe(0);
  });

  it('drain heals the user', () => {
    const s = createBattle([
      hero('dk', 0, 'deathKnight', 1, FRONT, 1, ['reap', 'drain']),
      hero('e', 1, 'knight', 1, FRONT, 9),
    ]);
    s.units.find((u) => u.id === 'dk')!.hp = 2;
    const { state } = play(s, act('dk', 'drain', 0, FRONT));
    expect(unit(state, 'dk').hp).toBe(3);
  });
});

describe('protecting allies', () => {
  it('bodyguard steps into a threatened neighbour’s slot and takes the hit', () => {
    const s = createBattle([
      hero('k', 0, 'knight', 1, FRONT, 1, ['bash', 'bodyguard']),
      hero('st', 0, 'stormcaller', 1, BACK, 9),
      hero('c', 1, 'crossbowman', 2, BACK, 2, ['aimedShot', 'heavyBolt']),
    ]);
    const { state } = play(
      s,
      act('k', 'bodyguard', 0, FRONT),
      act('c', 'aimedShot', -1, BACK),
    );
    const after = play(state, wait(state.activeId!)).state;
    expect(lost(after, 'st')).toBe(0);
    expect(lost(after, 'k')).toBe(1);
    expect(unit(after, 'k').pos).toEqual({ col: 1, row: BACK });
  });

  it('shield wall lays a barrier on its row: 1 less damage while standing there', () => {
    const s = createBattle([
      hero('k', 0, 'knight', 1, FRONT, 1, ['bash', 'shieldWall']),
      hero('w', 0, 'warden', 2, FRONT, 9),
      hero('c', 1, 'crossbowman', 2, BACK, 3, ['bolt', 'heavyBolt']),
    ]);
    const walled = play(s, act('k', 'shieldWall', 0, FRONT)).state;
    expect(walled.grounds.filter((g) => g.kind === 'barrier')).toHaveLength(4);
    const shot = play(walled, act('c', 'heavyBolt', 0, FRONT)).state;
    const after = play(shot, wait(shot.activeId!)).state;
    expect(lost(after, 'w')).toBe(abilities.heavyBolt!.damage - 1);
  });

  it('a shield absorbs the hit; stoneskin also chills the attacker', () => {
    const s = createBattle([
      hero('d', 0, 'druid', 1, BACK, 1, ['thorns', 'stoneskin']),
      hero('k', 0, 'knight', 1, FRONT, 9),
      hero('e', 1, 'deathKnight', 1, FRONT, 3, ['reap', 'dread']),
    ]);
    const { state } = play(
      s,
      act('d', 'stoneskin', 0, FRONT),
      act('e', 'reap', 0, FRONT),
    );
    expect(lost(state, 'k')).toBe(0);
    expect(unit(state, 'e').nextAt).toBe(3 + 5 + 2);
  });

  it('chain lightning spreads through touching heroes', () => {
    const s = createBattle([
      hero('s', 0, 'stormcaller', 1, BACK, 1, ['chainLightning', 'aegis']),
      hero('a', 1, 'knight', 1, FRONT, 9),
      hero('b', 1, 'knight', 2, FRONT, 9),
      hero('far', 1, 'knight', 0, BACK, 9),
    ]);
    const { state } = play(s, act('s', 'chainLightning', 0, FRONT), wait('s'));
    expect([lost(state, 'a'), lost(state, 'b'), lost(state, 'far')]).toEqual([
      1, 1, 0,
    ]);
  });

  it('dread delays the target’s queued actions', () => {
    const s = createBattle([
      hero('dk', 0, 'deathKnight', 1, FRONT, 1.5, ['reap', 'dread']),
      hero('e', 1, 'crossbowman', 1, FRONT, 1, ['bolt', 'heavyBolt']),
    ]);
    const queued = play(s, act('e', 'heavyBolt', 0, FRONT)).state;
    const { events } = play(queued, act('dk', 'dread', 0, FRONT));
    const delayedAt = events.findIndex((e) => e.type === 'delayed');
    const landedAt = events.findIndex(
      (e) => e.type === 'landed' && e.abilityId === 'heavyBolt',
    );
    expect(delayedAt).toBeGreaterThanOrEqual(0);
    expect(landedAt).toBeGreaterThan(delayedAt);
  });
});

describe('loadouts and levels', () => {
  it('equips one primary and one secondary of its role', () => {
    expect(() =>
      createBattle([hero('k', 0, 'knight', 1, FRONT, 1, ['bash', 'cleave'])]),
    ).toThrow();
    expect(() =>
      createBattle([hero('k', 0, 'knight', 1, FRONT, 1, ['arrow', 'taunt'])]),
    ).toThrow();
  });

  it('levels change the ability and cost one point each', () => {
    const s = createBattle([
      hero('c', 0, 'crossbowman', 1, BACK, 1, ['bolt', 'heavyBolt'], {
        bolt: 1,
      }),
      bystander(1),
    ]);
    const c = unit(s, 'c');
    expect(unitAbility(c, 'bolt').damage).toBe(abilities.bolt!.damage + 1);
    expect(() =>
      createBattle([
        hero('c', 0, 'crossbowman', 1, BACK, 1, ['bolt', 'heavyBolt'], {
          bolt: 2,
          heavyBolt: 1,
        }),
      ]),
    ).toThrow();
  });

  it('only the active hero can act, and only with equipped abilities', () => {
    const s = createBattle([
      hero('k', 0, 'knight', 1, FRONT, 1, ['bash', 'taunt']),
      hero('e', 1, 'knight', 1, FRONT, 5),
    ]);
    expect(applyCommand(s, wait('e')).ok).toBe(false);
    expect(applyCommand(s, act('k', 'cleave', 0, FRONT)).ok).toBe(false);
  });

  it('ends when one side has no heroes standing', () => {
    const s = createBattle([
      hero('c', 0, 'crossbowman', 1, BACK, 1, ['bolt', 'heavyBolt']),
      hero('w', 1, 'warlock', 1, BACK, 9),
    ]);
    const { state } = play(s, act('c', 'heavyBolt', 0, FRONT));
    expect(state.winner).toBe(0);
  });
});

describe('slot statuses', () => {
  it('hellfire leaves fire that hurts whoever starts its turn there', () => {
    const s = createBattle([
      hero('w', 0, 'warlock', 1, BACK, 1, ['fireBolt', 'hellfire']),
      hero('e', 1, 'knight', 1, FRONT, 5),
      bystander(0),
    ]);
    const { state } = play(s, act('w', 'hellfire', 0, FRONT));
    expect(state.grounds.filter((g) => g.kind === 'fire')).toHaveLength(4);
    expect(lost(state, 'e')).toBe(1); // the fire only: no impact damage at level 0
  });

  it('smoke stops the hero standing in it from acting and fizzles its queue', () => {
    const s = createBattle([
      hero('a', 0, 'assassin', 1, FRONT, 1.5, ['throwingKnives', 'smokeBomb']),
      hero('c', 1, 'crossbowman', 0, BACK, 1, ['bolt', 'heavyBolt']),
      hero('k', 0, 'knight', 0, FRONT, 9),
    ]);
    const queued = play(s, act('c', 'heavyBolt', 0, FRONT)).state;
    const { state, events } = play(queued, act('a', 'smokeBomb', -1, BACK));
    expect(events.some((e) => e.type === 'fizzled')).toBe(true);
    expect(lost(state, 'k')).toBe(0);
  });

  it('thorns hurt anyone stepping in; frost costs 2 moves', () => {
    const s = createBattle([
      hero('d', 0, 'druid', 1, BACK, 1, ['thorns', 'petrify'], {
        thorns: 1,
      }),
      hero('e', 1, 'knight', 1, FRONT, 3),
    ]);
    const patched = play(s, act('d', 'thorns', 1, FRONT)).state;
    expect(patched.grounds[0]).toMatchObject({ kind: 'thorns', side: 1 });
    const { state } = play(patched, move('e', 2, FRONT));
    expect(lost(state, 'e')).toBe(1);

    const t = createBattle([
      hero('r', 0, 'ranger', 1, BACK, 1, ['arrow', 'frostArrow'], {
        frostArrow: 2,
      }),
      hero('e', 1, 'knight', 1, FRONT, 5),
    ]);
    const frozen = play(t, act('r', 'frostArrow', 0, FRONT)).state;
    expect(frozen.grounds[0]).toMatchObject({ kind: 'frost', side: 1 });
  });

  it('moves one slot; stepping onto an ally swaps with it', () => {
    const s = createBattle([
      hero('a', 0, 'assassin', 0, FRONT, 1, ['throwingKnives', 'smokeBomb']),
      hero('k', 0, 'knight', 1, FRONT, 9),
      bystander(1),
    ]);
    expect(applyCommand(s, move('a', 2, FRONT)).ok).toBe(false);
    const swapped = play(s, move('a', 1, FRONT)).state;
    expect(unit(swapped, 'a').pos).toEqual({ col: 1, row: FRONT });
    expect(unit(swapped, 'k').pos).toEqual({ col: 0, row: FRONT });
    expect(applyCommand(swapped, move('a', 2, FRONT)).ok).toBe(false);
  });

  it('frost pins the hero standing in it; stone blocks cannot be entered', () => {
    const s = createBattle([
      hero('a', 0, 'assassin', 0, FRONT, 1, ['throwingKnives', 'smokeBomb']),
      hero('k', 0, 'knight', 1, FRONT, 9),
      bystander(1),
    ]);
    const frost = (col: number) => ({
      side: 0 as const,
      slot: { col, row: FRONT },
      kind: 'frost' as const,
      placerId: 'idle1',
      turns: 2,
    });
    s.grounds.push(frost(0));
    expect(applyCommand(s, move('a', 0, BACK)).ok).toBe(false);
    s.grounds = [frost(1)];
    expect(applyCommand(s, move('a', 1, FRONT)).ok).toBe(false);
    s.grounds = [frost(2)];
    s.units.find((u) => u.id === 'k')!.pos = { col: 3, row: FRONT };
    s.units.find((u) => u.id === 'a')!.pos = { col: 1, row: FRONT };
    expect(applyCommand(s, move('a', 2, FRONT)).ok).toBe(true);
    s.grounds = [];
    s.blocks.push({ owner: 0, col: 2, hp: 2 });
    expect(applyCommand(s, move('a', 2, FRONT)).ok).toBe(false);
  });

  it('ignite sets a slot on fire', () => {
    const s = createBattle([
      hero('w', 0, 'warlock', 1, BACK, 1, ['fireBolt', 'ignite']),
      hero('e', 1, 'knight', 1, FRONT, 9),
    ]);
    const { state } = play(s, act('w', 'ignite', 1, FRONT));
    expect(state.grounds[0]).toMatchObject({
      kind: 'fire',
      slot: { col: 2, row: FRONT },
    });
  });

  it('smoke on a slot stops the hero there from attacking', () => {
    const s = createBattle([
      hero('a', 0, 'assassin', 1, FRONT, 1, ['throwingKnives', 'smokeBomb']),
      hero('c', 1, 'crossbowman', 1, BACK, 3, ['bolt', 'heavyBolt']),
    ]);
    const smoked = play(s, act('a', 'smokeBomb', 0, BACK)).state;
    expect(smoked.activeId).toBe('c');
    expect(applyCommand(smoked, act('c', 'bolt', 0, FRONT)).ok).toBe(false);
  });

  it('slot statuses expire after their placer’s turns', () => {
    const s = createBattle([
      hero('w', 0, 'warlock', 1, BACK, 1, ['fireBolt', 'hellfire']),
      bystander(1),
    ]);
    const burning = play(s, act('w', 'hellfire', 0, BACK)).state;
    expect(burning.activeId).toBe('w');
    expect(burning.grounds[0]?.turns).toBe(1);
    expect(play(burning, wait('w')).state.grounds).toHaveLength(0);
  });
});

describe('pushes, pulls and support', () => {
  it('push knocks a front-liner back, swapping with whoever is behind', () => {
    const s = createBattle([
      hero('k', 0, 'knight', 1, FRONT, 1, ['shieldBash', 'taunt']),
      hero('dk', 1, 'deathKnight', 1, FRONT, 9),
      hero('w', 1, 'warlock', 1, BACK, 9),
    ]);
    const { state } = play(s, act('k', 'shieldBash', 0, FRONT));
    expect(unit(state, 'dk').pos).toEqual({ col: 1, row: BACK });
    expect(unit(state, 'w').pos).toEqual({ col: 1, row: FRONT });
  });

  it('pushed heroes carry their queued actions with them', () => {
    const s = createBattle([
      hero('k', 0, 'knight', 1, FRONT, 1.5, ['shieldBash', 'taunt']),
      hero('dk', 1, 'knight', 1, FRONT, 1, ['cleave', 'taunt']),
      bystander(1),
    ]);
    const { state, events } = play(
      s,
      act('dk', 'cleave', 0, FRONT),
      act('k', 'shieldBash', 0, FRONT),
    );
    // Cleave is melee: knocked into the back row before it lands, it fizzles.
    expect(events.some((e) => e.type === 'fizzled')).toBe(true);
    expect(lost(state, 'k')).toBe(0);
  });

  it('frost and roots stop pushes', () => {
    const s = createBattle([
      hero('k', 0, 'knight', 1, FRONT, 1, ['shieldBash', 'taunt']),
      hero('dk', 1, 'deathKnight', 1, FRONT, 9),
    ]);
    s.grounds.push({
      side: 1,
      slot: { col: 1, row: FRONT },
      kind: 'frost',
      placerId: 'k',
      turns: 2,
    });
    const { state } = play(s, act('k', 'shieldBash', 0, FRONT));
    expect(unit(state, 'dk').pos).toEqual({ col: 1, row: FRONT });
  });

  it('hook pulls a back-liner into the front row', () => {
    const s = createBattle([
      hero('dk', 0, 'deathKnight', 1, FRONT, 1, ['hook', 'dread']),
      hero('w', 1, 'warlock', 2, BACK, 9),
    ]);
    const { state } = play(s, act('dk', 'hook', 1, BACK));
    expect(unit(state, 'w').pos).toEqual({ col: 2, row: FRONT });
  });

  it('inspire empowers the next hit; rally quickens queued actions; mend heals', () => {
    const s = createBattle([
      hero('s', 0, 'stormcaller', 0, BACK, 1, ['spark', 'inspire']),
      hero('c', 0, 'crossbowman', 1, BACK, 2, ['bolt', 'heavyBolt']),
      hero('e', 1, 'knight', 1, FRONT, 9),
    ]);
    const { state } = play(
      s,
      act('s', 'inspire', 1, BACK),
      act('c', 'bolt', 0, FRONT),
    );
    expect(lost(state, 'e')).toBe(abilities.bolt!.damage + 1);

    const t = createBattle([
      hero('k', 0, 'knight', 0, FRONT, 2, ['bash', 'rally']),
      hero('c', 0, 'crossbowman', 1, BACK, 1, ['bolt', 'heavyBolt']),
      bystander(1),
    ]);
    const rallied = play(
      t,
      act('c', 'heavyBolt', 0, FRONT),
      act('k', 'rally', 1, BACK),
    ).state;
    expect(rallied.queue.length === 0 || rallied.queue[0]!.at === 2).toBe(true);

    const m = createBattle([
      hero('d', 0, 'druid', 0, BACK, 1, ['thorns', 'mend']),
      hero('k', 0, 'knight', 3, FRONT, 9),
      bystander(1),
    ]);
    m.units.find((u) => u.id === 'k')!.hp = 1;
    expect(unit(play(m, act('d', 'mend', 3, FRONT)).state, 'k').hp).toBe(3);
  });
});

describe('sideways moves and swaps', () => {
  it('trip shoves the target a lane away from the attacker', () => {
    const s = createBattle([
      hero('a', 0, 'deathKnight', 1, FRONT, 1, ['trip', 'dread']),
      hero('e', 1, 'knight', 2, FRONT, 9),
      hero('f', 1, 'knight', 3, FRONT, 9),
    ]);
    const { state } = play(s, act('a', 'trip', 1, FRONT));
    expect(unit(state, 'e').pos).toEqual({ col: 3, row: FRONT });
    expect(unit(state, 'f').pos).toEqual({ col: 2, row: FRONT });
  });

  it('twist swaps two enemies, and their queued attacks go with them', () => {
    const s = createBattle([
      hero('w', 0, 'warlock', 1, BACK, 1, ['fireBolt', 'twist']),
      hero('e', 1, 'knight', 0, FRONT, 9),
      hero('f', 1, 'crossbowman', 1, FRONT, 9),
    ]);
    const { state } = play(s, act('w', 'twist', -1, FRONT), wait('w'));
    expect(unit(state, 'e').pos).toEqual({ col: 1, row: FRONT });
    expect(unit(state, 'f').pos).toEqual({ col: 0, row: FRONT });
  });

  it('intervene swaps the user with any ally; relocate moves an ally between rows', () => {
    const s = createBattle([
      hero('k', 0, 'knight', 0, FRONT, 1, ['bash', 'intervene']),
      hero('c', 0, 'crossbowman', 3, BACK, 9),
      bystander(1),
    ]);
    const { state } = play(s, act('k', 'intervene', 3, BACK));
    expect(unit(state, 'k').pos).toEqual({ col: 3, row: BACK });
    expect(unit(state, 'c').pos).toEqual({ col: 0, row: FRONT });

    const t = createBattle([
      hero('s', 0, 'stormcaller', 0, BACK, 1, ['spark', 'relocate']),
      hero('k', 0, 'knight', 2, FRONT, 9),
      bystander(1),
    ]);
    const moved = play(t, act('s', 'relocate', 2, FRONT)).state;
    expect(unit(moved, 'k').pos).toEqual({ col: 2, row: BACK });
  });
});

describe('moving your own heroes', () => {
  it('gust can shove an ally out of a threatened lane', () => {
    const s = createBattle([
      hero('d', 0, 'druid', 0, BACK, 1, ['thorns', 'gust']),
      hero('k', 0, 'knight', 1, FRONT, 9),
      bystander(1),
    ]);
    const { state } = play(s, {
      type: 'act',
      unitId: 'd',
      abilityId: 'gust',
      aim: { dc: 1, row: FRONT, own: true },
    });
    expect(unit(state, 'k').pos).toEqual({ col: 2, row: FRONT });
  });

  it('twist can swap two of your own heroes', () => {
    const s = createBattle([
      hero('w', 0, 'warlock', 0, BACK, 1, ['fireBolt', 'twist']),
      hero('k', 0, 'knight', 1, FRONT, 9),
      hero('c', 0, 'crossbowman', 2, FRONT, 9),
      bystander(1),
    ]);
    const { state } = play(
      s,
      {
        type: 'act',
        unitId: 'w',
        abilityId: 'twist',
        aim: { dc: 1, row: FRONT, own: true },
      },
      wait('w'),
    );
    expect(unit(state, 'k').pos).toEqual({ col: 2, row: FRONT });
    expect(unit(state, 'c').pos).toEqual({ col: 1, row: FRONT });
  });

  it('damaging pushes stay enemy-only', () => {
    const s = createBattle([
      hero('k', 0, 'knight', 1, FRONT, 1, ['shieldBash', 'taunt']),
      bystander(1),
    ]);
    const own = aimOptions(s, unit(s, 'k'), 'shieldBash').filter((a) => a.own);
    expect(own).toHaveLength(0);
  });
});

describe('turn order', () => {
  it('a hero never gets its turn before its own queued action lands', () => {
    const s = createBattle([
      hero('c', 0, 'crossbowman', 1, FRONT, 1, ['bolt', 'heavyBolt']),
      hero('d', 1, 'deathKnight', 1, FRONT, 1.5, ['reap', 'dread'], {
        dread: 1,
      }),
      bystander(1),
    ]);
    // Heavy Bolt lands at 3; the Crossbowman's next turn would come at 5.
    const queued = play(s, act('c', 'heavyBolt', 0, FRONT)).state;
    // Dread (level 1: 3 ticks) pushes the Heavy Bolt to 6, past that turn, so
    // the turn waits until the bolt has landed.
    const { events } = play(queued, act('d', 'dread', 0, FRONT));
    expect(events).toContainEqual({ type: 'delayed', unitId: 'c', ticks: 3 });
    const landed = events.findIndex(
      (e) => e.type === 'landed' && e.abilityId === 'heavyBolt',
    );
    const turn = events.findIndex(
      (e) => e.type === 'activated' && e.unitId === 'c',
    );
    expect(landed).toBeGreaterThanOrEqual(0);
    expect(landed).toBeLessThan(turn);
  });
});

describe('empty aims', () => {
  it('knows an attack at an empty slot would hit no one yet', () => {
    const s = createBattle([
      hero('k', 0, 'knight', 1, FRONT, 1, ['bash', 'bodyguard']),
      hero('d', 1, 'deathKnight', 0, FRONT, 5),
    ]);
    expect(hitsNothing(s, 'k', 'bash', { dc: 0, row: FRONT })).toBe(true);
    const lined = createBattle([
      hero('k', 0, 'knight', 0, FRONT, 1, ['bash', 'bodyguard']),
      hero('d', 1, 'deathKnight', 0, FRONT, 5),
    ]);
    expect(hitsNothing(lined, 'k', 'bash', { dc: 0, row: FRONT })).toBe(false);
  });
});

describe('scatter shot', () => {
  it('hits the first hero in each lane beside the shooter, not the one ahead', () => {
    const s = createBattle([
      hero('c', 0, 'crossbowman', 1, BACK, 1, ['scatterShot', 'expose']),
      hero('a', 1, 'knight', 0, FRONT, 9),
      hero('e', 1, 'stormcaller', 0, BACK, 9),
      hero('f', 1, 'stormcaller', 2, BACK, 9),
      hero('b', 1, 'knight', 1, FRONT, 9),
      hero('d', 1, 'knight', 2, FRONT, 9),
    ]);
    const c = s.units.find((u) => u.id === 'c')!;
    expect(aimOptions(s, c, 'scatterShot')).toEqual([{ dc: 0, row: FRONT }]);
    const { slots } = actionSlots(s, {
      seq: 0,
      owner: 0,
      unitId: 'c',
      abilityId: 'scatterShot',
      dc: 0,
      row: FRONT,
      at: 3,
      targets: [],
    });
    // The knights in front cover the stormcallers behind them.
    expect(slots).toEqual([
      { col: 0, row: FRONT },
      { col: 2, row: FRONT },
    ]);
  });
});

describe('shot paths', () => {
  it('lets a lob fly over a front-liner that stops a direct shot', () => {
    const s = createBattle([
      hero('c', 0, 'crossbowman', 0, BACK, 1, ['bolt', 'expose']),
      hero('r', 0, 'ranger', 1, BACK, 2, ['arrow', 'frostArrow']),
      hero('k', 1, 'knight', 0, FRONT, 9),
      hero('w', 1, 'stormcaller', 0, BACK, 9),
    ]);
    expect(abilities.bolt!.path).toBe('direct');
    expect(abilities.arrow!.path).toBe('lob');
    const at = (unitId: string, abilityId: string, dc: number, row: Row) =>
      actionSlots(s, {
        seq: 0,
        owner: 0,
        unitId,
        abilityId,
        dc,
        row,
        at: 3,
        targets: [],
      }).slots;
    expect(at('c', 'bolt', 0, FRONT)).toEqual([{ col: 0, row: FRONT }]);
    expect(at('r', 'arrow', -1, BACK)).toEqual([{ col: 0, row: BACK }]);
  });
});

describe('threat answers (prototype A)', () => {
  afterEach(() => {
    tuning.threats = 'lock';
  });

  it('melee follows its target along the front row', () => {
    tuning.threats = 'answers';
    const s = createBattle([
      hero('k', 0, 'knight', 1, FRONT, 1, ['maul', 'bodyguard']),
      hero('e', 1, 'knight', 1, FRONT, 2),
      bystander(1),
    ]);
    const { state } = play(
      s,
      act('k', 'maul', 0, FRONT),
      move('e', 2, FRONT),
      act('e', 'bodyguard', 0, FRONT),
    );
    expect(lost(state, 'e')).toBe(abilities.maul!.damage);
  });

  it('melee misses a target that retreats behind an empty front slot', () => {
    tuning.threats = 'answers';
    const s = createBattle([
      hero('k', 0, 'knight', 1, FRONT, 1, ['maul', 'bodyguard']),
      hero('e', 1, 'knight', 1, FRONT, 2),
      bystander(1),
    ]);
    const { state, events } = play(
      s,
      act('k', 'maul', 0, FRONT),
      move('e', 1, BACK),
      act('e', 'bodyguard', 0, BACK),
    );
    expect(lost(state, 'e')).toBe(0);
    expect(events.some((e) => e.type === 'dodged')).toBe(true);
  });

  it('a lob hits whoever stands in the slot when it lands', () => {
    tuning.threats = 'answers';
    const s = createBattle([
      hero('s', 0, 'stormcaller', 1, BACK, 1, ['spark', 'thunder']),
      hero('a', 1, 'knight', 1, FRONT, 2),
      hero('b', 1, 'knight', 2, FRONT, 2),
      bystander(1),
    ]);
    const { state } = play(
      s,
      act('s', 'thunder', 0, FRONT),
      move('a', 0, FRONT),
      wait('a'),
      move('b', 1, FRONT),
      act('b', 'bodyguard', 0, FRONT),
    );
    expect(lost(state, 'a')).toBe(0);
    expect(lost(state, 'b')).toBe(abilities.thunder!.damage);
  });
});

describe('secret opening (prototype B)', () => {
  it('queues both sides together once both have chosen', () => {
    const s = createBattle(
      [
        hero('c', 0, 'crossbowman', 1, BACK, 1, ['bolt', 'heavyBolt']),
        hero('e', 1, 'knight', 1, FRONT, 2),
      ],
      { opening: true },
    );
    expect(s.opening).toEqual([null, null]);
    expect(applyCommand(s, wait('c')).ok).toBe(false);
    const first = applyCommand(s, {
      type: 'opening',
      owner: 0,
      choices: [{ unitId: 'c', abilityId: 'bolt', aim: { dc: 0, row: FRONT } }],
    });
    if (!first.ok) throw new Error(first.error);
    expect(first.state.queue).toHaveLength(0);
    const both = applyCommand(first.state, {
      type: 'opening',
      owner: 1,
      choices: [{ unitId: 'e', brace: true }],
    });
    if (!both.ok) throw new Error(both.error);
    expect(both.state.opening).toBeNull();
    expect(lost(both.state, 'e')).toBe(abilities.bolt!.damage - 1);
  });
});
